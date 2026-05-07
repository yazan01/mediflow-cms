from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import auth, patients, appointments, emr, consultations, billing
from routers import pharmacy, hr, accounting, reports, users, dashboard, doctors, audit, settings
from routers import laboratory, radiology

app = FastAPI(title="MediFlow API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "MediFlow API"}
