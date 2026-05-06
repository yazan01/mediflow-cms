from sqlalchemy import (
    Column, String, Boolean, Integer, DateTime, Text, JSON,
    ForeignKey, Numeric, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(String(36), primary_key=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    phone = Column(String(50))
    nationalId = Column(String(100), unique=True)
    passwordHash = Column(String(255), nullable=False)
    photo = Column(String(500))
    roles = Column(JSON, default=list)
    departmentId = Column(String(36), ForeignKey("departments.id"))
    isActive = Column(Boolean, default=True)
    twoFAEnabled = Column(Boolean, default=False)
    twoFASecret = Column(String(255))
    lastLogin = Column(DateTime)
    failedLogins = Column(Integer, default=0)
    lockedUntil = Column(DateTime)
    createdAt = Column(DateTime, server_default=func.now())
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now())

    department = relationship("Department", back_populates="users", foreign_keys=[departmentId])
    doctor = relationship("Doctor", back_populates="user", uselist=False)
    employee = relationship("Employee", back_populates="user", uselist=False)
    auditLogs = relationship("AuditLog", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
    recordedPayments = relationship("Payment", back_populates="recordedBy")
    stockMovements = relationship("StockMovement", back_populates="performedBy")
    approvedExpenses = relationship("Expense", back_populates="approvedBy", foreign_keys="Expense.approvedById")
    recordedExpenses = relationship("Expense", back_populates="recordedBy", foreign_keys="Expense.recordedById")


class Session(Base):
    __tablename__ = "sessions"
    id = Column(String(36), primary_key=True)
    userId = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(500), unique=True, nullable=False)
    expiresAt = Column(DateTime, nullable=False)
    twoFAVerified = Column(Boolean, default=False)
    ipAddress = Column(String(100))
    userAgent = Column(String(500))
    createdAt = Column(DateTime, server_default=func.now())


class Department(Base):
    __tablename__ = "departments"
    id = Column(String(36), primary_key=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True)
    parentId = Column(String(36), ForeignKey("departments.id"))
    headId = Column(String(36))
    description = Column(String(500))
    createdAt = Column(DateTime, server_default=func.now())
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now())

    users = relationship("User", back_populates="department", foreign_keys="User.departmentId")
    employees = relationship("Employee", back_populates="department")
    doctors = relationship("Doctor", back_populates="department")
    assets = relationship("Asset", back_populates="department")
    parent = relationship("Department", back_populates="children", foreign_keys=[parentId], remote_side="Department.id")
    children = relationship("Department", back_populates="parent", foreign_keys=[parentId])


class Patient(Base):
    __tablename__ = "patients"
    id = Column(String(36), primary_key=True)
    mrn = Column(String(50), unique=True, nullable=False)
    firstName = Column(String(100), nullable=False)
    lastName = Column(String(100), nullable=False)
    dateOfBirth = Column(DateTime, nullable=False)
    gender = Column(String(10), nullable=False)
    nationality = Column(String(100))
    nationalId = Column(String(100))
    phone = Column(String(50), nullable=False)
    email = Column(String(255))
    address = Column(String(500))
    photo = Column(String(500))
    bloodType = Column(String(10))
    allergies = Column(JSON, default=list)
    chronicConditions = Column(JSON, default=list)
    emergencyContactName = Column(String(200))
    emergencyContactPhone = Column(String(50))
    insuranceProvider = Column(String(200))
    insurancePolicyNo = Column(String(100))
    insuranceCoverageType = Column(String(100))
    insuranceExpiry = Column(DateTime)
    notes = Column(Text)
    isActive = Column(Boolean, default=True)
    mergedIntoId = Column(String(36))
    lastVisit = Column(DateTime)
    createdAt = Column(DateTime, server_default=func.now())
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now())

    appointments = relationship("Appointment", back_populates="patient")
    consultations = relationship("Consultation", back_populates="patient")
    invoices = relationship("Invoice", back_populates="patient")
    labOrders = relationship("LabOrder", back_populates="patient")
    radiologyOrders = relationship("RadiologyOrder", back_populates="patient")


