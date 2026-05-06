# MediFlow CMS

A full-featured clinic management ERP system with a decoupled architecture:
**FastAPI (Python) backend** + **Next.js 16 (TypeScript) frontend**.

## Modules

| Module | Description |
|---|---|
| Dashboard | KPIs, revenue trends, today's schedule, system alerts |
| Patients | Registration, demographics, insurance, profile |
| Appointments | Calendar view (week/day/list), status tracking, double-booking prevention |
| EMR | Consultations, SOAP notes, vitals, diagnoses, prescriptions, labs |
| Billing | Invoices, payments, insurance claims, financial stats |
| Pharmacy | Medication stock, dispensing, stock movements |
| Laboratory | Lab orders, results tracking |
| Radiology | Radiology orders, image management |
| HR | Employees, attendance, leave requests, payroll |
| Accounting | Purchase orders, assets, expenses, vendors, financial overview |
| Reports | Revenue, patient volume, operational analytics |
| Users | Role-based access control (11 roles), account management |
| Audit Logs | Full activity trail across all modules |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 — App Router, Turbopack |
| Frontend Language | TypeScript 5 |
| Backend | FastAPI (Python 3.11+) |
| Backend ORM | SQLAlchemy 2.0 + PyMySQL |
| Database | MySQL 8.4 |
| Auth | JWT (python-jose) + bcrypt (passlib), HttpOnly cookie |
| Styling | Tailwind CSS v4 + Material Symbols (Google) |
| Charts | Recharts |
| State | Zustand |
| Tables | TanStack React Table |

## Architecture

```
Browser
  │
  ▼
Next.js :3000  (frontend only — no API routes)
  │
  │  /api/* rewrite (next.config.ts)
  ▼
FastAPI :8000  (all business logic + auth + DB)
  │
  ▼
MySQL 8.4 :3306
```

All frontend pages call `/api/...` — Next.js transparently proxies them to the FastAPI backend on port 8000.

## Prerequisites

- Python 3.11+
- Node.js 18+
- MySQL 8.4

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/yazan01/mediflow-cms.git
cd mediflow-cms
```

### 2. Set up MySQL

Make sure MySQL is running on port 3306, then create the database:

```sql
CREATE DATABASE mediflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. Configure backend

```bash
cd backend
```

Edit `backend/.env`:

```env
DATABASE_URL=mysql+pymysql://root:your_password@localhost:3306/mediflow
JWT_SECRET=change-this-to-a-long-random-secret
```

### 4. Install backend dependencies and create tables

```bash
pip install -r requirements.txt
python -c "from database import engine; from models import Base; Base.metadata.create_all(engine)"
```

### 5. Seed admin user

```bash
python seed.py
```

Default credentials:
- **Email:** `admin@mediflow.com`
- **Password:** `Admin@1234`

### 6. Start the backend

```bash
uvicorn main:app --reload --port 8000
```

Or on Windows, double-click `backend/start.bat`.

### 7. Install frontend dependencies and start

