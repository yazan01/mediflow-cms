"""
Demo data seed — populates ALL modules with realistic test data.
Safe to re-run: skips records that already exist.

Usage:
    cd backend
    .venv\\Scripts\\python seed_demo.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime, timedelta, date
from database import SessionLocal
from auth import hash_password, generate_id
import models

db = SessionLocal()

def d(days=0, hours=0):
    """Return datetime offset from today's midnight."""
    midnight = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    return midnight + timedelta(days=days, hours=hours)

def exists(model, **kwargs):
    return db.query(model).filter_by(**kwargs).first()

# ──────────────────────────────────────────────
# 1. CLINIC SETTINGS
# ──────────────────────────────────────────────
def seed_settings():
    s = db.query(models.ClinicSetting).first()
    if not s:
        s = models.ClinicSetting(id=1)
        db.add(s)
    s.clinicName     = "MediFlow Medical Center"
    s.licenseNumber  = "MOH-2024-JO-00487"
    s.phone          = "+962-6-555-0100"
    s.email          = "info@mediflow.jo"
    s.address        = "Building 12, Al-Medina St., Amman, Jordan 11183"
    s.taxId          = "JO-TAX-987654321"
    s.currency       = "JOD"
    s.timezone       = "Asia/Amman"
    s.taxRate        = 7
    s.invoicePrefix  = "MF"
    s.paymentTerms   = 30
    db.flush()
    print("[OK] Clinic settings")

# ──────────────────────────────────────────────
# 2. DEPARTMENTS (top-up if missing)
# ──────────────────────────────────────────────
DEPT_DATA = [
    ("Medical",          "MED"),
    ("Nursing",          "NRS"),
    ("Administration",   "ADM"),
    ("Finance",          "FIN"),
    ("Human Resources",  "HRD"),
    ("Pharmacy",         "PHR"),
    ("Laboratory",       "LAB"),
    ("Radiology",        "RAD"),
    ("Emergency",        "EMR"),
    ("Pediatrics",       "PED"),
    ("Cardiology",       "CRD"),
]
dept_ids = {}
def seed_departments():
    for name, code in DEPT_DATA:
        row = exists(models.Department, code=code)
        if not row:
            row = models.Department(id=generate_id(), name=name, code=code)
            db.add(row)
            db.flush()
        dept_ids[code] = row.id
    print(f"[OK] Departments ({len(DEPT_DATA)})")

# ──────────────────────────────────────────────
# 3. USERS + DOCTORS + EMPLOYEES
# ──────────────────────────────────────────────
doctor_ids   = {}   # spec_key -> doctor.id
employee_ids = {}   # emp_code -> employee.id
user_ids     = {}   # email -> user.id

DOCTORS = [
    # (email, name, spec, fee, dept_code, emp_code, salary)
    ("doctor@mediflow.com",  "Dr. Ahmad Al-Mansouri",  "Internal Medicine", 150, "MED",  "EMP-001", 2800),
    ("cardio@mediflow.com",  "Dr. Rania Khalil",       "Cardiology",        200, "CRD",  "EMP-002", 3200),
    ("peds@mediflow.com",    "Dr. Tariq Abu-Hassan",   "Pediatrics",        120, "PED",  "EMP-003", 2600),
]
STAFF = [
    # (email, name, roles, job_title, dept_code, emp_code, salary)
    ("nurse1@mediflow.com",  "Sara Al-Qudah",      ["NURSE"],       "Head Nurse",       "NRS", "EMP-004", 900),
    ("nurse2@mediflow.com",  "Lina Hamdan",         ["NURSE"],       "Staff Nurse",      "NRS", "EMP-005", 800),
    ("recept@mediflow.com",  "Omar Shatnawi",       ["RECEPTIONIST"],"Receptionist",     "ADM", "EMP-006", 700),
    ("pharm@mediflow.com",   "Dina Nassar",         ["PHARMACIST"],  "Pharmacist",       "PHR", "EMP-007", 1100),
    ("lab@mediflow.com",     "Khalid Bani-Salameh", ["LAB_TECH"],    "Lab Technician",   "LAB", "EMP-008", 850),
    ("rad@mediflow.com",     "Nour Al-Rifai",       ["RAD_TECH"],    "Radiographer",     "RAD", "EMP-009", 950),
    ("finance@mediflow.com", "Hana Madi",           ["ACCOUNTANT"],  "Finance Officer",  "FIN", "EMP-010", 1200),
]

def seed_staff():
    for email, name, spec, fee, dept_code, emp_code, salary in DOCTORS:
        u = exists(models.User, email=email)
        if not u:
            u = models.User(id=generate_id(), name=name, email=email,
                            passwordHash=hash_password("Doctor@1234"),
                            roles=["DOCTOR"], isActive=True,
                            departmentId=dept_ids.get(dept_code))
            db.add(u); db.flush()
        user_ids[email] = u.id

        doc = exists(models.Doctor, userId=u.id)
        if not doc:
            doc = models.Doctor(id=generate_id(), userId=u.id,
                                specialization=spec, consultationFee=fee,
                                departmentId=dept_ids.get(dept_code),
                                licenseNumber=f"JMC-{emp_code}",
                                isAvailable=True)
            db.add(doc); db.flush()
        doctor_ids[spec] = doc.id

        emp = exists(models.Employee, empCode=emp_code)
        if not emp:
            emp = models.Employee(id=generate_id(), empCode=emp_code, userId=u.id,
                                  departmentId=dept_ids.get(dept_code),
                                  jobTitle=f"Specialist — {spec}",
                                  employmentType="FULL_TIME", status="ACTIVE",
                                  basicSalary=salary, hireDate=d(-730))
            db.add(emp); db.flush()
        employee_ids[emp_code] = emp.id

    for email, name, roles, job_title, dept_code, emp_code, salary in STAFF:
        u = exists(models.User, email=email)
        if not u:
            u = models.User(id=generate_id(), name=name, email=email,
                            passwordHash=hash_password("Staff@1234"),
                            roles=roles, isActive=True,
                            departmentId=dept_ids.get(dept_code))
            db.add(u); db.flush()
        user_ids[email] = u.id

        emp = exists(models.Employee, empCode=emp_code)
        if not emp:
            emp = models.Employee(id=generate_id(), empCode=emp_code, userId=u.id,
                                  departmentId=dept_ids.get(dept_code),
                                  jobTitle=job_title, employmentType="FULL_TIME",
                                  status="ACTIVE", basicSalary=salary,
                                  hireDate=d(-365))
            db.add(emp); db.flush()
        employee_ids[emp_code] = emp.id

    print(f"[OK] Users / Doctors / Employees ({len(DOCTORS)+len(STAFF)+1})")