class Doctor(Base):
    __tablename__ = "doctors"
    id = Column(String(36), primary_key=True)
    userId = Column(String(36), ForeignKey("users.id"), unique=True, nullable=False)
    departmentId = Column(String(36), ForeignKey("departments.id"))
    specialization = Column(String(200), nullable=False)
    consultationFee = Column(Numeric(10, 2), default=0)
    bio = Column(Text)
    licenseNumber = Column(String(100))
    licenseExpiry = Column(DateTime)
    isAvailable = Column(Boolean, default=True)
    createdAt = Column(DateTime, server_default=func.now())
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="doctor")
    department = relationship("Department", back_populates="doctors")
    appointments = relationship("Appointment", back_populates="doctor")
    consultations = relationship("Consultation", back_populates="doctor")
    labOrders = relationship("LabOrder", back_populates="orderedByDoctor")
    radiologyOrders = relationship("RadiologyOrder", back_populates="orderedByDoctor")


class DoctorAvailability(Base):
    __tablename__ = "doctor_availability"
    id = Column(String(36), primary_key=True)
    doctorId = Column(String(36), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    dayOfWeek = Column(Integer, nullable=False)
    startTime = Column(String(10), nullable=False)
    endTime = Column(String(10), nullable=False)
    slotMinutes = Column(Integer, default=30)
    isActive = Column(Boolean, default=True)


class Appointment(Base):
    __tablename__ = "appointments"
    id = Column(String(36), primary_key=True)
    patientId = Column(String(36), ForeignKey("patients.id"), nullable=False)
    doctorId = Column(String(36), ForeignKey("doctors.id"), nullable=False)
    scheduledAt = Column(DateTime, nullable=False)
    scheduledEnd = Column(DateTime)
    status = Column(String(30), default="SCHEDULED")
    type = Column(String(30), default="CONSULTATION")
    reason = Column(String(500))
    notes = Column(Text)
    room = Column(String(100))
    isUrgent = Column(Boolean, default=False)
    isWalkIn = Column(Boolean, default=False)
    checkedInAt = Column(DateTime)
    completedAt = Column(DateTime)
    cancelledAt = Column(DateTime)
    cancelReason = Column(String(500))
    createdById = Column(String(36))
    createdAt = Column(DateTime, server_default=func.now())
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now())

    patient = relationship("Patient", back_populates="appointments")
    doctor = relationship("Doctor", back_populates="appointments")
    consultation = relationship("Consultation", back_populates="appointment", uselist=False)
    invoice = relationship("Invoice", back_populates="appointment", uselist=False)


class Consultation(Base):
    __tablename__ = "consultations"
    id = Column(String(36), primary_key=True)
    appointmentId = Column(String(36), ForeignKey("appointments.id"), unique=True, nullable=False)
    patientId = Column(String(36), ForeignKey("patients.id"), nullable=False)
    doctorId = Column(String(36), ForeignKey("doctors.id"), nullable=False)
    chiefComplaint = Column(Text)
    subjective = Column(Text)
    objective = Column(Text)
    assessment = Column(Text)
    plan = Column(Text)
    hpi = Column(Text)
    pmh = Column(Text)
    examination = Column(Text)
    followUpDate = Column(DateTime)
    followUpNotes = Column(Text)
    isLocked = Column(Boolean, default=False)
    lockedAt = Column(DateTime)
    createdAt = Column(DateTime, server_default=func.now())
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now())

    appointment = relationship("Appointment", back_populates="consultation")
    patient = relationship("Patient", back_populates="consultations")
    doctor = relationship("Doctor", back_populates="consultations")
    vitals = relationship("Vitals", back_populates="consultation", uselist=False)
    diagnoses = relationship("Diagnosis", back_populates="consultation")
    prescriptions = relationship("Prescription", back_populates="consultation")
    labOrders = relationship("LabOrder", back_populates="consultation")
    radiologyOrders = relationship("RadiologyOrder", back_populates="consultation")


