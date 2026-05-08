# MediFlow CMS — Claude Code Context

## Project Overview
Full-stack clinic ERP with a **decoupled architecture**:
- **Backend**: FastAPI (Python) — handles all business logic, auth, and DB access
- **Frontend**: Next.js 16 (TypeScript) — UI only, proxies all `/api/*` calls to FastAPI

SRS reference: `../clinic_management/clinic_management_srs.md`

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router, webpack) + TypeScript |
| Backend | FastAPI (Python 3.11+) on port 8000 |
| ORM | SQLAlchemy 2.0 + PyMySQL |
| Database | MySQL 8.4 |
| Auth | JWT (python-jose) + bcrypt (passlib) — `mediflow_token` HttpOnly cookie |
| UI | Tailwind CSS v4, Material Symbols Outlined (Google Fonts), Recharts |
| Animations | Framer Motion v12 — sidebar collapse, stagger entrance, page transitions |
| Fonts | @fontsource/inter + @fontsource/cairo (self-hosted, no CDN) |
| State | Zustand |
| Tables | TanStack React Table |
| Rate limiting | `slowapi` (FastAPI) |
| Edge JWT | `jose` (Next.js middleware) |

## Architecture — CRITICAL

The frontend calls `/api/...` — Next.js **proxies** these to `http://localhost:8000/api/...` via `next.config.ts` rewrites. There are **no** Next.js API routes.

```
Browser → Next.js :3000 → (rewrite) → FastAPI :8000 → MySQL
```

Cookie (`mediflow_token`) is set by FastAPI and forwarded transparently through the proxy.

## Routing — CRITICAL
The `(dashboard)` and `(auth)` folders are Next.js **route groups** — they do NOT add a URL segment.

| File path | URL |
|---|---|
| `app/(dashboard)/page.tsx` | `/` |
| `app/(dashboard)/patients/page.tsx` | `/patients` |
| `app/(dashboard)/appointments/page.tsx` | `/appointments` |
| `app/(dashboard)/emr/[id]/page.tsx` | `/emr/[id]` |
| `app/(dashboard)/billing/page.tsx` | `/billing` |
| `app/(dashboard)/pharmacy/page.tsx` | `/pharmacy` |
| `app/(dashboard)/hr/page.tsx` | `/hr` |
| `app/(dashboard)/accounting/page.tsx` | `/accounting` |
| `app/(dashboard)/laboratory/page.tsx` | `/laboratory` |
| `app/(dashboard)/radiology/page.tsx` | `/radiology` |
| `app/(dashboard)/reports/page.tsx` | `/reports` |
| `app/(dashboard)/users/page.tsx` | `/users` |
| `app/(dashboard)/settings/page.tsx` | `/settings` |
| `app/(dashboard)/audit/page.tsx` | `/audit` |
| `app/(auth)/login/page.tsx` | `/login` |

**Never use `/dashboard/` as a URL prefix — it does not exist.**

## Project Structure

