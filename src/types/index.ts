// Core types matching Prisma schema entities

export type UserRole =
  | "SUPER_ADMIN"
  | "CLINIC_MANAGER"
  | "DOCTOR"
  | "RECEPTIONIST"
  | "NURSE"
  | "ACCOUNTANT"
  | "HR_OFFICER"
  | "PHARMACIST"
  | "LAB_TECHNICIAN"
  | "RADIOLOGIST"
  | "AUDITOR";

export type Gender = "MALE" | "FEMALE";

export type BloodType = "A_POS" | "A_NEG" | "B_POS" | "B_NEG" | "AB_POS" | "AB_NEG" | "O_POS" | "O_NEG";

export type AppointmentStatus =
  | "SCHEDULED"
  | "CHECKED_IN"
  | "IN_CONSULTATION"
  | "COMPLETED"
  | "NO_SHOW"
  | "CANCELLED"
  | "RESCHEDULED"
  | "URGENT";

export type AppointmentType =
  | "CONSULTATION"
  | "FOLLOW_UP"
  | "PROCEDURE"
  | "LAB_VISIT"
  | "IMAGING"
  | "EMERGENCY"
  | "DENTAL"
  | "CHECKUP";

export type InvoiceStatus = "DRAFT" | "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED" | "REFUNDED";

export type POStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "PARTIALLY_RECEIVED" | "COMPLETED" | "CANCELLED";

export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT";

export type EmployeeStatus = "ACTIVE" | "INACTIVE" | "ON_LEAVE" | "TERMINATED";

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "CRITICAL" | "OUT_OF_STOCK";

export type LeaveType = "ANNUAL" | "SICK" | "EMERGENCY" | "MATERNITY" | "PATERNITY" | "UNPAID";

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type AssetStatus = "ACTIVE" | "UNDER_MAINTENANCE" | "DISPOSED" | "TRANSFERRED";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  nationalId?: string;
  photo?: string;
  departmentId?: string;
  department?: Department;
  roles: UserRole[];
  isActive: boolean;
  twoFAEnabled: boolean;
  lastLogin?: string;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  code?: string;
  headId?: string;
  parentId?: string;
}

export interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  nationality?: string;
  nationalId?: string;
  phone: string;
  email?: string;
  address?: string;
  bloodType?: BloodType;
  allergies: string[];
  chronicConditions: string[];
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  insuranceProvider?: string;
  insurancePolicyNo?: string;
  insuranceExpiry?: string;
  photo?: string;
  isActive: boolean;
  lastVisit?: string;
  createdAt: string;
}

export interface Doctor {
  id: string;
  userId: string;
  user: { id: string; name: string; email: string };
  departmentId?: string;
  department?: Department;
  specialization: string;
  consultationFee: number;
  licenseNumber?: string;
  isAvailable: boolean;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  mrn?: string;
  doctorId: string;
  doctorName: string;
  specialization: string;
  scheduledAt: string;
  scheduledEnd?: string;
  status: AppointmentStatus;
  type: AppointmentType;
  reason?: string;
  room?: string;
  notes?: string;
  isUrgent: boolean;
  checkedInAt?: string;
  createdAt: string;
}

export interface Consultation {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  chiefComplaint?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  hpi?: string;
  pmh?: string;
  examination?: string;
  diagnoses: Diagnosis[];
  prescriptions: Prescription[];
  labOrders: LabOrder[];
  vitals?: Vitals;
  followUpDate?: string;
  isLocked: boolean;
  createdAt: string;
}

export interface Vitals {
  id: string;
  bpSystolic?: number;
  bpDiastolic?: number;
  heartRate?: number;
  temperature?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  spo2?: number;
  bloodGlucose?: number;
  respiratoryRate?: number;
  recordedAt: string;
}

export interface Diagnosis {
  id: string;
  icdCode: string;
  description: string;
  type: "PRIMARY" | "SECONDARY" | "DIFFERENTIAL";
  notes?: string;
}