class Vitals(Base):
    __tablename__ = "vitals"
    id = Column(String(36), primary_key=True)
    consultationId = Column(String(36), ForeignKey("consultations.id", ondelete="CASCADE"), unique=True, nullable=False)
    bpSystolic = Column(Integer)
    bpDiastolic = Column(Integer)
    heartRate = Column(Integer)
    temperature = Column(Numeric(4, 1))
    weight = Column(Numeric(6, 2))
    height = Column(Numeric(5, 2))
    bmi = Column(Numeric(5, 2))
    spo2 = Column(Numeric(5, 2))
    bloodGlucose = Column(Numeric(6, 2))
    respiratoryRate = Column(Integer)
    recordedById = Column(String(36))
    recordedAt = Column(DateTime, server_default=func.now())

    consultation = relationship("Consultation", back_populates="vitals")


class Diagnosis(Base):
    __tablename__ = "diagnoses"
    id = Column(String(36), primary_key=True)
    consultationId = Column(String(36), ForeignKey("consultations.id", ondelete="CASCADE"), nullable=False)
    icdCode = Column(String(50), nullable=False)
    description = Column(String(500), nullable=False)
    type = Column(String(20), default="PRIMARY")
    notes = Column(Text)

    consultation = relationship("Consultation", back_populates="diagnoses")


class Prescription(Base):
    __tablename__ = "prescriptions"
    id = Column(String(36), primary_key=True)
    consultationId = Column(String(36), ForeignKey("consultations.id", ondelete="CASCADE"), nullable=False)
    medicationId = Column(String(36), ForeignKey("medications.id"))
    medicationName = Column(String(300), nullable=False)
    dosage = Column(String(200), nullable=False)
    frequency = Column(String(200), nullable=False)
    duration = Column(String(200), nullable=False)
    quantity = Column(Integer)
    instructions = Column(Text)
    isDispensed = Column(Boolean, default=False)
    dispensedAt = Column(DateTime)
    dispensedById = Column(String(36))
    createdAt = Column(DateTime, server_default=func.now())

    consultation = relationship("Consultation", back_populates="prescriptions")
    medication = relationship("Medication", back_populates="prescriptions")


class LabOrder(Base):
    __tablename__ = "lab_orders"
    id = Column(String(36), primary_key=True)
    patientId = Column(String(36), ForeignKey("patients.id"), nullable=False)
    consultationId = Column(String(36), ForeignKey("consultations.id"))
    orderedByDoctorId = Column(String(36), ForeignKey("doctors.id"), nullable=False)
    tests = Column(JSON, default=list)
    priority = Column(String(20), default="ROUTINE")
    status = Column(String(30), default="PENDING_COLLECTION")
    specimenType = Column(String(100))
    specimenCollected = Column(Boolean, default=False)
    collectedAt = Column(DateTime)
    collectedById = Column(String(36))
    notes = Column(Text)
    createdAt = Column(DateTime, server_default=func.now())
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now())

    patient = relationship("Patient", back_populates="labOrders")
    consultation = relationship("Consultation", back_populates="labOrders")
    orderedByDoctor = relationship("Doctor", back_populates="labOrders")
    results = relationship("LabResult", back_populates="labOrder")


class LabResult(Base):
    __tablename__ = "lab_results"
    id = Column(String(36), primary_key=True)
    labOrderId = Column(String(36), ForeignKey("lab_orders.id", ondelete="CASCADE"), nullable=False)
    testName = Column(String(200), nullable=False)
    value = Column(String(200), nullable=False)
    unit = Column(String(50))
    referenceRange = Column(String(100))
    isAbnormal = Column(Boolean, default=False)
    isCritical = Column(Boolean, default=False)
    enteredById = Column(String(36))
    validatedById = Column(String(36))
    validatedAt = Column(DateTime)
    recordedAt = Column(DateTime, server_default=func.now())

    labOrder = relationship("LabOrder", back_populates="results")