# ──────────────────────────────────────────────
# 4. PATIENTS
# ──────────────────────────────────────────────
PATIENTS_DATA = [
    # (mrn, first, last, dob, gender, phone, blood, allergies, conditions)
    ("MRN-0001","Mohammed","Al-Rashid",  date(1978,3,15),"MALE",  "0791234001","A_POS",["Penicillin"],               ["Hypertension","Type 2 Diabetes"]),
    ("MRN-0002","Fatima",  "Khalil",     date(1992,7,22),"FEMALE","0792234002","B_NEG",[],                           ["Asthma"]),
    ("MRN-0003","Ahmad",   "Nasser",     date(1965,11,5),"MALE",  "0793234003","O_POS",["Sulfa","Aspirin"],          ["Coronary Artery Disease","Hypertension"]),
    ("MRN-0004","Layla",   "Abu-Samra",  date(2005,4,10),"FEMALE","0794234004","AB_POS",[],                          []),
    ("MRN-0005","Kareem",  "Hamdan",     date(1955,9,30),"MALE",  "0795234005","O_NEG",["Ibuprofen"],               ["COPD","Hypertension","Heart Failure"]),
    ("MRN-0006","Nadia",   "Al-Zoubi",   date(1988,1,14),"FEMALE","0796234006","A_NEG",[],                           ["Hypothyroidism"]),
    ("MRN-0007","Rami",    "Barakat",    date(2018,6,3), "MALE",  "0797234007","B_POS",[],                           []),
    ("MRN-0008","Huda",    "Al-Omari",   date(1972,12,25),"FEMALE","0798234008","A_POS",["Codeine"],                 ["Rheumatoid Arthritis"]),
    ("MRN-0009","Yousef",  "Mansour",    date(1945,8,19),"MALE",  "0799234009","AB_NEG",["Latex","Contrast dye"],   ["Type 2 Diabetes","CKD Stage 3","Hypertension"]),
    ("MRN-0010","Sana",    "Sweidan",    date(1995,2,28),"FEMALE","0791234010","O_POS",[],                           ["Migraine"]),
    ("MRN-0011","Ziad",    "Al-Khatib",  date(1983,5,17),"MALE",  "0792234011","A_POS",[],                           ["Hyperlipidemia"]),
    ("MRN-0012","Rana",    "Qasim",      date(2001,10,9),"FEMALE","0793234012","B_POS",[],                           []),
]
patient_ids = {}   # mrn -> patient.id

def seed_patients():
    for mrn, first, last, dob, gender, phone, blood, allergies, conditions in PATIENTS_DATA:
        p = exists(models.Patient, mrn=mrn)
        if not p:
            p = models.Patient(
                id=generate_id(), mrn=mrn, firstName=first, lastName=last,
                dateOfBirth=datetime.combine(dob, datetime.min.time()),
                gender=gender, phone=phone,
                email=f"{first.lower()}.{last.lower().replace('-','')}@example.com",
                nationality="Jordanian",
                bloodType=blood, allergies=allergies,
                chronicConditions=conditions,
                emergencyContactName=f"Family of {first}",
                emergencyContactPhone=phone[:-1] + "9",
                isActive=True,
                lastVisit=d(-7),
            )
            db.add(p); db.flush()
        patient_ids[mrn] = p.id
    print(f"[OK] Patients ({len(PATIENTS_DATA)})")

# ──────────────────────────────────────────────
# 5. APPOINTMENTS + CONSULTATIONS
# ──────────────────────────────────────────────
appt_ids = {}   # key -> appointment.id
consult_ids = {}

def make_appt(key, mrn, spec, days, hours_offset=9, status="COMPLETED",
              room="Room 1", reason="Follow-up visit", appt_type="CONSULTATION"):
    if key in appt_ids:
        return
    pid = patient_ids.get(mrn)
    did = doctor_ids.get(spec)
    if not pid or not did:
        return
    start = d(days, hours_offset)
    appt = models.Appointment(
        id=generate_id(), patientId=pid, doctorId=did,
        scheduledAt=start, scheduledEnd=start + timedelta(minutes=30),
        status=status, type=appt_type, reason=reason, room=room,
        checkedInAt=start - timedelta(minutes=10) if status in ("COMPLETED","IN_CONSULTATION","CHECKED_IN") else None,
        completedAt=start + timedelta(minutes=25)  if status == "COMPLETED" else None,
    )
    db.add(appt); db.flush()
    appt_ids[key] = appt.id

def make_consultation(key, appt_key, mrn, spec,
                      complaint, subjective, assessment, plan,
                      vitals, diagnoses, prescriptions):
    if appt_key not in appt_ids:
        return
    pid = patient_ids.get(mrn)
    did = doctor_ids.get(spec)
    c = models.Consultation(
        id=generate_id(),
        appointmentId=appt_ids[appt_key],
        patientId=pid, doctorId=did,
        chiefComplaint=complaint,
        subjective=subjective,
        assessment=assessment,
        plan=plan,
    )
    db.add(c); db.flush()
    consult_ids[key] = c.id

    # Vitals
    v = vitals
    db.add(models.Vitals(
        id=generate_id(), consultationId=c.id,
        bpSystolic=v[0], bpDiastolic=v[1], heartRate=v[2],
        temperature=v[3], weight=v[4], height=v[5],
        bmi=round(v[4]/(v[5]/100)**2, 1) if v[4] and v[5] else None,
        spo2=v[6],
    ))

    # Diagnoses
    for icd, desc, dtype in diagnoses:
        db.add(models.Diagnosis(
            id=generate_id(), consultationId=c.id,
            icdCode=icd, description=desc, type=dtype,
        ))

    # Prescriptions
    for med_name, dosage, freq, dur, qty in prescriptions:
        db.add(models.Prescription(
            id=generate_id(), consultationId=c.id,
            medicationName=med_name, dosage=dosage,
            frequency=freq, duration=dur, quantity=qty,
        ))

    db.flush()

