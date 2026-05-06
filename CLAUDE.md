# MediFlow CMS — Clinic Management System

## Project Overview
Full-stack web-based ERP clinic management system built with Next.js 14, TypeScript, Tailwind CSS, and Prisma.
SRS reference: `../clinic_management/clinic_management_srs.md`
Design system reference: `../clinic_management/professional_design_system/`

## Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Database**: Prisma ORM + PostgreSQL
- **Auth**: NextAuth.js (JWT + 2FA)
- **Charts**: Recharts
- **Icons**: Material Symbols Outlined (Google Fonts)
- **State**: Zustand

## Project Structure
```
src/
├── app/
│   ├── (auth)/login/          # Login page
│   ├── (dashboard)/           # All protected pages
│   │   ├── page.tsx           # Admin Dashboard
│   │   ├── patients/          # Patient Management
│   │   ├── appointments/      # Appointment Scheduling
│   │   ├── emr/               # Electronic Medical Records
│   │   ├── billing/           # Billing & Invoicing
│   │   ├── pharmacy/          # Pharmacy & Inventory
│   │   ├── hr/                # Human Resources
│   │   ├── accounting/        # Accounting & Finance
│   │   ├── reports/           # Reports & Analytics
│   │   └── users/             # User Management & RBAC
│   └── api/                   # API Routes
├── components/
│   ├── layout/                # Sidebar, TopBar, shared layout
│   └── ui/                    # Reusable UI components
├── lib/                       # Utilities, helpers
└── types/                     # TypeScript types
prisma/schema.prisma            # DB schema for all entities
```

## Design System Rules
- **Colors**: Navy primary `#002045`, Medical Blue `#1960a3`, follow `professional_design_system/DESIGN.md`
- **Font**: Inter only
- **Border radius**: 8px default, 16px for large containers
- **No dummy/mock data** — all data must come from the real database via Prisma/API
- **No placeholder images** — use initials avatars instead
- Icons: use `<span className="material-symbols-outlined">icon_name</span>` NOT Lucide

## Development Rules
- No dummy/mock data anywhere in the system
- All pages connect to real API routes
- All API routes connect to Prisma/PostgreSQL
- RBAC enforced at API level (not just UI)
- Passwords hashed with bcrypt
- Every data mutation logged in audit_logs table
- Arabic RTL support planned for Phase 2

## Modules (per SRS phases)
### Phase 1 (Current)
- User Management + RBAC
- Patient Registration
- Appointment Scheduling
- Basic Billing
- EMR Core

### Phase 2
- HR Module
- Full Accounting (AP/AR)
- Pharmacy & Inventory
- Insurance Billing

### Phase 3
- Radiology, Telemedicine
- Analytics Dashboard
- Advanced Reporting

## Running the Project
```bash
npm run dev       # Development server
npm run build     # Production build
npm run db:push   # Push Prisma schema to DB
npm run db:studio # Open Prisma Studio
```

## Environment Variables
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/mediflow
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000
```