class RadiologyOrder(Base):
    __tablename__ = "radiology_orders"
    id = Column(String(36), primary_key=True)
    patientId = Column(String(36), ForeignKey("patients.id"), nullable=False)
    consultationId = Column(String(36), ForeignKey("consultations.id"))
    orderedByDoctorId = Column(String(36), ForeignKey("doctors.id"), nullable=False)
    modality = Column(String(100), nullable=False)
    study = Column(String(200), nullable=False)
    bodyPart = Column(String(100))
    priority = Column(String(20), default="ROUTINE")
    status = Column(String(30), default="PENDING")
    clinicalInfo = Column(Text)
    scheduledAt = Column(DateTime)
    performedAt = Column(DateTime)
    reportedById = Column(String(36))
    report = Column(Text)
    imageUrls = Column(JSON, default=list)
    notes = Column(Text)
    createdAt = Column(DateTime, server_default=func.now())
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now())

    patient = relationship("Patient", back_populates="radiologyOrders")
    consultation = relationship("Consultation", back_populates="radiologyOrders")
    orderedByDoctor = relationship("Doctor", back_populates="radiologyOrders")


class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(String(36), primary_key=True)
    invoiceNo = Column(String(50), unique=True, nullable=False)
    patientId = Column(String(36), ForeignKey("patients.id"), nullable=False)
    appointmentId = Column(String(36), ForeignKey("appointments.id"), unique=True)
    dueDate = Column(DateTime)
    subtotal = Column(Numeric(12, 2), nullable=False)
    discountAmount = Column(Numeric(12, 2), default=0)
    discountRate = Column(Numeric(5, 2))
    taxRate = Column(Numeric(5, 2))
    taxAmount = Column(Numeric(12, 2), default=0)
    totalAmount = Column(Numeric(12, 2), nullable=False)
    paidAmount = Column(Numeric(12, 2), default=0)
    balance = Column(Numeric(12, 2), nullable=False)
    status = Column(String(20), default="PENDING")
    insuranceClaim = Column(Boolean, default=False)
    insuranceProvider = Column(String(200))
    insurancePolicyNo = Column(String(100))
    notes = Column(Text)
    createdById = Column(String(36))
    createdAt = Column(DateTime, server_default=func.now())
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now())

    patient = relationship("Patient", back_populates="invoices")
    appointment = relationship("Appointment", back_populates="invoice")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="invoice")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    id = Column(String(36), primary_key=True)
    invoiceId = Column(String(36), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    description = Column(String(500), nullable=False)
    category = Column(String(100))
    quantity = Column(Integer, default=1)
    unitPrice = Column(Numeric(12, 2), nullable=False)
    discount = Column(Numeric(5, 2), default=0)
    totalPrice = Column(Numeric(12, 2), nullable=False)
    serviceCode = Column(String(50))

    invoice = relationship("Invoice", back_populates="items")


class Payment(Base):
    __tablename__ = "payments"
    id = Column(String(36), primary_key=True)
    invoiceId = Column(String(36), ForeignKey("invoices.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    method = Column(String(20), default="CASH")
    referenceNo = Column(String(100))
    notes = Column(Text)
    recordedById = Column(String(36), ForeignKey("users.id"))
    paidAt = Column(DateTime, server_default=func.now())

    invoice = relationship("Invoice", back_populates="payments")
    recordedBy = relationship("User", back_populates="recordedPayments")


class Medication(Base):
    __tablename__ = "medications"
    id = Column(String(36), primary_key=True)
    genericName = Column(String(300), nullable=False)
    brandName = Column(String(300))
    category = Column(String(100), nullable=False)
    unit = Column(String(50), nullable=False)
    barcode = Column(String(100), unique=True)
    stockQuantity = Column(Integer, default=0)
    minStockLevel = Column(Integer, default=0)
    reorderLevel = Column(Integer, default=0)
    unitCost = Column(Numeric(12, 2), default=0)
    sellingPrice = Column(Numeric(12, 2), default=0)
    location = Column(String(200))
    isControlled = Column(Boolean, default=False)
    requiresPrescription = Column(Boolean, default=True)
    isActive = Column(Boolean, default=True)
    notes = Column(Text)
    createdAt = Column(DateTime, server_default=func.now())
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now())

    prescriptions = relationship("Prescription", back_populates="medication")
    stockMovements = relationship("StockMovement", back_populates="medication")
    batches = relationship("MedicationBatch", back_populates="medication")
    poItems = relationship("POItem", back_populates="medication")


class MedicationBatch(Base):
    __tablename__ = "medication_batches"
    id = Column(String(36), primary_key=True)
    medicationId = Column(String(36), ForeignKey("medications.id"), nullable=False)
    batchNumber = Column(String(100), nullable=False)
    quantity = Column(Integer, nullable=False)
    expiryDate = Column(DateTime, nullable=False)
    receivedDate = Column(DateTime, server_default=func.now())
    receivedById = Column(String(36))
    unitCost = Column(Numeric(12, 2), nullable=False)
    notes = Column(Text)

    medication = relationship("Medication", back_populates="batches")


class StockMovement(Base):
    __tablename__ = "stock_movements"
    id = Column(String(36), primary_key=True)
    medicationId = Column(String(36), ForeignKey("medications.id"), nullable=False)
    type = Column(String(50), nullable=False)
    quantity = Column(Integer, nullable=False)
    previousQty = Column(Integer, default=0)
    newQty = Column(Integer, default=0)
    reason = Column(String(300))
    referenceId = Column(String(36))
    notes = Column(Text)
    performedById = Column(String(36), ForeignKey("users.id"))
    createdAt = Column(DateTime, server_default=func.now())

    medication = relationship("Medication", back_populates="stockMovements")
    performedBy = relationship("User", back_populates="stockMovements")


class Vendor(Base):
    __tablename__ = "vendors"
    id = Column(String(36), primary_key=True)
    name = Column(String(300), nullable=False)
    contactPerson = Column(String(200))
    phone = Column(String(50))
    email = Column(String(255))
    address = Column(String(500))
    taxId = Column(String(100))
    paymentTerms = Column(String(200))
    bankDetails = Column(String(500))
    rating = Column(Integer, default=0)
    isPreferred = Column(Boolean, default=False)
    isActive = Column(Boolean, default=True)
    notes = Column(Text)
    createdAt = Column(DateTime, server_default=func.now())
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now())

    purchaseOrders = relationship("PurchaseOrder", back_populates="vendor")
    expenses = relationship("Expense", back_populates="vendor")


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    id = Column(String(36), primary_key=True)
    poNumber = Column(String(50), unique=True, nullable=False)
    vendorId = Column(String(36), ForeignKey("vendors.id"), nullable=False)
    date = Column(DateTime, nullable=False)
    expectedDelivery = Column(DateTime)
    status = Column(String(30), default="DRAFT")
    subtotal = Column(Numeric(12, 2), nullable=False)
    totalAmount = Column(Numeric(12, 2), nullable=False)
    notes = Column(Text)
    requestedById = Column(String(36))
    approvedById = Column(String(36))
    approvedAt = Column(DateTime)
    receivedAt = Column(DateTime)
    createdAt = Column(DateTime, server_default=func.now())
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now())

    vendor = relationship("Vendor", back_populates="purchaseOrders")
    items = relationship("POItem", back_populates="po", cascade="all, delete-orphan")