def seed_appointments():
    # ── Past completed appointments ──────────────────────
    make_appt("A01","MRN-0001","Internal Medicine", -14, 9,  "COMPLETED", "Room 1", "Blood pressure check")
    make_appt("A02","MRN-0003","Cardiology",         -10, 10, "COMPLETED", "Room 3", "Chest pain evaluation")
    make_appt("A03","MRN-0005","Internal Medicine",  -8,  11, "COMPLETED", "Room 1", "COPD follow-up")
    make_appt("A04","MRN-0006","Internal Medicine",  -7,  14, "COMPLETED", "Room 2", "Thyroid check")
    make_appt("A05","MRN-0009","Internal Medicine",  -5,  9,  "COMPLETED", "Room 1", "Diabetes management")
    make_appt("A06","MRN-0004","Pediatrics",         -4,  10, "COMPLETED", "Room 5", "Annual checkup")
    make_appt("A07","MRN-0007","Pediatrics",         -3,  9,  "COMPLETED", "Room 5", "Fever and cough")
    make_appt("A08","MRN-0002","Internal Medicine",  -3,  11, "COMPLETED", "Room 2", "Asthma review")
    make_appt("A09","MRN-0011","Cardiology",         -2,  10, "COMPLETED", "Room 3", "Lipid panel review")
    make_appt("A10","MRN-0008","Internal Medicine",  -1,  14, "COMPLETED", "Room 2", "Joint pain")

    # ── No-shows / Cancelled ─────────────────────────────
    make_appt("A11","MRN-0012","Internal Medicine",  -6,  9,  "NO_SHOW",  "Room 1", "General checkup")
    make_appt("A12","MRN-0010","Internal Medicine",  -2,  15, "CANCELLED", "Room 2", "Headache consultation",
              appt_type="CONSULTATION")

    # ── Today's schedule ─────────────────────────────────
    make_appt("A13","MRN-0001","Internal Medicine",  0,  9,  "CHECKED_IN",     "Room 1", "Follow-up on BP meds")
    make_appt("A14","MRN-0003","Cardiology",          0,  10, "IN_CONSULTATION", "Room 3", "Post-procedure review")
    make_appt("A15","MRN-0006","Internal Medicine",   0,  11, "SCHEDULED",       "Room 2", "Thyroid medication review")
    make_appt("A16","MRN-0004","Pediatrics",           0,  12, "SCHEDULED",       "Room 5", "Routine vaccination")
    make_appt("A17","MRN-0010","Internal Medicine",   0,  14, "SCHEDULED",       "Room 1", "Migraine management")
    make_appt("A18","MRN-0002","Internal Medicine",   0,  15, "SCHEDULED",       "Room 2", "Asthma refill",     appt_type="FOLLOW_UP")

    # ── Future ───────────────────────────────────────────
    make_appt("A19","MRN-0005","Internal Medicine",   2,  9,  "SCHEDULED", "Room 1", "Pulmonology follow-up")
    make_appt("A20","MRN-0008","Internal Medicine",   3,  10, "SCHEDULED", "Room 2", "Rheumatology consult")
    make_appt("A21","MRN-0009","Internal Medicine",   5,  9,  "SCHEDULED", "Room 1", "Kidney function review")
    make_appt("A22","MRN-0011","Cardiology",           7,  10, "SCHEDULED", "Room 3", "Echo follow-up")

    print(f"[OK] Appointments ({len(appt_ids)})")

    # ── Consultations for completed appts ─────────────────
    make_consultation(
        "C01","A01","MRN-0001","Internal Medicine",
        complaint="High blood pressure and occasional headache",
        subjective="Patient reports headaches in the morning. BP poorly controlled on current dose.",
        assessment="Hypertension, inadequately controlled. No end-organ damage.",
        plan="Increase Amlodipine to 10 mg. Dietary counselling. Review in 2 weeks.",
        vitals=(158,95,82,36.8,88,175,98),
        diagnoses=[("I10","Essential Hypertension","PRIMARY"),("R51","Headache","SECONDARY")],
        prescriptions=[
            ("Amlodipine","10 mg","Once daily","90 days",90),
            ("Aspirin","100 mg","Once daily","90 days",90),
        ],
    )
    make_consultation(
        "C02","A02","MRN-0003","Cardiology",
        complaint="Chest tightness and shortness of breath on exertion",
        subjective="Known CAD. Increased angina frequency. No rest pain. Denies syncope.",
        assessment="Unstable angina — optimization of anti-ischemic therapy required.",
        plan="Add Isosorbide Mononitrate. Stress ECG ordered. Cardiology review in 1 week.",
        vitals=(148,92,76,37.0,92,172,97),
        diagnoses=[("I20.0","Unstable angina","PRIMARY"),("I25.1","Atherosclerotic heart disease","SECONDARY")],
        prescriptions=[
            ("Isosorbide Mononitrate","20 mg","Twice daily","30 days",60),
            ("Atorvastatin","40 mg","Once at night","90 days",90),
            ("Clopidogrel","75 mg","Once daily","90 days",90),
        ],
    )
    make_consultation(
        "C03","A03","Internal Medicine",
        complaint="",
        subjective="",
        assessment="",
        plan="",
        vitals=(0, 0, 0, 0, 0, 0, 0),
        diagnoses=[], prescriptions=[],
    ) if False else None  # skip — just example

    make_consultation(
        "C03","A04","MRN-0006","Internal Medicine",
        complaint="Fatigue, weight gain, and feeling cold all the time",
        subjective="TSH elevated on last labs. Currently on Levothyroxine 75mcg.",
        assessment="Hypothyroidism, suboptimally controlled.",
        plan="Increase Levothyroxine to 100 mcg. Repeat TFT in 6 weeks.",
        vitals=(110,70,68,36.4,68,162,97),
        diagnoses=[("E03.9","Hypothyroidism, unspecified","PRIMARY")],
        prescriptions=[("Levothyroxine","100 mcg","Once daily on empty stomach","90 days",90)],
    )
    make_consultation(
        "C04","A05","MRN-0009","Internal Medicine",
        complaint="Poor glucose control and ankle swelling",
        subjective="HbA1c 9.2% last month. Non-compliant with diet. Ankle oedema bilateral.",
        assessment="Type 2 DM poorly controlled. CKD stage 3 — avoid nephrotoxic agents.",
        plan="Add Empagliflozin. Nephrology referral. Strict fluid and salt restriction.",
        vitals=(145,88,80,37.1,102,168,36.2),
        diagnoses=[
            ("E11.65","Type 2 DM with hyperglycaemia","PRIMARY"),
            ("N18.3","Chronic kidney disease, stage 3","SECONDARY"),
            ("I10","Essential hypertension","SECONDARY"),
        ],
        prescriptions=[
            ("Empagliflozin","10 mg","Once daily","30 days",30),
            ("Metformin","500 mg","Twice daily with meals","30 days",60),
            ("Insulin Glargine","10 units","Once at bedtime","30 days",1),
        ],
    )
    make_consultation(
        "C05","A07","MRN-0007","Pediatrics",
        complaint="Fever 38.9°C and productive cough for 3 days",
        subjective="Child aged 6. No sick contacts at school. No vomiting. Eating less.",
        assessment="Viral upper respiratory tract infection. No pneumonia signs.",
        plan="Supportive care. Paracetamol PRN. Return if fever >39.5 or worsening.",
        vitals=(None,None,104,38.9,22,118,None),
        diagnoses=[("J06.9","Acute upper respiratory infection, unspecified","PRIMARY")],
        prescriptions=[
            ("Paracetamol Syrup","200 mg/5ml","Every 6 hours if fever","5 days",1),
            ("Oral Rehydration Salts","As directed","After each loose stool","5 days",2),
        ],
    )
    make_consultation(
        "C06","A08","MRN-0002","Internal Medicine",
        complaint="Increased shortness of breath and wheezing at night",
        subjective="Known asthmatic. Increased use of rescue inhaler — 4× per week. No recent infection.",
        assessment="Asthma, poorly controlled. Step up therapy.",
        plan="Add Salmeterol/Fluticasone combination inhaler. Spacer technique review.",
        vitals=(120,78,88,37.2,65,168,94),
        diagnoses=[("J45.40","Moderate persistent asthma, uncomplicated","PRIMARY")],
        prescriptions=[
            ("Salmeterol/Fluticasone 25/250","1 puff","Twice daily","90 days",1),
            ("Salbutamol Inhaler","200 mcg","PRN — max 4×/day","90 days",1),
        ],
    )
    print(f"[OK] Consultations ({len(consult_ids)})")