export interface Prescription {
  id: string;
  medicationId?: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity?: number;
  instructions?: string;
  isDispensed: boolean;
}

export interface LabOrder {
  id: string;
  patientId: string;
  patientName: string;
  tests: string[];
  orderedBy: string;
  date: string;
  status: "PENDING_COLLECTION" | "IN_PROGRESS" | "RESULTS_READY" | "RESULTS_RELEASED" | "CANCELLED";
  priority: "ROUTINE" | "URGENT" | "STAT";
  specimenCollected?: boolean;
  results?: LabResult[];
}

export interface LabResult {
  id: string;
  testName: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  isAbnormal: boolean;
  isCritical: boolean;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  patientId: string;
  patientName?: string;
  patient?: { id: string; firstName: string; lastName: string; mrn: string };
  appointmentId?: string;
  dueDate?: string;
  items: InvoiceItem[];
  subtotal: number;
  discountAmount: number;
  discountRate?: number;
  taxRate?: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: InvoiceStatus;
  insuranceClaim: boolean;
  insuranceProvider?: string;
  insurancePolicyNo?: string;
  notes?: string;
  createdAt: string;
  payments?: Payment[];
}

export interface InvoiceItem {
  id: string;
  description: string;
  category?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  totalPrice: number;
  serviceCode?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: string;
  referenceNo?: string;
  notes?: string;
  paidAt: string;
}

export interface Medication {
  id: string;
  genericName: string;
  brandName?: string;
  category: string;
  unit: string;
  stockQuantity: number;
  minStockLevel: number;
  reorderLevel: number;
  unitCost: number;
  sellingPrice: number;
  barcode?: string;
  nearestExpiry?: string;
  expiryDate?: string;
  location?: string;
  stockStatus: StockStatus;
  status?: StockStatus;
  isControlled: boolean;
  requiresPrescription: boolean;
  isActive: boolean;
}

export interface Employee {
  id: string;
  empCode: string;
  userId: string;
  user: { name: string; email: string; phone?: string; photo?: string; isActive: boolean };
  department: { id: string; name: string };
  departmentId: string;
  jobTitle: string;
  employmentType: EmploymentType;
  basicSalary: number;
  hireDate: string;
  endDate?: string;
  status: EmployeeStatus;
  annualLeaveBalance: number;
  sickLeaveBalance: number;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employee?: {
    empCode: string;
    user: { name: string };
    department: { name: string };
  };
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: LeaveStatus;
  approvedById?: string;
  createdAt: string;
}

export interface Asset {
  id: string;
  name: string;
  assetCode?: string;
  category: string;
  serialNumber?: string;
  departmentId?: string;
  department?: Department;
  purchaseDate?: string;
  purchasePrice?: number;
  currentValue?: number;
  location?: string;
  warrantyExpiry?: string;
  status: AssetStatus;
  depreciationMethod: "STRAIGHT_LINE" | "DECLINING_BALANCE";
  usefulLifeYears: number;
  notes?: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  vendor: { id: string; name: string };
  date: string;
  expectedDelivery?: string;
  items: POItem[];
  subtotal: number;
  totalAmount: number;
  status: POStatus;
  approvedById?: string;
  notes?: string;
  createdAt: string;
}

export interface POItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  receivedQty: number;
}

export interface Vendor {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  paymentTerms?: string;
  rating?: number;
  isPreferred: boolean;
  isActive: boolean;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  action: string;
  module: string;
  entityId?: string;
  entityType?: string;
  oldValues?: string;
  newValues?: string;
  ipAddress?: string;
  timestamp: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "INFO" | "WARNING" | "ERROR" | "SUCCESS" | "ALERT";
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export interface DashboardStats {
  dailyRevenue: number;
  dailyRevenueChange: number;
  totalAppointments: number;
  appointmentsChange: number;
  newPatients: number;
  newPatientsChange: number;
  bedOccupancy: number;
  bedOccupancyChange: number;
  pendingInvoices: number;
  criticalAlerts: number;
  lowStockItems: number;
  waitingPatients: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
