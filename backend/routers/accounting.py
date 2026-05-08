from datetime import datetime, date, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from database import get_db
from auth import get_current_user, require_roles, generate_id, generate_po_number, sanitize_string, log_audit

ACCT_ROLES = ("ACCOUNTANT", "SUPER_ADMIN", "CLINIC_MANAGER")
import models

router = APIRouter(prefix="/api/accounting", tags=["accounting"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

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


class ExpenseUpdate(BaseModel):
    date: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    vendorId: Optional[str] = None
    paymentMethod: Optional[str] = None
    referenceNo: Optional[str] = None
    isRecurring: Optional[bool] = None
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
    depreciationMethod: Optional[str] = "STRAIGHT_LINE"
    usefulLifeYears: Optional[int] = 5
    salvageValue: Optional[float] = 0
    notes: Optional[str] = None


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    assetCode: Optional[str] = None
    serialNumber: Optional[str] = None
    departmentId: Optional[str] = None
    purchaseDate: Optional[str] = None
    purchasePrice: Optional[float] = None
    currentValue: Optional[float] = None
    location: Optional[str] = None
    warrantyExpiry: Optional[str] = None
    status: Optional[str] = None
    depreciationMethod: Optional[str] = None
    usefulLifeYears: Optional[int] = None
    salvageValue: Optional[float] = None
    notes: Optional[str] = None


class VendorCreate(BaseModel):
    name: str
    contactPerson: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    taxId: Optional[str] = None
    paymentTerms: Optional[str] = None
    bankDetails: Optional[str] = None
    isPreferred: Optional[bool] = False
    notes: Optional[str] = None


class VendorUpdate(BaseModel):
    name: Optional[str] = None
    contactPerson: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    taxId: Optional[str] = None
    paymentTerms: Optional[str] = None
    bankDetails: Optional[str] = None
    rating: Optional[int] = None
    isPreferred: Optional[bool] = None
    isActive: Optional[bool] = None
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


class POReceiveItem(BaseModel):
    itemId: str
    receivedQty: int


class POReceive(BaseModel):
    items: List[POReceiveItem]
    notes: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _po_dict(po: models.PurchaseOrder) -> dict:
    return {
        "id": po.id,
        "poNumber": po.poNumber,
        "vendorId": po.vendorId,
        "vendor": {"id": po.vendor.id, "name": po.vendor.name, "phone": po.vendor.phone, "email": po.vendor.email} if po.vendor else None,
        "date": po.date.isoformat() if po.date else None,
        "expectedDelivery": po.expectedDelivery.isoformat() if po.expectedDelivery else None,
        "status": po.status,
        "subtotal": float(po.subtotal),
        "totalAmount": float(po.totalAmount),
        "notes": po.notes,
        "approvedAt": po.approvedAt.isoformat() if po.approvedAt else None,
        "receivedAt": po.receivedAt.isoformat() if po.receivedAt else None,
        "createdAt": po.createdAt.isoformat() if po.createdAt else None,
        "items": [
            {
                "id": item.id,
                "itemName": item.itemName,
                "quantity": item.quantity,
                "unitPrice": float(item.unitPrice),
                "totalPrice": float(item.totalPrice),
                "receivedQty": item.receivedQty or 0,
                "notes": item.notes,
            }
            for item in (po.items or [])
        ],
    }


def _asset_dict(a: models.Asset) -> dict:
    return {
        "id": a.id,
        "name": a.name,
        "assetCode": a.assetCode,
        "category": a.category,
        "serialNumber": a.serialNumber,
        "location": a.location,
        "purchaseDate": a.purchaseDate.isoformat() if a.purchaseDate else None,
        "purchasePrice": float(a.purchasePrice) if a.purchasePrice else None,
        "currentValue": float(a.currentValue) if a.currentValue else None,
        "salvageValue": float(a.salvageValue) if a.salvageValue else 0,
        "usefulLifeYears": a.usefulLifeYears,
        "depreciationMethod": a.depreciationMethod,
        "status": a.status,
        "warrantyExpiry": a.warrantyExpiry.isoformat() if a.warrantyExpiry else None,
        "notes": a.notes,
        "department": {"id": a.department.id, "name": a.department.name} if a.department else None,
        "createdAt": a.createdAt.isoformat() if a.createdAt else None,
    }


def _expense_dict(e: models.Expense) -> dict:
    return {
        "id": e.id,
        "date": e.date.isoformat() if e.date else None,
        "category": e.category,
        "description": e.description,
        "amount": float(e.amount),
        "paymentMethod": e.paymentMethod,
        "referenceNo": e.referenceNo,
        "isRecurring": e.isRecurring,
        "status": e.status,
        "notes": e.notes,
        "vendor": {"id": e.vendor.id, "name": e.vendor.name} if e.vendor else None,
        "approvedAt": e.approvedAt.isoformat() if e.approvedAt else None,
        "approvedBy": {"name": e.approvedBy.name} if e.approvedBy else None,
        "createdAt": e.createdAt.isoformat() if e.createdAt else None,
    }


# ── Overview ──────────────────────────────────────────────────────────────────

@router.get("/overview")
def get_overview(db: Session = Depends(get_db), _user=Depends(require_roles(*ACCT_ROLES))):
    today = datetime.now()
    month_start = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_revenue = db.query(func.sum(models.Payment.amount)).scalar() or 0
    monthly_revenue = db.query(func.sum(models.Payment.amount)).filter(
        models.Payment.paidAt >= month_start
    ).scalar() or 0

    total_expenses = db.query(func.sum(models.Expense.amount)).filter(
        models.Expense.status == "APPROVED"
    ).scalar() or 0
    monthly_expenses = db.query(func.sum(models.Expense.amount)).filter(
        models.Expense.status == "APPROVED",
        models.Expense.date >= month_start,
    ).scalar() or 0

    accounts_receivable = db.query(func.sum(models.Invoice.balance)).filter(
        models.Invoice.status.in_(["PENDING", "PARTIAL", "OVERDUE"])
    ).scalar() or 0

    accounts_payable = db.query(func.sum(models.PurchaseOrder.totalAmount)).filter(
        models.PurchaseOrder.status.in_(["SUBMITTED", "APPROVED"])
    ).scalar() or 0

    pending_expenses = db.query(func.count(models.Expense.id)).filter(
        models.Expense.status == "PENDING"
    ).scalar() or 0

    overdue_invoices = db.query(func.count(models.Invoice.id)).filter(
        models.Invoice.status == "OVERDUE"
    ).scalar() or 0

    recent_expenses = db.query(models.Expense).order_by(models.Expense.createdAt.desc()).limit(5).all()
    recent_invoices = db.query(models.Invoice).order_by(models.Invoice.createdAt.desc()).limit(5).all()

    # Revenue trend: last 6 months
    revenue_trend = []
    for i in range(5, -1, -1):
        m_start = (today.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
        if i > 0:
            m_end = (m_start.replace(day=28) + timedelta(days=4)).replace(day=1)
        else:
            m_end = today
        rev = db.query(func.sum(models.Payment.amount)).filter(
            models.Payment.paidAt >= m_start,
            models.Payment.paidAt < m_end,
        ).scalar() or 0
        exp = db.query(func.sum(models.Expense.amount)).filter(
            models.Expense.status == "APPROVED",
            models.Expense.date >= m_start,
            models.Expense.date < m_end,
        ).scalar() or 0
        revenue_trend.append({
            "month": m_start.strftime("%b %Y"),
            "revenue": float(rev),
            "expenses": float(exp),
        })

    return {
        "totalRevenue": float(total_revenue),
        "monthlyRevenue": float(monthly_revenue),
        "totalExpenses": float(total_expenses),
        "monthlyExpenses": float(monthly_expenses),
        "netProfit": float(total_revenue) - float(total_expenses),
        "monthlyNetProfit": float(monthly_revenue) - float(monthly_expenses),
        "accountsReceivable": float(accounts_receivable),
        "accountsPayable": float(accounts_payable),
        "pendingExpenses": int(pending_expenses),
        "overdueInvoices": int(overdue_invoices),
        "revenueTrend": revenue_trend,
        "recentExpenses": [_expense_dict(e) for e in recent_expenses],
        "recentInvoices": [
            {
                "id": i.id,
                "invoiceNo": i.invoiceNo,
                "totalAmount": float(i.totalAmount),
                "balance": float(i.balance),
                "status": i.status,
                "createdAt": i.createdAt.isoformat() if i.createdAt else None,
            }
            for i in recent_invoices
        ],
    }


# ── Reports ───────────────────────────────────────────────────────────────────

@router.get("/reports/profit-loss")
def profit_loss_report(
    from_date: str = Query(...),
    to_date: str = Query(...),
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*ACCT_ROLES)),
):
    try:
        d_from = datetime.fromisoformat(from_date)
        d_to = datetime.fromisoformat(to_date).replace(hour=23, minute=59, second=59)
    except ValueError:
        raise HTTPException(422, "Invalid date format — use YYYY-MM-DD")

    # Revenue by payment method
    revenue_rows = db.query(
        models.Payment.method,
        func.sum(models.Payment.amount).label("total")
    ).filter(
        models.Payment.paidAt >= d_from,
        models.Payment.paidAt <= d_to,
    ).group_by(models.Payment.method).all()
    total_revenue = sum(float(r.total) for r in revenue_rows)

    # Expenses by category
    expense_rows = db.query(
        models.Expense.category,
        func.sum(models.Expense.amount).label("total")
    ).filter(
        models.Expense.status == "APPROVED",
        models.Expense.date >= d_from,
        models.Expense.date <= d_to,
    ).group_by(models.Expense.category).all()
    total_expenses = sum(float(r.total) for r in expense_rows)

    return {
        "period": {"from": from_date, "to": to_date},
        "revenue": {
            "total": total_revenue,
            "breakdown": [{"method": r.method or "CASH", "amount": float(r.total)} for r in revenue_rows],
        },
        "expenses": {
            "total": total_expenses,
            "breakdown": [{"category": r.category, "amount": float(r.total)} for r in expense_rows],
        },
        "grossProfit": total_revenue - total_expenses,
        "grossProfitMargin": round((total_revenue - total_expenses) / total_revenue * 100, 2) if total_revenue else 0,
    }


@router.get("/reports/ar-aging")
def ar_aging_report(db: Session = Depends(get_db), _user=Depends(require_roles(*ACCT_ROLES))):
    today = datetime.now()
    invoices = db.query(models.Invoice).options(
        joinedload(models.Invoice.patient)
    ).filter(
        models.Invoice.status.in_(["PENDING", "PARTIAL", "OVERDUE"]),
        models.Invoice.balance > 0,
    ).all()

    buckets = {"current": [], "1_30": [], "31_60": [], "61_90": [], "over_90": []}

    for inv in invoices:
        ref_date = inv.dueDate or inv.createdAt or today
        age = (today - ref_date).days
        entry = {
            "invoiceNo": inv.invoiceNo,
            "patient": f"{inv.patient.firstName} {inv.patient.lastName}" if inv.patient else "",
            "totalAmount": float(inv.totalAmount),
            "balance": float(inv.balance),
            "dueDate": ref_date.isoformat() if ref_date else None,
            "status": inv.status,
            "ageDays": age,
        }
        if age <= 0:
            buckets["current"].append(entry)
        elif age <= 30:
            buckets["1_30"].append(entry)
        elif age <= 60:
            buckets["31_60"].append(entry)
        elif age <= 90:
            buckets["61_90"].append(entry)
        else:
            buckets["over_90"].append(entry)

    def bucket_total(items):
        return round(sum(i["balance"] for i in items), 2)

    return {
        "summary": {
            "current": {"count": len(buckets["current"]), "total": bucket_total(buckets["current"])},
            "days1_30": {"count": len(buckets["1_30"]), "total": bucket_total(buckets["1_30"])},
            "days31_60": {"count": len(buckets["31_60"]), "total": bucket_total(buckets["31_60"])},
            "days61_90": {"count": len(buckets["61_90"]), "total": bucket_total(buckets["61_90"])},
            "over90": {"count": len(buckets["over_90"]), "total": bucket_total(buckets["over_90"])},
            "grandTotal": round(sum(bucket_total(v) for v in buckets.values()), 2),
        },
        "detail": buckets,
    }


@router.get("/reports/ap-aging")
def ap_aging_report(db: Session = Depends(get_db), _user=Depends(require_roles(*ACCT_ROLES))):
    today = datetime.now()
    pos = db.query(models.PurchaseOrder).options(
        joinedload(models.PurchaseOrder.vendor)
    ).filter(
        models.PurchaseOrder.status.in_(["SUBMITTED", "APPROVED", "PARTIALLY_RECEIVED"])
    ).all()

    buckets = {"current": [], "1_30": [], "31_60": [], "61_90": [], "over_90": []}

    for po in pos:
        ref_date = po.expectedDelivery or po.date or today
        age = (today - ref_date).days
        entry = {
            "poNumber": po.poNumber,
            "vendor": po.vendor.name if po.vendor else "",
            "totalAmount": float(po.totalAmount),
            "status": po.status,
            "expectedDelivery": ref_date.isoformat() if ref_date else None,
            "ageDays": age,
        }
        if age <= 0:
            buckets["current"].append(entry)
        elif age <= 30:
            buckets["1_30"].append(entry)
        elif age <= 60:
            buckets["31_60"].append(entry)
        elif age <= 90:
            buckets["61_90"].append(entry)
        else:
            buckets["over_90"].append(entry)

    def bucket_total(items):
        return round(sum(i["totalAmount"] for i in items), 2)

    return {
        "summary": {
            "current": {"count": len(buckets["current"]), "total": bucket_total(buckets["current"])},
            "days1_30": {"count": len(buckets["1_30"]), "total": bucket_total(buckets["1_30"])},
            "days31_60": {"count": len(buckets["31_60"]), "total": bucket_total(buckets["31_60"])},
            "days61_90": {"count": len(buckets["61_90"]), "total": bucket_total(buckets["61_90"])},
            "over90": {"count": len(buckets["over_90"]), "total": bucket_total(buckets["over_90"])},
            "grandTotal": round(sum(bucket_total(v) for v in buckets.values()), 2),
        },
        "detail": buckets,
    }


@router.get("/reports/cash-flow")
def cash_flow_report(
    from_date: str = Query(...),
    to_date: str = Query(...),
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*ACCT_ROLES)),
):
    try:
        d_from = datetime.fromisoformat(from_date)
        d_to = datetime.fromisoformat(to_date).replace(hour=23, minute=59, second=59)
    except ValueError:
        raise HTTPException(422, "Invalid date format")

    # Operating inflows: payments received
    inflows = float(db.query(func.sum(models.Payment.amount)).filter(
        models.Payment.paidAt >= d_from, models.Payment.paidAt <= d_to,
    ).scalar() or 0)

    # Operating outflows: approved expenses paid in period
    outflows = float(db.query(func.sum(models.Expense.amount)).filter(
        models.Expense.status == "APPROVED",
        models.Expense.date >= d_from, models.Expense.date <= d_to,
    ).scalar() or 0)

    # Investing: asset purchases in period
    asset_purchases = float(db.query(func.sum(models.Asset.purchasePrice)).filter(
        models.Asset.purchaseDate >= d_from, models.Asset.purchaseDate <= d_to,
    ).scalar() or 0)

    # PO payments (committed payables)
    po_committed = float(db.query(func.sum(models.PurchaseOrder.totalAmount)).filter(
        models.PurchaseOrder.status == "COMPLETED",
        models.PurchaseOrder.receivedAt >= d_from, models.PurchaseOrder.receivedAt <= d_to,
    ).scalar() or 0)

    net_operating = inflows - outflows
    net_investing = -(asset_purchases + po_committed)
    net_cash = net_operating + net_investing

    return {
        "period": {"from": from_date, "to": to_date},
        "operating": {
            "inflows": inflows,
            "outflows": outflows,
            "net": net_operating,
        },
        "investing": {
            "assetPurchases": asset_purchases,
            "poPayments": po_committed,
            "net": net_investing,
        },
        "netCashFlow": net_cash,
    }