class POItem(Base):
    __tablename__ = "po_items"
    id = Column(String(36), primary_key=True)
    poId = Column(String(36), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    medicationId = Column(String(36), ForeignKey("medications.id"))
    itemName = Column(String(300), nullable=False)
    quantity = Column(Integer, nullable=False)
    unitPrice = Column(Numeric(12, 2), nullable=False)
    totalPrice = Column(Numeric(12, 2), nullable=False)
    receivedQty = Column(Integer, default=0)
    notes = Column(Text)

    po = relationship("PurchaseOrder", back_populates="items")
    medication = relationship("Medication", back_populates="poItems")


class Expense(Base):
    __tablename__ = "expenses"
    id = Column(String(36), primary_key=True)
    date = Column(DateTime, nullable=False)
    category = Column(String(100), nullable=False)
    description = Column(String(500), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    vendorId = Column(String(36), ForeignKey("vendors.id"))
    paymentMethod = Column(String(50))
    referenceNo = Column(String(100))
    receiptUrl = Column(String(500))
    isRecurring = Column(Boolean, default=False)
    status = Column(String(20), default="PENDING")
    approvedById = Column(String(36), ForeignKey("users.id"))
    approvedAt = Column(DateTime)
    recordedById = Column(String(36), ForeignKey("users.id"))
    notes = Column(Text)
    createdAt = Column(DateTime, server_default=func.now())
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now())

    vendor = relationship("Vendor", back_populates="expenses")
    approvedBy = relationship("User", back_populates="approvedExpenses", foreign_keys=[approvedById])
    recordedBy = relationship("User", back_populates="recordedExpenses", foreign_keys=[recordedById])


class Asset(Base):
    __tablename__ = "assets"
    id = Column(String(36), primary_key=True)
    name = Column(String(300), nullable=False)
    assetCode = Column(String(50), unique=True)
    category = Column(String(100), nullable=False)
    serialNumber = Column(String(100))
    departmentId = Column(String(36), ForeignKey("departments.id"))
    purchaseDate = Column(DateTime)
    purchasePrice = Column(Numeric(12, 2))
    currentValue = Column(Numeric(12, 2))
    location = Column(String(200))
    assignedToId = Column(String(36))
    warrantyExpiry = Column(DateTime)
    status = Column(String(30), default="ACTIVE")
    depreciationMethod = Column(String(30), default="STRAIGHT_LINE")
    usefulLifeYears = Column(Integer, default=5)
    salvageValue = Column(Numeric(12, 2), default=0)
    notes = Column(Text)
    createdAt = Column(DateTime, server_default=func.now())
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now())

    department = relationship("Department", back_populates="assets")
    maintenanceLogs = relationship("AssetMaintenance", back_populates="asset")


