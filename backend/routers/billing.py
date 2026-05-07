from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from database import get_db
from auth import get_current_user, require_roles, generate_id, generate_invoice_no, sanitize_string

BILLING_ROLES = ("ACCOUNTANT", "SUPER_ADMIN", "CLINIC_MANAGER", "RECEPTIONIST")
import models

router = APIRouter(prefix="/api/billing", tags=["billing"])


class InvoiceItemIn(BaseModel):
    description: str
    category: Optional[str] = None
    quantity: int = 1
    unitPrice: float
    discount: Optional[float] = 0
    serviceCode: Optional[str] = None


class InvoiceCreate(BaseModel):
    patientId: str
    appointmentId: Optional[str] = None
    items: List[InvoiceItemIn]
    discountAmount: Optional[float] = None
    discountRate: Optional[float] = None
    taxRate: Optional[float] = None
    notes: Optional[str] = None
    insuranceClaim: Optional[bool] = False
    insuranceProvider: Optional[str] = None
    insurancePolicyNo: Optional[str] = None


class PaymentIn(BaseModel):
    amount: float
    method: Optional[str] = "CASH"
    referenceNo: Optional[str] = None
    notes: Optional[str] = None


def invoice_to_dict(inv: models.Invoice) -> dict:
    return {
        "id": inv.id,
        "invoiceNo": inv.invoiceNo,
        "patientId": inv.patientId,
        "patientName": f"{inv.patient.firstName} {inv.patient.lastName}" if inv.patient else "",
        "patient": {
            "id": inv.patient.id,
            "firstName": inv.patient.firstName,
            "lastName": inv.patient.lastName,
            "mrn": inv.patient.mrn,
        } if inv.patient else None,
        "subtotal": float(inv.subtotal),
        "discountAmount": float(inv.discountAmount or 0),
        "discountRate": float(inv.discountRate) if inv.discountRate else None,
        "taxRate": float(inv.taxRate) if inv.taxRate else None,
        "taxAmount": float(inv.taxAmount or 0),
        "totalAmount": float(inv.totalAmount),
        "paidAmount": float(inv.paidAmount or 0),
        "balance": float(inv.balance),
        "status": inv.status,
        "insuranceClaim": inv.insuranceClaim,
        "insuranceProvider": inv.insuranceProvider,
        "notes": inv.notes,
        "dueDate": inv.dueDate.isoformat() if inv.dueDate else None,
        "createdAt": inv.createdAt.isoformat() if inv.createdAt else None,
        "items": [
            {
                "id": it.id,
                "description": it.description,
                "category": it.category,
                "quantity": it.quantity,
                "unitPrice": float(it.unitPrice),
                "discount": float(it.discount or 0),
                "totalPrice": float(it.totalPrice),
                "serviceCode": it.serviceCode,
            }
            for it in (inv.items or [])
        ],
        "payments": [
            {
                "id": p.id,
                "amount": float(p.amount),
                "method": p.method,
                "referenceNo": p.referenceNo,
                "paidAt": p.paidAt.isoformat() if p.paidAt else None,
            }
            for p in (inv.payments or [])
        ],
    }


