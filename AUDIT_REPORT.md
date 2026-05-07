# MediFlow CMS — Full System Audit Report

**Date:** 2026-05-07  
**Auditor:** Senior QA / Security / Performance Review  
**Version audited:** Branch `main` (commit `a32c1e5`)  
**Scope:** Backend (FastAPI + SQLAlchemy), Frontend (Next.js 16), Database schema (MySQL 8.4), Auth flow, UX, i18n, deployment

---

## Executive Summary

MediFlow CMS is a well-structured, full-stack clinic ERP with a clean architecture, solid auth foundation (JWT + bcrypt + token blocklist), and a complete bilingual UI. The codebase shows professional-grade work in many areas — rate limiting, XSS sanitization, RBAC infrastructure, audit logging, and session timeout are all present.

However, **the system is NOT production-ready** in its current state due to a combination of one crash-level runtime bug, nine missing RBAC guards on sensitive financial/medical endpoints, a stock-level race condition, and an employee-code generator that cannot guarantee uniqueness. These issues create real exposure: financial data visible to any logged-in user, medical records writable without authorization, and stock figures that can go negative under concurrent load.

**Total findings: 38** across 5 severity tiers.

---

## Overall System Health Scorecard

| Dimension | Score | Notes |
|---|---|---|
| **Security** | 54 / 100 | RBAC gaps on 9 endpoints; deactivated users can still call API |
| **Stability / Correctness** | 68 / 100 | 1 crash-level bug, 2 ID-generation collision risks |
| **Performance** | 72 / 100 | N+1 patterns in shifts/branches; no aggregation caching |
| **Data Integrity** | 70 / 100 | Race condition on pharmacy stock; unguarded schema mutations |
| **UX / Accessibility** | 80 / 100 | ARIA and mobile drawer added; session timeout works; minor gaps remain |
| **Code Quality** | 82 / 100 | Consistent patterns, good abstractions; a few untyped dict bodies |
| **i18n Completeness** | 85 / 100 | Bilingual throughout; a few new keys may be missing in AR |

### **Production Readiness Score: 52 / 100**

The system must resolve all P0 and P1 items before any patient data is processed.

---

## Findings by Severity

---

### P0 — CRITICAL (System-Breaking / Data-Corrupting)

---

#### BUG-001 — `TypeError` crash in WhatsApp reminder endpoint
**File:** `backend/routers/appointments.py:288`  
**Impact:** Every call to `POST /api/appointments/{id}/whatsapp-reminder` throws `TypeError: 'User' object is not subscriptable` and returns HTTP 500.

```python
# WRONG — current_user is a models.User ORM object, not a dict
log_audit(db, current_user["id"], "WHATSAPP_SENT" ...)

# CORRECT
log_audit(db, current_user.id, "WHATSAPP_SENT" ...)
```

**Fix:** Change `current_user["id"]` → `current_user.id` on line 288.

---

#### BUG-002 — Race condition: pharmacy stock can go negative
**File:** `backend/routers/pharmacy.py` — `create_stock_movement`  
**Impact:** Under concurrent stock dispense requests (two nurses dispensing simultaneously), both read the same `stockQuantity`, both subtract, and the final value is wrong — typically resulting in negative stock.

The current flow:
```python
med = db.query(Medication).filter(...).first()   # read qty
# ... compute new_qty ...
med.stockQuantity = new_qty                       # write qty — NOT ATOMIC
```

**Fix:** Add `with_for_update()` to the medication fetch:
```python
med = db.query(Medication).filter(...).with_for_update().first()
```

---

### P1 — HIGH (Security Vulnerabilities / RBAC Gaps)

---

#### SEC-001 — Deactivated users can still call the API
**File:** `backend/auth.py:120-142` — `get_current_user`  
**Impact:** A dismissed employee whose account is set `isActive=False` can continue to use their valid JWT (up to 8 hours) to call any endpoint. No `isActive` check is performed after fetching the user.