# ── Assets ────────────────────────────────────────────────────────────────────

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
        "data": [_asset_dict(a) for a in assets],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }


@router.get("/assets/{asset_id}")
def get_asset(asset_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    a = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not a:
        raise HTTPException(404, "Asset not found")
    return _asset_dict(a)


@router.post("/assets", status_code=201)
def create_asset(body: AssetCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(*ACCT_ROLES))):
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
        depreciationMethod=body.depreciationMethod or "STRAIGHT_LINE",
        usefulLifeYears=body.usefulLifeYears or 5,
        salvageValue=body.salvageValue or 0,
        notes=body.notes,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    log_audit(db, current_user.id, "CREATE", "Asset", asset.id, {"name": asset.name})
    return _asset_dict(asset)


@router.patch("/assets/{asset_id}")
def update_asset(asset_id: str, body: AssetUpdate, db: Session = Depends(get_db), current_user=Depends(require_roles(*ACCT_ROLES))):
    a = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not a:
        raise HTTPException(404, "Asset not found")

    for field, val in body.model_dump(exclude_none=True).items():
        if field == "purchaseDate" and val:
            val = datetime.fromisoformat(val)
        elif field == "warrantyExpiry" and val:
            val = datetime.fromisoformat(val)
        setattr(a, field, val)

    db.commit()
    db.refresh(a)
    log_audit(db, current_user.id, "UPDATE", "Asset", a.id, {})
    return _asset_dict(a)