```
mediflow-cms/
├── setup.py                        # One-time interactive installer
├── install.bat                     # Double-click installer (runs setup.py)
├── start.bat                       # Starts MySQL + Backend + Frontend
├── stop.bat                        # Stops all services
├── .env.example                    # Frontend env template (tracked in Git)
├── deploy/                         # Ubuntu production deployment files
│   ├── deploy.sh                   # First-time server setup script
│   ├── update.sh                   # git pull → migrate → build → restart
│   ├── nginx.conf                  # Nginx reverse proxy + HTTPS + SSE
│   ├── mediflow-backend.service    # systemd unit — uvicorn (no --reload)
│   └── mediflow-frontend.service   # systemd unit — next start
├── public/
│   └── robots.txt                  # Disallow: / (blocks search engine indexing)
├── backend/                        # FastAPI Python backend
│   ├── main.py                     # FastAPI app + CORS + slowapi rate limiter
│   ├── database.py                 # SQLAlchemy engine + get_db() + connection pool
│   ├── models.py                   # All SQLAlchemy ORM models + TokenBlocklist
│   ├── auth.py                     # JWT, bcrypt, generate_id, log_audit, revoke_token
│   ├── seed.py                     # Creates admin@mediflow.com / Admin@1234
│   ├── reset_db.py                 # Wipes + recreates schema + seeds (requires --confirm)
│   ├── requirements.txt            # includes alembic + cryptography
│   ├── alembic.ini                 # Alembic config — sqlalchemy.url read from .env
│   ├── .env.example                # Backend env template (tracked in Git)
│   ├── .env                        # DATABASE_URL + JWT_SECRET + COOKIE_SECURE (not in Git)
│   ├── .venv/                      # Python virtual environment (created by setup.py)
│   ├── migrations/
│   │   ├── env.py                  # Alembic env — imports Base + all models, reads .env
│   │   ├── script.py.mako          # Migration file template
│   │   └── versions/               # Generated migration files (empty on fresh clone)
│   ├── start.bat
│   └── routers/
│       ├── auth.py                 # POST /api/auth/login|logout (rate limited: 10/min)
│       ├── patients.py             # GET/POST/PATCH/DELETE /api/patients (soft delete)
│       ├── appointments.py         # GET/POST/PATCH /api/appointments
│       ├── emr.py                  # GET /api/emr/{id} (eager-loaded, no N+1)
│       ├── consultations.py        # POST /api/consultations
│       ├── billing.py              # /api/billing + /{id} + /{id}/payments
│       ├── pharmacy.py             # /api/pharmacy/medications + stock-movements
│       ├── hr.py                   # /api/hr/employees|leaves|payroll|attendance
│       ├── accounting.py           # /api/accounting/overview|assets|expenses|vendors|purchase-orders
│       ├── reports.py              # GET /api/reports/overview
│       ├── users.py                # GET/POST/PATCH/DELETE /api/users
│       ├── dashboard.py            # GET /api/dashboard/stats
│       ├── doctors.py              # GET /api/doctors
│       ├── audit.py                # GET /api/audit
│       ├── settings.py             # GET/PATCH /api/settings (timezone, currency, etc.)
│       ├── branches.py             # GET/POST/PATCH /api/branches
│       └── shifts.py               # CRUD /api/shifts + /api/shifts/assignments
│
├── src/
│   ├── middleware.ts               # Edge JWT verification (jose) — protects all dashboard routes
│   ├── app/
│   │   ├── (auth)/login/           # Login page → /login
│   │   └── (dashboard)/            # Protected pages (no URL prefix)
│   │       ├── layout.tsx          # Server component — reads JWT cookie, renders DashboardShell
│   │       ├── page.tsx            # Dashboard → /
│   │       ├── patients/           # → /patients
│   │       ├── appointments/       # → /appointments
│   │       ├── emr/[id]/           # → /emr/:id  (detail page)
│   │       ├── emr/page.tsx        # → /emr  (list page)
│   │       ├── appointments/[id]/  # → /appointments/:id  (detail page)
│   │       ├── billing/            # → /billing
│   │       ├── pharmacy/           # → /pharmacy
│   │       ├── hr/                 # → /hr
│   │       ├── accounting/         # → /accounting
│   │       ├── laboratory/         # → /laboratory
│   │       ├── radiology/          # → /radiology
│   │       ├── reports/            # → /reports
│   │       ├── users/              # → /users
│   │       ├── settings/           # → /settings
│   │       └── audit/              # → /audit
│   ├── components/
│   │   ├── layout/
│   │   │   ├── DashboardShell.tsx  # Client wrapper: mobile sidebar state + session timeout modal
│   │   │   ├── Sidebar.tsx         # Navigation — supports mobile drawer (isOpen/onClose props)
│   │   │   └── TopBar.tsx          # Search, notifications, user menu, hamburger (onMenuClick prop)
│   │   ├── ErrorBoundary.tsx       # React class Error Boundary with "Try again" button
│   │   └── ErrorBanner.tsx         # Inline error display — distinguishes network vs. API errors
│   ├── lib/
│   │   ├── utils.ts                # cn, formatDate, formatCurrency, getInitials
│   │   ├── TimezoneContext.tsx     # TimezoneProvider + useTimezone hook
│   │   ├── hooks/
│   │   │   ├── useDebounce.ts      # 300ms debounce hook (used on all search inputs)
│   │   │   └── useDataFetch.ts     # useFetchState hook + ApiError class + apiFetch util
│   │   └── i18n/
│   │       ├── translations.ts     # Full EN/AR translation dictionaries
│   │       └── LanguageContext.tsx # LanguageProvider + useLanguage hook
│   └── types/
│       └── index.ts                # Shared TypeScript types (UserRole includes AUDITOR + STAFF)
│
└── next.config.ts                  # Proxy rewrite + security headers (CSP, X-Frame-Options, etc.)
```