```python
user = db.query(models.User).filter(models.User.id == user_id).first()
if not user:
    raise HTTPException(status_code=401, detail="User not found")
# ← Missing: if not user.isActive: raise HTTPException(401, "Account disabled")
return user
```

---

#### SEC-002 — Locked accounts bypass lockout with existing JWT
**File:** `backend/auth.py:139-142`  
**Impact:** The login endpoint checks `lockedUntil`, but `get_current_user` does not. A user with too many failed logins on a different device can still use a previously issued token.

**Fix:** Add to `get_current_user` after the `isActive` check:
```python
if user.lockedUntil and user.lockedUntil > datetime.utcnow():
    raise HTTPException(status_code=401, detail="Account is temporarily locked")
```

---

#### SEC-003 — Financial overview accessible by any authenticated user
**File:** `backend/routers/accounting.py:76`  
**Impact:** `GET /api/accounting/overview` returns total revenue, net profit, accounts receivable, accounts payable, and recent invoices to **any** logged-in user (receptionist, lab tech, nurse, etc.).

```python
# CURRENT — no role restriction
def get_overview(db: Session = Depends(get_db), _user=Depends(get_current_user)):

# REQUIRED
def get_overview(db: Session = Depends(get_db), _user=Depends(require_roles(*ACCT_ROLES))):
```

The `ACCT_ROLES` constant is already defined in the same file — it's simply not applied to the overview endpoint.

---

#### SEC-004 — Revenue and patient statistics accessible by any user
**File:** `backend/routers/reports.py:13`  
**Impact:** `GET /api/reports/overview` returns monthly revenue, patient counts, appointment volumes, and no-show rates to any authenticated user.

**Fix:** Apply `require_roles("SUPER_ADMIN", "CLINIC_MANAGER", "ACCOUNTANT")`.

---

#### SEC-005 — Patient billing and insurance data accessible by any user
**File:** `backend/routers/billing.py` — `get_invoices` and `get_invoice`  
**Impact:** Any authenticated user can query the full invoice list including patient names, insurance provider, insurance policy numbers, outstanding balances, and payment history — all PII-adjacent medical financial data.

**Fix:** Apply `require_roles("SUPER_ADMIN", "CLINIC_MANAGER", "ACCOUNTANT", "RECEPTIONIST")` to GET endpoints.

---

#### SEC-006 — Invoice update accepts arbitrary unvalidated dict
**File:** `backend/routers/billing.py` — `update_invoice`  
**Impact:** The endpoint accepts `body: dict` with no Pydantic schema. Any field can be overwritten including computed fields (`balance`, `totalAmount`). No status enum validation — arbitrary strings can be set as `status`.

**Fix:** Replace `body: dict` with a typed Pydantic `InvoiceUpdate` model with `Optional` fields and `Literal` for status.

---

#### SEC-007 — Radiology orders accessible by any authenticated user
**File:** `backend/routers/radiology.py:36`  
**Impact:** Any logged-in user can browse all radiology orders including patient names, clinical information, and radiological reports — which are sensitive medical data.

**Fix:** Apply `require_roles("SUPER_ADMIN", "CLINIC_MANAGER", "DOCTOR", "NURSE", "RADIOLOGIST")`.

---

#### SEC-008 — Branch management unguarded (any user can create/modify branches)
**File:** `backend/routers/branches.py:63,93`  
**Impact:** `POST /api/branches` and `PATCH /api/branches/{id}` use `Depends(get_current_user)` — any staff member can create branches or change the branch manager, which is an administrative function that should be restricted to SUPER_ADMIN or CLINIC_MANAGER.

---

#### SEC-009 — Shift management unguarded
**File:** `backend/routers/shifts.py:98,116,129`  
**Impact:** Any authenticated user can create, update, or deactivate work shifts — an HR administration function.

**Fix:** Apply `require_roles("SUPER_ADMIN", "CLINIC_MANAGER", "HR_OFFICER")` to write operations.

