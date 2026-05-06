# MediFlow CMS

A full-featured clinic management ERP system built with Next.js 16, Prisma 5, MySQL 8, and Tailwind CSS v4.

## Modules

| Module | Description |
|---|---|
| Dashboard | KPIs, revenue trends, today's schedule, system alerts |
| Patients | Registration, demographics, insurance, profile |
| Appointments | Calendar view (week/day/list), status tracking |
| EMR | Consultations, SOAP notes, vitals, diagnoses, prescriptions, labs |
| Billing | Invoices, payments, insurance claims, financial stats |
| Pharmacy | Medication stock, dispensing, stock movements |
| Laboratory | Lab orders, results tracking |
| Radiology | Radiology orders, image management |
| HR | Employees, attendance, leave requests, payroll |
| Accounting | Purchase orders, assets, expenses, vendors, financial overview |
| Reports | Revenue, patient volume, operational analytics |
| Users | Role-based access control, 2FA support |
| Audit Logs | Full activity trail across all modules |

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 — App Router, Turbopack |
| Language | TypeScript 5 |
| Database | MySQL 8.4 via Prisma 5 |
| Auth | JWT (jsonwebtoken) + bcrypt, HttpOnly cookie |
| Styling | Tailwind CSS v4 + Material Symbols (Google) |
| Charts | Recharts |
| State | Zustand |
| Tables | TanStack React Table |

## Prerequisites

- Node.js 18+
- MySQL 8+ (see MySQL setup below)

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/yazan01/mediflow-cms.git
cd mediflow-cms
npm install
```

### 2. Configure environment

Create a `.env` file at the project root:

```env
DATABASE_URL="mysql://root:your_password@localhost:3306/mediflow"
JWT_SECRET="change-this-to-a-long-random-secret"
JWT_EXPIRES_IN="8h"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

### 3. Set up MySQL

**Option A — Already installed:** Make sure MySQL is running on port 3306.

**Option B — Fresh install on Windows:**
```bash
winget install --id Oracle.MySQL --accept-package-agreements --accept-source-agreements
```
Then initialize and start:
```
"C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" --initialize-insecure --datadir="C:\ProgramData\MySQL\MySQL Server 8.4\Data"
"C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" --defaults-file="C:\ProgramData\MySQL\MySQL Server 8.4\my.ini" --console
```

### 4. Create tables

```bash
npx prisma db push
```

### 5. Create admin user

```bash
node prisma/seed.mjs
```

Default credentials:
- **Email:** `admin@mediflow.com`
- **Password:** `Admin@1234`

### 6. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be taken to the login page.

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server (Turbopack) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run db:push` | Sync Prisma schema to MySQL |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |
| `npm run db:generate` | Regenerate Prisma client after schema changes |
| `npm run db:migrate` | Run Prisma migrations |

## Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx         # Login page → /login
│   ├── (dashboard)/               # Route group — no URL prefix
│   │   ├── layout.tsx             # Sidebar + TopBar layout, reads JWT
│   │   ├── page.tsx               # Dashboard → /
│   │   ├── patients/              # → /patients
│   │   ├── appointments/          # → /appointments
│   │   ├── emr/[id]/              # → /emr/:id
│   │   ├── billing/               # → /billing
│   │   ├── pharmacy/              # → /pharmacy
│   │   ├── hr/                    # → /hr
│   │   ├── accounting/            # → /accounting
│   │   ├── laboratory/            # → /laboratory
│   │   ├── radiology/             # → /radiology
│   │   ├── reports/               # → /reports
│   │   ├── users/                 # → /users
│   │   ├── settings/              # → /settings
│   │   └── audit/                 # → /audit
│   └── api/                       # REST API routes
│       ├── auth/login/            # POST login → sets JWT cookie
│       ├── auth/logout/           # POST logout → clears cookie
│       ├── patients/              # CRUD
│       ├── appointments/          # CRUD
│       ├── emr/[id]/              # Patient EMR
│       ├── consultations/         # Create consultation
│       ├── billing/               # Invoices CRUD
│       ├── pharmacy/              # Medications + stock
│       ├── hr/                    # Employees, leaves, payroll, attendance
│       ├── accounting/            # Assets, expenses, vendors, POs
│       ├── reports/               # Analytics overview
│       ├── users/                 # User management
│       └── dashboard/stats/       # KPI data
├── components/layout/
│   ├── Sidebar.tsx                # Navigation
│   └── TopBar.tsx                 # Search, notifications, user menu
├── lib/
│   ├── prisma.ts                  # Prisma client singleton
│   ├── auth.ts                    # JWT, bcrypt, code generators
│   └── utils.ts                   # Formatting utilities
└── types/index.ts                 # Shared TypeScript types
prisma/
├── schema.prisma                  # MySQL schema
└── seed.mjs                       # Creates first admin user
```

## Design System

Colors, components, and icons follow a consistent design language:

- **Primary Navy:** `#002045`
- **Medical Blue:** `#1960a3`
- **Background:** `#faf9fd`
- **Icons:** Google Material Symbols Outlined (not Lucide)
- **Font:** Inter

## Notes

- The `(dashboard)` folder is a Next.js **route group** — it does NOT add `/dashboard` to URLs. All dashboard routes start directly at `/`.
- All `String[]` Prisma fields are stored as `Json` (MySQL has no native array type).
- Auth uses a JWT stored in an HttpOnly cookie (`mediflow_token`, 8h expiry).
- MySQL must be running before starting the app — it does not auto-start.