## Design System
- **Primary**: `#002045` (deep navy)
- **Medical Blue**: `#1960a3`
- **Background**: `#faf9fd`
- **Border**: `#e3e2e6`
- **Text primary**: `#1a1c1e`
- **Text secondary**: `#74777f`
- **Success**: `#0d9488` / `#ccfbf1`
- **Error**: `#ba1a1a` / `#ffdad6`
- **Warning**: `#d97706` / `#fff7ed`
- **Font**: Inter (EN) / Cairo (AR) — switched via `[lang="ar"]` CSS selector
- **Icons**: `<span className="material-symbols-outlined">icon_name</span>` — NOT Lucide
- **Border radius**: `rounded-lg` (8px) standard, `rounded-xl` (12px) for cards, `rounded-2xl` for modals
- **Reusable CSS classes** (in `globals.css`): `btn-primary`, `btn-secondary`, `btn-ghost`, `btn-danger`, `card`, `input-field`, `select-field`, `badge`, `table-header`, `table-cell`, `table-row`, `no-scrollbar`, `skeleton`, `popup-panel`, `animate-fade-in`, `animate-slide-up`, `animate-scale-in`

### CSS Custom Properties (Design Tokens)
All colors are available as CSS variables via `:root` — use `var(--token)` in component CSS classes:
- **Surfaces**: `--bg`, `--surface`, `--surface2`, `--surface3`, `--border`, `--border2`
- **Text**: `--txt1`, `--txt2`, `--txt3`, `--txt4`
- **Brand**: `--brand`, `--brandh`, `--blue`, `--blue-soft`, `--blue-bg`
- **Status**: `--ok`, `--ok-bg`, `--err`, `--err-bg`, `--warn`, `--warn-bg`
- **Shadows**: `--sh-xs`, `--sh-sm`, `--sh-md`, `--sh-lg`, `--sh-xl`

### Dark Mode
- Toggled by adding/removing the `dark` class on `<html>` (`html.dark`)
- `DashboardShell` manages the `darkMode` boolean state — persisted in `localStorage` key `mediflow_dark`
- `TopBar` receives `darkMode` + `onToggleDark` props — shows sun/moon toggle button
- All CSS component classes (`.card`, `.btn-*`, `.input-field`, etc.) automatically respond to dark mode via `var()` tokens
- `html.dark` overrides also lift common inline Tailwind values (`bg-white`, `text-[#1a1c1e]`, `border-[#e3e2e6]`, etc.)

### Skeleton Loader
Use the `.skeleton` CSS class on any placeholder element — renders an animated shimmer:
```tsx
<div className="skeleton h-8 w-48" />
<div className="skeleton h-32 w-full rounded-xl" />
```

## Auth Flow
1. Frontend POSTs to `/api/auth/login` → Next.js proxies to FastAPI (rate limit: 10/min)
2. FastAPI verifies credentials (bcrypt), signs JWT `{ sub, name, email, roles }`, sets `mediflow_token` HttpOnly cookie (8h, `samesite=strict`)
3. `src/middleware.ts` verifies the cookie on every request using `jose` (Edge-compatible) — redirects to `/login` on failure
4. Dashboard `layout.tsx` (server) re-verifies the cookie with `jsonwebtoken` to populate TopBar/Sidebar
5. `DashboardShell.tsx` (client) tracks inactivity — shows warning modal after 25min, auto-logout after 5min countdown
6. Logout POSTs to `/api/auth/logout` → FastAPI adds token hash to `TokenBlocklist`, clears cookie
7. `get_current_user()` checks `TokenBlocklist` on every authenticated request (SHA-256 hash comparison)