---

#### SEC-010 — Consultation creation has no role restriction
**File:** `backend/routers/consultations.py` — `create_consultation`  
**Impact:** Any authenticated user (receptionist, pharmacist, accountant, etc.) can create medical consultation records and modify patient medical history — a function that should be restricted to clinical staff.

**Fix:** Apply `require_roles("SUPER_ADMIN", "CLINIC_MANAGER", "DOCTOR", "NURSE")`.

---

#### SEC-011 — HR stats endpoint unguarded
**File:** `backend/routers/hr.py` — `get_hr_stats`  
**Impact:** Any user can see total employee count, total salary expenditure, and leave statistics.

**Fix:** Apply `require_roles("SUPER_ADMIN", "CLINIC_MANAGER", "HR_OFFICER")`.

---

#### SEC-012 — `update_employee` userRoles bypass VALID_ROLES whitelist
**File:** `backend/routers/hr.py` — `update_employee`  
**Impact:** When an HR officer updates an employee's roles via the employee edit form, the new roles list is not validated against `VALID_ROLES`. Arbitrary role strings can be injected, which could cause undefined behavior in RBAC checks throughout the app.

**Fix:** Add validation before writing:
```python
if body.userRoles:
    from routers.users import VALID_ROLES
    invalid = set(body.userRoles) - VALID_ROLES
    if invalid:
        raise HTTPException(422, f"Invalid roles: {invalid}")
```

---

### P2 — MEDIUM (Performance / Reliability)

---

#### PERF-001 — N+1 query pattern in shifts listing
**File:** `backend/routers/shifts.py` — `shift_to_dict()` and `assignment_to_dict()`  
**Impact:** For each shift, a separate query fetches the branch. For each assignment, two additional queries fetch the employee and then the user. With 50 shifts and 200 assignments, this produces 450+ queries per request.

**Fix:** Use SQLAlchemy `joinedload` on the query:
```python
from sqlalchemy.orm import joinedload
q.options(joinedload(models.Shift.branch), joinedload(models.Shift.assignments))
```

---

#### PERF-002 — N+1 query pattern in branches listing
**File:** `backend/routers/branches.py` — `branch_to_dict()`  
**Impact:** For each branch, two queries run to fetch the manager employee record and then the user name.

**Fix:** Join `Employee` and `User` on the initial branch query.

---

#### PERF-003 — Accounting overview runs 5 separate aggregation queries
**File:** `backend/routers/accounting.py:76-116`  
**Impact:** Each dashboard load fires 5 independent `func.sum/count` queries against potentially large tables. For a busy clinic, this adds 50-200ms of unnecessary latency.

**Fix:** Cache the overview for 60 seconds (e.g. with a simple `functools.lru_cache` on a TTL wrapper, or Redis for multi-worker deployments).

---

#### PERF-004 — Reports use naive `datetime.now()` for date filtering
**File:** `backend/routers/reports.py:19`  
**Impact:** `datetime.now()` returns server local time. If the server timezone differs from the clinic's configured timezone, report date ranges will be off. Under DST changes, a day can be double-counted or skipped.

**Fix:** Use `datetime.now(timezone.utc)` throughout, or derive the clinic timezone from `ClinicSetting` and convert.

---

#### PERF-005 — TokenBlocklist pruning uses mixed naive/aware datetimes
**File:** `backend/auth.py:116`  
**Impact:** `datetime.utcnow()` (naive) is compared against `expiresAt` values stored from `datetime.fromtimestamp(exp_ts)` (naive local time). On non-UTC servers, expired tokens may not be pruned at the correct time.

**Fix:** Use consistent `datetime.now(timezone.utc)` everywhere and store aware datetimes.

---

### P3 — LOW (Data Integrity / Correctness)

---

