"""
Demo data seeder — run ONCE to populate realistic appointments calendar data.
  cd backend
  python demo_seed.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime, timedelta
from database import SessionLocal
from auth import hash_password, generate_id, generate_mrn
import models

TODAY = datetime(2026, 5, 8)   # Thursday

def dt(day_offset: int, hour: int, minute: int = 0) -> datetime:
    return TODAY + timedelta(days=day_offset, hours=hour, minutes=minute)


def seed_demo():
    db = SessionLocal()
    try:
        # ── Branches ──────────────────────────────────────────────────────────
        branch_data = [
            {"name": "Main Branch",    "code": "MAIN", "address": "Amman, Sweifieh"},
            {"name": "North Clinic",   "code": "NRTH", "address": "Amman, Abdali"},
            {"name": "South Center",   "code": "SUTH", "address": "Amman, Sahab"},
        ]
        branches = {}
        for b in branch_data:
            obj = db.query(models.Branch).filter(models.Branch.code == b["code"]).first()
            if not obj:
                obj = models.Branch(
                    id=generate_id(), name=b["name"], code=b["code"],
                    address=b["address"], timezone="Asia/Amman", isActive=True,
                )
                db.add(obj)
                db.flush()
                print(f"  [Branch] {b['name']}")
            branches[b["code"]] = obj.id

        # ── AppointmentConfig per branch ───────────────────────────────────────
        configs = [
            {"branchId": branches["MAIN"], "startTime": "08:00", "endTime": "17:00",
             "workingDays": ["MON","TUE","WED","THU","FRI"], "slotDurationMin": 30},
            {"branchId": branches["NRTH"], "startTime": "09:00", "endTime": "18:00",
             "workingDays": ["MON","TUE","WED","THU","FRI","SAT"], "slotDurationMin": 20},
            {"branchId": branches["SUTH"], "startTime": "08:00", "endTime": "14:00",
             "workingDays": ["SUN","MON","TUE","WED","THU"], "slotDurationMin": 30},
        ]
        for cfg in configs:
            existing = db.query(models.AppointmentConfig).filter(
                models.AppointmentConfig.branchId == cfg["branchId"]
            ).first()
            if not existing:
                db.add(models.AppointmentConfig(**cfg, id=generate_id()))
                db.flush()

        # ── Departments ────────────────────────────────────────────────────────
        dept_map = {}
        for name in ["Medical","Cardiology","Pediatrics","Orthopedics","Dentistry",
                     "Nursing","Administration","Finance","Pharmacy","Laboratory","Radiology"]:
            obj = db.query(models.Department).filter(models.Department.name == name).first()
            if not obj:
                obj = models.Department(id=generate_id(), name=name, code=name[:3].upper())
                db.add(obj); db.flush()
            dept_map[name] = obj.id

        # ── Doctors ────────────────────────────────────────────────────────────
        doctor_data = [
            {"name": "Dr. Ahmad Al-Mansouri", "email": "doctor@mediflow.com",
             "spec": "Internal Medicine",   "fee": 150, "dept": "Medical"},
            {"name": "Dr. Sara Al-Hassan",    "email": "sara@mediflow.com",
             "spec": "Cardiology",          "fee": 200, "dept": "Cardiology"},
            {"name": "Dr. Khalid Nabulsi",   "email": "khalid@mediflow.com",
             "spec": "Pediatrics",          "fee": 120, "dept": "Pediatrics"},
            {"name": "Dr. Lina Barakat",     "email": "lina@mediflow.com",
             "spec": "Orthopedics",         "fee": 180, "dept": "Orthopedics"},
            {"name": "Dr. Omar Rasheed",     "email": "omar@mediflow.com",
             "spec": "Dentistry",           "fee": 100, "dept": "Dentistry"},
            {"name": "Dr. Maya Khalil",      "email": "maya@mediflow.com",
             "spec": "General Practice",    "fee": 80,  "dept": "Medical"},
        ]
        doctors = {}   # name → Doctor model
        for d in doctor_data:
            user = db.query(models.User).filter(models.User.email == d["email"]).first()
            if not user:
                user = models.User(
                    id=generate_id(), name=d["name"], email=d["email"],
                    passwordHash=hash_password("Doctor@1234"),
                    roles=["DOCTOR"], isActive=True,
                )
                db.add(user); db.flush()
            doc = db.query(models.Doctor).filter(models.Doctor.userId == user.id).first()
            if not doc:
                doc = models.Doctor(
                    id=generate_id(), userId=user.id,
                    specialization=d["spec"], consultationFee=d["fee"],
                    departmentId=dept_map.get(d["dept"]), isAvailable=True,
                )
                db.add(doc); db.flush()
                print(f"  [Doctor] {d['name']} — {d['spec']}")
            doctors[d["name"]] = doc

        # ── Patients ───────────────────────────────────────────────────────────
        patient_data = [
            {"first": "Mohammed", "last": "Al-Qasim",   "dob": "1985-03-12", "phone": "0791234001", "gender": "MALE"},
            {"first": "Fatima",   "last": "Al-Zahrani", "dob": "1990-07-22", "phone": "0791234002", "gender": "FEMALE"},
            {"first": "Tariq",    "last": "Mustafa",    "dob": "1978-11-05", "phone": "0791234003", "gender": "MALE"},
            {"first": "Nour",     "last": "Al-Aqrabawi","dob": "1995-02-18", "phone": "0791234004", "gender": "FEMALE"},
            {"first": "Khaled",   "last": "Bani-Hani",  "dob": "1965-09-30", "phone": "0791234005", "gender": "MALE"},
            {"first": "Rima",     "last": "Saleh",      "dob": "2001-04-14", "phone": "0791234006", "gender": "FEMALE"},
            {"first": "Yousef",   "last": "Khalaileh",  "dob": "1972-12-01", "phone": "0791234007", "gender": "MALE"},
            {"first": "Hana",     "last": "Al-Dabbas",  "dob": "1988-06-25", "phone": "0791234008", "gender": "FEMALE"},
            {"first": "Feras",    "last": "Odeh",       "dob": "1993-08-09", "phone": "0791234009", "gender": "MALE"},
            {"first": "Sana",     "last": "Jarrar",     "dob": "1980-01-17", "phone": "0791234010", "gender": "FEMALE"},
            {"first": "Bilal",    "last": "Najjar",     "dob": "2005-05-03", "phone": "0791234011", "gender": "MALE"},
            {"first": "Dina",     "last": "Farhat",     "dob": "1970-10-28", "phone": "0791234012", "gender": "FEMALE"},
        ]
        patients = []
        for p in patient_data:
            existing = db.query(models.Patient).filter(
                models.Patient.phone == p["phone"],
                models.Patient.deletedAt == None
            ).first()
            if not existing:
                mrn = generate_mrn(db)
                existing = models.Patient(
                    id=generate_id(), mrn=mrn,
                    firstName=p["first"], lastName=p["last"],
                    dateOfBirth=datetime.strptime(p["dob"], "%Y-%m-%d"),
                    gender=p["gender"], phone=p["phone"],
                    allergies=[], chronicConditions=[], isActive=True,
                )
                db.add(existing); db.flush()
                print(f"  [Patient] {p['first']} {p['last']} — {mrn}")
            patients.append(existing)

        db.commit()

        # ── Appointments ───────────────────────────────────────────────────────
        # day_offset: -4=Mon, -3=Tue, -2=Wed, -1=yesterday(Wed), 0=Thu(today),
        #              1=Fri, 3=Mon next week, 4=Tue, 5=Wed
        D = doctors
        P = patients
        B = branches

        appt_specs = [
            # ── Monday (May 4) — past, mostly COMPLETED
            (dt(-4,  8,  0), dt(-4,  8, 30), D["Dr. Ahmad Al-Mansouri"], P[0],  "CONSULTATION", "COMPLETED",  B["MAIN"], False),
            (dt(-4,  8, 30), dt(-4,  9,  0), D["Dr. Sara Al-Hassan"],    P[1],  "CHECKUP",      "COMPLETED",  B["MAIN"], False),
            (dt(-4,  9,  0), dt(-4,  9, 30), D["Dr. Khalid Nabulsi"],    P[2],  "FOLLOW_UP",    "COMPLETED",  B["MAIN"], False),
            (dt(-4, 10,  0), dt(-4, 10, 30), D["Dr. Lina Barakat"],      P[3],  "PROCEDURE",    "COMPLETED",  B["NRTH"], False),
            (dt(-4, 10, 30), dt(-4, 11,  0), D["Dr. Omar Rasheed"],      P[4],  "DENTAL",       "NO_SHOW",    B["NRTH"], False),
            (dt(-4, 11,  0), dt(-4, 11, 30), D["Dr. Maya Khalil"],       P[5],  "CONSULTATION", "COMPLETED",  B["SUTH"], False),
            (dt(-4, 12,  0), dt(-4, 12, 30), D["Dr. Ahmad Al-Mansouri"], P[6],  "LAB_VISIT",    "COMPLETED",  B["MAIN"], False),
            (dt(-4, 14,  0), dt(-4, 14, 30), D["Dr. Sara Al-Hassan"],    P[7],  "IMAGING",      "COMPLETED",  B["MAIN"], False),
            (dt(-4, 15,  0), dt(-4, 15, 30), D["Dr. Khalid Nabulsi"],    P[8],  "CHECKUP",      "NO_SHOW",    B["MAIN"], False),

            # ── Tuesday (May 5)
            (dt(-3,  8,  0), dt(-3,  8, 30), D["Dr. Ahmad Al-Mansouri"], P[9],  "CONSULTATION", "COMPLETED",  B["MAIN"], False),
            (dt(-3,  9,  0), dt(-3,  9, 30), D["Dr. Lina Barakat"],      P[10], "PROCEDURE",    "COMPLETED",  B["NRTH"], False),
            (dt(-3, 10,  0), dt(-3, 10, 30), D["Dr. Omar Rasheed"],      P[11], "DENTAL",       "COMPLETED",  B["NRTH"], False),
            (dt(-3, 11,  0), dt(-3, 11, 30), D["Dr. Maya Khalil"],       P[0],  "FOLLOW_UP",    "COMPLETED",  B["MAIN"], False),
            (dt(-3, 13,  0), dt(-3, 13, 30), D["Dr. Sara Al-Hassan"],    P[2],  "IMAGING",      "COMPLETED",  B["MAIN"], False),
            (dt(-3, 15,  0), dt(-3, 15, 30), D["Dr. Khalid Nabulsi"],    P[4],  "CHECKUP",      "COMPLETED",  B["SUTH"], False),

            # ── Wednesday (May 6)
            (dt(-2,  8,  0), dt(-2,  8, 30), D["Dr. Ahmad Al-Mansouri"], P[1],  "EMERGENCY",    "COMPLETED",  B["MAIN"], True),
            (dt(-2,  8,  0), dt(-2,  8, 30), D["Dr. Sara Al-Hassan"],    P[3],  "CHECKUP",      "COMPLETED",  B["MAIN"], False),
            (dt(-2,  9,  0), dt(-2,  9, 30), D["Dr. Lina Barakat"],      P[5],  "PROCEDURE",    "COMPLETED",  B["MAIN"], False),
            (dt(-2, 10,  0), dt(-2, 10, 30), D["Dr. Khalid Nabulsi"],    P[7],  "FOLLOW_UP",    "COMPLETED",  B["NRTH"], False),
            (dt(-2, 11,  0), dt(-2, 11, 30), D["Dr. Maya Khalil"],       P[9],  "CONSULTATION", "COMPLETED",  B["SUTH"], False),
            (dt(-2, 13,  0), dt(-2, 13, 30), D["Dr. Omar Rasheed"],      P[11], "DENTAL",       "NO_SHOW",    B["NRTH"], False),
            (dt(-2, 14,  0), dt(-2, 14, 30), D["Dr. Ahmad Al-Mansouri"], P[6],  "CONSULTATION", "COMPLETED",  B["MAIN"], False),
            (dt(-2, 15,  0), dt(-2, 15, 30), D["Dr. Sara Al-Hassan"],    P[8],  "LAB_VISIT",    "COMPLETED",  B["MAIN"], False),

            # ── TODAY Thursday (May 8) — mixed live statuses, overlaps ─────────
            # Morning block
            (dt( 0,  8,  0), dt( 0,  8, 30), D["Dr. Ahmad Al-Mansouri"], P[0],  "CONSULTATION",  "COMPLETED",    B["MAIN"], False),
            (dt( 0,  8, 30), dt( 0,  9,  0), D["Dr. Ahmad Al-Mansouri"], P[1],  "FOLLOW_UP",     "COMPLETED",    B["MAIN"], False),
            (dt( 0,  8,  0), dt( 0,  8, 30), D["Dr. Sara Al-Hassan"],    P[2],  "CHECKUP",       "COMPLETED",    B["MAIN"], False),
            (dt( 0,  8,  0), dt( 0,  9,  0), D["Dr. Khalid Nabulsi"],    P[3],  "CONSULTATION",  "CHECKED_IN",   B["MAIN"], False),
            (dt( 0,  9,  0), dt( 0,  9, 30), D["Dr. Ahmad Al-Mansouri"], P[4],  "EMERGENCY",     "IN_CONSULTATION", B["MAIN"], True),
            (dt( 0,  9,  0), dt( 0,  9, 30), D["Dr. Lina Barakat"],      P[5],  "PROCEDURE",     "CHECKED_IN",   B["NRTH"], False),
            (dt( 0,  9, 30), dt( 0, 10,  0), D["Dr. Omar Rasheed"],      P[6],  "DENTAL",        "SCHEDULED",    B["NRTH"], False),
            # Two overlapping at 10:00 for same doctor to test layout
            (dt( 0, 10,  0), dt( 0, 10, 30), D["Dr. Maya Khalil"],       P[7],  "CONSULTATION",  "SCHEDULED",    B["SUTH"], False),
            (dt( 0, 10,  0), dt( 0, 10, 30), D["Dr. Sara Al-Hassan"],    P[8],  "IMAGING",       "SCHEDULED",    B["MAIN"], False),
            (dt( 0, 10, 30), dt( 0, 11,  0), D["Dr. Ahmad Al-Mansouri"], P[9],  "CONSULTATION",  "SCHEDULED",    B["MAIN"], False),
            (dt( 0, 11,  0), dt( 0, 11, 30), D["Dr. Lina Barakat"],      P[10], "PROCEDURE",     "SCHEDULED",    B["MAIN"], False),
            (dt( 0, 11,  0), dt( 0, 11, 30), D["Dr. Khalid Nabulsi"],    P[11], "CHECKUP",       "SCHEDULED",    B["MAIN"], False),
            # Afternoon
            (dt( 0, 13,  0), dt( 0, 13, 30), D["Dr. Ahmad Al-Mansouri"], P[2],  "FOLLOW_UP",     "SCHEDULED",    B["MAIN"], False),
            (dt( 0, 13,  0), dt( 0, 13, 30), D["Dr. Sara Al-Hassan"],    P[3],  "LAB_VISIT",     "SCHEDULED",    B["MAIN"], False),
            (dt( 0, 14,  0), dt( 0, 14, 30), D["Dr. Omar Rasheed"],      P[4],  "DENTAL",        "SCHEDULED",    B["NRTH"], False),
            (dt( 0, 14, 30), dt( 0, 15,  0), D["Dr. Khalid Nabulsi"],    P[5],  "CONSULTATION",  "SCHEDULED",    B["MAIN"], False),
            (dt( 0, 15,  0), dt( 0, 15, 30), D["Dr. Maya Khalil"],       P[6],  "CONSULTATION",  "SCHEDULED",    B["SUTH"], False),
            (dt( 0, 15, 30), dt( 0, 16,  0), D["Dr. Lina Barakat"],      P[7],  "PROCEDURE",     "SCHEDULED",    B["MAIN"], False),

            # ── Friday (May 9)
            (dt( 1,  8,  0), dt( 1,  8, 30), D["Dr. Ahmad Al-Mansouri"], P[8],  "CONSULTATION", "SCHEDULED",  B["MAIN"], False),
            (dt( 1,  8, 30), dt( 1,  9,  0), D["Dr. Sara Al-Hassan"],    P[9],  "CHECKUP",      "SCHEDULED",  B["MAIN"], False),
            (dt( 1,  9,  0), dt( 1,  9, 30), D["Dr. Khalid Nabulsi"],    P[10], "FOLLOW_UP",    "SCHEDULED",  B["NRTH"], False),
            (dt( 1, 10,  0), dt( 1, 10, 30), D["Dr. Lina Barakat"],      P[11], "PROCEDURE",    "SCHEDULED",  B["NRTH"], False),
            (dt( 1, 11,  0), dt( 1, 11, 30), D["Dr. Omar Rasheed"],      P[0],  "DENTAL",       "SCHEDULED",  B["NRTH"], False),
            (dt( 1, 13,  0), dt( 1, 13, 30), D["Dr. Maya Khalil"],       P[1],  "CONSULTATION", "SCHEDULED",  B["SUTH"], False),

            # ── Monday next week (May 11)
            (dt( 3,  8,  0), dt( 3,  8, 30), D["Dr. Ahmad Al-Mansouri"], P[2],  "CONSULTATION", "SCHEDULED",  B["MAIN"], False),
            (dt( 3,  9,  0), dt( 3,  9, 30), D["Dr. Sara Al-Hassan"],    P[3],  "IMAGING",      "SCHEDULED",  B["MAIN"], False),
            (dt( 3, 10,  0), dt( 3, 10, 30), D["Dr. Khalid Nabulsi"],    P[4],  "CHECKUP",      "SCHEDULED",  B["MAIN"], False),
            (dt( 3, 11,  0), dt( 3, 11, 30), D["Dr. Lina Barakat"],      P[5],  "PROCEDURE",    "SCHEDULED",  B["NRTH"], False),
            (dt( 3, 13,  0), dt( 3, 13, 30), D["Dr. Omar Rasheed"],      P[6],  "DENTAL",       "SCHEDULED",  B["NRTH"], False),
            (dt( 3, 14,  0), dt( 3, 14, 30), D["Dr. Maya Khalil"],       P[7],  "FOLLOW_UP",    "SCHEDULED",  B["SUTH"], False),

            # ── Tuesday (May 12)
            (dt( 4,  8,  0), dt( 4,  8, 30), D["Dr. Ahmad Al-Mansouri"], P[8],  "EMERGENCY",    "SCHEDULED",  B["MAIN"], True),
            (dt( 4,  9,  0), dt( 4,  9, 30), D["Dr. Sara Al-Hassan"],    P[9],  "CONSULTATION", "SCHEDULED",  B["MAIN"], False),
            (dt( 4, 10,  0), dt( 4, 10, 30), D["Dr. Khalid Nabulsi"],    P[10], "LAB_VISIT",    "SCHEDULED",  B["MAIN"], False),
            (dt( 4, 11,  0), dt( 4, 11, 30), D["Dr. Lina Barakat"],      P[11], "PROCEDURE",    "SCHEDULED",  B["NRTH"], False),
            (dt( 4, 13,  0), dt( 4, 13, 30), D["Dr. Omar Rasheed"],      P[0],  "DENTAL",       "SCHEDULED",  B["NRTH"], False),
            (dt( 4, 14,  0), dt( 4, 14, 30), D["Dr. Maya Khalil"],       P[1],  "CHECKUP",      "SCHEDULED",  B["SUTH"], False),

            # ── Wednesday (May 13)
            (dt( 5,  8,  0), dt( 5,  8, 30), D["Dr. Ahmad Al-Mansouri"], P[2],  "CONSULTATION", "SCHEDULED",  B["MAIN"], False),
            (dt( 5,  9,  0), dt( 5,  9, 30), D["Dr. Sara Al-Hassan"],    P[3],  "CHECKUP",      "SCHEDULED",  B["MAIN"], False),
            (dt( 5, 10,  0), dt( 5, 10, 30), D["Dr. Lina Barakat"],      P[4],  "PROCEDURE",    "SCHEDULED",  B["MAIN"], False),
            (dt( 5, 13,  0), dt( 5, 13, 30), D["Dr. Khalid Nabulsi"],    P[5],  "FOLLOW_UP",    "SCHEDULED",  B["NRTH"], False),
        ]

        created = 0
        for (start, end, doc, patient, atype, status, branch_id, urgent) in appt_specs:
            # Skip if this doctor already has an appointment at this exact time
            existing = db.query(models.Appointment).filter(
                models.Appointment.doctorId == doc.id,
                models.Appointment.scheduledAt == start,
                models.Appointment.status.notin_(["CANCELLED"]),
            ).first()
            if existing:
                continue

            appt = models.Appointment(
                id=generate_id(),
                patientId=patient.id,
                doctorId=doc.id,
                scheduledAt=start,
                scheduledEnd=end,
                type=atype,
                status=status,
                isUrgent=urgent,
                isWalkIn=False,
                branchId=branch_id,
                checkedInAt=start if status in ("CHECKED_IN","IN_CONSULTATION","COMPLETED") else None,
            )
            db.add(appt)

            # Update patient lastVisit
            if status == "COMPLETED":
                patient.lastVisit = start

            created += 1

        db.commit()
        print(f"\n[OK] {created} appointments created.")
        print("\nDemo seed complete — open http://localhost:3000/appointments")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        import traceback; traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo()