# ──────────────────────────────────────────────
# 6. LAB ORDERS + RESULTS
# ──────────────────────────────────────────────
def seed_lab():
    for mrn, spec, appt_key, tests, priority, status, results in [
        ("MRN-0001","Internal Medicine","A01",
         ["CBC","Renal Function","Lipid Panel","HbA1c"],"ROUTINE","RESULTED",
         [("Haemoglobin","13.2","g/dL","13.0–17.0",False),
          ("WBC","7.8","×10⁹/L","4.0–11.0",False),
          ("Creatinine","1.1","mg/dL","0.7–1.3",False),
          ("Total Cholesterol","220","mg/dL","<200",True),
          ("LDL","145","mg/dL","<130",True),
          ("HbA1c","7.8","%","<7.0",True)]),
        ("MRN-0003","Cardiology","A02",
         ["Troponin I","BNP","ECG","Lipid Panel"],"URGENT","RESULTED",
         [("Troponin I","0.08","ng/mL","<0.04",True),
          ("BNP","450","pg/mL","<100",True),
          ("LDL","160","mg/dL","<70",True)]),
        ("MRN-0009","Internal Medicine","A05",
         ["HbA1c","Renal Function","Urine Albumin:Creatinine","eGFR"],"ROUTINE","RESULTED",
         [("HbA1c","9.2","%","<7.0",True),
          ("Creatinine","1.9","mg/dL","0.7–1.3",True),
          ("eGFR","38","mL/min/1.73m²",">60",True),
          ("Urine ACR","85","mg/g","<30",True)]),
        ("MRN-0006","Internal Medicine","A04",
         ["TSH","Free T4","Free T3"],"ROUTINE","RESULTED",
         [("TSH","8.2","mIU/L","0.4–4.0",True),
          ("Free T4","0.8","ng/dL","0.9–1.7",True)]),
        ("MRN-0011","Cardiology","A09",
         ["Lipid Panel","Liver Function","CK"],"ROUTINE","RESULTED",
         [("Total Cholesterol","195","mg/dL","<200",False),
          ("LDL","118","mg/dL","<100",True),
          ("ALT","38","U/L","7–56",False),
          ("CK","182","U/L","22–198",False)]),
        ("MRN-0002","Internal Medicine","A08",
         ["Peak Flow","Spirometry","CBC"],"ROUTINE","COLLECTION",
         []),
        ("MRN-0010","Internal Medicine",None,
         ["CBC","ESR","CRP"],"ROUTINE","PENDING_COLLECTION",
         []),
    ]:
        pid = patient_ids.get(mrn)
        did = doctor_ids.get(spec)
        if not pid or not did:
            continue
        cid = consult_ids.get(appt_key.replace("A","C")) if appt_key else None
        lo = models.LabOrder(
            id=generate_id(), patientId=pid, orderedByDoctorId=did,
            consultationId=cid,
            tests=tests, priority=priority, status=status,
            specimenType="Blood" if priority != "COLLECTION" else "Blood",
            specimenCollected=(status != "PENDING_COLLECTION"),
            collectedAt=d(-1) if status != "PENDING_COLLECTION" else None,
            createdAt=d(-2),
        )
        db.add(lo); db.flush()
        for name, val, unit, ref, abnormal in results:
            db.add(models.LabResult(
                id=generate_id(), labOrderId=lo.id,
                testName=name, value=val, unit=unit,
                referenceRange=ref, isAbnormal=abnormal,
                isCritical=(abnormal and float(val.replace(",","")) > 200 if val.replace(".","").replace(",","").isdigit() else False),
                validatedAt=d(-1) if status == "RESULTED" else None,
            ))
    db.flush()
    print("[OK] Lab orders + results")

# ──────────────────────────────────────────────
# 7. RADIOLOGY ORDERS
# ──────────────────────────────────────────────
def seed_radiology():
    data = [
        ("MRN-0003","Cardiology","A02","XRAY","Chest X-Ray","Chest","URGENT","REPORTED",
         "Cardiomegaly. No pulmonary oedema. No infiltrates."),
        ("MRN-0005","Internal Medicine","A03","CT","CT Chest (HRCT)","Chest","ROUTINE","REPORTED",
         "Bilateral lower-lobe emphysematous changes consistent with COPD. No mass lesion."),
        ("MRN-0008","Internal Medicine","A10","XRAY","X-Ray Both Hands","Hands","ROUTINE","REPORTED",
         "Periarticular erosions at MCP joints bilaterally. Soft tissue swelling. Findings consistent with rheumatoid arthritis."),
        ("MRN-0001","Internal Medicine",None,"ECHO","Echocardiogram","Heart","ROUTINE","PENDING",None),
        ("MRN-0009","Internal Medicine","A05","US","Renal Ultrasound","Kidneys","ROUTINE","REPORTED",
         "Bilateral small echogenic kidneys (right 9.2 cm, left 8.8 cm). Increased parenchymal echogenicity consistent with CKD."),
    ]
    for mrn, spec, appt_key, modality, study, body, priority, status, report in data:
        pid = patient_ids.get(mrn)
        did = doctor_ids.get(spec)
        if not pid or not did:
            continue
        cid = consult_ids.get(appt_key.replace("A","C")) if appt_key else None
        ro = models.RadiologyOrder(
            id=generate_id(), patientId=pid, orderedByDoctorId=did,
            consultationId=cid, modality=modality, study=study,
            bodyPart=body, priority=priority, status=status,
            performedAt=d(-1) if status != "PENDING" else None,
            report=report, createdAt=d(-2),
        )
        db.add(ro)
    db.flush()
    print("[OK] Radiology orders")