#### DATA-001 — `generate_emp_code()` has no uniqueness check and only 9,000 combinations
**File:** `backend/auth.py:51-53`  
**Impact:** `generate_emp_code()` returns a random code in range `EMP-1000` to `EMP-9999` without checking for existing codes in the database. With a unique constraint on `empCode`, this causes `IntegrityError` (HTTP 500) at a high probability once the employee count exceeds ~500 (birthday paradox).

Compare with `generate_mrn()` which correctly retries with DB uniqueness check.

```python
# CURRENT — no DB check, only 9000 combinations
def generate_emp_code() -> str:
    rand = secrets.randbelow(9000) + 1000
    return f"EMP-{rand}"

# REQUIRED
def generate_emp_code(db=None) -> str:
    for _ in range(20):
        rand = secrets.randbelow(900000) + 100000   # 900,000 combinations
        candidate = f"EMP-{rand}"
        if db is None:
            return candidate
        if not db.query(models.Employee).filter(models.Employee.empCode == candidate).first():
            return candidate
    raise RuntimeError("Failed to generate unique employee code")
```

---

#### DATA-002 — `generate_po_number()` has no uniqueness check
**File:** `backend/auth.py:69-72`  
**Impact:** `PO-{year}-{rand}` (90,000 combinations per year) is generated without DB uniqueness verification. The `poNumber` column has a `UNIQUE` constraint, so a collision causes IntegrityError (HTTP 500).

**Fix:** Add retry-with-DB-check loop, same pattern as `generate_invoice_no()`.

---

#### DATA-003 — Soft-deleted patient can be fetched by direct ID
**File:** `backend/routers/patients.py` — `get_patient(patient_id)`  
**Impact:** `GET /api/patients/{id}` returns soft-deleted patients (`deletedAt IS NOT NULL`) to callers. If a deleted patient's ID is known, their full medical record remains accessible.

**Fix:** Add `.filter(models.Patient.deletedAt.is_(None))` to the by-ID fetch.

---

#### DATA-004 — Duplicate `nationalId` check includes soft-deleted patients
**File:** `backend/routers/patients.py` — `create_patient`  
**Impact:** When creating a new patient, the duplicate nationalId check fires against all patients including soft-deleted ones. This prevents registering a patient who has a national ID that was previously soft-deleted.

**Fix:** Add `.filter(models.Patient.deletedAt.is_(None))` to the duplicate check query.

---

#### DATA-005 — Vitals BMI not auto-calculated
**File:** `backend/routers/consultations.py` — `create_vitals`  
**Impact:** When weight and height are submitted without a BMI value, the backend doesn't compute `bmi = weight / (height/100)^2`. The frontend relies on the backend to have the correct value; stored BMI will be null unless the caller explicitly computes it.

---

#### DATA-006 — `Session` model is dead code
**File:** `backend/models.py:42-52`  
**Impact:** A complete `Session` table is defined in the model but never written to or read from anywhere. The auth system uses JWT + TokenBlocklist instead. This creates a misleading table in production that consumes schema space and may confuse future developers.

**Recommendation:** Either remove the model and migration, or document its intended future use.

---

### P4 — INFORMATIONAL (UX / Docs / Minor)

---

#### UX-001 — Frontend session timeout hardcoded, ignores DB setting
**File:** `src/components/layout/DashboardShell.tsx`  
**Impact:** The inactivity threshold is hardcoded at 25 minutes. `ClinicSetting.sessionTimeout` (default 480 minutes = 8 hours) is stored in the DB and returned by `/api/settings` but the frontend ignores it. Clinical admin cannot configure session timeout from the Settings UI.

**Fix:** Read `settings.sessionTimeout` from the `/api/settings` fetch in `TimezoneContext` or `DashboardShell` and use it to set `INACTIVITY_WARN_MS`.

---

#### UX-002 — `twoFAEnabled` omitted from Users API response
**File:** `backend/routers/users.py`  
**Impact:** The users list and current-user endpoints don't include `twoFAEnabled` in the response dict. The frontend `User` TypeScript type declares this field, but it will always be `undefined` — so the Settings page cannot show correct 2FA status.