class AssetMaintenance(Base):
    __tablename__ = "asset_maintenance"
    id = Column(String(36), primary_key=True)
    assetId = Column(String(36), ForeignKey("assets.id"), nullable=False)
    type = Column(String(100), nullable=False)
    description = Column(String(500), nullable=False)
    cost = Column(Numeric(12, 2))
    performedBy = Column(String(200))
    scheduledDate = Column(DateTime, nullable=False)
    performedAt = Column(DateTime)
    nextDue = Column(DateTime)
    notes = Column(Text)
    createdAt = Column(DateTime, server_default=func.now())

    asset = relationship("Asset", back_populates="maintenanceLogs")


class Employee(Base):
    __tablename__ = "employees"
    id = Column(String(36), primary_key=True)
    empCode = Column(String(50), unique=True, nullable=False)
    userId = Column(String(36), ForeignKey("users.id"), unique=True, nullable=False)
    departmentId = Column(String(36), ForeignKey("departments.id"), nullable=False)
    jobTitle = Column(String(200), nullable=False)
    employmentType = Column(String(20), default="FULL_TIME")
    status = Column(String(20), default="ACTIVE")
    basicSalary = Column(Numeric(12, 2), nullable=False)
    housingAllowance = Column(Numeric(12, 2), default=0)
    transportAllowance = Column(Numeric(12, 2), default=0)
    medicalAllowance = Column(Numeric(12, 2), default=0)
    hireDate = Column(DateTime, nullable=False)
    endDate = Column(DateTime)
    bankName = Column(String(200))
    bankAccount = Column(String(100))
    annualLeaveBalance = Column(Integer, default=21)
    sickLeaveBalance = Column(Integer, default=14)
    notes = Column(Text)
    createdAt = Column(DateTime, server_default=func.now())
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="employee")
    department = relationship("Department", back_populates="employees")
    attendance = relationship("Attendance", back_populates="employee")
    leaveRequests = relationship("LeaveRequest", back_populates="employee")
    payrollRecords = relationship("Payroll", back_populates="employee")