## Security Hardening (implemented)
- **Token blocklist**: `TokenBlocklist` model stores SHA-256 hashes of revoked tokens; expired entries auto-purged on each logout
- **Rate limiting**: `slowapi` on FastAPI — 200/min global, 10/min on login
- **Input validation**: Pydantic `Field` validators (min/max length, regex, enum whitelists) on all mutation endpoints
- **Role whitelist**: `VALID_ROLES` set in `users.py` — rejects unknown roles at user creation/update
- **RBAC**: `require_roles()` dependency on all sensitive endpoints; self-role-escalation blocked
- **Pessimistic locking**: `with_for_update()` on invoice payments and medication stock adjustments
- **Security headers**: CSP (production-narrowed), HSTS (production-only), X-Frame-Options, X-Content-Type-Options set in `next.config.ts`
- **CORS**: `ALLOWED_ORIGINS` configurable via env var (default: `http://localhost:3000`)
- **Cookie secure flag**: controlled by `COOKIE_SECURE` env var — `false` in dev (HTTP), `true` in production (HTTPS required)
- **CSRF protection**: double-submit cookie (`mediflow_csrf`) checked on all POST/PATCH/DELETE requests
- **Secrets**: `secrets` module used everywhere (replaced `random`) — MRN/invoice generation with DB uniqueness retry

## Database — MySQL 8.4
- **Connection**: configured in `backend/.env` — generated by `setup.py` / `install.bat`
- **ORM**: SQLAlchemy 2.0 — models in `backend/models.py`
- **Migrations**: Alembic 1.14 — `backend/alembic.ini` + `backend/migrations/env.py`
  - New migration: `alembic revision --autogenerate -m "description"`
  - Apply: `alembic upgrade head` (run from `backend/` with `.venv` active)
  - `migrations/env.py` auto-loads `backend/.env` and imports all models from `models.py`
- **JSON fields**: Arrays (allergies, roles, tests, etc.) stored as MySQL `JSON` columns
- **IDs**: 25-char hex strings generated via `uuid.uuid4().hex[:25]`
- **Connection pool**: `pool_size=20`, `max_overflow=40`, `pool_recycle=3600`, `pool_pre_ping=True`
- **Indexes**: Added on high-query columns — Consultation (patientId, doctorId, createdAt), LabOrder, RadiologyOrder, Payment (invoiceId), StockMovement, Employee, LeaveRequest, AuditLog, Notification
- **Soft delete**: `Patient.deletedAt` and `Employee.deletedAt` — DELETE sets timestamp, queries filter `deletedAt == None`
- **Reset DB (dev only)**: `cd backend && python reset_db.py --confirm` — wipes all data, requires `--confirm` flag
- **MySQL manual start** (fallback if not a Windows service):
  ```
  "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" --defaults-file="C:\ProgramData\MySQL\MySQL Server 8.4\my.ini" --console
  ```

## Backend Notes (FastAPI)
- All routers use `Depends(get_current_user)` for auth — reads `mediflow_token` cookie
- JSON fields from MySQL come back as Python lists/dicts — no casting needed
- `generate_id()` in `auth.py` → `uuid.uuid4().hex[:25]`
- `log_audit()` in `auth.py` — call after any mutation
- `revoke_token(db, token, exp)` in `auth.py` — called by logout; stores SHA-256 hash in `TokenBlocklist`
- Decimal fields returned as `float()` in response dicts
- N+1 prevention: use `joinedload` / `selectinload` in routers that return nested objects (see `emr.py`, `appointments.py`)
- Python on this machine is system-wide (no `.venv`) — run with `python`, not `.venv\Scripts\python`