# ──────────────────────────────────────────────
# 8. MEDICATIONS + BATCHES + STOCK MOVEMENTS
# ──────────────────────────────────────────────
med_ids = {}
MEDS = [
    # (name, brand, category, unit, stock, min, reorder, cost, price, location, controlled, rx)
    ("Amlodipine 5mg",       "Norvasc",        "Cardiovascular","Tablet",  240, 50, 100, 0.08, 0.35, "Shelf A-1", False, True),
    ("Amlodipine 10mg",      "Norvasc 10",     "Cardiovascular","Tablet",  180, 50, 100, 0.12, 0.50, "Shelf A-1", False, True),
    ("Metformin 500mg",      "Glucophage",     "Endocrine",     "Tablet",  500, 100,200, 0.05, 0.20, "Shelf B-1", False, True),
    ("Metformin 1000mg",     "Glucophage 1G",  "Endocrine",     "Tablet",  350, 100,200, 0.08, 0.30, "Shelf B-1", False, True),
    ("Atorvastatin 40mg",    "Lipitor",        "Cardiovascular","Tablet",  300, 50, 100, 0.15, 0.55, "Shelf A-2", False, True),
    ("Levothyroxine 100mcg", "Eltroxin",       "Endocrine",     "Tablet",  120, 30,  60, 0.10, 0.45, "Shelf B-2", False, True),
    ("Aspirin 100mg",        "Aspocid",        "Cardiovascular","Tablet",  600, 100,200, 0.02, 0.10, "Shelf A-3", False, False),
    ("Paracetamol 500mg",    "Panadol",        "Analgesic",     "Tablet",  800, 200,400, 0.01, 0.08, "Shelf C-1", False, False),
    ("Paracetamol Syrup",    "Panadol Syrup",  "Analgesic",     "Bottle",   60, 20,  40, 0.80, 2.50, "Shelf C-1", False, False),
    ("Salbutamol Inhaler",   "Ventolin",       "Respiratory",   "Inhaler",  45, 10,  20, 1.20, 3.50, "Shelf D-1", False, True),
    ("Salmeterol/Fluticasone","Seretide 25/250","Respiratory",  "Inhaler",  30, 10,  15, 5.00,12.00, "Shelf D-1", False, True),
    ("Clopidogrel 75mg",     "Plavix",         "Cardiovascular","Tablet",  200, 50, 100, 0.25, 0.80, "Shelf A-4", False, True),
    ("Isosorbide Mono 20mg", "Imdur",          "Cardiovascular","Tablet",  150, 30,  60, 0.12, 0.45, "Shelf A-4", False, True),
    ("Empagliflozin 10mg",   "Jardiance",      "Endocrine",     "Tablet",   90, 20,  40, 1.80, 4.50, "Shelf B-3", False, True),
    ("Insulin Glargine",     "Lantus",         "Endocrine",     "Vial",     25,  5,  10, 8.00,18.00, "Fridge F-1",False, True),
    ("Amoxicillin 500mg",    "Amoxil",         "Antibiotic",    "Capsule", 400, 100,200, 0.04, 0.20, "Shelf E-1", False, True),
    ("Azithromycin 500mg",   "Zithromax",      "Antibiotic",    "Tablet",  120, 30,  60, 0.35, 1.20, "Shelf E-1", False, True),
    ("ORS Sachet",           "Pedialyte",      "Supportive",    "Sachet",  200, 50, 100, 0.10, 0.35, "Shelf C-2", False, False),
    ("Omeprazole 20mg",      "Losec",          "Gastro",        "Capsule", 300, 60, 120, 0.08, 0.30, "Shelf C-3", False, True),
    ("Ibuprofen 400mg",      "Brufen",         "Analgesic",     "Tablet",   20, 50, 100, 0.03, 0.15, "Shelf C-1", False, False),  # low stock
]

def seed_pharmacy():
    admin_user = exists(models.User, email="admin@mediflow.com")
    for name, brand, cat, unit, stock, minlv, reorder, cost, price, loc, ctrl, rx in MEDS:
        m = exists(models.Medication, genericName=name)
        if not m:
            m = models.Medication(
                id=generate_id(), genericName=name, brandName=brand,
                category=cat, unit=unit, stockQuantity=stock,
                minStockLevel=minlv, reorderLevel=reorder,
                unitCost=cost, sellingPrice=price,
                location=loc, isControlled=ctrl,
                requiresPrescription=rx, isActive=True,
            )
            db.add(m); db.flush()
            # Batch
            db.add(models.MedicationBatch(
                id=generate_id(), medicationId=m.id,
                batchNumber=f"BT-2024-{m.id[:6].upper()}",
                quantity=stock, expiryDate=d(365),
                unitCost=cost,
            ))
            # Stock-in movement
            if admin_user:
                db.add(models.StockMovement(
                    id=generate_id(), medicationId=m.id,
                    type="STOCK_IN", quantity=stock,
                    previousQty=0, newQty=stock,
                    reason="Initial stock", performedById=admin_user.id,
                ))
        med_ids[name] = m.id
    db.flush()
    print(f"[OK] Medications ({len(MEDS)})")

# ──────────────────────────────────────────────
# 9. INVOICES + PAYMENTS
# ──────────────────────────────────────────────
INVOICE_NO = [0]
def next_inv():
    INVOICE_NO[0] += 1
    return f"MF-2026-{INVOICE_NO[0]:04d}"