@router.get("/assets/{asset_id}/depreciation")
def asset_depreciation_schedule(asset_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    a = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not a:
        raise HTTPException(404, "Asset not found")
    if not a.purchasePrice or not a.purchaseDate:
        raise HTTPException(400, "Asset must have a purchase price and date for depreciation calculation")

    cost = float(a.purchasePrice)
    salvage = float(a.salvageValue) if a.salvageValue else 0
    life = a.usefulLifeYears or 5
    method = a.depreciationMethod or "STRAIGHT_LINE"
    start_year = a.purchaseDate.year

    schedule = []
    book_value = cost

    for yr in range(1, life + 1):
        if method == "DECLINING_BALANCE":
            rate = 2 / life  # double declining balance
            dep = round(book_value * rate, 2)
            if book_value - dep < salvage:
                dep = max(0, book_value - salvage)
        else:  # STRAIGHT_LINE
            dep = round((cost - salvage) / life, 2)

        book_value = round(book_value - dep, 2)
        book_value = max(book_value, salvage)

        schedule.append({
            "year": start_year + yr,
            "depreciation": dep,
            "accumulatedDepreciation": round(cost - book_value, 2),
            "bookValue": book_value,
        })

    return {
        "assetId": a.id,
        "assetName": a.name,
        "cost": cost,
        "salvageValue": salvage,
        "usefulLifeYears": life,
        "depreciationMethod": method,
        "schedule": schedule,
        "totalDepreciation": round(cost - salvage, 2),
    }


# ── Expenses ──────────────────────────────────────────────────────────────────

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

    return {"data": [_expense_dict(e) for e in expenses], "total": total, "page": page, "pageSize": pageSize}


@router.get("/expenses/{expense_id}")
def get_expense(expense_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    e = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not e:
        raise HTTPException(404, "Expense not found")
    return _expense_dict(e)


@router.post("/expenses", status_code=201)
def create_expense(body: ExpenseCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(*ACCT_ROLES))):
    try:
        expense_date = datetime.fromisoformat(body.date)
    except (ValueError, TypeError):
        raise HTTPException(422, f"Invalid date: {body.date!r}")

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
    log_audit(db, current_user.id, "CREATE", "Expense", expense.id, {"amount": float(expense.amount)})
    return _expense_dict(expense)


@router.patch("/expenses/{expense_id}")
def update_expense(expense_id: str, body: ExpenseUpdate, db: Session = Depends(get_db), current_user=Depends(require_roles(*ACCT_ROLES))):
    e = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not e:
        raise HTTPException(404, "Expense not found")
    if e.status == "APPROVED":
        raise HTTPException(409, "Approved expenses cannot be edited")

    data = body.model_dump(exclude_none=True)
    if "date" in data:
        data["date"] = datetime.fromisoformat(data["date"])
    for k, v in data.items():
        setattr(e, k, v)

    db.commit()
    db.refresh(e)
    log_audit(db, current_user.id, "UPDATE", "Expense", e.id, {})
    return _expense_dict(e)


@router.post("/expenses/{expense_id}/approve")
def approve_expense(expense_id: str, db: Session = Depends(get_db), current_user=Depends(require_roles(*ACCT_ROLES))):
    e = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not e:
        raise HTTPException(404, "Expense not found")
    if e.status != "PENDING":
        raise HTTPException(409, f"Cannot approve expense with status {e.status}")

    e.status = "APPROVED"
    e.approvedById = current_user.id
    e.approvedAt = datetime.now()
    db.commit()
    log_audit(db, current_user.id, "APPROVE", "Expense", e.id, {"amount": float(e.amount)})
    return _expense_dict(e)


@router.post("/expenses/{expense_id}/reject")
def reject_expense(expense_id: str, db: Session = Depends(get_db), current_user=Depends(require_roles(*ACCT_ROLES))):
    e = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not e:
        raise HTTPException(404, "Expense not found")
    if e.status not in ("PENDING",):
        raise HTTPException(409, f"Cannot reject expense with status {e.status}")

    e.status = "REJECTED"
    db.commit()
    log_audit(db, current_user.id, "REJECT", "Expense", e.id, {})
    return _expense_dict(e)


# ── Vendors ───────────────────────────────────────────────────────────────────

@router.get("/vendors")
def get_vendors(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    includeInactive: bool = Query(False),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = db.query(models.Vendor)
    if not includeInactive:
        query = query.filter(models.Vendor.isActive == True)  # noqa: E712
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
                "taxId": v.taxId,
                "paymentTerms": v.paymentTerms,
                "bankDetails": v.bankDetails,
                "isPreferred": v.isPreferred,
                "isActive": v.isActive,
                "rating": v.rating,
                "notes": v.notes,
            }
            for v in vendors
        ],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }


@router.get("/vendors/{vendor_id}")
def get_vendor(vendor_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    v = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not v:
        raise HTTPException(404, "Vendor not found")
    recent_pos = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.vendorId == vendor_id
    ).order_by(models.PurchaseOrder.createdAt.desc()).limit(5).all()
    return {
        "id": v.id, "name": v.name, "contactPerson": v.contactPerson,
        "phone": v.phone, "email": v.email, "address": v.address,
        "taxId": v.taxId, "paymentTerms": v.paymentTerms, "bankDetails": v.bankDetails,
        "isPreferred": v.isPreferred, "isActive": v.isActive, "rating": v.rating, "notes": v.notes,
        "recentPOs": [{"id": po.id, "poNumber": po.poNumber, "totalAmount": float(po.totalAmount), "status": po.status} for po in recent_pos],
    }


@router.post("/vendors", status_code=201)
def create_vendor(body: VendorCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(*ACCT_ROLES))):
    vendor = models.Vendor(
        id=generate_id(),
        name=sanitize_string(body.name),
        contactPerson=sanitize_string(body.contactPerson),
        phone=sanitize_string(body.phone),
        email=sanitize_string(body.email),
        address=sanitize_string(body.address),
        taxId=sanitize_string(body.taxId),
        paymentTerms=sanitize_string(body.paymentTerms),
        bankDetails=sanitize_string(body.bankDetails),
        isPreferred=body.isPreferred or False,
        notes=sanitize_string(body.notes),
    )
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    log_audit(db, current_user.id, "CREATE", "Vendor", vendor.id, {"name": vendor.name})
    return {"id": vendor.id, "name": vendor.name}


