# MediFlow CMS

Full-stack clinic ERP system built with Next.js 16 and FastAPI.

## Features

- **Patient Management** — registration, medical history, allergies, chronic conditions
- **Appointments** — scheduling, check-in, status tracking, doctor assignment
- **EMR** — electronic medical records, consultations, vitals, lab & radiology results
- **Billing** — invoices, payments, insurance claims
- **Pharmacy** — medication inventory, stock movements, dispensing
- **Laboratory & Radiology** — order tracking, result entry
- **HR** — employee management, attendance, leave requests, payroll, work shifts
- **Accounting** — financial overview, assets, expenses, vendors, purchase orders
- **Reports** — revenue, patient stats, department performance
- **User Management** — role-based access control
- **Audit Log** — full activity trail
- **Multi-Branch** — manage multiple clinic locations, each with its own staff, appointments, and financials
- **Work Shifts** — define shifts with time ranges, working days, color coding, and employee assignments
- **Timezone** — clinic-wide timezone setting applied to all date/time displays
- **Bilingual** — full Arabic / English support with RTL layout

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router, webpack) + TypeScript |
| Backend | FastAPI (Python 3.11+) |
| Database | MySQL 8.4 |
| ORM | SQLAlchemy 2.0 |
| Auth | JWT + bcrypt (HttpOnly cookie) |
| UI | Tailwind CSS v4, Material Symbols, Recharts |

## Prerequisites

- Python 3.11+
- Node.js 18+
- MySQL 8.4

## Installation

### 1. Run the installer

Double-click `install.bat` or run in cmd:

```cmd
install.bat
```

The installer will:
- Check Python and Node.js versions
- Create a Python virtual environment in `backend/.venv`
- Install all Python and Node.js dependencies
- Prompt for your MySQL credentials
- Create the `mediflow` database
- Create all tables and seed the default admin user
- Generate `backend/.env` automatically

### 2. Start the application

```cmd
start.bat
```

Opens `http://localhost:3000` automatically.

### 3. Stop the application

```cmd
stop.bat
```

## Default Login

```
Email:    admin@mediflow.com
Password: Admin@1234
```

## Scripts

| File | Purpose |
|---|---|
| `install.bat` | One-time setup — install deps, configure DB, seed |
| `start.bat` | Start MySQL + Backend + Frontend |
| `stop.bat` | Stop all services |
| `build.bat` | Build the Next.js production bundle |
| `backend/reset_db.py` | Wipe and rebuild the database (all data deleted) |

## Project Structure

```
mediflow-cms/
├── install.bat           # One-click installer
├── start.bat             # Start all services
├── stop.bat              # Stop all services
├── setup.py              # Installer logic
├── backend/              # FastAPI backend (port 8000)
│   ├── main.py
│   ├── models.py
│   ├── auth.py
│   ├── seed.py
│   ├── reset_db.py
│   ├── .venv/            # Python virtual environment
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
│       ├── TimezoneContext.tsx  # Global timezone provider
│       └── i18n/               # Bilingual system (EN/AR)
└── next.config.ts        # Proxies /api/* → localhost:8000
```

## Architecture

```
Browser → Next.js :3000 → (proxy rewrite) → FastAPI :8000 → MySQL
```

All API calls go through Next.js rewrites — there are no Next.js API routes.

## Notes

- Frontend runs with `--webpack` flag — Turbopack has a CSS resolution bug when the project path contains spaces
- On Windows, use `cmd` not PowerShell for running batch scripts