---

#### UX-003 — `NEXT_PUBLIC_BASE_URL` env var is undocumented
**File:** `src/app/(dashboard)/page.tsx`  
**Impact:** The dashboard page references `process.env.NEXT_PUBLIC_BASE_URL` but this variable is absent from `.env.local` documentation in both `README.md` and `CLAUDE.md`. Developers setting up the project will get `undefined` silently.

---

#### UX-004 — 2FA infrastructure modeled but not enforced
**File:** `backend/models.py:23`, `backend/routers/settings.py`  
**Impact:** `User.twoFAEnabled` and `User.twoFASecret` columns exist, `ClinicSetting.require2FA` exists, but the login flow never enforces 2FA even when `require2FA=True`. This is a security theater risk — an admin enabling "require 2FA" in settings has no actual effect.

**Recommendation:** Either implement 2FA enforcement in the login flow or remove the UI toggle and document it as a future feature.

---

#### UX-005 — Settings timezone field accepts arbitrary strings
**File:** `backend/routers/settings.py`  
**Impact:** `PATCH /api/settings` accepts any string as `timezone` without validation against a list of valid IANA timezone identifiers. An invalid value stored in the DB will cause silent failures in `Intl.DateTimeFormat` (returns NaN or wrong results) and in `reports.py` date calculations.

**Fix:** Validate against `pytz.all_timezones`:
```python
import pytz
if body.timezone and body.timezone not in pytz.all_timezones:
    raise HTTPException(422, f"Invalid timezone: {body.timezone!r}")
```

---

#### UX-006 — Radiology and Laboratory pages are read-only despite backend write support
**File:** Frontend pages: `src/app/(dashboard)/radiology/`, `laboratory/`  
**Impact:** Radiologists and lab technicians can only view orders — there is no UI to enter results, update status, or attach reports. The backend endpoints to do so exist but are not wired to the frontend.

---

#### UX-007 — No DELETE endpoint for radiology/lab orders
**File:** `backend/routers/radiology.py`, `backend/routers/laboratory.py`  
**Impact:** Orders can only be listed; there's no cancel or delete operation. Clinical staff cannot remove accidentally created or duplicate orders.

---

#### DOCS-001 — `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_WA_FROM` not in `.env.local` docs
**File:** `backend/routers/appointments.py:272-274`  
**Impact:** The WhatsApp reminder feature silently degrades to "preview mode" (`sent=false`) when these env vars are absent. They are not documented anywhere, so operators won't know to set them.

---

## Fix Priority Queue

| Priority | Bug ID | File | Effort |
|---|---|---|---|
| 🔴 CRITICAL | BUG-001 | `appointments.py:288` | 1 line |
| 🔴 CRITICAL | BUG-002 | `pharmacy.py` stock movement | 1 line |
| 🔴 HIGH | SEC-001 | `auth.py` `get_current_user` | 3 lines |
| 🔴 HIGH | SEC-002 | `auth.py` `get_current_user` | 3 lines |
| 🔴 HIGH | SEC-003 | `accounting.py` overview | 1 line |
| 🔴 HIGH | SEC-004 | `reports.py` overview | 1 line |
| 🔴 HIGH | SEC-005 | `billing.py` GET endpoints | 2 lines |
| 🔴 HIGH | SEC-006 | `billing.py` update | 15 lines (new model) |
| 🔴 HIGH | SEC-007 | `radiology.py` listing | 1 line |
| 🔴 HIGH | SEC-008 | `branches.py` write ops | 2 lines |
| 🔴 HIGH | SEC-009 | `shifts.py` write ops | 3 lines |
| 🔴 HIGH | SEC-010 | `consultations.py` create | 1 line |
| 🔴 HIGH | SEC-011 | `hr.py` stats | 1 line |
| 🔴 HIGH | SEC-012 | `hr.py` update_employee | 8 lines |
| 🟡 MEDIUM | DATA-001 | `auth.py` emp code gen | 10 lines |
| 🟡 MEDIUM | DATA-002 | `auth.py` PO number gen | 10 lines |
| 🟡 MEDIUM | DATA-003 | `patients.py` get by ID | 1 line |
| 🟡 MEDIUM | DATA-004 | `patients.py` nationalId check | 1 line |
| 🟡 MEDIUM | PERF-001 | `shifts.py` N+1 | 10 lines |
| 🟡 MEDIUM | PERF-002 | `branches.py` N+1 | 10 lines |
| 🟡 MEDIUM | PERF-004 | `reports.py` datetime | 5 lines |
| 🟢 LOW | UX-001 | `DashboardShell.tsx` timeout | 15 lines |
| 🟢 LOW | UX-002 | `users.py` twoFAEnabled | 1 line |
| 🟢 LOW | UX-005 | `settings.py` timezone validation | 5 lines |

