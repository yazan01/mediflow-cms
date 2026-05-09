import hmac
import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy.exc import IntegrityError

from routers import auth, patients, appointments, emr, consultations, billing
from routers import pharmacy, hr, accounting, reports, users, dashboard, doctors, audit, settings
from routers import laboratory, radiology, branches, shifts, notifications
from routers import events, search, clinics, smtp
from routers import whatsapp, sms_config, payment_gateway, feature_flags, api_keys
from routers import notification_templates, appointment_config, integrations
from routers import insurance_providers

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

_log = logging.getLogger("mediflow")

# Paths exempt from CSRF check (no browser session involved)
_CSRF_EXEMPT = {"/api/auth/login", "/api/auth/logout", "/api/auth/2fa/verify"}
_CSRF_EXEMPT_PREFIXES = ("/api/webhooks/",)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Security startup checks ───────────────────────────────────────────────
    if not os.getenv("SETTINGS_ENCRYPTION_KEY"):
        _log.critical(
            "SECURITY: SETTINGS_ENCRYPTION_KEY not set — encrypted secrets fall back to a "
            "JWT_SECRET-derived key. Generate a dedicated Fernet key and add it to backend/.env:\n"
            '  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
        )
    if not os.getenv("REDIS_URL"):
        _log.warning(
            "PERFORMANCE: REDIS_URL not set — settings cache is in-process (single-worker only). "
            "Set REDIS_URL=redis://localhost:6379/0 for distributed caching."
        )

    from database import engine, Base, SessionLocal
    import models  # noqa: F401
    Base.metadata.create_all(bind=engine)

    # Backfill Doctor records for any existing users with DOCTOR role that lack one.
    # Idempotent — safe to run on every startup.
    try:
        from auth import generate_id
        db = SessionLocal()
        doctor_users = (
            db.query(models.User)
            .filter(models.User.isActive == True)
            .all()
        )
        created = 0
        for u in doctor_users:
            roles = u.roles if isinstance(u.roles, list) else []
            if "DOCTOR" in roles:
                exists = db.query(models.Doctor).filter(models.Doctor.userId == u.id).first()
                if not exists:
                    db.add(models.Doctor(
                        id=generate_id(),
                        userId=u.id,
                        specialization="General Medicine",
                        consultationFee=100,
                        isAvailable=True,
                    ))
                    created += 1
        if created:
            db.commit()
            _log.info("Backfilled %d missing Doctor record(s) for existing DOCTOR users.", created)
        db.close()
    except Exception as exc:  # pragma: no cover
        _log.warning("Doctor backfill skipped: %s", exc)

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


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    _log.warning("IntegrityError on %s %s: %s", request.method, request.url.path, exc.orig)
    return JSONResponse(
        status_code=409,
        content={"detail": "Operation conflicts with existing data. Check for duplicate or missing references."},
    )


# ── CSRF double-submit cookie middleware ──────────────────────────────────────
@app.middleware("http")
async def csrf_middleware(request: Request, call_next):
    if request.method in ("POST", "PATCH", "DELETE", "PUT"):
        path = request.url.path
        if path not in _CSRF_EXEMPT and not any(path.startswith(p) for p in _CSRF_EXEMPT_PREFIXES):
            csrf_cookie = request.cookies.get("mediflow_csrf", "")
            csrf_header = request.headers.get("x-csrf-token", "")
            if not csrf_cookie or not csrf_header:
                return JSONResponse({"detail": "CSRF token missing"}, status_code=403)
            if not hmac.compare_digest(csrf_cookie, csrf_header):
                return JSONResponse({"detail": "CSRF token invalid"}, status_code=403)
    return await call_next(request)


app.add_middleware(SlowAPIMiddleware)

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "X-CSRF-Token"],
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
app.include_router(appointment_config.router)
app.include_router(integrations.router)
app.include_router(payment_gateway.webhook_router)
app.include_router(insurance_providers.router)


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
