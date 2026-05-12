from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func

from database import get_db
from auth import get_current_user, require_roles, generate_id, generate_invoice_no, sanitize_string, log_audit  # noqa: F401

BILLING_ROLES = ("ACCOUNTANT", "SUPER_ADMIN", "CLINIC_MANAGER", "RECEPTIONIST")
import models

router = APIRouter(prefix="/api/billing", tags=["billing"])


VALID_PAYMENT_METHODS = {"CASH", "CARD", "CHECK", "TRANSFER", "INSURANCE", "BANK_TRANSFER", "MOBILE"}


class InvoiceItemIn(BaseModel):
    description: str = Field(..., min_length=1, max_length=500)
    category: Optional[str] = Field(None, max_length=100)
    quantity: int = Field(1, gt=0, le=10000)
    unitPrice: float = Field(..., gt=0)
    discount: Optional[float] = Field(0, ge=0, le=100)
    serviceCode: Optional[str] = Field(None, max_length=50)


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
    insuranceCopayPercent: Optional[float] = Field(None, ge=0, le=100)


VALID_INVOICE_STATUSES = {"PENDING", "PARTIAL", "PAID", "OVERDUE", "CANCELLED", "REFUNDED"}


class InvoiceUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=2000)
    dueDate: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_INVOICE_STATUSES:
            raise ValueError(f"Invalid status. Allowed: {', '.join(sorted(VALID_INVOICE_STATUSES))}")
        return v


class PaymentIn(BaseModel):
    amount: float = Field(..., gt=0)
    method: Optional[str] = Field("CASH", max_length=20)
    referenceNo: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)


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
        "insurancePolicyNo": inv.insurancePolicyNo,
        "insuranceCopayPercent": float(inv.insuranceCopayPercent) if inv.insuranceCopayPercent is not None else None,
        "patientShare": (
            round(float(inv.totalAmount) * float(inv.insuranceCopayPercent) / 100, 2)
            if inv.insuranceClaim and inv.insuranceCopayPercent is not None
            else float(inv.totalAmount)
        ),
        "insuranceShare": (
            round(float(inv.totalAmount) * (1 - float(inv.insuranceCopayPercent) / 100), 2)
            if inv.insuranceClaim and inv.insuranceCopayPercent is not None
            else 0.0
        ),
        "notes": inv.notes,
        "dueDate": inv.dueDate.isoformat() if inv.dueDate else None,
        "createdAt": inv.createdAt.isoformat() if inv.createdAt else None,
        "branchId": inv.branchId,
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
def get_billing_stats(db: Session = Depends(get_db), _user=Depends(require_roles(*BILLING_ROLES))):
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
    _user=Depends(require_roles(*BILLING_ROLES)),
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
    invoices = (
        query
        .options(
            joinedload(models.Invoice.patient),
            joinedload(models.Invoice.items),
            joinedload(models.Invoice.payments),
        )
        .order_by(models.Invoice.createdAt.desc())
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .all()
    )

    return {
        "data": [invoice_to_dict(inv) for inv in invoices],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }


@router.post("", status_code=201)
def create_invoice(body: InvoiceCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(*BILLING_ROLES))):
    if not body.patientId or not body.items:
        raise HTTPException(status_code=400, detail="Patient and at least one item are required")

    patient = db.query(models.Patient).filter(
        models.Patient.id == body.patientId,
        models.Patient.deletedAt == None,  # noqa: E711
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Subtotal accounts for per-item discounts
    subtotal = sum(
        item.quantity * item.unitPrice * (1 - (item.discount or 0) / 100)
        for item in body.items
    )
    discount = body.discountAmount if body.discountAmount is not None else (
        subtotal * (body.discountRate / 100) if body.discountRate else 0
    )
    if discount > subtotal:
        raise HTTPException(status_code=422, detail="Discount amount cannot exceed the invoice subtotal")
    after_discount = subtotal - discount
    tax = after_discount * (body.taxRate / 100) if body.taxRate else 0
    total = after_discount + tax

    invoice = models.Invoice(
        id=generate_id(),
        invoiceNo=generate_invoice_no(db),
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
        insuranceCopayPercent=body.insuranceCopayPercent if body.insuranceClaim else None,
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
    log_audit(db, current_user.id, "CREATE", "BILLING", invoice.id, "Invoice",
              new_values={"invoiceNo": invoice.invoiceNo, "patientId": body.patientId, "totalAmount": float(total)})
    return invoice_to_dict(invoice)


@router.get("/by-appointment/{appointment_id}")
def get_invoice_by_appointment(
    appointment_id: str,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    inv = db.query(models.Invoice).filter(models.Invoice.appointmentId == appointment_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="No invoice for this appointment")
    return invoice_to_dict(inv)


@router.get("/insurance-ar")
def get_insurance_ar(db: Session = Depends(get_db), _user=Depends(require_roles(*BILLING_ROLES))):
    """Per-insurance-company receivables summary: what each insurer owes the clinic."""
    from collections import defaultdict

    invoices = (
        db.query(models.Invoice)
        .options(joinedload(models.Invoice.payments))
        .filter(models.Invoice.insuranceClaim == True)  # noqa: E712
        .all()
    )

    buckets: dict = defaultdict(lambda: {
        "invoiceCount": 0,
        "totalBilled": 0.0,
        "insuranceShare": 0.0,
        "patientShare": 0.0,
        "insuranceCollected": 0.0,
    })

    for inv in invoices:
        name = inv.insuranceProvider or "Unknown"
        d = buckets[name]
        total = float(inv.totalAmount)
        copay = float(inv.insuranceCopayPercent or 0)
        ins_share = round(total * (1 - copay / 100), 2)
        pat_share = round(total * copay / 100, 2)
        ins_collected = sum(
            float(p.amount) for p in (inv.payments or []) if (p.method or "").upper() == "INSURANCE"
        )
        d["invoiceCount"] += 1
        d["totalBilled"] += total
        d["insuranceShare"] += ins_share
        d["patientShare"] += pat_share
        d["insuranceCollected"] += ins_collected

    providers = []
    for name, d in buckets.items():
        outstanding = round(d["insuranceShare"] - d["insuranceCollected"], 2)
        providers.append({
            "providerName": name,
            "invoiceCount": d["invoiceCount"],
            "totalBilled": round(d["totalBilled"], 2),
            "insuranceShare": round(d["insuranceShare"], 2),
            "patientShare": round(d["patientShare"], 2),
            "insuranceCollected": round(d["insuranceCollected"], 2),
            "outstanding": outstanding,
        })

    providers.sort(key=lambda x: x["outstanding"], reverse=True)

    return {
        "providers": providers,
        "totals": {
            "insuranceShare": round(sum(p["insuranceShare"] for p in providers), 2),
            "insuranceCollected": round(sum(p["insuranceCollected"] for p in providers), 2),
            "outstanding": round(sum(p["outstanding"] for p in providers), 2),
        },
    }


@router.get("/{invoice_id}")
def get_invoice(invoice_id: str, db: Session = Depends(get_db), _user=Depends(require_roles(*BILLING_ROLES))):
    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice_to_dict(inv)


@router.patch("/{invoice_id}")
def update_invoice(
    invoice_id: str,
    body: InvoiceUpdate,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*BILLING_ROLES)),
):
    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    updates = body.model_dump(exclude_none=True)
    for field, val in updates.items():
        if field == "dueDate" and val:
            try:
                val = datetime.fromisoformat(val)
            except (ValueError, TypeError):
                raise HTTPException(422, f"Invalid dueDate format: {val!r}")
        setattr(inv, field, val)

    db.commit()
    db.refresh(inv)
    return invoice_to_dict(inv)


@router.post("/{invoice_id}/payments", status_code=201)
def add_payment(
    invoice_id: str,
    body: PaymentIn,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(*BILLING_ROLES)),
):
    inv = (
        db.query(models.Invoice)
        .with_for_update()
        .filter(models.Invoice.id == invoice_id)
        .first()
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if body.method and body.method.upper() not in VALID_PAYMENT_METHODS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid payment method. Allowed: {', '.join(sorted(VALID_PAYMENT_METHODS))}",
        )

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
    log_audit(db, current_user.id, "PAYMENT", "BILLING", invoice_id, "Invoice",
              new_values={"paymentId": payment.id, "amount": body.amount, "method": payment.method,
                          "invoiceNo": inv.invoiceNo, "newStatus": inv.status})
    return {"id": payment.id, "amount": float(payment.amount), "method": payment.method}