def make_invoice(mrn, appt_key, items, status, paid_pct=1.0, days=-7):
    pid = patient_ids.get(mrn)
    if not pid:
        return
    # Avoid duplicate per appointment
    aid = appt_ids.get(appt_key) if appt_key else None
    if aid and exists(models.Invoice, appointmentId=aid):
        return

    subtotal = sum(q*p for _,_,q,p in items)
    disc = 0
    tax  = round(subtotal * 0.07, 2)
    total = round(subtotal + tax - disc, 2)
    paid  = round(total * paid_pct, 2)
    bal   = round(total - paid, 2)

    inv = models.Invoice(
        id=generate_id(), invoiceNo=next_inv(),
        patientId=pid, appointmentId=aid,
        dueDate=d(days + 30),
        subtotal=subtotal, discountAmount=disc,
        taxRate=7, taxAmount=tax,
        totalAmount=total, paidAmount=paid, balance=bal,
        status=status, createdAt=d(days),
    )
    db.add(inv); db.flush()
    for desc, cat, qty, price in items:
        db.add(models.InvoiceItem(
            id=generate_id(), invoiceId=inv.id,
            description=desc, category=cat,
            quantity=qty, unitPrice=price,
            totalPrice=qty*price,
        ))
    if paid > 0:
        admin_user = exists(models.User, email="admin@mediflow.com")
        db.add(models.Payment(
            id=generate_id(), invoiceId=inv.id,
            amount=paid, method="CASH" if paid_pct == 1.0 else "CARD",
            paidAt=d(days + 1),
            recordedById=admin_user.id if admin_user else None,
        ))
    db.flush()

def seed_billing():
    # Force invoice number start
    last = db.query(models.Invoice).count()
    INVOICE_NO[0] = last

    make_invoice("MRN-0001","A01",[
        ("Internal Medicine Consultation","Consultation",1,50),
        ("Blood Pressure Monitoring","Procedure",1,15),
        ("Amlodipine 10mg x90","Pharmacy",1,45),
    ],"PAID", paid_pct=1.0, days=-14)

    make_invoice("MRN-0003","A02",[
        ("Cardiology Consultation","Consultation",1,80),
        ("ECG","Procedure",1,25),
        ("Troponin / BNP Bloods","Laboratory",1,55),
        ("Chest X-Ray","Radiology",1,35),
    ],"PAID", paid_pct=1.0, days=-10)

    make_invoice("MRN-0009","A05",[
        ("Internal Medicine Consultation","Consultation",1,50),
        ("HbA1c + Renal Panel","Laboratory",1,45),
        ("Empagliflozin 10mg x30","Pharmacy",1,135),
        ("Renal Ultrasound","Radiology",1,40),
    ],"PARTIAL", paid_pct=0.5, days=-5)

    make_invoice("MRN-0006","A04",[
        ("Internal Medicine Consultation","Consultation",1,50),
        ("TFT Panel (TSH/T3/T4)","Laboratory",1,30),
        ("Levothyroxine 100mcg x90","Pharmacy",1,40.5),
    ],"PAID", paid_pct=1.0, days=-7)

    make_invoice("MRN-0007","A07",[
        ("Paediatrics Consultation","Consultation",1,35),
        ("Paracetamol Syrup","Pharmacy",1,2.5),
        ("ORS Sachets x2","Pharmacy",2,0.35),
    ],"PAID", paid_pct=1.0, days=-3)

    make_invoice("MRN-0002","A08",[
        ("Internal Medicine Consultation","Consultation",1,50),
        ("Spirometry","Procedure",1,30),
        ("Seretide Inhaler 25/250","Pharmacy",1,12),
        ("Ventolin Inhaler","Pharmacy",1,3.5),
    ],"PENDING", paid_pct=0.0, days=-3)

    make_invoice("MRN-0011","A09",[
        ("Cardiology Consultation","Consultation",1,80),
        ("Lipid Panel + LFTs","Laboratory",1,40),
    ],"PENDING", paid_pct=0.0, days=-2)

    # Overdue — old unpaid
    make_invoice("MRN-0008","A10",[
        ("Internal Medicine Consultation","Consultation",1,50),
        ("X-Ray Both Hands","Radiology",1,30),
    ],"OVERDUE", paid_pct=0.0, days=-45)

    print("[OK] Invoices + payments")

# ──────────────────────────────────────────────
# 10. VENDORS + PURCHASE ORDERS + EXPENSES
# ──────────────────────────────────────────────
vendor_ids = {}
VENDORS = [
    ("PharmaCo Jordan","Amjad Haddad","+962-6-555-2000","procurement@pharmacojo.com","PHCO"),
    ("Al-Hikma Pharmaceuticals","Rana Khalil","+962-6-555-3000","orders@hikma.jo","HKMA"),
    ("MedSupply Ltd","Tariq Nassar","+962-6-555-4000","info@medsupply.jo","MEDS"),
    ("Gulf Medical Equipment","Salem Al-Zoubi","+962-6-555-5000","sales@gulfmed.com","GFME"),
]
def seed_vendors():
    for name, contact, phone, email, code in VENDORS:
        v = exists(models.Vendor, email=email)
        if not v:
            v = models.Vendor(
                id=generate_id(), name=name, contactPerson=contact,
                phone=phone, email=email, isPreferred=(code in ("PHCO","HKMA")),
                paymentTerms="Net 30", rating=4, isActive=True,
            )
            db.add(v); db.flush()
        vendor_ids[code] = v.id
    print(f"[OK] Vendors ({len(VENDORS)})")

def seed_purchase_orders():
    v_phco = vendor_ids.get("PHCO")
    v_hkma = vendor_ids.get("HKMA")
    if not v_phco:
        return

    po1_exists = db.query(models.PurchaseOrder).filter_by(poNumber="PO-2026-001").first()
    if not po1_exists:
        po1 = models.PurchaseOrder(
            id=generate_id(), poNumber="PO-2026-001",
            vendorId=v_phco, date=d(-30),
            expectedDelivery=d(-23), status="RECEIVED",
            subtotal=1250.00, totalAmount=1250.00,
            receivedAt=d(-22),
        )
        db.add(po1); db.flush()
        for med_name, qty, price in [
            ("Amlodipine 5mg",500,0.08),
            ("Metformin 500mg",1000,0.05),
            ("Aspirin 100mg",1000,0.02),
            ("Paracetamol 500mg",2000,0.01),
        ]:
            mid = med_ids.get(med_name)
            db.add(models.POItem(
                id=generate_id(), poId=po1.id,
                medicationId=mid, itemName=med_name,
                quantity=qty, unitPrice=price,
                totalPrice=qty*price, receivedQty=qty,
            ))

    po2_exists = db.query(models.PurchaseOrder).filter_by(poNumber="PO-2026-002").first()
    if not po2_exists:
        po2 = models.PurchaseOrder(
            id=generate_id(), poNumber="PO-2026-002",
            vendorId=v_hkma, date=d(-7),
            expectedDelivery=d(7), status="APPROVED",
            subtotal=3200.00, totalAmount=3200.00,
        )
        db.add(po2); db.flush()
        for med_name, qty, price in [
            ("Insulin Glargine",50,8.00),
            ("Empagliflozin 10mg",100,1.80),
            ("Salmeterol/Fluticasone",60,5.00),
        ]:
            mid = med_ids.get(med_name)
            db.add(models.POItem(
                id=generate_id(), poId=po2.id,
                medicationId=mid, itemName=med_name,
                quantity=qty, unitPrice=price,
                totalPrice=qty*price, receivedQty=0,
            ))
    db.flush()
    print("[OK] Purchase orders")

