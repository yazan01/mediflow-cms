from datetime import datetime
from sqlalchemy import (
    Column, String, Boolean, Integer, DateTime, Text, JSON,
    ForeignKey, ForeignKeyConstraint, Numeric, UniqueConstraint, Index
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
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

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
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

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
    deletedAt = Column(DateTime, nullable=True)
    createdAt = Column(DateTime, server_default=func.now())
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

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
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

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
    __table_args__ = (
        Index("ix_appt_patient", "patientId"),
        Index("ix_appt_doctor", "doctorId"),
        Index("ix_appt_scheduled", "scheduledAt"),
        Index("ix_appt_status", "status"),
    )
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
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    branchId = Column(String(25), ForeignKey("branches.id"), nullable=True)

    patient = relationship("Patient", back_populates="appointments")
    doctor = relationship("Doctor", back_populates="appointments")
    consultation = relationship("Consultation", back_populates="appointment", uselist=False)
    invoice = relationship("Invoice", back_populates="appointment", uselist=False)


class Consultation(Base):
    __tablename__ = "consultations"
    __table_args__ = (
        Index("ix_consult_patient", "patientId"),
        Index("ix_consult_doctor", "doctorId"),
        Index("ix_consult_created", "createdAt"),
    )
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
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

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
    __table_args__ = (
        Index("ix_laborder_patient", "patientId"),
        Index("ix_laborder_status", "status"),
        Index("ix_laborder_created", "createdAt"),
    )
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
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

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
    __table_args__ = (
        Index("ix_radorder_patient", "patientId"),
        Index("ix_radorder_status", "status"),
        Index("ix_radorder_created", "createdAt"),
    )
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
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    patient = relationship("Patient", back_populates="radiologyOrders")
    consultation = relationship("Consultation", back_populates="radiologyOrders")
    orderedByDoctor = relationship("Doctor", back_populates="radiologyOrders")


class RadiologyImage(Base):
    __tablename__ = "radiology_images"
    id = Column(String(36), primary_key=True)
    orderId = Column(String(36), ForeignKey("radiology_orders.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False)
    originalName = Column(String(255))
    fileSize = Column(Integer)
    mimeType = Column(String(50))
    uploadedBy = Column(String(36), ForeignKey("users.id"))
    uploadedAt = Column(DateTime, server_default=func.now())

    order = relationship("RadiologyOrder", backref="images")
    uploader = relationship("User", foreign_keys=[uploadedBy])


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (
        Index("ix_invoice_patient", "patientId"),
        Index("ix_invoice_status", "status"),
        Index("ix_invoice_created", "createdAt"),
    )
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
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    branchId = Column(String(25), ForeignKey("branches.id"), nullable=True)

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
    __table_args__ = (
        Index("ix_payment_invoice", "invoiceId"),
        Index("ix_payment_paid_at", "paidAt"),
    )
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
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

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
    __table_args__ = (
        Index("ix_stockmov_medication", "medicationId"),
        Index("ix_stockmov_created", "createdAt"),
    )
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
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

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
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

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
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    vendor = relationship("Vendor", back_populates="expenses")
    approvedBy = relationship("User", back_populates="approvedExpenses", foreign_keys=[approvedById])
    recordedBy = relationship("User", back_populates="recordedExpenses", foreign_keys=[recordedById])


class ClinicSetting(Base):
    __tablename__ = "clinic_settings"
    id = Column(Integer, primary_key=True, default=1)
    clinicName = Column(String(255), default="")
    licenseNumber = Column(String(100), default="")
    phone = Column(String(50), default="")
    email = Column(String(255), default="")
    address = Column(Text, default="")
    taxId = Column(String(100), default="")
    currency = Column(String(10), default="USD")
    timezone = Column(String(50), default="Asia/Amman")
    taxRate = Column(Numeric(5, 2), default=7)
    invoicePrefix = Column(String(20), default="INV")
    paymentTerms = Column(Integer, default=30)
    sessionTimeout = Column(Integer, default=480)
    passwordMinLength = Column(Integer, default=8)
    require2FA = Column(Boolean, default=False)
    notifApptReminders = Column(Boolean, default=True)
    notifLabCritical = Column(Boolean, default=True)
    notifLowStock = Column(Boolean, default=True)
    notifOverdueInvoice = Column(Boolean, default=True)
    notifLeave = Column(Boolean, default=True)
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)


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
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

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
    __table_args__ = (
        Index("ix_employee_user", "userId"),
        Index("ix_employee_dept", "departmentId"),
        Index("ix_employee_status", "status"),
    )
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
    probationEndDate = Column(DateTime)
    bankName = Column(String(200))
    bankAccount = Column(String(100))
    annualLeaveBalance = Column(Integer, default=21)
    sickLeaveBalance = Column(Integer, default=14)
    notes = Column(Text)
    branchId = Column(String(25), ForeignKey("branches.id"), nullable=True)
    reportsToId = Column(String(36), ForeignKey("employees.id"), nullable=True)
    deletedAt = Column(DateTime, nullable=True)
    createdAt = Column(DateTime, server_default=func.now())
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    user = relationship("User", back_populates="employee")
    department = relationship("Department", back_populates="employees")
    attendance = relationship("Attendance", back_populates="employee")
    leaveRequests = relationship("LeaveRequest", back_populates="employee")
    payrollRecords = relationship("Payroll", back_populates="employee")
    shiftAssignments = relationship("ShiftAssignment", back_populates="employee")
    salaryHistory = relationship("SalaryHistory", back_populates="employee")
    contracts = relationship("EmployeeContract", back_populates="employee")
    reportsTo = relationship("Employee", remote_side="Employee.id", foreign_keys="Employee.reportsToId")


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
    __table_args__ = (
        Index("ix_leave_employee", "employeeId"),
        Index("ix_leave_status", "status"),
    )
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
    medicalCert = Column(Boolean, default=False)
    createdAt = Column(DateTime, server_default=func.now())
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

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


class EmployeeContract(Base):
    __tablename__ = "employee_contracts"
    __table_args__ = (
        Index("ix_contract_employee", "employeeId"),
        Index("ix_contract_end", "endDate"),
    )
    id = Column(String(36), primary_key=True)
    employeeId = Column(String(36), ForeignKey("employees.id"), nullable=False)
    contractType = Column(String(50), nullable=False)  # PERMANENT, FIXED_TERM, PART_TIME, PROBATION
    startDate = Column(DateTime, nullable=False)
    endDate = Column(DateTime)
    renewalReminderDays = Column(Integer, default=30)
    notes = Column(String(500))
    createdAt = Column(DateTime, server_default=func.now())

    employee = relationship("Employee", back_populates="contracts")


class LeavePolicy(Base):
    __tablename__ = "leave_policies"
    id = Column(String(36), primary_key=True)
    leaveType = Column(String(50), unique=True, nullable=False)
    maxDaysPerYear = Column(Integer)
    carryForwardMax = Column(Integer, default=0)
    requiresMedicalCert = Column(Boolean, default=False)
    probationAllowed = Column(Boolean, default=True)
    minServiceDays = Column(Integer, default=0)
    encashmentAllowed = Column(Boolean, default=False)
    accrualMonthly = Column(Boolean, default=False)
    createdAt = Column(DateTime, server_default=func.now())


class SalaryHistory(Base):
    __tablename__ = "salary_history"
    __table_args__ = (
        Index("ix_salary_history_employee", "employeeId"),
    )
    id = Column(String(36), primary_key=True)
    employeeId = Column(String(36), ForeignKey("employees.id"), nullable=False)
    changedById = Column(String(36), ForeignKey("users.id"), nullable=False)
    basicSalary = Column(Numeric(12, 2), nullable=False)
    housingAllowance = Column(Numeric(12, 2), default=0)
    transportAllowance = Column(Numeric(12, 2), default=0)
    medicalAllowance = Column(Numeric(12, 2), default=0)
    effectiveDate = Column(DateTime, nullable=False)
    reason = Column(String(500))
    createdAt = Column(DateTime, server_default=func.now())

    employee = relationship("Employee", back_populates="salaryHistory")
    changedBy = relationship("User")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_user", "userId"),
        Index("ix_audit_timestamp", "timestamp"),
        Index("ix_audit_module", "module"),
    )
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
    __table_args__ = (
        Index("ix_notif_user_read", "userId", "isRead"),
        Index("ix_notif_created", "createdAt"),
    )
    id = Column(String(36), primary_key=True)
    userId = Column(String(36), ForeignKey("users.id"), nullable=False)
    title = Column(String(300), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(20), default="INFO")
    isRead = Column(Boolean, default=False)
    link = Column(String(500))
    createdAt = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="notifications")


