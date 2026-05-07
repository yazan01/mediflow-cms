"""
Full data seed — realistic clinic data across all modules.
  cd backend
  python seed_full.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime, timedelta
from decimal import Decimal
from database import SessionLocal, engine
from auth import hash_password, generate_id
import models

models.Base.metadata.create_all(bind=engine)

def d(days_offset: int) -> datetime:
    return datetime.now() + timedelta(days=days_offset)

def seed():
    db = SessionLocal()
    try:
        # ── 1. CLINIC SETTINGS ──────────────────────────────────────────────
        if not db.query(models.ClinicSetting).first():
            db.add(models.ClinicSetting(
                id=1,
                clinicName="Al-Shifa Medical Center",
                licenseNumber="MH-2024-00347",
                phone="+962 6 555 0100",
                email="info@alshifa-clinic.jo",
                address="King Abdullah II St, Amman 11190, Jordan",
                taxId="TIN-962-00347",
                currency="JOD",
                timezone="Asia/Amman",
                taxRate=16,
                invoicePrefix="INV",
                paymentTerms=30,
                sessionTimeout=480,
                passwordMinLength=8,
                require2FA=False,
            ))
            print("[OK] Clinic settings")

        # ── 2. DEPARTMENTS ───────────────────────────────────────────────────
        dept_ids = {}
        dept_data = [
            ("Internal Medicine",  "INT-MED"),
            ("General Surgery",    "SURGERY"),
            ("Pediatrics",         "PEDS"),
            ("Obstetrics & Gyn",   "OBG"),
            ("Radiology",          "RADIOL"),
            ("Laboratory",         "LAB"),
            ("Pharmacy",           "PHARM"),
            ("Administration",     "ADMIN"),
            ("Human Resources",    "HR"),
            ("Emergency",          "ER"),
        ]
        for name, code in dept_data:
            existing = db.query(models.Department).filter(models.Department.code == code).first()
            if not existing:
                dep = models.Department(id=generate_id(), name=name, code=code)
                db.add(dep)
                db.flush()
                dept_ids[code] = dep.id
            else:
                dept_ids[code] = existing.id
        print("[OK] Departments")

        # ── 3. USERS & DOCTORS & EMPLOYEES ──────────────────────────────────
        users_data = [
            # (name, email, password, roles, dept_code, specialization, fee, job_title, salary)
            ("System Admin",           "admin@mediflow.com",    "Admin@1234",    ["SUPER_ADMIN"],          "ADMIN",   None,                  0,   "System Administrator", 1500),
            ("Dr. Ahmad Al-Mansouri",  "ahmad@mediflow.com",    "Doctor@1234",   ["DOCTOR"],               "INT-MED", "Internal Medicine",   80,  "Senior Consultant",    1800),
            ("Dr. Rania Khalil",       "rania@mediflow.com",    "Doctor@1234",   ["DOCTOR"],               "SURGERY", "General Surgery",     100, "Consultant Surgeon",   2000),
            ("Dr. Tariq Abu-Hassan",   "tariq@mediflow.com",    "Doctor@1234",   ["DOCTOR"],               "PEDS",    "Pediatrics",          70,  "Pediatric Consultant", 1700),
            ("Dr. Lina Samara",        "lina@mediflow.com",     "Doctor@1234",   ["DOCTOR"],               "OBG",     "Obstetrics & Gyn",    90,  "OB/GYN Consultant",    1900),
            ("Dr. Khalid Nabulsi",     "khalid@mediflow.com",   "Doctor@1234",   ["DOCTOR"],               "INT-MED", "Cardiology",          120, "Cardiologist",         2200),
            ("Sara Al-Zoubi",          "sara@mediflow.com",     "Nurse@1234",    ["NURSE"],                "INT-MED", None,                  0,   "Head Nurse",           800),
            ("Hana Bani-Salameh",      "hana@mediflow.com",     "Nurse@1234",    ["NURSE"],                "PEDS",    None,                  0,   "Pediatric Nurse",      750),
            ("Yousef Issa",            "yousef@mediflow.com",   "Staff@1234",    ["PHARMACIST"],           "PHARM",   None,                  0,   "Chief Pharmacist",     900),
            ("Maha Qasem",             "maha@mediflow.com",     "Staff@1234",    ["LAB_TECHNICIAN"],       "LAB",     None,                  0,   "Lab Supervisor",       850),
            ("Bilal Darwish",          "bilal@mediflow.com",    "Staff@1234",    ["RECEPTIONIST"],         "ADMIN",   None,                  0,   "Front Desk Officer",   600),
            ("Nour Al-Ahmad",          "nour@mediflow.com",     "Staff@1234",    ["HR_OFFICER"],           "HR",      None,                  0,   "HR Manager",           950),
            ("Dr. Firas Hammouri",     "firas@mediflow.com",    "Doctor@1234",   ["DOCTOR"],               "RADIOL",  "Radiology",           85,  "Chief Radiologist",    2100),
        ]

        user_map = {}  # email -> User
        doc_map  = {}  # email -> Doctor
        emp_codes_used = set()

        def make_emp_code(dept_code: str) -> str:
            base = f"EMP-{dept_code}-"
            n = sum(1 for c in emp_codes_used if c.startswith(base)) + 1
            code = f"{base}{n:03d}"
            emp_codes_used.add(code)
            return code

        for (name, email, pw, roles, dept_code, spec, fee, job_title, salary) in users_data:
            u = db.query(models.User).filter(models.User.email == email).first()
            if not u:
                u = models.User(
                    id=generate_id(), name=name, email=email,
                    passwordHash=hash_password(pw),
                    roles=roles, isActive=True,
                    departmentId=dept_ids.get(dept_code),
                )
                db.add(u)
                db.flush()

                # Employee record for everyone
                emp_code = make_emp_code(dept_code)
                emp = models.Employee(
                    id=generate_id(), empCode=emp_code,
                    userId=u.id, departmentId=dept_ids[dept_code],
                    jobTitle=job_title, employmentType="FULL_TIME",
                    status="ACTIVE", basicSalary=salary,
                    housingAllowance=salary * Decimal("0.15"),
                    transportAllowance=50,
                    hireDate=d(-730),
                    annualLeaveBalance=21, sickLeaveBalance=14,
                )
                db.add(emp)
                db.flush()

                # Doctor record
                if spec:
                    doc = models.Doctor(
                        id=generate_id(), userId=u.id,
                        departmentId=dept_ids.get(dept_code),
                        specialization=spec,
                        consultationFee=fee,
                        licenseNumber=f"LIC-JO-{generate_id()[:8].upper()}",
                        licenseExpiry=d(365),
                        isAvailable=True,
                    )
                    db.add(doc)
                    db.flush()
                    doc_map[email] = doc

            user_map[email] = u if u else db.query(models.User).filter(models.User.email == email).first()

        # refresh doc_map for existing rows
        for email in [e for (_, e, _, r, *_) in users_data if "DOCTOR" in r]:
            u = db.query(models.User).filter(models.User.email == email).first()
            if u:
                doc = db.query(models.Doctor).filter(models.Doctor.userId == u.id).first()
                if doc:
                    doc_map[email] = doc

        print("[OK] Users / Doctors / Employees")

        # ── 4. DOCTOR AVAILABILITY ───────────────────────────────────────────
        doctor_emails = [e for (_, e, _, r, *_) in users_data if "DOCTOR" in r]
        for email in doctor_emails:
            doc = doc_map.get(email)
            if not doc:
                continue
            existing = db.query(models.DoctorAvailability).filter(models.DoctorAvailability.doctorId == doc.id).first()
            if not existing:
                for day in [0, 1, 2, 3, 4]:  # Mon-Fri
                    db.add(models.DoctorAvailability(
                        id=generate_id(), doctorId=doc.id,
                        dayOfWeek=day, startTime="08:00", endTime="16:00",
                        slotMinutes=30, isActive=True,
                    ))
        print("[OK] Doctor availability")

        # ── 5. PATIENTS ──────────────────────────────────────────────────────
        patients_raw = [
            ("Mohammad", "Al-Rashid",   "1985-03-12", "MALE",   "+962 79 111 0001", "A_POS",  ["Penicillin"],           ["Hypertension", "Type 2 Diabetes"]),
            ("Fatima",   "Khalil",      "1990-07-24", "FEMALE", "+962 79 111 0002", "B_POS",  [],                       ["Asthma"]),
            ("Omar",     "Hamdan",      "1978-11-05", "MALE",   "+962 79 111 0003", "O_POS",  ["Sulfa"],                ["Hypothyroidism"]),
            ("Layla",    "Abu-Jaber",   "1995-02-18", "FEMALE", "+962 79 111 0004", "AB_NEG", [],                       []),
            ("Khalid",   "Al-Zoubi",    "1965-08-30", "MALE",   "+962 79 111 0005", "A_NEG",  ["Aspirin", "Ibuprofen"], ["Hypertension", "CAD"]),
            ("Reem",     "Nasser",      "2000-05-10", "FEMALE", "+962 79 111 0006", "O_NEG",  [],                       ["Migraine"]),
            ("Tariq",    "Smadi",       "1972-12-20", "MALE",   "+962 79 111 0007", "B_NEG",  [],                       ["GERD"]),
            ("Hana",     "Barakat",     "1988-09-15", "FEMALE", "+962 79 111 0008", "A_POS",  ["Codeine"],              ["Anxiety disorder"]),
            ("Samir",    "Najjar",      "1959-04-02", "MALE",   "+962 79 111 0009", "AB_POS", [],                       ["Type 2 Diabetes", "CKD stage 2"]),
            ("Dana",     "Mansour",     "2005-01-28", "FEMALE", "+962 79 111 0010", "O_POS",  ["Amoxicillin"],          []),
            ("Bilal",    "Issa",        "1993-06-11", "MALE",   "+962 79 111 0011", "B_POS",  [],                       ["Epilepsy"]),
            ("Mona",     "Saleh",       "1981-10-07", "FEMALE", "+962 79 111 0012", "A_POS",  [],                       ["Rheumatoid Arthritis"]),
            ("Jad",      "Khoury",      "2018-03-22", "MALE",   "+962 79 111 0013", "O_POS",  [],                       []),
            ("Nadia",    "Awad",        "1970-07-19", "FEMALE", "+962 79 111 0014", "B_POS",  ["Latex"],                ["Osteoporosis"]),
            ("Fadi",     "Haddad",      "1986-12-03", "MALE",   "+962 79 111 0015", "A_NEG",  [],                       ["Asthma", "Hypertension"]),
            ("Rana",     "Qasim",       "1998-08-14", "FEMALE", "+962 79 111 0016", "AB_POS", [],                       []),
            ("Ayman",    "Tawfiq",      "1975-05-25", "MALE",   "+962 79 111 0017", "O_NEG",  ["Cephalosporins"],       ["Dyslipidemia"]),
            ("Suha",     "Barakat",     "1983-11-30", "FEMALE", "+962 79 111 0018", "B_NEG",  [],                       ["PCOS"]),
            ("Ziad",     "Haddadin",    "1962-02-08", "MALE",   "+962 79 111 0019", "A_POS",  [],                       ["CAD", "HFrEF"]),
            ("Lara",     "Nimri",       "2010-09-17", "FEMALE", "+962 79 111 0020", "O_POS",  [],                       []),
        ]

        patient_ids = []
        mrn_counter = db.query(models.Patient).count()
        for (fn, ln, dob, gender, phone, bt, allergies, chronic) in patients_raw:
            mrn_counter += 1
            mrn = f"MRN-{mrn_counter:05d}"
            existing = db.query(models.Patient).filter(models.Patient.phone == phone).first()
            if not existing:
                p = models.Patient(
                    id=generate_id(), mrn=mrn,
                    firstName=fn, lastName=ln,
                    dateOfBirth=datetime.strptime(dob, "%Y-%m-%d"),
                    gender=gender, phone=phone, bloodType=bt,
                    allergies=allergies, chronicConditions=chronic,
                    nationality="Jordanian",
                    address="Amman, Jordan",
                    emergencyContactName=f"{ln} Family",
                    emergencyContactPhone=phone[:-1] + "9",
                    insuranceProvider="Jordan Healthcare Insurance",
                    insurancePolicyNo=f"JHI-{mrn_counter:05d}",
                    insuranceCoverageType="Comprehensive",
                    insuranceExpiry=d(365),
                    isActive=True, lastVisit=d(-7),
                )
                db.add(p)
                db.flush()
                patient_ids.append(p.id)
            else:
                patient_ids.append(existing.id)
        print(f"[OK] {len(patient_ids)} patients")

        # ── 6. APPOINTMENTS + CONSULTATIONS + VITALS + DIAGNOSES + PRESCRIPTIONS ──
        admin_user = db.query(models.User).filter(models.User.email == "admin@mediflow.com").first()
        doc_ahmad   = doc_map.get("ahmad@mediflow.com")
        doc_rania   = doc_map.get("rania@mediflow.com")
        doc_tariq   = doc_map.get("tariq@mediflow.com")
        doc_lina    = doc_map.get("lina@mediflow.com")
        doc_khalid  = doc_map.get("khalid@mediflow.com")
        doc_firas   = doc_map.get("firas@mediflow.com")

        consult_scenarios = [
            # (patient_idx, doctor, days_ago, chief_complaint, icd, icd_desc, drug, dosage, freq, dur, bp_sys, bp_dia, hr, temp, wt, ht)
            (0, doc_ahmad,  14, "Persistent headache and elevated blood pressure", "I10",    "Essential hypertension",           "Amlodipine 5mg",       "5mg",     "Once daily",     "30 days", 160, 95, 88, 37.1, 87, 175),
            (1, doc_ahmad,  10, "Wheezing and shortness of breath",                "J45.40",  "Moderate persistent asthma",       "Salbutamol inhaler",   "2 puffs", "Every 4-6h PRN", "14 days", 118, 76, 96, 37.3, 62, 165),
            (2, doc_khalid, 7,  "Chest pain on exertion and palpitations",         "I25.10",  "CAD without angina",               "Bisoprolol 5mg",       "5mg",     "Once daily",     "60 days", 148, 90, 102, 37.0, 93, 178),
            (3, doc_lina,   5,  "Irregular periods and lower abdominal pain",      "N91.2",   "Amenorrhea, unspecified",          "Progesterone 200mg",   "200mg",   "Twice daily",    "21 days", 110, 70, 78, 36.8, 58, 162),
            (4, doc_khalid, 3,  "Chest tightness and exertional dyspnea",          "I50.20",  "HFrEF, NYHA class II",             "Furosemide 40mg",      "40mg",    "Once daily",     "30 days", 155, 92, 94, 36.9, 99, 172),
            (5, doc_ahmad,  2,  "Severe unilateral headache with photophobia",     "G43.909", "Migraine unspecified",             "Sumatriptan 50mg",     "50mg",    "As needed",      "10 tabs", 122, 78, 84, 36.7, 65, 168),
            (6, doc_ahmad,  1,  "Epigastric pain worse after meals",               "K21.0",   "GERD with esophagitis",            "Omeprazole 20mg",      "20mg",    "Before breakfast","30 days", 126, 82, 80, 36.8, 80, 176),
            (7, doc_tariq,  0,  "Ear pain and fever — child 8 years old",          "H66.90",  "Otitis media, unspecified",        "Amoxicillin 250mg",    "250mg",   "Three times daily","7 days", 100, 62, 104, 38.2, 28, 128),
            (8, doc_ahmad,  8,  "Fatigue, polyuria, polydipsia",                   "E11.9",   "Type 2 Diabetes without complication", "Metformin 500mg", "500mg",   "Twice daily",    "30 days", 132, 84, 76, 36.6, 95, 170),
            (9, doc_rania,  6,  "Right iliac fossa pain worsening over 24h",       "K37",     "Unspecified appendicitis",         "Paracetamol 500mg",    "500mg",   "Every 6h",       "5 days",  112, 72, 96, 38.4, 55, 160),
        ]

        appt_ids = []
        consult_ids = []

        for (pidx, doc, days_ago, cc, icd, icd_desc, drug, dosage, freq, dur, bp_s, bp_d, hr_, temp, wt, ht) in consult_scenarios:
            if not doc:
                continue
            pat_id = patient_ids[pidx]
            appt_time = d(-days_ago).replace(hour=9 + pidx % 8, minute=0, second=0, microsecond=0)

            # Check for duplicate appointment
            existing_appt = db.query(models.Appointment).filter(
                models.Appointment.patientId == pat_id,
                models.Appointment.doctorId == doc.id,
                models.Appointment.scheduledAt == appt_time,
            ).first()
            if existing_appt:
                appt_ids.append(existing_appt.id)
                c = db.query(models.Consultation).filter(models.Consultation.appointmentId == existing_appt.id).first()
                if c:
                    consult_ids.append(c.id)
                continue

            appt = models.Appointment(
                id=generate_id(), patientId=pat_id, doctorId=doc.id,
                scheduledAt=appt_time,
                scheduledEnd=appt_time + timedelta(minutes=30),
                status="COMPLETED",
                type="CONSULTATION",
                reason=cc,
                room=f"Room {pidx % 5 + 1}",
                checkedInAt=appt_time - timedelta(minutes=15),
                completedAt=appt_time + timedelta(minutes=25),
                createdById=admin_user.id if admin_user else None,
            )
            db.add(appt)
            db.flush()
            appt_ids.append(appt.id)

            bmi = round(wt / ((ht / 100) ** 2), 1)
            c = models.Consultation(
                id=generate_id(), appointmentId=appt.id,
                patientId=pat_id, doctorId=doc.id,
                chiefComplaint=cc,
                subjective=f"Patient presents with {cc.lower()} for the past few days.",
                objective=f"BP {bp_s}/{bp_d} mmHg, HR {hr_} bpm, Temp {temp}°C, Wt {wt}kg, Ht {ht}cm.",
                assessment=f"{icd_desc}.",
                plan=f"Start {drug}. Advise lifestyle modifications. Follow up in 4 weeks.",
                isLocked=(days_ago > 1),
                lockedAt=d(-days_ago + 1) if days_ago > 1 else None,
            )
            db.add(c)
            db.flush()
            consult_ids.append(c.id)

            db.add(models.Vitals(
                id=generate_id(), consultationId=c.id,
                bpSystolic=bp_s, bpDiastolic=bp_d,
                heartRate=hr_, temperature=temp,
                weight=wt, height=ht, bmi=bmi,
                spo2=98, bloodGlucose=None if pidx != 8 else 11.4,
                respiratoryRate=18,
                recordedById=admin_user.id if admin_user else None,
            ))

            db.add(models.Diagnosis(
                id=generate_id(), consultationId=c.id,
                icdCode=icd, description=icd_desc, type="PRIMARY",
            ))

            med = db.query(models.Medication).filter(models.Medication.genericName.like(f"%{drug.split()[0]}%")).first()
            db.add(models.Prescription(
                id=generate_id(), consultationId=c.id,
                medicationId=med.id if med else None,
                medicationName=drug, dosage=dosage,
                frequency=freq, duration=dur,
                quantity=30 if "days" in dur else 10,
                instructions="Take with food. Avoid alcohol.",
            ))

        print(f"[OK] {len(consult_ids)} consultations with vitals/diagnoses/prescriptions")

        # ── Future appointments ───────────────────────────────────────────────
        future_appts = [
            (10, doc_ahmad,  2, "Routine follow-up"),
            (11, doc_rania,  3, "Post-operative check"),
            (12, doc_tariq,  1, "Fever and rash — child"),
            (13, doc_lina,   4, "Antenatal checkup"),
            (14, doc_khalid, 2, "Hypertension follow-up"),
            (15, doc_ahmad,  5, "Thyroid function review"),
            (16, doc_khalid, 3, "Lipid panel results review"),
            (17, doc_lina,   6, "Menstrual irregularity"),
            (18, doc_ahmad,  7, "Diabetes management"),
            (19, doc_tariq,  1, "Well child visit"),
        ]
        for (pidx, doc, days_ahead, reason) in future_appts:
            if not doc or pidx >= len(patient_ids):
                continue
            pat_id = patient_ids[pidx]
            appt_time = d(days_ahead).replace(hour=10 + pidx % 6, minute=0, second=0, microsecond=0)
            existing = db.query(models.Appointment).filter(
                models.Appointment.patientId == pat_id,
                models.Appointment.doctorId == doc.id,
                models.Appointment.scheduledAt == appt_time,
            ).first()
            if not existing:
                db.add(models.Appointment(
                    id=generate_id(), patientId=pat_id, doctorId=doc.id,
                    scheduledAt=appt_time,
                    scheduledEnd=appt_time + timedelta(minutes=30),
                    status="SCHEDULED",
                    type="CONSULTATION", reason=reason,
                    room=f"Room {pidx % 5 + 1}",
                    createdById=admin_user.id if admin_user else None,
                ))
        print("[OK] Future appointments")

        # ── 7. LAB ORDERS + RESULTS ──────────────────────────────────────────
        lab_scenarios = [
            (0, doc_ahmad,  14, ["CBC", "Lipid Panel", "HbA1c"],         "VENOUS_BLOOD", "RESULTS_RELEASED"),
            (1, doc_ahmad,  10, ["CBC", "Spirometry", "IgE level"],      "VENOUS_BLOOD", "RESULTS_RELEASED"),
            (2, doc_khalid,  7, ["Troponin I", "BNP", "CBC", "CMP"],     "VENOUS_BLOOD", "RESULTS_RELEASED"),
            (4, doc_khalid,  3, ["BNP", "Creatinine", "Electrolytes"],   "VENOUS_BLOOD", "IN_PROGRESS"),
            (6, doc_ahmad,   1, ["H. pylori antigen", "CBC"],            "STOOL",        "PENDING_COLLECTION"),
            (8, doc_ahmad,   8, ["HbA1c", "Fasting glucose", "Creatinine", "Lipid Panel"], "VENOUS_BLOOD", "RESULTS_RELEASED"),
        ]

        lab_order_ids = []
        for (pidx, doc, days_ago, tests, specimen, status) in lab_scenarios:
            if not doc or pidx >= len(patient_ids):
                continue
            pat_id = patient_ids[pidx]
            # find consultation
            appt = db.query(models.Appointment).filter(
                models.Appointment.patientId == pat_id,
                models.Appointment.doctorId == doc.id,
                models.Appointment.status == "COMPLETED",
            ).order_by(models.Appointment.scheduledAt.desc()).first()
            c_id = None
            if appt:
                c = db.query(models.Consultation).filter(models.Consultation.appointmentId == appt.id).first()
                if c:
                    c_id = c.id

            existing_lo = db.query(models.LabOrder).filter(
                models.LabOrder.patientId == pat_id,
                models.LabOrder.consultationId == c_id,
            ).first()
            if existing_lo:
                lab_order_ids.append(existing_lo.id)
                continue

            lo = models.LabOrder(
                id=generate_id(), patientId=pat_id,
                consultationId=c_id,
                orderedByDoctorId=doc.id,
                tests=tests,
                priority="ROUTINE",
                status=status,
                specimenType=specimen,
                specimenCollected=(status != "PENDING_COLLECTION"),
                collectedAt=d(-days_ago) if status != "PENDING_COLLECTION" else None,
            )
            db.add(lo)
            db.flush()
            lab_order_ids.append(lo.id)

            if status == "RESULTS_RELEASED":
                result_data = {
                    "CBC": [("WBC", "7.2", "x10³/μL", "4.5-11.0", False), ("HGB", "13.8", "g/dL", "13.5-17.5", False), ("PLT", "220", "x10³/μL", "150-400", False)],
                    "Lipid Panel": [("Total Cholesterol", "215", "mg/dL", "<200", True), ("LDL", "142", "mg/dL", "<100", True), ("HDL", "42", "mg/dL", ">40", False), ("TG", "180", "mg/dL", "<150", True)],
                    "HbA1c": [("HbA1c", "8.4" if pidx == 8 else "5.6", "%", "<5.7", pidx == 8)],
                    "Fasting glucose": [("Fasting Glucose", "11.2" if pidx == 8 else "5.4", "mmol/L", "3.9-5.6", pidx == 8)],
                    "Troponin I": [("Troponin I", "0.02", "ng/mL", "<0.04", False)],
                    "BNP": [("BNP", "580", "pg/mL", "<100", True)],
                    "Creatinine": [("Creatinine", "88", "μmol/L", "62-106", False)],
                    "CMP": [("Na", "138", "mEq/L", "135-145", False), ("K", "4.1", "mEq/L", "3.5-5.0", False), ("ALT", "32", "U/L", "<41", False)],
                }
                for test in tests:
                    for (tname, val, unit, ref, abnormal) in result_data.get(test, []):
                        db.add(models.LabResult(
                            id=generate_id(), labOrderId=lo.id,
                            testName=tname, value=val, unit=unit,
                            referenceRange=ref, isAbnormal=abnormal,
                            isCritical=(abnormal and ("BNP" in tname or "Troponin" in tname)),
                            enteredById=admin_user.id if admin_user else None,
                            validatedAt=d(-days_ago + 1),
                        ))
        print(f"[OK] {len(lab_order_ids)} lab orders with results")

        # ── 8. RADIOLOGY ORDERS ──────────────────────────────────────────────
        rad_scenarios = [
            (2, doc_khalid, 7,  "CT",   "CT Coronary Angiography",        "Chest",      "URGENT",  "REPORT_READY"),
            (4, doc_khalid, 3,  "ECHO", "2D Echocardiography",             "Heart",      "URGENT",  "REPORT_READY"),
            (0, doc_ahmad,  14, "XRAY", "Chest X-Ray PA",                  "Chest",      "ROUTINE", "REPORT_READY"),
            (9, doc_rania,  6,  "CT",   "CT Abdomen & Pelvis with contrast","Abdomen",   "URGENT",  "IMAGES_ACQUIRED"),
            (6, doc_ahmad,  1,  "XRAY", "Abdominal X-Ray supine & erect",  "Abdomen",    "ROUTINE", "PENDING"),
            (8, doc_ahmad,  8,  "XRAY", "Foot X-Ray AP & lateral",         "Right foot", "ROUTINE", "REPORT_READY"),
            (3, doc_lina,   5,  "US",   "Pelvic Ultrasound",               "Pelvis",     "ROUTINE", "REPORT_READY"),
            (14, doc_khalid, 3, "MRI",  "Brain MRI with contrast",         "Brain",      "ROUTINE", "SCHEDULED"),
        ]

        for (pidx, doc, days_ago, modality, study, body_part, priority, status) in rad_scenarios:
            if not doc or pidx >= len(patient_ids):
                continue
            pat_id = patient_ids[pidx]
            appt = db.query(models.Appointment).filter(
                models.Appointment.patientId == pat_id,
                models.Appointment.doctorId == doc.id,
            ).order_by(models.Appointment.scheduledAt.desc()).first()
            c_id = None
            if appt:
                c = db.query(models.Consultation).filter(models.Consultation.appointmentId == appt.id).first()
                if c:
                    c_id = c.id

            existing = db.query(models.RadiologyOrder).filter(
                models.RadiologyOrder.patientId == pat_id,
                models.RadiologyOrder.study == study,
            ).first()
            if existing:
                continue

            report_text = None
            if status == "REPORT_READY":
                report_text = f"Findings: No acute abnormality. Normal study. Reported by: Dr. F. Hammouri."

            db.add(models.RadiologyOrder(
                id=generate_id(), patientId=pat_id,
                consultationId=c_id,
                orderedByDoctorId=doc.id,
                modality=modality, study=study, bodyPart=body_part,
                priority=priority, status=status,
                scheduledAt=d(-days_ago + 1) if status not in ("PENDING",) else None,
                performedAt=d(-days_ago + 1) if status in ("IMAGES_ACQUIRED", "REPORT_READY") else None,
                report=report_text,
                reportedById=doc_firas.id if doc_firas and status == "REPORT_READY" else None,
                clinicalInfo=f"Clinical: {study} requested for evaluation.",
            ))
        print("[OK] Radiology orders")

        # ── 9. MEDICATIONS ───────────────────────────────────────────────────
        meds_data = [
            # (generic, brand, category, unit, stock, min_stock, reorder, cost, price, controlled, rx)
            ("Amlodipine 5mg",         "Norvasc",         "Cardiovascular",    "Tablet",  250, 50,  100, Decimal("0.15"), Decimal("0.35"), False, True),
            ("Amlodipine 10mg",        "Norvasc 10",      "Cardiovascular",    "Tablet",  180, 40,  80,  Decimal("0.20"), Decimal("0.45"), False, True),
            ("Metformin 500mg",        "Glucophage",      "Antidiabetic",      "Tablet",  500, 100, 150, Decimal("0.08"), Decimal("0.20"), False, True),
            ("Metformin 1000mg",       "Glucophage XR",   "Antidiabetic",      "Tablet",  300, 60,  100, Decimal("0.12"), Decimal("0.30"), False, True),
            ("Omeprazole 20mg",        "Losec",           "GI",                "Capsule", 400, 80,  120, Decimal("0.18"), Decimal("0.40"), False, True),
            ("Furosemide 40mg",        "Lasix",           "Diuretic",          "Tablet",  200, 40,  80,  Decimal("0.10"), Decimal("0.25"), False, True),
            ("Bisoprolol 5mg",         "Concor",          "Cardiovascular",    "Tablet",  150, 30,  60,  Decimal("0.25"), Decimal("0.55"), False, True),
            ("Amoxicillin 500mg",      "Amoxil",          "Antibiotic",        "Capsule", 600, 100, 200, Decimal("0.12"), Decimal("0.30"), False, True),
            ("Amoxicillin 250mg/5ml",  "Amoxil Susp",     "Antibiotic",        "Bottle",  80,  20,  40,  Decimal("1.50"), Decimal("3.50"), False, True),
            ("Paracetamol 500mg",      "Panadol",         "Analgesic",         "Tablet",  1000,200, 300, Decimal("0.05"), Decimal("0.12"), False, False),
            ("Paracetamol 125mg Susp", "Panadol Baby",    "Analgesic",         "Bottle",  120, 30,  50,  Decimal("1.20"), Decimal("2.80"), False, False),
            ("Ibuprofen 400mg",        "Brufen",          "NSAID",             "Tablet",  350, 70,  100, Decimal("0.08"), Decimal("0.20"), False, False),
            ("Salbutamol inhaler",     "Ventolin",        "Respiratory",       "Inhaler", 60,  15,  25,  Decimal("3.50"), Decimal("7.50"), False, True),
            ("Salbutamol 2mg",         "Ventolin tabs",   "Respiratory",       "Tablet",  200, 40,  60,  Decimal("0.10"), Decimal("0.25"), False, True),
            ("Sumatriptan 50mg",       "Imigran",         "Neurological",      "Tablet",  80,  20,  30,  Decimal("1.20"), Decimal("2.80"), False, True),
            ("Atorvastatin 20mg",      "Lipitor",         "Cardiovascular",    "Tablet",  300, 60,  100, Decimal("0.20"), Decimal("0.50"), False, True),
            ("Atorvastatin 40mg",      "Lipitor 40",      "Cardiovascular",    "Tablet",  200, 40,  80,  Decimal("0.28"), Decimal("0.65"), False, True),
            ("Levothyroxine 50mcg",    "Euthyrox",        "Hormonal",          "Tablet",  150, 30,  50,  Decimal("0.22"), Decimal("0.50"), False, True),
            ("Metoprolol 50mg",        "Lopressor",       "Cardiovascular",    "Tablet",  120, 25,  50,  Decimal("0.18"), Decimal("0.42"), False, True),
            ("Progesterone 200mg",     "Utrogestan",      "Hormonal",          "Capsule", 90,  20,  35,  Decimal("0.80"), Decimal("1.80"), False, True),
            ("Omeprazole 40mg",        "Losec 40",        "GI",                "Capsule", 180, 40,  60,  Decimal("0.25"), Decimal("0.60"), False, True),
            ("Codeine 30mg",           "Codalgin",        "Analgesic",         "Tablet",  50,  10,  20,  Decimal("0.30"), Decimal("0.70"), True,  True),
            ("Tramadol 50mg",          "Tramal",          "Analgesic",         "Capsule", 8,   15,  25,  Decimal("0.40"), Decimal("0.90"), True,  True),
            ("Insulin Glargine",       "Lantus",          "Antidiabetic",      "Vial",    40,  10,  20,  Decimal("12.00"),Decimal("25.00"),False, True),
            ("Normal Saline 0.9% 1L",  "NS 1L",           "IV Fluid",          "Bag",     200, 50,  80,  Decimal("0.80"), Decimal("2.00"), False, True),
        ]

        med_ids = {}
        for (generic, brand, cat, unit, stock, min_s, reorder, cost, price, ctrl, rx) in meds_data:
            existing = db.query(models.Medication).filter(models.Medication.genericName == generic).first()
            if not existing:
                m = models.Medication(
                    id=generate_id(), genericName=generic, brandName=brand,
                    category=cat, unit=unit,
                    stockQuantity=stock, minStockLevel=min_s,
                    reorderLevel=reorder, unitCost=cost,
                    sellingPrice=price,
                    isControlled=ctrl, requiresPrescription=rx,
                    isActive=True,
                    location=f"Shelf {cat[:3].upper()}-{len(med_ids)+1:02d}",
                )
                db.add(m)
                db.flush()
                med_ids[generic] = m.id

                # Batch
                db.add(models.MedicationBatch(
                    id=generate_id(), medicationId=m.id,
                    batchNumber=f"BATCH-{generate_id()[:8].upper()}",
                    quantity=stock,
                    expiryDate=d(365 + (len(med_ids) * 7)),
                    unitCost=cost,
                ))

                # Stock movement — initial receipt
                u_yousef = db.query(models.User).filter(models.User.email == "yousef@mediflow.com").first()
                db.add(models.StockMovement(
                    id=generate_id(), medicationId=m.id,
                    type="RECEIPT", quantity=stock,
                    previousQty=0, newQty=stock,
                    reason="Initial stock receipt",
                    performedById=u_yousef.id if u_yousef else (admin_user.id if admin_user else None),
                ))
            else:
                med_ids[generic] = existing.id

        print(f"[OK] {len(med_ids)} medications with batches and stock movements")

        # ── 10. INVOICES + PAYMENTS ──────────────────────────────────────────
        invoice_counter = db.query(models.Invoice).count()
        paid_pairs = [
            (0, 0, 80,  "CARD"),
            (1, 1, 70,  "INSURANCE"),
            (2, 2, 120, "INSURANCE"),
            (3, 3, 90,  "CASH"),
            (4, 4, 120, "CARD"),
            (5, 5, 80,  "CASH"),
            (6, 6, 80,  "CASH"),
            (7, 7, 70,  "INSURANCE"),
            (8, 8, 80,  "INSURANCE"),
        ]
        for (pidx, appt_idx, fee, method) in paid_pairs:
            if appt_idx >= len(appt_ids) or pidx >= len(patient_ids):
                continue
            appt_id = appt_ids[appt_idx]
            existing = db.query(models.Invoice).filter(models.Invoice.appointmentId == appt_id).first()
            if existing:
                continue
            invoice_counter += 1
            inv_no = f"INV-{invoice_counter:05d}"
            tax = round(fee * 0.16, 2)
            total = round(fee + tax, 2)
            inv = models.Invoice(
                id=generate_id(), invoiceNo=inv_no,
                patientId=patient_ids[pidx],
                appointmentId=appt_id,
                dueDate=d(30),
                subtotal=fee, taxRate=16, taxAmount=tax,
                totalAmount=total, paidAmount=total,
                balance=0, status="PAID",
                createdById=admin_user.id if admin_user else None,
            )
            db.add(inv)
            db.flush()

            db.add(models.InvoiceItem(
                id=generate_id(), invoiceId=inv.id,
                description="Consultation Fee",
                category="Consultation",
                quantity=1, unitPrice=fee,
                totalPrice=fee, serviceCode="CONS-001",
            ))

            db.add(models.Payment(
                id=generate_id(), invoiceId=inv.id,
                amount=total, method=method,
                referenceNo=f"PAY-{generate_id()[:8].upper()}",
                recordedById=admin_user.id if admin_user else None,
            ))

        # 3 pending invoices
        for i, (pidx, fee) in enumerate([(10, 80), (11, 100), (12, 70)]):
            if pidx >= len(patient_ids):
                continue
            invoice_counter += 1
            inv_no = f"INV-{invoice_counter:05d}"
            tax = round(fee * 0.16, 2)
            total = round(fee + tax, 2)
            existing_inv = db.query(models.Invoice).filter(models.Invoice.invoiceNo == inv_no).first()
            if not existing_inv:
                inv = models.Invoice(
                    id=generate_id(), invoiceNo=inv_no,
                    patientId=patient_ids[pidx],
                    dueDate=d(14 + i * 7),
                    subtotal=fee, taxRate=16, taxAmount=tax,
                    totalAmount=total, paidAmount=0,
                    balance=total, status="PENDING",
                    createdById=admin_user.id if admin_user else None,
                )
                db.add(inv)
                db.flush()
                db.add(models.InvoiceItem(
                    id=generate_id(), invoiceId=inv.id,
                    description="Consultation Fee",
                    category="Consultation",
                    quantity=1, unitPrice=fee,
                    totalPrice=fee, serviceCode="CONS-001",
                ))
        print("[OK] Invoices and payments")

        # ── 11. VENDORS ──────────────────────────────────────────────────────
        vendors_data = [
            ("Jordan Pharma Supplies",  "Khalid Mansour",  "+962 6 555 2001", "jps@example.com",  "Amman, Jordan",  "JPS-TAX-001", "Net 30", True),
            ("MedTech Equipment Co.",   "Randa Saleh",     "+962 6 555 2002", "medtech@example.com","Zarqa, Jordan", "MTE-TAX-002", "Net 45", True),
            ("Al-Shifaa Distributors",  "Hassan Najjar",   "+962 6 555 2003", "alshifaa@example.com","Irbid, Jordan","ASD-TAX-003", "Net 30", False),
            ("Global Lab Solutions",    "Layla Ibrahim",   "+962 6 555 2004", "gls@example.com",  "Amman, Jordan",  "GLS-TAX-004", "Net 60", True),
            ("Office Supplies Ltd.",    "Samer Haddad",    "+962 6 555 2005", "osl@example.com",  "Amman, Jordan",  "OSL-TAX-005", "Net 30", False),
        ]
        vendor_ids = []
        for (name, contact, phone, email, addr, tax_id, terms, preferred) in vendors_data:
            existing = db.query(models.Vendor).filter(models.Vendor.email == email).first()
            if not existing:
                v = models.Vendor(
                    id=generate_id(), name=name, contactPerson=contact,
                    phone=phone, email=email, address=addr,
                    taxId=tax_id, paymentTerms=terms,
                    rating=4 if preferred else 3,
                    isPreferred=preferred, isActive=True,
                )
                db.add(v)
                db.flush()
                vendor_ids.append(v.id)
            else:
                vendor_ids.append(existing.id)
        print(f"[OK] {len(vendor_ids)} vendors")

        # ── 12. PURCHASE ORDERS ──────────────────────────────────────────────
        po_counter = db.query(models.PurchaseOrder).count()
        po_scenarios = [
            (0, "COMPLETED",  -30, [("Amoxicillin 500mg", 500, 0.12), ("Paracetamol 500mg", 1000, 0.05)]),
            (0, "COMPLETED",  -15, [("Amlodipine 5mg", 300, 0.15), ("Metformin 500mg", 400, 0.08)]),
            (1, "APPROVED",   -5,  [("Salbutamol inhaler", 50, 3.50)]),
            (2, "DRAFT",       0,  [("Omeprazole 20mg", 400, 0.18), ("Bisoprolol 5mg", 200, 0.25)]),
            (3, "SUBMITTED",  -2,  [("Normal Saline 0.9% 1L", 200, 0.80)]),
        ]
        for (v_idx, status, days, items) in po_scenarios:
            if v_idx >= len(vendor_ids):
                continue
            po_counter += 1
            po_no = f"PO-2026-{po_counter:04d}"
            existing_po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.poNumber == po_no).first()
            if existing_po:
                continue
            subtotal = sum(qty * price for (_, qty, price) in items)
            po = models.PurchaseOrder(
                id=generate_id(), poNumber=po_no,
                vendorId=vendor_ids[v_idx],
                date=d(days), expectedDelivery=d(days + 7),
                status=status, subtotal=subtotal, totalAmount=subtotal,
                requestedById=admin_user.id if admin_user else None,
                approvedById=admin_user.id if status in ("APPROVED","SUBMITTED","COMPLETED","PARTIALLY_RECEIVED") else None,
                approvedAt=d(days + 1) if status in ("APPROVED","SUBMITTED","COMPLETED","PARTIALLY_RECEIVED") else None,
                receivedAt=d(days + 5) if status == "COMPLETED" else None,
            )
            db.add(po)
            db.flush()
            for (gen_name, qty, price) in items:
                med_id = med_ids.get(gen_name)
                db.add(models.POItem(
                    id=generate_id(), poId=po.id,
                    medicationId=med_id, itemName=gen_name,
                    quantity=qty, unitPrice=price,
                    totalPrice=qty * price,
                    receivedQty=qty if status == "COMPLETED" else 0,
                ))
        print("[OK] Purchase orders")

        # ── 13. EXPENSES ─────────────────────────────────────────────────────
        expense_data = [
            (-30, "Utilities",       "Electricity bill — April",          450.00, "BANK_TRANSFER",  True,  "APPROVED"),
            (-28, "Utilities",       "Water bill — April",                 85.00, "CASH",           True,  "APPROVED"),
            (-25, "Maintenance",     "HVAC maintenance contract",          320.00, "BANK_TRANSFER", False, "APPROVED"),
            (-20, "Medical Supplies","Gloves and consumables batch",       180.00, "CASH",          False, "APPROVED"),
            (-18, "IT",              "Annual antivirus license renewal",   220.00, "CARD",          True,  "APPROVED"),
            (-15, "Utilities",       "Internet & phone — April",           150.00, "BANK_TRANSFER", True,  "APPROVED"),
            (-12, "Cleaning",        "Janitorial supplies",                 95.00, "CASH",          False, "APPROVED"),
            (-10, "Marketing",       "Social media advertising",           200.00, "CARD",          False, "APPROVED"),
            (-8,  "Medical Supplies","Surgical gloves restock",            120.00, "CASH",          False, "PENDING"),
            (-5,  "Maintenance",     "Elevator annual inspection",         400.00, "BANK_TRANSFER", False, "PENDING"),
            (-3,  "Utilities",       "Electricity bill — May",             430.00, "BANK_TRANSFER", True,  "PENDING"),
            (-1,  "Office Supplies", "Printer cartridges and stationery",   75.00, "CASH",          False, "PENDING"),
        ]
        u_nour = db.query(models.User).filter(models.User.email == "nour@mediflow.com").first()
        existing_expense_count = db.query(models.Expense).count()
        if existing_expense_count == 0:
            for (days, cat, desc, amt, method, recurring, status) in expense_data:
                db.add(models.Expense(
                    id=generate_id(), date=d(days), category=cat,
                    description=desc, amount=amt,
                    vendorId=vendor_ids[4] if "Office" in cat else (vendor_ids[0] if "Medical" in cat else None),
                    paymentMethod=method, isRecurring=recurring,
                    status=status,
                    approvedById=admin_user.id if status == "APPROVED" else None,
                    approvedAt=d(days + 1) if status == "APPROVED" else None,
                    recordedById=u_nour.id if u_nour else (admin_user.id if admin_user else None),
                ))
            print(f"[OK] {len(expense_data)} expenses")
        else:
            print(f"  Expenses already exist — skipping.")

        # ── 14. ASSETS ───────────────────────────────────────────────────────
        assets_data = [
            ("MRI Machine 1.5T",             "MED",  "EQUIP-001", "RADIOL",   d(-1095), 280000, 240000, "ACTIVE",    10),
            ("CT Scanner 64-slice",          "MED",  "EQUIP-002", "RADIOL",   d(-730),  350000, 310000, "ACTIVE",    10),
            ("Digital X-Ray Unit",           "MED",  "EQUIP-003", "RADIOL",   d(-548),  95000,  85000,  "ACTIVE",    8),
            ("Ultrasound Machine GE",        "MED",  "EQUIP-004", "RADIOL",   d(-365),  45000,  41000,  "ACTIVE",    7),
            ("ECG Machine 12-lead",          "MED",  "EQUIP-005", "INT-MED",  d(-548),  8500,   7000,   "ACTIVE",    5),
            ("Hematology Analyzer",          "MED",  "EQUIP-006", "LAB",      d(-730),  32000,  26000,  "ACTIVE",    8),
            ("Biochemistry Analyzer",        "MED",  "EQUIP-007", "LAB",      d(-730),  55000,  45000,  "ACTIVE",    8),
            ("Autoclave Sterilizer",         "MED",  "EQUIP-008", "SURGERY",  d(-1095), 12000,  9000,   "ACTIVE",    10),
            ("Patient Monitor 5-para",       "MED",  "EQUIP-009", "ER",       d(-365),  5500,   5000,   "ACTIVE",    5),
            ("Infusion Pump",                "MED",  "EQUIP-010", "INT-MED",  d(-548),  3200,   2800,   "ACTIVE",    5),
            ("Reception Workstation",        "IT",   "IT-001",    "ADMIN",    d(-730),  1800,   1200,   "ACTIVE",    4),
            ("Server Room — Main Server",    "IT",   "IT-002",    "ADMIN",    d(-548),  12000,  9500,   "ACTIVE",    5),
            ("PACS Server",                  "IT",   "IT-003",    "RADIOL",   d(-365),  18000,  16000,  "ACTIVE",    5),
            ("Ambulance (Toyota HiAce)",     "VEH",  "VEH-001",   "ADMIN",    d(-1095), 45000,  30000,  "ACTIVE",    8),
        ]
        existing_asset_count = db.query(models.Asset).count()
        if existing_asset_count < 5:
            asset_counter = existing_asset_count
            for (name, cat, code_prefix, dept_code, pdate, pprice, cval, status, life) in assets_data:
                asset_counter += 1
                asset_code = f"{code_prefix}-{asset_counter:03d}" if db.query(models.Asset).filter(models.Asset.assetCode == code_prefix).first() else code_prefix
                existing_asset = db.query(models.Asset).filter(models.Asset.assetCode == code_prefix).first()
                if not existing_asset:
                    db.add(models.Asset(
                        id=generate_id(), name=name,
                        assetCode=code_prefix, category=cat,
                        departmentId=dept_ids.get(dept_code),
                        purchaseDate=pdate, purchasePrice=pprice,
                        currentValue=cval, status=status,
                        usefulLifeYears=life,
                        salvageValue=pprice * Decimal("0.05"),
                        location=f"{dept_code} department",
                        warrantyExpiry=pdate + timedelta(days=365),
                    ))
            print(f"[OK] Assets")
        else:
            print("  Assets already exist — skipping.")

        # ── 15. LEAVE REQUESTS ───────────────────────────────────────────────
        leave_data = [
            ("sara@mediflow.com",   "ANNUAL", d(-20), d(-16), 5,  "Family vacation",         "APPROVED"),
            ("hana@mediflow.com",   "SICK",   d(-8),  d(-6),  3,  "Flu with fever",          "APPROVED"),
            ("yousef@mediflow.com", "ANNUAL", d(10),  d(17),  7,  "Travel abroad",           "PENDING"),
            ("bilal@mediflow.com",  "SICK",   d(-2),  d(-1),  2,  "Dental procedure",        "APPROVED"),
            ("maha@mediflow.com",   "ANNUAL", d(5),   d(7),   3,  "Personal matters",        "PENDING"),
            ("nour@mediflow.com",   "ANNUAL", d(-60), d(-53), 7,  "Annual leave",            "APPROVED"),
        ]
        for (email, ltype, start, end, days_, reason, status) in leave_data:
            u = db.query(models.User).filter(models.User.email == email).first()
            if not u:
                continue
            emp = db.query(models.Employee).filter(models.Employee.userId == u.id).first()
            if not emp:
                continue
            existing_leave = db.query(models.LeaveRequest).filter(
                models.LeaveRequest.employeeId == emp.id,
                models.LeaveRequest.startDate == start,
            ).first()
            if not existing_leave:
                db.add(models.LeaveRequest(
                    id=generate_id(), employeeId=emp.id,
                    type=ltype, startDate=start, endDate=end,
                    days=days_, reason=reason, status=status,
                    approvedById=admin_user.id if status == "APPROVED" else None,
                    approvedAt=start - timedelta(days=2) if status == "APPROVED" else None,
                ))
        print("[OK] Leave requests")

        # ── 16. PAYROLL ──────────────────────────────────────────────────────
        all_emps = db.query(models.Employee).all()
        if db.query(models.Payroll).count() == 0:
            for emp in all_emps:
                for month_offset in [3, 4]:  # March + April payroll
                    month = month_offset
                    year = 2026
                    allowances = float(emp.housingAllowance or 0) + float(emp.transportAllowance or 0) + float(emp.medicalAllowance or 0)
                    gross = float(emp.basicSalary) + allowances
                    tax = round(gross * 0.05, 2)
                    net = round(gross - tax, 2)
                    existing_payroll = db.query(models.Payroll).filter(
                        models.Payroll.employeeId == emp.id,
                        models.Payroll.month == month,
                        models.Payroll.year == year,
                    ).first()
                    if not existing_payroll:
                        db.add(models.Payroll(
                            id=generate_id(), employeeId=emp.id,
                            month=month, year=year,
                            basicSalary=emp.basicSalary,
                            allowances=allowances, bonus=0,
                            overtimePay=0, deductions=0,
                            taxDeduction=tax,
                            grossSalary=gross, netSalary=net,
                            status="PAID" if month == 3 else "PENDING",
                            processedById=admin_user.id if admin_user and month == 3 else None,
                            processedAt=datetime(2026, 4, 5) if month == 3 else None,
                        ))
            print("[OK] Payroll (March paid, April pending)")
        else:
            print("  Payroll already exists — skipping.")

        # ── 17. ATTENDANCE (last 7 working days) ─────────────────────────────
        if db.query(models.Attendance).count() == 0:
            for emp in all_emps[:8]:  # first 8 employees
                for day_offset in range(-7, 0):
                    att_date = d(day_offset).replace(hour=0, minute=0, second=0, microsecond=0)
                    if att_date.weekday() >= 5:  # skip weekends
                        continue
                    check_in  = att_date.replace(hour=8, minute=0)
                    check_out = att_date.replace(hour=16, minute=15)
                    db.add(models.Attendance(
                        id=generate_id(), employeeId=emp.id,
                        date=att_date, checkIn=check_in, checkOut=check_out,
                        status="PRESENT", overtimeHrs=0.25,
                        isManual=False,
                    ))
            print("[OK] Attendance records")
        else:
            print("  Attendance already exists — skipping.")

        db.commit()
        print("\n[DONE] Full seed complete - all modules populated.")

    except Exception as e:
        db.rollback()
        import traceback; traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