@router.patch("/vendors/{vendor_id}")
def update_vendor(vendor_id: str, body: VendorUpdate, db: Session = Depends(get_db), current_user=Depends(require_roles(*ACCT_ROLES))):
    v = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not v:
        raise HTTPException(404, "Vendor not found")

    for field, val in body.model_dump(exclude_none=True).items():
        if isinstance(val, str):
            val = sanitize_string(val)
        setattr(v, field, val)

    db.commit()
    db.refresh(v)
    log_audit(db, current_user.id, "UPDATE", "Vendor", v.id, {})
    return {"id": v.id, "name": v.name, "isActive": v.isActive}


# ── Purchase Orders ───────────────────────────────────────────────────────────

@router.get("/purchase-orders")
def get_purchase_orders(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    vendorId: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = db.query(models.PurchaseOrder)
    if status and status != "ALL":
        query = query.filter(models.PurchaseOrder.status == status)
    if vendorId:
        query = query.filter(models.PurchaseOrder.vendorId == vendorId)

    total = query.count()
    pos = query.order_by(models.PurchaseOrder.createdAt.desc()).offset((page - 1) * pageSize).limit(pageSize).all()

    return {"data": [_po_dict(po) for po in pos], "total": total, "page": page, "pageSize": pageSize}


@router.get("/purchase-orders/{po_id}")
def get_purchase_order(po_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(404, "Purchase order not found")
    return _po_dict(po)


@router.post("/purchase-orders", status_code=201)
def create_purchase_order(
    body: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(*ACCT_ROLES)),
):
    if not body.items:
        raise HTTPException(400, "At least one item is required")

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
    log_audit(db, current_user.id, "CREATE", "PurchaseOrder", po.id, {"poNumber": po.poNumber})
    return _po_dict(po)


@router.post("/purchase-orders/{po_id}/submit")
def submit_purchase_order(po_id: str, db: Session = Depends(get_db), current_user=Depends(require_roles(*ACCT_ROLES))):
    po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(404, "Purchase order not found")
    if po.status != "DRAFT":
        raise HTTPException(409, f"Only DRAFT orders can be submitted (current: {po.status})")

    po.status = "SUBMITTED"
    db.commit()
    log_audit(db, current_user.id, "SUBMIT", "PurchaseOrder", po.id, {})
    return _po_dict(po)


@router.post("/purchase-orders/{po_id}/approve")
def approve_purchase_order(po_id: str, db: Session = Depends(get_db), current_user=Depends(require_roles(*ACCT_ROLES))):
    po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(404, "Purchase order not found")
    if po.status != "SUBMITTED":
        raise HTTPException(409, f"Only SUBMITTED orders can be approved (current: {po.status})")

    po.status = "APPROVED"
    po.approvedById = current_user.id
    po.approvedAt = datetime.now()
    db.commit()
    log_audit(db, current_user.id, "APPROVE", "PurchaseOrder", po.id, {})
    return _po_dict(po)


@router.post("/purchase-orders/{po_id}/receive")
def receive_purchase_order(
    po_id: str,
    body: POReceive,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(*ACCT_ROLES)),
):
    po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(404, "Purchase order not found")
    if po.status not in ("APPROVED", "PARTIALLY_RECEIVED"):
        raise HTTPException(409, f"Cannot receive items for PO with status {po.status}")

    received_map = {r.itemId: r.receivedQty for r in body.items}
    all_received = True

    for item in po.items:
        if item.id in received_map:
            qty = received_map[item.id]
            if qty < 0 or qty > item.quantity:
                raise HTTPException(400, f"Invalid received quantity for item {item.itemName}")
            item.receivedQty = (item.receivedQty or 0) + qty
            if item.receivedQty < item.quantity:
                all_received = False
        else:
            if (item.receivedQty or 0) < item.quantity:
                all_received = False

    po.status = "COMPLETED" if all_received else "PARTIALLY_RECEIVED"
    if all_received:
        po.receivedAt = datetime.now()

    db.commit()
    log_audit(db, current_user.id, "RECEIVE", "PurchaseOrder", po.id, {"status": po.status})
    return _po_dict(po)


@router.post("/purchase-orders/{po_id}/cancel")
def cancel_purchase_order(po_id: str, db: Session = Depends(get_db), current_user=Depends(require_roles(*ACCT_ROLES))):
    po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(404, "Purchase order not found")
    if po.status in ("COMPLETED", "CANCELLED"):
        raise HTTPException(409, f"Cannot cancel PO with status {po.status}")

    po.status = "CANCELLED"
    db.commit()
    log_audit(db, current_user.id, "CANCEL", "PurchaseOrder", po.id, {})
    return _po_dict(po)