@router.get("/stats")
def get_billing_stats(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    from datetime import date
    first_of_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_revenue = db.query(func.sum(models.Payment.amount)).scalar() or 0
    pending_amount = db.query(func.sum(models.Invoice.balance)).filter(
        models.Invoice.status.in_(["PENDING", "PARTIAL"])
    ).scalar() or 0
    overdue_amount = db.query(func.sum(models.Invoice.balance)).filter(
        models.Invoice.status == "OVERDUE"
    ).scalar() or 0
    paid_this_month = db.query(func.sum(models.Payment.amount)).filter(
        models.Payment.paidAt >= first_of_month
    ).scalar() or 0

    return {
        "totalRevenue": float(total_revenue),
        "pendingAmount": float(pending_amount),
        "overdueAmount": float(overdue_amount),
        "paidThisMonth": float(paid_this_month),
    }


@router.get("")
def get_invoices(
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    status: Optional[str] = None,
    search: str = Query(""),
    dateFrom: Optional[str] = None,
    dateTo: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = db.query(models.Invoice)

    if status and status != "ALL":
        query = query.filter(models.Invoice.status == status)

    if search:
        query = query.join(models.Patient).filter(
            or_(
                models.Invoice.invoiceNo.contains(search),
                models.Patient.firstName.contains(search),
                models.Patient.lastName.contains(search),
            )
        )

    if dateFrom:
        try:
            query = query.filter(models.Invoice.createdAt >= datetime.fromisoformat(dateFrom))
        except (ValueError, TypeError):
            raise HTTPException(status_code=422, detail=f"Invalid dateFrom format: {dateFrom!r}")
    if dateTo:
        try:
            query = query.filter(models.Invoice.createdAt <= datetime.fromisoformat(dateTo + "T23:59:59"))
        except (ValueError, TypeError):
            raise HTTPException(status_code=422, detail=f"Invalid dateTo format: {dateTo!r}")

    total = query.count()
    invoices = query.order_by(models.Invoice.createdAt.desc()).offset((page - 1) * pageSize).limit(pageSize).all()

    return {
        "data": [invoice_to_dict(inv) for inv in invoices],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }


@router.post("", status_code=201)
def create_invoice(body: InvoiceCreate, db: Session = Depends(get_db), _user=Depends(require_roles(*BILLING_ROLES))):
    if not body.patientId or not body.items:
        raise HTTPException(status_code=400, detail="Patient and at least one item are required")

    subtotal = sum(item.quantity * item.unitPrice for item in body.items)
    discount = body.discountAmount if body.discountAmount is not None else (
        subtotal * (body.discountRate / 100) if body.discountRate else 0
    )
    after_discount = subtotal - discount
    tax = after_discount * (body.taxRate / 100) if body.taxRate else 0
    total = after_discount + tax

    invoice = models.Invoice(
        id=generate_id(),
        invoiceNo=generate_invoice_no(),
        patientId=body.patientId,
        appointmentId=body.appointmentId,
        subtotal=subtotal,
        discountAmount=discount,
        discountRate=body.discountRate,
        taxAmount=tax,
        taxRate=body.taxRate,
        totalAmount=total,
        paidAmount=0,
        balance=total,
        status="PENDING",
        insuranceClaim=body.insuranceClaim or False,
        insuranceProvider=sanitize_string(body.insuranceProvider),
        insurancePolicyNo=sanitize_string(body.insurancePolicyNo),
        notes=sanitize_string(body.notes),
    )
    db.add(invoice)
    db.flush()

    for item in body.items:
        db.add(models.InvoiceItem(
            id=generate_id(),
            invoiceId=invoice.id,
            description=item.description,
            category=item.category,
            quantity=item.quantity,
            unitPrice=item.unitPrice,
            discount=item.discount or 0,
            totalPrice=item.quantity * item.unitPrice * (1 - (item.discount or 0) / 100),
            serviceCode=item.serviceCode,
        ))

    db.commit()
    db.refresh(invoice)
    return invoice_to_dict(invoice)


@router.get("/{invoice_id}")
def get_invoice(invoice_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice_to_dict(inv)


@router.patch("/{invoice_id}")
def update_invoice(
    invoice_id: str,
    body: dict,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*BILLING_ROLES)),
):
    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    allowed = ["status", "notes", "dueDate"]
    for field in allowed:
        if field in body:
            setattr(inv, field, body[field])

    db.commit()
    db.refresh(inv)
    return invoice_to_dict(inv)


@router.post("/{invoice_id}/payments", status_code=201)
def add_payment(
    invoice_id: str,
    body: PaymentIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if body.amount <= 0:
        raise HTTPException(status_code=422, detail="Payment amount must be greater than zero")

    remaining = float(inv.balance)
    if body.amount > remaining + 0.01:
        raise HTTPException(
            status_code=422,
            detail=f"Payment amount ({body.amount:.3f}) exceeds remaining balance ({remaining:.3f})",
        )

    if inv.status in ("PAID", "CANCELLED", "REFUNDED"):
        raise HTTPException(status_code=422, detail=f"Cannot add payment to a {inv.status.lower()} invoice")

    payment = models.Payment(
        id=generate_id(),
        invoiceId=invoice_id,
        amount=body.amount,
        method=body.method or "CASH",
        referenceNo=body.referenceNo,
        notes=body.notes,
        recordedById=current_user.id,
    )
    db.add(payment)

    new_paid = float(inv.paidAmount or 0) + body.amount
    inv.paidAmount = new_paid
    inv.balance = float(inv.totalAmount) - new_paid

    if inv.balance <= 0:
        inv.status = "PAID"
    elif new_paid > 0:
        inv.status = "PARTIAL"

    db.commit()
    db.refresh(payment)
    return {"id": payment.id, "amount": float(payment.amount), "method": payment.method}
