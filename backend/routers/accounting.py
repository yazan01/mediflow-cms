from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from auth import get_current_user, require_roles, generate_id, generate_po_number, sanitize_string

ACCT_ROLES = ("ACCOUNTANT", "SUPER_ADMIN", "CLINIC_MANAGER")
import models

router = APIRouter(prefix="/api/accounting", tags=["accounting"])


class ExpenseCreate(BaseModel):
    date: str
    category: str
    description: str
    amount: float
    vendorId: Optional[str] = None
    paymentMethod: Optional[str] = None
    referenceNo: Optional[str] = None
    isRecurring: Optional[bool] = False
    notes: Optional[str] = None


class AssetCreate(BaseModel):
    name: str
    category: str
    assetCode: Optional[str] = None
    serialNumber: Optional[str] = None
    departmentId: Optional[str] = None
    purchaseDate: Optional[str] = None
    purchasePrice: Optional[float] = None
    currentValue: Optional[float] = None
    location: Optional[str] = None
    warrantyExpiry: Optional[str] = None
    status: Optional[str] = "ACTIVE"
    usefulLifeYears: Optional[int] = 5
    salvageValue: Optional[float] = 0
    notes: Optional[str] = None


class VendorCreate(BaseModel):
    name: str
    contactPerson: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    taxId: Optional[str] = None
    paymentTerms: Optional[str] = None
    notes: Optional[str] = None


class POItemIn(BaseModel):
    itemName: str
    quantity: int
    unitPrice: float
    medicationId: Optional[str] = None
    notes: Optional[str] = None


class PurchaseOrderCreate(BaseModel):
    vendorId: str
    date: str
    expectedDelivery: Optional[str] = None
    items: List[POItemIn]
    notes: Optional[str] = None


# ── Overview ───────────────────────────────────────────────────────────────────

@router.get("/overview")
def get_overview(db: Session = Depends(get_db), _user=Depends(require_roles(*ACCT_ROLES))):
    total_revenue = db.query(func.sum(models.Payment.amount)).scalar() or 0
    total_expenses = db.query(func.sum(models.Expense.amount)).filter(models.Expense.status == "APPROVED").scalar() or 0
    accounts_receivable = db.query(func.sum(models.Invoice.balance)).filter(
        models.Invoice.status.in_(["PENDING", "PARTIAL", "OVERDUE"])
    ).scalar() or 0
    accounts_payable = db.query(func.sum(models.PurchaseOrder.totalAmount)).filter(
        models.PurchaseOrder.status.in_(["SUBMITTED", "APPROVED"])
    ).scalar() or 0

    recent_expenses = db.query(models.Expense).order_by(models.Expense.createdAt.desc()).limit(5).all()
    recent_invoices = db.query(models.Invoice).order_by(models.Invoice.createdAt.desc()).limit(5).all()

    return {
        "totalRevenue": float(total_revenue),
        "totalExpenses": float(total_expenses),
        "netProfit": float(total_revenue) - float(total_expenses),
        "accountsReceivable": float(accounts_receivable),
        "accountsPayable": float(accounts_payable),
        "recentExpenses": [
            {
                "id": e.id,
                "category": e.category,
                "description": e.description,
                "amount": float(e.amount),
                "date": e.date.isoformat() if e.date else None,
                "status": e.status,
            }
            for e in recent_expenses
        ],
        "recentInvoices": [
            {
                "id": i.id,
                "invoiceNo": i.invoiceNo,
                "totalAmount": float(i.totalAmount),
                "balance": float(i.balance),
                "status": i.status,
            }
            for i in recent_invoices
        ],
    }


# ── Assets ─────────────────────────────────────────────────────────────────────

