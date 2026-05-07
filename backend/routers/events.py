# backend/routers/events.py
import asyncio
import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import get_db, SessionLocal
from auth import get_current_user
import models

router = APIRouter(prefix="/api/events", tags=["events"])


async def _generate_dashboard_events(db_factory):
    while True:
        try:
            db: Session = db_factory()
            now = datetime.utcnow()
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

            total_patients = db.query(models.Patient).filter(models.Patient.deletedAt == None).count()
            today_appts = db.query(models.Appointment).filter(
                models.Appointment.scheduledAt >= today_start,
                models.Appointment.scheduledAt < today_start + timedelta(days=1),
            ).count()
            low_stock = db.query(models.Medication).filter(
                models.Medication.isActive == True,
                models.Medication.minStockLevel > 0,
                models.Medication.stockQuantity <= models.Medication.minStockLevel,
            ).count()
            db.close()

            payload = json.dumps({
                "type": "dashboard",
                "payload": {
                    "totalPatients": total_patients,
                    "todayAppointments": today_appts,
                    "lowStockAlerts": low_stock,
                    "timestamp": now.isoformat(),
                }
            })
            yield f"data: {payload}\n\n"
        except Exception:
            yield f"data: {json.dumps({'type': 'error', 'payload': {}})}\n\n"
        await asyncio.sleep(5)


async def _generate_appointments_events(db_factory):
    while True:
        try:
            db: Session = db_factory()
            now = datetime.utcnow()
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            appts = (
                db.query(models.Appointment, models.Patient)
                .join(models.Patient, models.Appointment.patientId == models.Patient.id)
                .filter(
                    models.Appointment.scheduledAt >= today_start,
                    models.Appointment.scheduledAt < today_start + timedelta(days=1),
                )
                .order_by(models.Appointment.scheduledAt.asc())
                .limit(20)
                .all()
            )
            data = [
                {
                    "id": a.id,
                    "patientName": f"{p.firstName} {p.lastName}",
                    "status": a.status,
                    "scheduledAt": a.scheduledAt.isoformat() if a.scheduledAt else None,
                    "isUrgent": a.isUrgent,
                }
                for a, p in appts
            ]
            db.close()
            payload = json.dumps({"type": "appointments", "payload": data})
            yield f"data: {payload}\n\n"
        except Exception:
            yield f"data: {json.dumps({'type': 'error', 'payload': []})}\n\n"
        await asyncio.sleep(5)


async def _generate_lab_events(db_factory):
    while True:
        try:
            db: Session = db_factory()
            now = datetime.utcnow()
            ready = (
                db.query(models.LabOrder, models.Patient)
                .join(models.Patient, models.LabOrder.patientId == models.Patient.id)
                .filter(
                    models.LabOrder.status == "RESULTS_READY",
                    models.LabOrder.createdAt >= now - timedelta(days=7),
                )
                .order_by(models.LabOrder.createdAt.desc())
                .limit(10)
                .all()
            )
            data = [
                {
                    "id": o.id,
                    "patientName": f"{p.firstName} {p.lastName}",
                    "tests": o.tests if isinstance(o.tests, list) else [],
                    "createdAt": o.createdAt.isoformat() if o.createdAt else None,
                }
                for o, p in ready
            ]
            db.close()
            payload = json.dumps({"type": "lab", "payload": data})
            yield f"data: {payload}\n\n"
        except Exception:
            yield f"data: {json.dumps({'type': 'error', 'payload': []})}\n\n"
        await asyncio.sleep(5)


@router.get("/dashboard")
async def stream_dashboard(_user=Depends(get_current_user)):
    return StreamingResponse(
        _generate_dashboard_events(SessionLocal),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/appointments")
async def stream_appointments(_user=Depends(get_current_user)):
    return StreamingResponse(
        _generate_appointments_events(SessionLocal),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/lab")
async def stream_lab(_user=Depends(get_current_user)):
    return StreamingResponse(
        _generate_lab_events(SessionLocal),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
