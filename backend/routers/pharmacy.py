from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_user, generate_id
import models

router = APIRouter(prefix="/api/pharmacy", tags=["pharmacy"])


class MedicationCreate(BaseModel):
    genericName: str
    brandName: Optional[str] = None
    category: str
    unit: str
    barcode: Optional[str] = None
    stockQuantity: Optional[int] = 0
    minStockLevel: Optional[int] = 0
    reorderLevel: Optional[int] = 0
    unitCost: Optional[float] = 0
    sellingPrice: Optional[float] = 0
    location: Optional[str] = None
    isControlled: Optional[bool] = False
    requiresPrescription: Optional[bool] = True
    notes: Optional[str] = None


class StockMovementCreate(BaseModel):
    medicationId: str
    type: str
    quantity: int
    reason: Optional[str] = None
    notes: Optional[str] = None


def med_to_dict(m: models.Medication) -> dict:
    stock_status = "OUT_OF_STOCK"
    if m.stockQuantity > m.reorderLevel:
        stock_status = "IN_STOCK"
    elif m.stockQuantity > 0:
        stock_status = "LOW_STOCK"

    return {
        "id": m.id,
        "genericName": m.genericName,
        "brandName": m.brandName,
        "category": m.category,
        "unit": m.unit,
        "barcode": m.barcode,
        "stockQuantity": m.stockQuantity,
        "minStockLevel": m.minStockLevel,
        "reorderLevel": m.reorderLevel,
        "unitCost": float(m.unitCost or 0),
        "sellingPrice": float(m.sellingPrice or 0),
        "location": m.location,
        "isControlled": m.isControlled,
        "requiresPrescription": m.requiresPrescription,
        "isActive": m.isActive,
        "notes": m.notes,
        "stockStatus": stock_status,
        "createdAt": m.createdAt.isoformat() if m.createdAt else None,
    }


@router.get("/medications")
def get_medications(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=200),
    search: str = Query(""),
    category: Optional[str] = None,
    stockStatus: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = db.query(models.Medication).filter(models.Medication.isActive == True)

    if search:
        query = query.filter(
            models.Medication.genericName.contains(search) |
            models.Medication.brandName.contains(search)
        )

    if category and category != "ALL":
        query = query.filter(models.Medication.category == category)

    all_meds = query.order_by(models.Medication.genericName.asc()).all()

    if stockStatus and stockStatus != "ALL":
        filtered = [m for m in all_meds if med_to_dict(m)["stockStatus"] == stockStatus]
    else:
        filtered = all_meds

    total = len(filtered)
    page_data = filtered[(page - 1) * pageSize: page * pageSize]

    return {
        "data": [med_to_dict(m) for m in page_data],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }


@router.post("/medications", status_code=201)
def create_medication(
    body: MedicationCreate,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    if not all([body.genericName, body.category, body.unit]):
        raise HTTPException(status_code=400, detail="Generic name, category, and unit are required")

    med = models.Medication(
        id=generate_id(),
        genericName=body.genericName,
        brandName=body.brandName,
        category=body.category,
        unit=body.unit,
        barcode=body.barcode,
        stockQuantity=body.stockQuantity or 0,
        minStockLevel=body.minStockLevel or 0,
        reorderLevel=body.reorderLevel or 0,
        unitCost=body.unitCost or 0,
        sellingPrice=body.sellingPrice or 0,
        location=body.location,
        isControlled=body.isControlled or False,
        requiresPrescription=body.requiresPrescription if body.requiresPrescription is not None else True,
        notes=body.notes,
    )
    db.add(med)
    db.commit()
    db.refresh(med)
    return med_to_dict(med)


@router.get("/stock-movements")
def get_stock_movements(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    medicationId: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = db.query(models.StockMovement)
    if medicationId:
        query = query.filter(models.StockMovement.medicationId == medicationId)

    total = query.count()
    movements = query.order_by(models.StockMovement.createdAt.desc()).offset((page - 1) * pageSize).limit(pageSize).all()

    return {
        "data": [
            {
                "id": sm.id,
                "medicationId": sm.medicationId,
                "medicationName": sm.medication.genericName if sm.medication else "",
                "type": sm.type,
                "quantity": sm.quantity,
                "previousQty": sm.previousQty,
                "newQty": sm.newQty,
                "reason": sm.reason,
                "notes": sm.notes,
                "createdAt": sm.createdAt.isoformat() if sm.createdAt else None,
            }
            for sm in movements
        ],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }


@router.post("/medications/{med_id}/adjust", status_code=200)
def adjust_medication_stock(
    med_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    med = db.query(models.Medication).filter(models.Medication.id == med_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")

    qty = int(body.get("quantity", 0))
    note = body.get("note", "")
    previous_qty = med.stockQuantity
    new_qty = previous_qty + qty
    if new_qty < 0:
        raise HTTPException(status_code=400, detail="Insufficient stock")

    movement_type = "ADJUSTMENT_IN" if qty > 0 else "ADJUSTMENT_OUT"
    movement = models.StockMovement(
        id=generate_id(),
        medicationId=med_id,
        type=movement_type,
        quantity=abs(qty),
        previousQty=previous_qty,
        newQty=new_qty,
        reason="Manual adjustment",
        notes=note,
        performedById=current_user.id,
    )
    db.add(movement)
    med.stockQuantity = new_qty
    db.commit()

    return {"id": med_id, "stockQuantity": new_qty, "previousQty": previous_qty}


@router.post("/stock-movements", status_code=201)
def create_stock_movement(
    body: StockMovementCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    med = db.query(models.Medication).filter(models.Medication.id == body.medicationId).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")

    previous_qty = med.stockQuantity
    if body.type in ["DISPENSE", "ADJUSTMENT_OUT", "EXPIRED", "DAMAGED"]:
        new_qty = previous_qty - body.quantity
    else:
        new_qty = previous_qty + body.quantity

    if new_qty < 0:
        raise HTTPException(status_code=400, detail="Insufficient stock")

    movement = models.StockMovement(
        id=generate_id(),
        medicationId=body.medicationId,
        type=body.type,
        quantity=body.quantity,
        previousQty=previous_qty,
        newQty=new_qty,
        reason=body.reason,
        notes=body.notes,
        performedById=current_user.id,
    )
    db.add(movement)
    med.stockQuantity = new_qty
    db.commit()
    db.refresh(movement)

    return {
        "id": movement.id,
        "medicationId": movement.medicationId,
        "type": movement.type,
        "quantity": movement.quantity,
        "previousQty": movement.previousQty,
        "newQty": movement.newQty,
    }