@router.get("/assets")
def get_assets(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    category: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = db.query(models.Asset)
    if search:
        query = query.filter(models.Asset.name.contains(search) | models.Asset.assetCode.contains(search))
    if category and category != "ALL":
        query = query.filter(models.Asset.category == category)
    if status and status != "ALL":
        query = query.filter(models.Asset.status == status)

    total = query.count()
    assets = query.order_by(models.Asset.createdAt.desc()).offset((page - 1) * pageSize).limit(pageSize).all()

    return {
        "data": [
            {
                "id": a.id,
                "name": a.name,
                "assetCode": a.assetCode,
                "category": a.category,
                "serialNumber": a.serialNumber,
                "location": a.location,
                "purchaseDate": a.purchaseDate.isoformat() if a.purchaseDate else None,
                "purchasePrice": float(a.purchasePrice) if a.purchasePrice else None,
                "currentValue": float(a.currentValue) if a.currentValue else None,
                "status": a.status,
                "usefulLifeYears": a.usefulLifeYears,
                "warrantyExpiry": a.warrantyExpiry.isoformat() if a.warrantyExpiry else None,
                "department": {"id": a.department.id, "name": a.department.name} if a.department else None,
            }
            for a in assets
        ],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }


@router.post("/assets", status_code=201)
def create_asset(body: AssetCreate, db: Session = Depends(get_db), _user=Depends(require_roles(*ACCT_ROLES))):
    asset = models.Asset(
        id=generate_id(),
        name=body.name,
        category=body.category,
        assetCode=body.assetCode,
        serialNumber=body.serialNumber,
        departmentId=body.departmentId,
        purchaseDate=datetime.fromisoformat(body.purchaseDate) if body.purchaseDate else None,
        purchasePrice=body.purchasePrice,
        currentValue=body.currentValue or body.purchasePrice,
        location=body.location,
        warrantyExpiry=datetime.fromisoformat(body.warrantyExpiry) if body.warrantyExpiry else None,
        status=body.status or "ACTIVE",
        usefulLifeYears=body.usefulLifeYears or 5,
        salvageValue=body.salvageValue or 0,
        notes=body.notes,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return {"id": asset.id, "name": asset.name, "status": asset.status}


# ── Expenses ───────────────────────────────────────────────────────────────────

@router.get("/expenses")
def get_expenses(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    category: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = db.query(models.Expense)
    if search:
        query = query.filter(models.Expense.description.contains(search))
    if category and category != "ALL":
        query = query.filter(models.Expense.category == category)
    if status and status != "ALL":
        query = query.filter(models.Expense.status == status)

    total = query.count()
    expenses = query.order_by(models.Expense.createdAt.desc()).offset((page - 1) * pageSize).limit(pageSize).all()

    return {
        "data": [
            {
                "id": e.id,
                "date": e.date.isoformat() if e.date else None,
                "category": e.category,
                "description": e.description,
                "amount": float(e.amount),
                "paymentMethod": e.paymentMethod,
                "referenceNo": e.referenceNo,
                "isRecurring": e.isRecurring,
                "status": e.status,
                "vendor": {"name": e.vendor.name} if e.vendor else None,
                "createdAt": e.createdAt.isoformat() if e.createdAt else None,
            }
            for e in expenses
        ],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }


@router.post("/expenses", status_code=201)
def create_expense(body: ExpenseCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(*ACCT_ROLES))):
    try:
        expense_date = datetime.fromisoformat(body.date)
    except (ValueError, TypeError):
        raise HTTPException(422, f"Invalid date format: {body.date!r}")

    expense = models.Expense(
        id=generate_id(),
        date=expense_date,
        category=sanitize_string(body.category),
        description=sanitize_string(body.description),
        amount=body.amount,
        vendorId=body.vendorId,
        paymentMethod=sanitize_string(body.paymentMethod),
        referenceNo=sanitize_string(body.referenceNo),
        isRecurring=body.isRecurring or False,
        recordedById=current_user.id,
        notes=sanitize_string(body.notes),
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return {"id": expense.id, "amount": float(expense.amount), "status": expense.status}


# ── Vendors ────────────────────────────────────────────────────────────────────

@router.get("/vendors")
def get_vendors(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = db.query(models.Vendor).filter(models.Vendor.isActive == True)
    if search:
        query = query.filter(models.Vendor.name.contains(search))

    total = query.count()
    vendors = query.order_by(models.Vendor.name.asc()).offset((page - 1) * pageSize).limit(pageSize).all()

    return {
        "data": [
            {
                "id": v.id,
                "name": v.name,
                "contactPerson": v.contactPerson,
                "phone": v.phone,
                "email": v.email,
                "address": v.address,
                "isPreferred": v.isPreferred,
                "rating": v.rating,
            }
            for v in vendors
        ],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }


@router.post("/vendors", status_code=201)
def create_vendor(body: VendorCreate, db: Session = Depends(get_db), _user=Depends(require_roles(*ACCT_ROLES))):
    vendor = models.Vendor(
        id=generate_id(),
        name=sanitize_string(body.name),
        contactPerson=sanitize_string(body.contactPerson),
        phone=sanitize_string(body.phone),
        email=sanitize_string(body.email),
        address=sanitize_string(body.address),
        taxId=sanitize_string(body.taxId),
        paymentTerms=sanitize_string(body.paymentTerms),
        notes=sanitize_string(body.notes),
    )
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return {"id": vendor.id, "name": vendor.name}


# ── Purchase Orders ────────────────────────────────────────────────────────────

@router.get("/purchase-orders")
def get_purchase_orders(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = db.query(models.PurchaseOrder)
    if status and status != "ALL":
        query = query.filter(models.PurchaseOrder.status == status)

    total = query.count()
    pos = query.order_by(models.PurchaseOrder.createdAt.desc()).offset((page - 1) * pageSize).limit(pageSize).all()

    return {
        "data": [
            {
                "id": po.id,
                "poNumber": po.poNumber,
                "vendorId": po.vendorId,
                "vendor": {"id": po.vendor.id, "name": po.vendor.name} if po.vendor else {"id": "", "name": ""},
                "date": po.date.isoformat() if po.date else None,
                "expectedDelivery": po.expectedDelivery.isoformat() if po.expectedDelivery else None,
                "status": po.status,
                "subtotal": float(po.subtotal),
                "totalAmount": float(po.totalAmount),
                "items": [
                    {
                        "id": item.id,
                        "itemName": item.itemName,
                        "quantity": item.quantity,
                        "unitPrice": float(item.unitPrice),
                        "totalPrice": float(item.totalPrice),
                        "receivedQty": item.receivedQty if hasattr(item, "receivedQty") and item.receivedQty else 0,
                    }
                    for item in (po.items or [])
                ],
            }
            for po in pos
        ],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }


@router.post("/purchase-orders", status_code=201)
def create_purchase_order(
    body: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(*ACCT_ROLES)),
):
    if not body.items:
        raise HTTPException(status_code=400, detail="At least one item is required")

    subtotal = sum(item.quantity * item.unitPrice for item in body.items)

    po = models.PurchaseOrder(
        id=generate_id(),
        poNumber=generate_po_number(db),
        vendorId=body.vendorId,
        date=datetime.fromisoformat(body.date),
        expectedDelivery=datetime.fromisoformat(body.expectedDelivery) if body.expectedDelivery else None,
        subtotal=subtotal,
        totalAmount=subtotal,
        notes=body.notes,
        requestedById=current_user.id,
    )
    db.add(po)
    db.flush()

    for item in body.items:
        db.add(models.POItem(
            id=generate_id(),
            poId=po.id,
            itemName=item.itemName,
            quantity=item.quantity,
            unitPrice=item.unitPrice,
            totalPrice=item.quantity * item.unitPrice,
            medicationId=item.medicationId,
            notes=item.notes,
        ))

    db.commit()
    db.refresh(po)
    return {"id": po.id, "poNumber": po.poNumber, "totalAmount": float(po.totalAmount)}