## Role System — CRITICAL
Valid roles (canonical list in `backend/routers/users.py` `VALID_ROLES`):
```
SUPER_ADMIN, CLINIC_MANAGER, DOCTOR, NURSE, RECEPTIONIST,
PHARMACIST, LAB_TECHNICIAN, RADIOLOGIST, ACCOUNTANT, HR_OFFICER, AUDITOR, STAFF
```
- **HR endpoints** use `HR_ROLES = ("HR_OFFICER", "SUPER_ADMIN", "CLINIC_MANAGER")` — the role is `HR_OFFICER`, NOT `HR_MANAGER`
- **Audit endpoints** accept `AUDITOR` role
- TypeScript `UserRole` type in `src/types/index.ts` must stay in sync with this list

## Frontend Layout — DashboardShell
The dashboard layout uses a three-layer client structure:
```
layout.tsx (server) → DashboardShell.tsx (client) → Sidebar + TopBar + children
```
- `DashboardShell` manages: mobile sidebar open/close, **desktop sidebar collapse**, **dark mode toggle**, and session timeout inactivity timer
- **Sidebar collapse**: `sidebarCollapsed` boolean — persisted in `localStorage` key `mediflow_sidebar_collapsed`; collapsed width = 72 px, expanded = 256 px; CSS `transition-[width]` on `md:` breakpoint; Framer Motion `AnimatePresence` fades nav labels in/out
- **Dark mode**: `darkMode` boolean — persisted in `localStorage` key `mediflow_dark`; applies/removes `html.dark` class
- `Sidebar` accepts: `isOpen`, `onClose` (mobile drawer), `isCollapsed`, `onToggleCollapse` (desktop)
- `TopBar` accepts: `onMenuClick`, `darkMode`, `onToggleDark`
- Session timeout: 25min inactivity → warning modal → 5min countdown → auto-logout

## Error Handling Pattern
- `ErrorBanner` component (`src/components/ErrorBanner.tsx`) — renders inline error with icon, distinguishes network vs. API errors (403 shows lock icon/warning color)
- `useDataFetch` hook + `ApiError` class + `apiFetch` util in `src/lib/hooks/useDataFetch.ts`
- Standard fetch pattern in pages: track `fetchError` state, render `<ErrorBanner error={fetchError} onRetry={fetchPatients} />` at top of return
- Silent `catch { }` blocks are an anti-pattern — always set error state

## i18n — Bilingual (Arabic / English)
- `useLanguage()` hook provides `{ t, lang, setLang, dir }`
- Language stored in `localStorage` key `mediflow_lang`; default `"en"`
- `document.documentElement.dir` is set to `"rtl"` / `"ltr"` automatically
- All UI strings come from `t.*` — never hardcode English text in JSX
- **Tab state pattern**: use static string keys (`"employees"`) as state, NOT translated strings (`t.hr.employees`) — translated strings only for display
- Objects referencing `t.*` (TABS, STATUS_STYLES, etc.) must be defined **inside** the component so they re-render on language change
- Logical CSS properties for RTL: `ps-` / `pe-` instead of `pl-` / `pr-`; `start-` / `end-` instead of `left-` / `right-`; `border-e` instead of `border-r`
- Branches keys in `t.settings` are **flat** (e.g. `t.settings.addBranch`, `t.settings.branchName`) — NOT nested under `t.settings.branches`

## Timezone System
- `TimezoneProvider` in `src/lib/TimezoneContext.tsx` wraps the entire dashboard layout
- On mount it fetches `/api/settings` and reads `timezone` — falls back to `"Asia/Amman"`
- `useTimezone()` returns `{ timezone, formatDate, formatTime, formatDateTime }` backed by `Intl.DateTimeFormat`
- All date/time display across the app should use these helpers instead of raw `toLocaleDateString()`

## Multi-Branch System
- `Branch` model: id, name, code (unique), address, phone, email, timezone, isActive, managerId
- `Employee.branchId`, `Appointment.branchId`, `Invoice.branchId` — each record can be scoped to a branch
- Branch manager FK uses `use_alter=True` to break the circular reference with `Employee`
- Managed via **Settings → Branches** tab (full CRUD)
- API: `GET/POST /api/branches`, `GET/PATCH /api/branches/{id}`