def seed_expenses():
    admin_user = exists(models.User, email="admin@mediflow.com")
    aid = admin_user.id if admin_user else None
    EXPS = [
        ("UTILITIES",    "Electricity bill — April 2026",     380.00, d(-7),  "APPROVED"),
        ("UTILITIES",    "Water bill — April 2026",            55.00, d(-7),  "APPROVED"),
        ("RENT",         "Clinic rent — May 2026",           1800.00, d(-3),  "APPROVED"),
        ("SUPPLIES",     "Medical disposables restock",        220.00, d(-5),  "APPROVED"),
        ("MAINTENANCE",  "HVAC preventive maintenance",        150.00, d(-10), "APPROVED"),
        ("CLEANING",     "Cleaning service — April",           200.00, d(-7),  "APPROVED"),
        ("IT",           "EMR software annual licence",        500.00, d(-14), "APPROVED"),
        ("MARKETING",    "Social media advertising — Q2",      300.00, d(-2),  "PENDING"),
        ("SUPPLIES",     "Printer cartridges and paper",        45.00, d(-1),  "PENDING"),
        ("MAINTENANCE",  "X-ray machine calibration",          350.00, d(-20), "APPROVED"),
    ]
    v_meds = vendor_ids.get("MEDS")
    for cat, desc, amt, dt, status in EXPS:
        e = models.Expense(
            id=generate_id(), date=dt, category=cat,
            description=desc, amount=amt,
            vendorId=v_meds if cat == "SUPPLIES" else None,
            paymentMethod="BANK_TRANSFER", status=status,
            approvedById=aid if status == "APPROVED" else None,
            approvedAt=dt + timedelta(days=1) if status == "APPROVED" else None,
            recordedById=aid,
        )
        db.add(e)
    db.flush()
    print("[OK] Expenses")

# ──────────────────────────────────────────────
# 11. ASSETS
# ──────────────────────────────────────────────
def seed_assets():
    ASSETS = [
        ("Digital X-Ray Machine",    "RAD-001","Medical Equipment","Philips","SN-XR2024-001",
         "RAD",d(-730),28000,24000,"Radiology Room"),
        ("Ultrasound Machine",        "RAD-002","Medical Equipment","GE Healthcare","SN-US2023-002",
         "RAD",d(-400),18000,16000,"Radiology Room"),
        ("ECG Machine (12-Lead)",     "CAR-001","Medical Equipment","Schiller","SN-ECG2024-003",
         "CRD",d(-180),3500,3200,"Cardiology Room 3"),
        ("Autoclave Steriliser",      "EQP-001","Medical Equipment","Tuttnauer","SN-AC2022-004",
         "MED",d(-1000),4500,3000,"Sterilisation Room"),
        ("Pharmacy Refrigerator",     "PHR-001","Equipment","Liebherr","SN-FR2023-005",
         "PHR",d(-500),1200,1050,"Pharmacy"),
        ("Waiting Room Reception Desk","FUR-001","Furniture",None,None,
         "ADM",d(-730),800,500,"Reception"),
        ("Examination Bed ×3",        "FUR-002","Furniture",None,None,
         "MED",d(-730),1200,900,"Examination Rooms"),
        ("Server / NAS Storage",      "IT-001","IT Equipment","Dell","SN-SRV2024-008",
         "ADM",d(-365),2200,2000,"Server Room"),
        ("Portable Vital Signs Monitor","NRS-001","Medical Equipment","Mindray","SN-VS2024-009",
         "NRS",d(-200),1800,1700,"Nursing Station"),
        ("Chemistry Analyser",        "LAB-001","Medical Equipment","Roche","SN-CA2023-010",
         "LAB",d(-600),35000,30000,"Laboratory"),
    ]
    for name, code, cat, brand, sn, dept_code, pdate, pprice, cval, loc in ASSETS:
        a = exists(models.Asset, assetCode=code)
        if not a:
            a = models.Asset(
                id=generate_id(), name=name, assetCode=code,
                category=cat, serialNumber=sn,
                departmentId=dept_ids.get(dept_code),
                purchaseDate=pdate, purchasePrice=pprice,
                currentValue=cval, location=loc,
                warrantyExpiry=pdate + timedelta(days=730),
                status="ACTIVE",
            )
            db.add(a)
    db.flush()
    print(f"[OK] Assets ({len(ASSETS)})")

# ──────────────────────────────────────────────
# 12. ATTENDANCE (last 30 days for all employees)
# ──────────────────────────────────────────────
def seed_attendance():
    added = 0
    emps = db.query(models.Employee).all()
    for emp in emps:
        for i in range(1, 31):
            att_date = datetime.now().replace(hour=0,minute=0,second=0,microsecond=0) - timedelta(days=i)
            weekday = att_date.weekday()
            if weekday >= 4:  # Fri/Sat off (Jordan weekend)
                continue
            try:
                check_in  = att_date.replace(hour=8,  minute=0)
                check_out = att_date.replace(hour=16, minute=30)
                status = "PRESENT"
                # Some absent/late days
                if i % 11 == 0:
                    status = "ABSENT"; check_in = None; check_out = None
                elif i % 7 == 0:
                    check_in = att_date.replace(hour=8, minute=25)
                    status = "LATE"

                a = models.Attendance(
                    id=generate_id(), employeeId=emp.id,
                    date=att_date, checkIn=check_in, checkOut=check_out,
                    status=status, isManual=False,
                )
                db.add(a)
                db.flush()
                added += 1
            except Exception:
                db.rollback()
    print(f"[OK] Attendance records ({added})")

