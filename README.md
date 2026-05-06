# MediFlow CMS

A full-featured clinic management ERP system built with Next.js 16, Prisma 5, MySQL, and Tailwind CSS v4.

## Features

- **Dashboard** — KPIs, revenue charts, appointments overview
- **Patient Management** — registration, demographics, insurance
- **EMR** — consultations, SOAP notes, vitals, diagnoses, prescriptions
- **Appointments** — scheduling with calendar view
- **Billing & Invoicing** — invoices, payments, insurance claims
- **Pharmacy & Inventory** — medications, stock, dispensing
- **HR Module** — employees, attendance, leave requests, payroll
- **Accounting** — purchase orders, assets, financial overview
- **User Management** — roles, permissions, 2FA support

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Database**: MySQL via Prisma 5
- **Auth**: JWT (jsonwebtoken) + bcrypt
- **UI**: Tailwind CSS v4, Lucide React, Recharts
- **State**: Zustand
- **Tables**: TanStack React Table

## Prerequisites

- Node.js 18+
- MySQL 8+ running locally

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example below into a `.env` file at the project root and update with your MySQL credentials:

```env
DATABASE_URL="mysql://root:your_password@localhost:3306/mediflow"
JWT_SECRET="change-this-to-a-long-random-string"
JWT_EXPIRES_IN="8h"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

### 3. Create the database

Make sure MySQL is running, then push the Prisma schema to create all tables:

```bash
npx prisma db push
```

### 4. (Optional) Open Prisma Studio

Use this to browse/edit data directly:

```bash
npx prisma studio
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server (Turbopack) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:migrate` | Run Prisma migrations |

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/        # Protected dashboard pages
│   │   ├── page.tsx        # Main dashboard
│   │   ├── patients/       # Patient management
│   │   ├── emr/            # Electronic medical records
│   │   ├── appointments/   # Appointment scheduling
│   │   ├── billing/        # Billing & invoicing
│   │   ├── pharmacy/       # Pharmacy & inventory
│   │   ├── hr/             # Human resources
│   │   ├── accounting/     # Accounting & finance
│   │   └── users/          # User management
│   ├── api/                # API route handlers
│   └── login/              # Authentication page
├── lib/
│   ├── prisma.ts           # Prisma client singleton
│   └── auth.ts             # JWT & password utilities
└── types/
    └── index.ts            # Shared TypeScript types
prisma/
└── schema.prisma           # Database schema
```

## Default Login

After running `npx prisma db push`, create your first admin user via Prisma Studio (`npx prisma studio`) or by inserting directly into the `User` table with a bcrypt-hashed password.