## Work Shifts System
- `Shift` model: id, name, startTime, endTime, daysOfWeek (JSON), color, isActive, branchId
- `ShiftAssignment` model: links Employee ↔ Shift with startDate / endDate
- `Employee.shiftAssignments` relationship → `ShiftAssignment.employee`
- Managed via **HR → Shifts** tab: shift cards with duration badge, day chips, assignment modal
- API: `GET/POST /api/shifts`, `PATCH/DELETE /api/shifts/{id}`, `GET /api/shifts/{id}/assignments`, `POST/DELETE /api/shifts/assignments`

## Development Rules
- **No** Next.js API routes — all backend logic goes in `backend/routers/`
- No `/dashboard/` URL prefix in any link or redirect
- Icons always via Material Symbols, never Lucide
- Form submissions show loading state; errors show inline
- Modals have backdrop blur, close button, and ESC key support
- Empty states with icon + message + CTA for all lists/tables
- Passwords hashed with bcrypt via passlib (12 rounds) in `backend/auth.py`
- Every mutation should call `log_audit()` when possible
- Frontend runs with `--webpack` flag (Turbopack breaks CSS resolution with spaces in path)
- All search inputs use `useDebounce(search, 300)` — never pass raw `search` directly to API calls
- Accessibility: icon-only buttons must have `aria-label`; dialogs must have `role="dialog"` + `aria-labelledby`
- **New component CSS classes use CSS `var()` tokens** — do NOT add raw hardcoded hex values to new `.card`/`.btn-*` classes; use `var(--surface)`, `var(--txt1)` etc. so dark mode works automatically
- **Framer Motion**: import `motion`, `AnimatePresence` from `framer-motion` — use for entrance animations and conditional content transitions; do NOT use for simple hover states (use CSS `transition` instead)
- **`ease` type narrowing**: when passing a string ease to framer-motion `transition`, use `"easeOut" as const` to avoid TypeScript error; for bezier arrays use `[x1, y1, x2, y2] as [number, number, number, number]`

## Running the Project

### Local development (Windows)

**First-time setup:**
```cmd
install.bat
```

**Daily use:**
```cmd
start.bat   # starts MySQL + Backend + Frontend, opens browser
stop.bat    # stops everything
```

**Manual start (for debugging):**
```cmd
# Terminal 1 — Backend
cd backend
python -m uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
npm run dev
```
> Uses `--webpack` flag. Do NOT use Turbopack — it fails to resolve `tailwindcss` when the project path contains spaces.

**On Windows — use cmd (not PowerShell)** to avoid execution policy errors with npm.

### Ubuntu production deployment

**First time — fully automated (single run, no manual .env editing):**
```bash
git clone https://github.com/YOUR_USERNAME/mediflow-cms.git /opt/mediflow
sudo bash /opt/mediflow/deploy/deploy.sh
```

`deploy.sh` collects four inputs upfront, then runs end-to-end without stopping:
1. Git repo URL
2. Domain name or server IP (IP → HTTP only + `COOKIE_SECURE=false`; domain → HTTPS-ready)
3. MySQL root password (asks for existing if already installed; sets new one if not)
4. System Admin password for `admin@mediflow.com` (strength-validated)

After the prompts it auto-generates `JWT_SECRET`, `SETTINGS_ENCRYPTION_KEY`, `DB_PASS`, writes both `.env` files, creates tables, seeds the admin user, builds Next.js, starts systemd services, and configures Nginx.

**Enable HTTPS (domain deployments only):**
```bash
sudo certbot --nginx -d yourdomain.com
```

**Every update after `git push`:**
```bash
sudo bash /opt/mediflow/deploy/update.sh
```

**Monitor services:**
```bash
sudo journalctl -u mediflow-backend -f
sudo journalctl -u mediflow-frontend -f
sudo systemctl status mediflow-backend mediflow-frontend nginx
```

### Reset database (dev only — deletes all data)
```cmd
cd backend
python reset_db.py --confirm
```

Default dev credentials: `admin@mediflow.com` / `Admin@1234`
Production credentials: `admin@mediflow.com` / password set during `deploy.sh`
