# MediFlow CMS

Full-stack clinic ERP system built with Next.js 16 and FastAPI.

## Features

- **Patient Management** — registration, medical history, allergies, chronic conditions
- **Appointments** — scheduling, check-in, status tracking, doctor assignment
- **EMR** — electronic medical records, consultations, vitals, lab & radiology results
- **Billing** — invoices, payments, insurance claims
- **Pharmacy** — medication inventory, stock movements, dispensing
- **Laboratory & Radiology** — order tracking, result entry
- **HR** — employee management, attendance, leave requests, payroll
- **Accounting** — financial overview, assets, expenses, vendors, purchase orders
- **Reports** — revenue, patient stats, department performance
- **User Management** — role-based access control
- **Audit Log** — full activity trail
- **Bilingual** — full Arabic / English support with RTL layout

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript |
| Backend | FastAPI (Python 3.11+) |
| Database | MySQL 8.4 |
| ORM | SQLAlchemy 2.0 |
| Auth | JWT + bcrypt (HttpOnly cookie) |
| UI | Tailwind CSS v4, Material Symbols, Recharts |

## Getting Started

### Prerequisites
- Node.js 20+
- Python 3.11+
- MySQL 8.4

### 1. Backend

```cmd
cd backend
pip install -r requirements.txt
```

Create `backend/.env`:
```
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/mediflow
JWT_SECRET=your-secret-key
```

Start MySQL, then run:
```cmd
python seed.py
uvicorn main:app --reload --port 8000
```

### 2. Frontend

```cmd
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Default Login

```
Email:    admin@mediflow.com
Password: Admin@1234
```

## Project Structure

```
mediflow-cms/
├── backend/              # FastAPI backend (port 8000)
│   ├── main.py
│   ├── models.py
│   ├── auth.py
│   └── routers/          # One file per module
├── src/
│   ├── app/
│   │   ├── (auth)/       # Login page
│   │   └── (dashboard)/  # All protected pages
│   ├── components/layout/
│   │   ├── Sidebar.tsx
│   │   └── TopBar.tsx
│   └── lib/
│       ├── utils.ts
│       └── i18n/         # Bilingual system (EN/AR)
└── next.config.ts        # Proxies /api/* → localhost:8000
```

## Architecture

```
Browser → Next.js :3000 → (proxy rewrite) → FastAPI :8000 → MySQL
```

All API calls go through Next.js rewrites — there are no Next.js API routes.

## Notes

- Run frontend with `npm run dev` (uses `--webpack`; Turbopack has a CSS resolution bug with spaces in the project path)
- On Windows, use `cmd` not PowerShell for running npm scripts