```bash
cd ..
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to the login page.

> Both servers must be running at the same time.

## Available Scripts

### Backend (`cd backend`)

| Command | Description |
|---|---|
| `uvicorn main:app --reload --port 8000` | Start FastAPI with auto-reload |
| `python seed.py` | Create the default admin user |
| `start.bat` | Install deps + start backend (Windows) |

### Frontend (project root)

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js dev server (Turbopack) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |

## Project Structure

```
mediflow-cms/
├── backend/                    # FastAPI Python backend
│   ├── main.py                 # App entry point + CORS
│   ├── database.py             # SQLAlchemy engine
│   ├── models.py               # All ORM models (40+ tables)
│   ├── auth.py                 # JWT, bcrypt, helpers
│   ├── seed.py                 # First admin user
│   ├── requirements.txt
│   ├── .env
│   └── routers/
│       ├── auth.py             # Login / logout
│       ├── patients.py
│       ├── appointments.py
│       ├── emr.py
│       ├── consultations.py
│       ├── billing.py
│       ├── pharmacy.py
│       ├── hr.py
│       ├── accounting.py
│       ├── reports.py
│       ├── users.py
│       ├── dashboard.py
│       ├── doctors.py
│       └── audit.py
│
├── src/
│   ├── app/
│   │   ├── (auth)/login/       # /login
│   │   └── (dashboard)/        # All protected pages (no URL prefix)
│   │       ├── layout.tsx      # Sidebar + TopBar layout
│   │       ├── page.tsx        # /
│   │       ├── patients/       # /patients
│   │       ├── appointments/   # /appointments
│   │       ├── emr/[id]/       # /emr/:id
│   │       ├── billing/        # /billing
│   │       ├── pharmacy/       # /pharmacy
│   │       ├── hr/             # /hr
│   │       ├── accounting/     # /accounting
│   │       ├── laboratory/     # /laboratory
│   │       ├── radiology/      # /radiology
│   │       ├── reports/        # /reports
│   │       ├── users/          # /users
│   │       ├── settings/       # /settings
│   │       └── audit/          # /audit
│   ├── components/layout/
│   │   ├── Sidebar.tsx
│   │   └── TopBar.tsx
│   ├── lib/utils.ts
│   └── types/index.ts
│
└── next.config.ts              # Proxy: /api/* → localhost:8000/api/*
```

## API Reference

All endpoints are served by FastAPI at `http://localhost:8000`. The frontend accesses them via Next.js proxy at `/api/...`.

| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/login` | POST | Login, returns JWT cookie |
| `/api/auth/logout` | POST | Clears JWT cookie |
| `/api/patients` | GET, POST | List / create patients |
| `/api/patients/{id}` | PATCH, DELETE | Update / deactivate |
| `/api/appointments` | GET, POST | List / create |
| `/api/emr/{id}` | GET | Patient full EMR |
| `/api/consultations` | POST | Create consultation |
| `/api/billing` | GET, POST | Invoices |
| `/api/billing/{id}/payments` | POST | Record payment |
| `/api/pharmacy/medications` | GET, POST | Medications |
| `/api/pharmacy/stock-movements` | GET, POST | Stock |
| `/api/hr/employees` | GET | Employees |
| `/api/hr/leaves` | GET, POST | Leave requests |
| `/api/hr/payroll` | GET, POST | Payroll records |
| `/api/hr/attendance` | GET, POST | Attendance |
| `/api/accounting/overview` | GET | Financial summary |
| `/api/accounting/assets` | GET, POST | Assets |
| `/api/accounting/expenses` | GET, POST | Expenses |
| `/api/accounting/vendors` | GET, POST | Vendors |
| `/api/accounting/purchase-orders` | GET, POST | POs |
| `/api/reports/overview` | GET | Analytics |
| `/api/users` | GET, POST | User management |
| `/api/users/{id}` | PATCH, DELETE | Update / deactivate |
| `/api/dashboard/stats` | GET | KPI cards |
| `/api/doctors` | GET | Doctor list |
| `/api/audit` | GET | Audit logs |
| `/api/health` | GET | Health check |

Interactive docs available at [http://localhost:8000/docs](http://localhost:8000/docs) when backend is running.

## Design System

- **Primary Navy:** `#002045`
- **Medical Blue:** `#1960a3`
- **Background:** `#faf9fd`
- **Icons:** Google Material Symbols Outlined — never Lucide
- **Font:** Inter

## Notes

- The `(dashboard)` folder is a Next.js **route group** — does NOT add `/dashboard` to URLs
- Both servers (`npm run dev` + `uvicorn`) must run simultaneously
- Auth cookie (`mediflow_token`, 8h) is HttpOnly — set by FastAPI, forwarded by the proxy
- MySQL must be running before starting either server
- Interactive API docs: [http://localhost:8000/docs](http://localhost:8000/docs)