---

## Most Dangerous Hidden Issue

**SEC-003 combined with SEC-004 and SEC-005** — The financial data exposure is the most dangerous hidden issue because it is completely invisible at the UI level. The frontend properly shows/hides UI elements based on roles, but any authenticated user can bypass the UI entirely and call `GET /api/accounting/overview`, `GET /api/reports/overview`, or `GET /api/billing/` directly via curl or browser devtools. A nurse, lab technician, or receptionist can extract the clinic's full financial history, revenue figures, and every patient's insurance data without any record in the audit log (since it's a read operation).

This is a HIPAA/GDPR-relevant data exposure that creates real legal liability.

---

## Top Risks Preventing Production Deployment

1. **Financial data accessible to all users** (SEC-003/004/005) — Any logged-in staff can read full revenue, expenses, and patient billing. Regulatory violation.

2. **WhatsApp reminder endpoint always crashes** (BUG-001) — Every reminder request returns HTTP 500. A visible, documented feature is completely broken.

3. **Stock race condition** (BUG-002) — Under concurrent pharmacy load, medication stock levels become incorrect. Could lead to dispensing drugs that are out of stock or to negative inventory values causing reporting errors.

4. **Deactivated users remain authenticated** (SEC-001) — Offboarded employees with valid JWTs can continue to access patient records for up to 8 hours after deactivation.

5. **Employee code collision** (DATA-001) — Will cause unhandled IntegrityError (HTTP 500) in HR workflows when employee count crosses ~500.

---

## Enterprise Scaling Recommendations

1. **Connection pooling:** Configure `pool_size=20, max_overflow=40, pool_pre_ping=True` in `database.py` for production worker concurrency.

2. **Read replicas:** Route GET endpoints to a read replica for reports and audit log queries which can be eventually consistent.

3. **Caching layer:** Add Redis for `/api/dashboard/stats`, `/api/accounting/overview`, and `/api/reports/overview` with 60-second TTL.

4. **Pagination enforcement:** All listing endpoints have `pageSize` max at 100. Under high data volume, add a secondary `cursor`-based pagination for the audit log table which can grow to millions of rows.

5. **Async FastAPI workers:** Migrate long-running endpoints (payroll calculation, report aggregation) to `async def` with `asyncio` or background tasks via FastAPI `BackgroundTasks`.

6. **Soft-delete cascade:** Add a scheduled job to hard-delete records soft-deleted more than 7 years ago (or per jurisdiction's medical record retention law), to prevent unbounded table growth.

7. **Rate limiting per user:** The current `default_limits=["200/minute"]` is per IP. In a NAT'd clinic environment, all staff share an IP — add per-user rate limits on write endpoints.

8. **Database indexes for audit log growth:** As `audit_logs` grows, ensure `(module, timestamp)` composite index exists for the module-filtered queries in the audit page.

---

*End of Report — MediFlow CMS Full Audit 2026-05-07*