class Attendance(Base):
    __tablename__ = "attendance"
    id = Column(String(36), primary_key=True)
    employeeId = Column(String(36), ForeignKey("employees.id"), nullable=False)
    date = Column(DateTime, nullable=False)
    checkIn = Column(DateTime)
    checkOut = Column(DateTime)
    status = Column(String(20), default="PRESENT")
    overtimeHrs = Column(Numeric(5, 2))
    notes = Column(Text)
    enteredById = Column(String(36))
    isManual = Column(Boolean, default=False)
    createdAt = Column(DateTime, server_default=func.now())

    __table_args__ = (UniqueConstraint("employeeId", "date"),)
    employee = relationship("Employee", back_populates="attendance")


class LeaveRequest(Base):
    __tablename__ = "leave_requests"
    id = Column(String(36), primary_key=True)
    employeeId = Column(String(36), ForeignKey("employees.id"), nullable=False)
    type = Column(String(20), nullable=False)
    startDate = Column(DateTime, nullable=False)
    endDate = Column(DateTime, nullable=False)
    days = Column(Integer, nullable=False)
    reason = Column(Text)
    status = Column(String(20), default="PENDING")
    approvedById = Column(String(36))
    approvedAt = Column(DateTime)
    rejectedReason = Column(Text)
    createdAt = Column(DateTime, server_default=func.now())
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now())

    employee = relationship("Employee", back_populates="leaveRequests")


class Payroll(Base):
    __tablename__ = "payroll"
    id = Column(String(36), primary_key=True)
    employeeId = Column(String(36), ForeignKey("employees.id"), nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    basicSalary = Column(Numeric(12, 2), nullable=False)
    allowances = Column(Numeric(12, 2), default=0)
    bonus = Column(Numeric(12, 2), default=0)
    overtimePay = Column(Numeric(12, 2), default=0)
    deductions = Column(Numeric(12, 2), default=0)
    taxDeduction = Column(Numeric(12, 2), default=0)
    grossSalary = Column(Numeric(12, 2), nullable=False)
    netSalary = Column(Numeric(12, 2), nullable=False)
    status = Column(String(20), default="PENDING")
    processedById = Column(String(36))
    processedAt = Column(DateTime)
    payslipUrl = Column(String(500))
    notes = Column(Text)
    createdAt = Column(DateTime, server_default=func.now())

    __table_args__ = (UniqueConstraint("employeeId", "month", "year"),)
    employee = relationship("Employee", back_populates="payrollRecords")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(String(36), primary_key=True)
    userId = Column(String(36), ForeignKey("users.id"), nullable=False)
    action = Column(String(100), nullable=False)
    module = Column(String(100), nullable=False)
    entityId = Column(String(36))
    entityType = Column(String(100))
    oldValues = Column(Text)
    newValues = Column(Text)
    ipAddress = Column(String(100))
    userAgent = Column(String(500))
    timestamp = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="auditLogs")


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(String(36), primary_key=True)
    userId = Column(String(36), ForeignKey("users.id"), nullable=False)
    title = Column(String(300), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(20), default="INFO")
    isRead = Column(Boolean, default=False)
    link = Column(String(500))
    createdAt = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="notifications")