# ─── Multi-branch & Shifts ────────────────────────────────────────────────────

class Branch(Base):
    __tablename__ = "branches"
    id = Column(String(25), primary_key=True)
    name = Column(String(200), nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    address = Column(Text)
    phone = Column(String(50))
    email = Column(String(200))
    # managerId resolved via use_alter to break circular FK with employees
    managerId = Column(String(25), nullable=True)
    timezone = Column(String(50))          # overrides clinic timezone if set
    isActive = Column(Boolean, default=True)
    description = Column(Text)
    country = Column(String(50))
    city = Column(String(100))
    createdAt = Column(DateTime, server_default=func.now())
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (
        ForeignKeyConstraint(
            ["managerId"], ["employees.id"],
            use_alter=True, name="fk_branch_manager"
        ),
    )

    shifts = relationship("Shift", back_populates="branch")
    settings = relationship("BranchSetting", back_populates="branch", uselist=False)
    clinics = relationship("Clinic", back_populates="branch", cascade="all, delete-orphan")


class BranchSetting(Base):
    """Per-branch configuration that overrides global ClinicSetting values."""
    __tablename__ = "branch_settings"
    id = Column(String(25), primary_key=True)
    branchId = Column(String(25), ForeignKey("branches.id"), nullable=False, unique=True)
    currency = Column(String(10), default="USD")
    timezone = Column(String(50), default="Asia/Amman")
    taxRate = Column(Numeric(5, 2), default=0)
    invoicePrefix = Column(String(20), default="INV")
    paymentTerms = Column(Integer, default=30)
    language = Column(String(5), default="en")
    workingHoursStart = Column(String(5), default="08:00")
    workingHoursEnd = Column(String(5), default="17:00")
    workingDays = Column(JSON, default=lambda: [0, 1, 2, 3, 4])
    emergencyContact = Column(String(100))
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    branch = relationship("Branch", back_populates="settings")


class Clinic(Base):
    """Sub-entity inside a branch (e.g., General, Dental, Radiology)."""
    __tablename__ = "clinics"
    __table_args__ = (
        UniqueConstraint("branchId", "code", name="uq_clinic_branch_code"),
        Index("ix_clinic_branch", "branchId"),
    )
    id = Column(String(25), primary_key=True)
    branchId = Column(String(25), ForeignKey("branches.id"), nullable=False)
    name = Column(String(200), nullable=False)
    code = Column(String(20), nullable=False)
    description = Column(Text)
    clinicType = Column(String(50), default="general")
    colorTheme = Column(String(20), default="#1960a3")
    capacity = Column(Integer, default=10)
    apptDurationMin = Column(Integer, default=20)
    queueEnabled = Column(Boolean, default=True)
    onlineBooking = Column(Boolean, default=True)
    status = Column(String(20), default="active")
    sortOrder = Column(Integer, default=0)
    createdAt = Column(DateTime, server_default=func.now())
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    branch = relationship("Branch", back_populates="clinics")


class Shift(Base):
    __tablename__ = "shifts"
    id = Column(String(25), primary_key=True)
    branchId = Column(String(25), ForeignKey("branches.id"), nullable=True)
    name = Column(String(100), nullable=False)
    startTime = Column(String(5), nullable=False)   # "08:00"
    endTime = Column(String(5), nullable=False)     # "16:00"
    daysOfWeek = Column(JSON, default=lambda: [0, 1, 2, 3, 4])  # 0=Mon … 6=Sun
    color = Column(String(20), default="#1960a3")
    isActive = Column(Boolean, default=True)
    createdAt = Column(DateTime, server_default=func.now())
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    branch = relationship("Branch", back_populates="shifts")
    assignments = relationship("ShiftAssignment", back_populates="shift", cascade="all, delete-orphan")


class ShiftAssignment(Base):
    __tablename__ = "shift_assignments"
    id = Column(String(25), primary_key=True)
    employeeId = Column(String(25), ForeignKey("employees.id"), nullable=False)
    shiftId = Column(String(25), ForeignKey("shifts.id"), nullable=False)
    startDate = Column(DateTime, nullable=False)
    endDate = Column(DateTime)
    notes = Column(Text)
    createdAt = Column(DateTime, server_default=func.now())

    employee = relationship("Employee", back_populates="shiftAssignments")
    shift = relationship("Shift", back_populates="assignments")


class PerformanceReview(Base):
    __tablename__ = "performance_reviews"
    __table_args__ = (
        Index("ix_perf_employee", "employeeId"),
        Index("ix_perf_period", "period"),
    )
    id = Column(String(25), primary_key=True)
    employeeId = Column(String(36), ForeignKey("employees.id"), nullable=False)
    reviewerId = Column(String(36), ForeignKey("users.id"), nullable=False)
    period = Column(String(7), nullable=False)   # "2025-Q1"
    rating = Column(Integer, nullable=False)      # 1-5
    goals = Column(JSON, default=lambda: [])      # list of {title, status}
    strengths = Column(Text)
    improvements = Column(Text)
    comments = Column(Text)
    status = Column(String(20), default="DRAFT")  # DRAFT | SUBMITTED | ACKNOWLEDGED
    createdAt = Column(DateTime, server_default=func.now())
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    employee = relationship("Employee", foreign_keys=[employeeId])
    reviewer = relationship("User", foreign_keys=[reviewerId])


class EmployeeDocument(Base):
    __tablename__ = "employee_documents"
    __table_args__ = (
        Index("ix_doc_employee", "employeeId"),
    )
    id = Column(String(25), primary_key=True)
    employeeId = Column(String(36), ForeignKey("employees.id"), nullable=False)
    uploadedById = Column(String(36), ForeignKey("users.id"), nullable=False)
    name = Column(String(300), nullable=False)
    docType = Column(String(50), nullable=False)  # NATIONAL_ID | PASSPORT | CERTIFICATE | CONTRACT | OTHER
    notes = Column(Text)
    expiryDate = Column(DateTime, nullable=True)
    createdAt = Column(DateTime, server_default=func.now())

    employee = relationship("Employee")
    uploadedBy = relationship("User")


class SmtpConfig(Base):
    """SMTP email configuration — branchId=None means global fallback."""
    __tablename__ = "smtp_configs"
    id = Column(String(25), primary_key=True)
    branchId = Column(String(25), ForeignKey("branches.id"), nullable=True)
    host = Column(String(255))
    port = Column(Integer, default=587)
    useTLS = Column(Boolean, default=True)
    username = Column(String(255))
    passwordEncrypted = Column(Text)
    fromName = Column(String(100))
    fromEmail = Column(String(255))
    isActive = Column(Boolean, default=False)
    lastTestedAt = Column(DateTime)
    lastTestResult = Column(String(20))
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (
        UniqueConstraint("branchId", name="uq_smtp_branch"),
    )


class SettingsHistory(Base):
    """Audit trail for all settings mutations."""
    __tablename__ = "settings_history"
    __table_args__ = (
        Index("ix_settings_history_scope", "scope", "scopeId", "changedAt"),
    )
    id = Column(String(25), primary_key=True)
    scope = Column(String(10), nullable=False)
    scopeId = Column(String(25))
    changedBy = Column(String(25), ForeignKey("users.id"), nullable=True)
    changedAt = Column(DateTime, server_default=func.now())
    category = Column(String(50))
    fieldName = Column(String(100))
    oldValue = Column(Text)
    newValue = Column(Text)
    ipAddress = Column(String(45))


class WhatsAppConfig(Base):
    """Per-branch WhatsApp Business API configuration."""
    __tablename__ = "whatsapp_configs"
    id = Column(String(25), primary_key=True)
    branchId = Column(String(25), ForeignKey("branches.id"), nullable=False, unique=True)
    phoneNumberId = Column(String(50))
    wabaId = Column(String(50))
    accessTokenEncrypted = Column(Text)
    appSecretEncrypted = Column(Text)
    webhookVerifyToken = Column(String(100))
    phoneNumber = Column(String(20))
    displayName = Column(String(100))
    isVerified = Column(Boolean, default=False)
    isActive = Column(Boolean, default=False)
    autoReplyEnabled = Column(Boolean, default=False)
    businessHoursOnly = Column(Boolean, default=True)
    aiReplyEnabled = Column(Boolean, default=False)
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    templates = relationship("WhatsAppTemplate", back_populates="config", cascade="all, delete-orphan")


class WhatsAppTemplate(Base):
    """Message templates linked to a WhatsApp Business account."""
    __tablename__ = "whatsapp_templates"
    __table_args__ = (Index("ix_wa_template_config", "configId"),)
    id = Column(String(25), primary_key=True)
    configId = Column(String(25), ForeignKey("whatsapp_configs.id"), nullable=False)
    name = Column(String(100), nullable=False)
    category = Column(String(30), default="APPOINTMENT_REMINDER")
    language = Column(String(10), default="en")
    bodyText = Column(Text)
    isActive = Column(Boolean, default=True)
    usageCount = Column(Integer, default=0)
    createdAt = Column(DateTime, server_default=func.now())

    config = relationship("WhatsAppConfig", back_populates="templates")


class SmsConfig(Base):
    """SMS gateway configuration — branchId=None means global."""
    __tablename__ = "sms_configs"
    id = Column(String(25), primary_key=True)
    branchId = Column(String(25), ForeignKey("branches.id"), nullable=True)
    provider = Column(String(30), default="twilio")
    apiKeyEncrypted = Column(Text)
    apiSecretEncrypted = Column(Text)
    fromNumber = Column(String(20))
    isActive = Column(Boolean, default=False)
    dailyLimit = Column(Integer, default=1000)
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (UniqueConstraint("branchId", name="uq_sms_branch"),)


class PaymentGatewayConfig(Base):
    """Payment gateway configuration — branchId=None means global."""
    __tablename__ = "payment_gateway_configs"
    id = Column(String(25), primary_key=True)
    branchId = Column(String(25), ForeignKey("branches.id"), nullable=True)
    provider = Column(String(30), default="stripe")
    publicKey = Column(String(255))
    secretKeyEncrypted = Column(Text)
    webhookSecretEncrypted = Column(Text)
    currency = Column(String(10), default="USD")
    testMode = Column(Boolean, default=True)
    isActive = Column(Boolean, default=False)
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (UniqueConstraint("branchId", name="uq_payment_branch"),)


class FeatureFlag(Base):
    """System-wide feature toggles managed by SUPER_ADMIN."""
    __tablename__ = "feature_flags"
    id = Column(String(25), primary_key=True)
    key = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    isEnabled = Column(Boolean, default=False)
    updatedBy = Column(String(25), ForeignKey("users.id"), nullable=True)
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class ApiKey(Base):
    """External API keys — SHA-256 hashed, plaintext returned only at creation."""
    __tablename__ = "api_keys"
    __table_args__ = (Index("ix_apikey_branch", "branchId"),)
    id = Column(String(25), primary_key=True)
    branchId = Column(String(25), ForeignKey("branches.id"), nullable=True)
    name = Column(String(100), nullable=False)
    keyHashSha256 = Column(String(64), nullable=False, unique=True)
    keyPrefix = Column(String(10))
    scopes = Column(JSON, default=lambda: [])
    lastUsedAt = Column(DateTime, nullable=True)
    expiresAt = Column(DateTime, nullable=True)
    isActive = Column(Boolean, default=True)
    createdBy = Column(String(25), ForeignKey("users.id"), nullable=True)
    createdAt = Column(DateTime, server_default=func.now())


class NotificationTemplate(Base):
    """Customisable email/SMS/WhatsApp templates per event type and channel."""
    __tablename__ = "notification_templates"
    __table_args__ = (
        UniqueConstraint("branchId", "eventType", "channel", "language", name="uq_notif_tpl_branch_event_ch_lang"),
        Index("ix_notif_tpl_branch", "branchId"),
    )
    id = Column(String(25), primary_key=True)
    branchId = Column(String(25), ForeignKey("branches.id", ondelete="CASCADE"), nullable=True)
    eventType = Column(String(50), nullable=False)
    channel = Column(String(20), nullable=False)
    subject = Column(String(255))
    body = Column(Text, nullable=False)
    variables = Column(JSON, default=lambda: [])
    language = Column(String(5), default="en")
    isActive = Column(Boolean, default=True)
    isDefault = Column(Boolean, default=False)
    createdAt = Column(DateTime, default=datetime.now)
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class WebhookEvent(Base):
    """Incoming webhook events from WhatsApp and other integrations."""
    __tablename__ = "webhook_events"
    __table_args__ = (
        Index("ix_webhook_events_branch_created", "branchId", "createdAt"),
    )
    id = Column(String(25), primary_key=True)
    branchId = Column(String(25), ForeignKey("branches.id", ondelete="SET NULL"), nullable=True)
    source = Column(String(30), default="whatsapp")
    eventType = Column(String(50))
    fromNumber = Column(String(50))
    payload = Column(JSON)
    processed = Column(Boolean, default=False)
    createdAt = Column(DateTime, server_default=func.now())


class TokenBlocklist(Base):
    """Revoked JWT tokens — checked on every authenticated request."""
    __tablename__ = "token_blocklist"
    id = Column(String(36), primary_key=True)
    # SHA-256 hex digest of the raw token — avoids storing the full token
    tokenHash = Column(String(64), unique=True, nullable=False, index=True)
    # Copy exp from the JWT so we can prune expired entries
    expiresAt = Column(DateTime, nullable=False)
    revokedAt = Column(DateTime, server_default=func.now())