# ──────────────────────────────────────────────
# 13. LEAVE REQUESTS
# ──────────────────────────────────────────────
def seed_leaves():
    emps = db.query(models.Employee).limit(6).all()
    leave_data = [
        ("ANNUAL",  d(7),  d(14),  5, "APPROVED", "Family vacation"),
        ("SICK",    d(-5), d(-3),  2, "APPROVED",  "Flu recovery"),
        ("ANNUAL",  d(20), d(24),  3, "PENDING",   "Personal travel"),
        ("CASUAL",  d(-1), d(-1),  1, "APPROVED",  "Personal errand"),
        ("SICK",    d(1),  d(2),   2, "PENDING",   "Medical procedure"),
        ("ANNUAL",  d(30), d(40),  8, "PENDING",   "Annual leave"),
    ]
    for emp, (ltype, start, end, days, status, reason) in zip(emps, leave_data):
        lr = models.LeaveRequest(
            id=generate_id(), employeeId=emp.id,
            type=ltype, startDate=start, endDate=end,
            days=days, reason=reason, status=status,
            approvedAt=d(-1) if status == "APPROVED" else None,
        )
        db.add(lr)
    db.flush()
    print("[OK] Leave requests")

# ──────────────────────────────────────────────
# 14. PAYROLL (last 2 months)
# ──────────────────────────────────────────────
def seed_payroll():
    emps = db.query(models.Employee).all()
    now = datetime.now()
    added = 0
    for emp in emps:
        for month_offset in [1, 2]:
            month = (now.month - month_offset - 1) % 12 + 1
            year  = now.year if (now.month - month_offset) > 0 else now.year - 1
            exists_payroll = db.query(models.Payroll).filter_by(
                employeeId=emp.id, month=month, year=year
            ).first()
            if exists_payroll:
                continue
            basic  = float(emp.basicSalary)
            allow  = float(emp.housingAllowance or 0) + float(emp.transportAllowance or 0)
            gross  = basic + allow
            tax    = round(gross * 0.05, 2)
            net    = round(gross - tax, 2)
            db.add(models.Payroll(
                id=generate_id(), employeeId=emp.id,
                month=month, year=year,
                basicSalary=basic, allowances=allow,
                bonus=0, overtimePay=0,
                deductions=0, taxDeduction=tax,
                grossSalary=gross, netSalary=net,
                status="PAID", processedAt=d(-month_offset*30),
            ))
            added += 1
    db.flush()
    print(f"[OK] Payroll records ({added})")

# ──────────────────────────────────────────────
# 15. SHIFTS
# ──────────────────────────────────────────────
def seed_shifts():
    main_branch = exists(models.Branch, code="MAIN")
    bid = main_branch.id if main_branch else None
    SHIFTS = [
        ("Morning Shift",  "07:00","15:00",[0,1,2,3,4],"#1960a3"),
        ("Evening Shift",  "15:00","23:00",[0,1,2,3,4],"#0d9488"),
        ("Night Shift",    "23:00","07:00",[0,1,2,3,4],"#633f0f"),
        ("Weekend Shift",  "08:00","16:00",[5,6],       "#d97706"),
    ]
    shift_ids = []
    for name, start, end, days, color in SHIFTS:
        s = db.query(models.Shift).filter_by(name=name).first()
        if not s:
            s = models.Shift(
                id=generate_id(), name=name, startTime=start,
                endTime=end, daysOfWeek=days, color=color,
                isActive=True, branchId=bid,
            )
            db.add(s); db.flush()
        shift_ids.append(s.id)

    # Assign morning shift to first 5 employees
    emps = db.query(models.Employee).limit(5).all()
    for emp in emps:
        already = db.query(models.ShiftAssignment).filter_by(
            employeeId=emp.id, shiftId=shift_ids[0]
        ).first()
        if not already:
            db.add(models.ShiftAssignment(
                id=generate_id(), employeeId=emp.id,
                shiftId=shift_ids[0], startDate=d(-90),
            ))
    db.flush()
    print(f"[OK] Shifts ({len(SHIFTS)})")

# ──────────────────────────────────────────────
# 16. NOTIFICATIONS
# ──────────────────────────────────────────────
def seed_notifications():
    admin = exists(models.User, email="admin@mediflow.com")
    if not admin:
        return
    NOTIFS = [
        ("Low Stock Alert","Ibuprofen 400mg stock is critically low (20 units remaining).","WARNING","/pharmacy"),
        ("Overdue Invoice","Invoice MF-2026-0008 for Huda Al-Omari is overdue (45 days).","ERROR","/billing"),
        ("Lab Results Ready","Critical lab results available for Yousef Mansour — HbA1c 9.2%.","INFO","/laboratory"),
        ("Appointment Reminder","3 appointments scheduled for today. First at 09:00.","INFO","/appointments"),
        ("System","Database backup completed successfully.","SUCCESS",None),
    ]
    for title, message, ntype, link in NOTIFS:
        db.add(models.Notification(
            id=generate_id(), userId=admin.id,
            title=title, message=message,
            type=ntype, isRead=False, link=link,
        ))
    db.flush()
    print(f"[OK] Notifications ({len(NOTIFS)})")

# ──────────────────────────────────────────────
# RUN ALL
# ──────────────────────────────────────────────
try:
    print("\n=== MediFlow Demo Data Seed ===\n")
    seed_settings()
    seed_departments()
    seed_staff()
    seed_patients()
    seed_appointments()
    seed_lab()
    seed_radiology()
    seed_pharmacy()
    seed_billing()
    seed_vendors()
    seed_purchase_orders()
    seed_expenses()
    seed_assets()
    seed_attendance()
    seed_leaves()
    seed_payroll()
    seed_shifts()
    seed_notifications()
    db.commit()
    print("\n[DONE] All demo data seeded successfully.\n")
    print("  Login accounts:")
    print("  admin@mediflow.com     / Admin@1234   (Super Admin)")
    print("  doctor@mediflow.com    / Doctor@1234  (Internal Medicine)")
    print("  cardio@mediflow.com    / Doctor@1234  (Cardiology)")
    print("  peds@mediflow.com      / Doctor@1234  (Pediatrics)")
    print("  nurse1@mediflow.com    / Staff@1234   (Head Nurse)")
    print("  recept@mediflow.com    / Staff@1234   (Receptionist)")
    print("  pharm@mediflow.com     / Staff@1234   (Pharmacist)")
    print("  lab@mediflow.com       / Staff@1234   (Lab Tech)")
    print("  finance@mediflow.com   / Staff@1234   (Finance)\n")
except Exception as e:
    db.rollback()
    print(f"\n[FAIL] Seed failed: {e}")
    import traceback; traceback.print_exc()
finally:
    db.close()
