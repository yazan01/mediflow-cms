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
| State | Zustand |
| Tables | TanStack React Table |

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
├── backend/                        # FastAPI Python backend
│   ├── main.py                     # FastAPI app + CORS
│   ├── database.py                 # SQLAlchemy engine + get_db()
│   ├── models.py                   # All SQLAlchemy ORM models
│   ├── auth.py                     # JWT, bcrypt, generate_id, log_audit
│   ├── seed.py                     # Creates admin@mediflow.com / Admin@1234
│   ├── requirements.txt
│   ├── .env                        # DATABASE_URL + JWT_SECRET
│   ├── start.bat
│   └── routers/
│       ├── auth.py                 # POST /api/auth/login|logout
│       ├── patients.py             # GET/POST/PATCH/DELETE /api/patients
│       ├── appointments.py         # GET/POST/PATCH /api/appointments
│       ├── emr.py                  # GET /api/emr/{id}
│       ├── consultations.py        # POST /api/consultations
│       ├── billing.py              # /api/billing + /{id} + /{id}/payments
│       ├── pharmacy.py             # /api/pharmacy/medications + stock-movements
│       ├── hr.py                   # /api/hr/employees|leaves|payroll|attendance
│       ├── accounting.py           # /api/accounting/overview|assets|expenses|vendors|purchase-orders
│       ├── reports.py              # GET /api/reports/overview
│       ├── users.py                # GET/POST/PATCH/DELETE /api/users
│       ├── dashboard.py            # GET /api/dashboard/stats
│       ├── doctors.py              # GET /api/doctors
│       └── audit.py                # GET /api/audit
│
├── src/
│   ├── app/
│   │   ├── (auth)/login/           # Login page → /login
│   │   └── (dashboard)/            # Protected pages (no URL prefix)
│   │       ├── layout.tsx          # Sidebar + TopBar, reads JWT from cookie
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
│   ├── components/layout/
│   │   ├── Sidebar.tsx             # Navigation
│   │   └── TopBar.tsx              # Search, notifications, user menu
│   ├── lib/
│   │   ├── utils.ts                # cn, formatDate, formatCurrency, getInitials
│   │   └── i18n/
│   │       ├── translations.ts     # Full EN/AR translation dictionaries
│   │       └── LanguageContext.tsx # LanguageProvider + useLanguage hook
│   └── types/
│       └── index.ts                # Shared TypeScript types
│
└── next.config.ts                  # Proxy rewrite: /api/* → localhost:8000/api/*
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
- **Reusable CSS classes** (in `globals.css`): `btn-primary`, `btn-secondary`, `btn-ghost`, `btn-danger`, `card`, `input-field`, `select-field`, `badge`, `table-header`, `table-cell`, `table-row`, `no-scrollbar`

## Auth Flow
1. Frontend POSTs to `/api/auth/login` → Next.js proxies to FastAPI
2. FastAPI verifies credentials (bcrypt), signs JWT `{ sub, name, email, roles }`, sets `mediflow_token` HttpOnly cookie (8h)
3. Dashboard `layout.tsx` reads and verifies the cookie server-side with `jsonwebtoken` to populate TopBar
4. Logout POSTs to `/api/auth/logout` → FastAPI clears the cookie, then frontend redirects to `/login`
5. All subsequent API calls include the cookie automatically (same-origin via proxy)

## Database — MySQL 8.4
- **Connection**: `mysql+pymysql://root:password@localhost:3306/mediflow` (in `backend/.env`)
- **ORM**: SQLAlchemy 2.0 — models in `backend/models.py`
- **JSON fields**: Arrays (allergies, roles, tests, etc.) stored as MySQL `JSON` columns
- **IDs**: 25-char hex strings generated via `uuid.uuid4().hex[:25]`
- **MySQL service**: Start with:
  ```
  "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" --defaults-file="C:\ProgramData\MySQL\MySQL Server 8.4\my.ini" --console
  ```

## Backend Notes (FastAPI)
- All routers use `Depends(get_current_user)` for auth — reads `mediflow_token` cookie
- JSON fields from MySQL come back as Python lists/dicts — no casting needed
- `generate_id()` in `auth.py` → `uuid.uuid4().hex[:25]`
- `log_audit()` in `auth.py` — call after any mutation
- Decimal fields returned as `float()` in response dicts

## i18n — Bilingual (Arabic / English)
- `useLanguage()` hook provides `{ t, lang, setLang, dir }`
- Language stored in `localStorage` key `mediflow_lang`; default `"en"`
- `document.documentElement.dir` is set to `"rtl"` / `"ltr"` automatically
- All UI strings come from `t.*` — never hardcode English text in JSX
- **Tab state pattern**: use static string keys (`"employees"`) as state, NOT translated strings (`t.hr.employees`) — translated strings only for display
- Objects referencing `t.*` (TABS, STATUS_STYLES, etc.) must be defined **inside** the component so they re-render on language change
- Logical CSS properties for RTL: `ps-` / `pe-` instead of `pl-` / `pr-`; `start-` / `end-` instead of `left-` / `right-`; `border-e` instead of `border-r`

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

## Running the Project

**Terminal 1 — Backend (FastAPI):**
```cmd
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend (Next.js):**
```cmd
npm run dev
```
> Runs with `--webpack` flag. Do NOT use Turbopack — it fails to resolve `tailwindcss` when the project path contains spaces.

**Seed admin user (first run only):**
```cmd
cd backend
python seed.py
```

Default credentials: `admin@mediflow.com` / `Admin@1234`

**On Windows — use cmd (not PowerShell)** to avoid execution policy errors with npm.
