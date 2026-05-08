import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from routers import auth, patients, appointments, emr, consultations, billing
from routers import pharmacy, hr, accounting, reports, users, dashboard, doctors, audit, settings
from routers import laboratory, radiology, branches, shifts, notifications
from routers import events, search, clinics, smtp
from routers import whatsapp, sms_config, payment_gateway, feature_flags, api_keys
from routers import notification_templates

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    from database import engine, Base
    import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="MediFlow API", version="1.0.0", lifespan=lifespan)
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please slow down."},
        headers={"Retry-After": "60"},
    )


app.add_middleware(SlowAPIMiddleware)

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(appointments.router)
app.include_router(emr.router)
app.include_router(consultations.router)
app.include_router(billing.router)
app.include_router(pharmacy.router)
app.include_router(hr.router)
app.include_router(accounting.router)
app.include_router(reports.router)
app.include_router(users.router)
app.include_router(dashboard.router)
app.include_router(doctors.router)
app.include_router(audit.router)
app.include_router(settings.router)
app.include_router(laboratory.router)
app.include_router(radiology.router)
app.include_router(branches.router)
app.include_router(shifts.router)
app.include_router(notifications.router)
app.include_router(events.router)
app.include_router(search.router)
app.include_router(clinics.router)
app.include_router(smtp.router)
app.include_router(whatsapp.router)
app.include_router(whatsapp.webhook_router)
app.include_router(sms_config.router)
app.include_router(payment_gateway.router)
app.include_router(feature_flags.router)
app.include_router(api_keys.router)
app.include_router(notification_templates.router)


@app.get("/api/health")
def health():
    from sqlalchemy import text
    from database import SessionLocal
    db_status = "unavailable"
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        db_status = "connected"
    except Exception:
        pass
    return {"status": "ok", "service": "MediFlow API", "database": db_status}
