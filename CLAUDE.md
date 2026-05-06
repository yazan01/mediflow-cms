# MediFlow CMS — Claude Code Context

## Project Overview
Full-stack clinic ERP built with Next.js 16, TypeScript, Tailwind CSS v4, Prisma 5, and MySQL 8.
SRS reference: `../clinic_management/clinic_management_srs.md`

## Tech Stack
- **Framework**: Next.js 16 (App Router, Turbopack)
- **Database**: MySQL 8.4 via Prisma 5 (ORM)
- **Auth**: JWT (jsonwebtoken) + bcrypt — token stored in `mediflow_token` HttpOnly cookie
- **UI**: Tailwind CSS v4, Material Symbols Outlined (Google Fonts), Recharts
- **State**: Zustand
- **Tables**: TanStack React Table

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
src/
├── app/
│   ├── (auth)/login/              # Login page → /login
│   ├── (dashboard)/               # Protected pages (no URL prefix)
│   │   ├── layout.tsx             # Sidebar + TopBar, reads JWT from cookie
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
│   └── api/
│       ├── auth/login/            # POST — returns JWT, sets mediflow_token cookie
│       ├── auth/logout/           # POST — clears mediflow_token cookie
│       ├── patients/              # GET, POST
│       ├── patients/[id]/         # PATCH, DELETE
│       ├── appointments/          # GET, POST
│       ├── emr/[id]/              # GET patient EMR
│       ├── consultations/         # POST create consultation
│       ├── billing/               # GET, POST
│       ├── billing/[id]/          # GET, PATCH
│       ├── billing/[id]/payments/ # POST
│       ├── pharmacy/medications/  # GET, POST
│       ├── pharmacy/stock-movements/ # POST
│       ├── hr/employees/          # GET, POST
│       ├── hr/leaves/             # GET, POST
│       ├── hr/payroll/            # GET
│       ├── hr/attendance/         # GET, POST
│       ├── accounting/overview/   # GET
│       ├── accounting/assets/     # GET, POST
│       ├── accounting/expenses/   # GET, POST
│       ├── accounting/vendors/    # GET, POST
│       ├── accounting/purchase-orders/ # GET, POST
│       ├── reports/overview/      # GET
│       ├── users/                 # GET, POST
│       ├── users/[id]/            # PATCH, DELETE
│       ├── dashboard/stats/       # GET KPIs
│       ├── doctors/               # GET
│       └── audit/                 # GET
├── components/
│   └── layout/
│       ├── Sidebar.tsx            # Navigation — uses correct paths (no /dashboard prefix)
│       └── TopBar.tsx             # Search, notifications, user menu with logout
├── lib/
│   ├── prisma.ts                  # PrismaClient singleton
│   ├── auth.ts                    # hashPassword, verifyPassword, generateMRN, generateEmpCode
│   └── utils.ts                   # cn, formatDate, formatCurrency, getInitials
└── types/
    └── index.ts                   # All shared TypeScript types
prisma/
├── schema.prisma                  # MySQL schema — all String[] converted to Json
└── seed.mjs                       # Creates admin@mediflow.com / Admin@1234
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
- **Font**: Inter only
- **Icons**: `<span className="material-symbols-outlined">icon_name</span>` — NOT Lucide
- **Border radius**: `rounded-lg` (8px) standard, `rounded-xl` (12px) for cards, `rounded-2xl` for modals
- **Reusable CSS classes** (defined in `globals.css`): `btn-primary`, `btn-secondary`, `btn-ghost`, `btn-danger`, `card`, `input-field`, `select-field`, `badge`, `table-header`, `table-cell`, `table-row`, `no-scrollbar`

## Auth Flow
1. User POSTs to `/api/auth/login` with email + password
2. API verifies credentials, signs JWT `{ sub, name, email, roles }`, sets `mediflow_token` HttpOnly cookie (8h)
3. Dashboard layout (`(dashboard)/layout.tsx`) reads and verifies JWT from cookie to populate TopBar with real user name/role
4. Logout POSTs to `/api/auth/logout` which clears the cookie, then redirects to `/login`
5. Login page redirects to `/` on success (not `/dashboard`)

## Database — MySQL 8.4
- **Connection**: `mysql://root:password@localhost:3306/mediflow` (see `.env`)
- **MySQL service**: Runs as background process — start with:
  ```
  "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" --defaults-file="C:\ProgramData\MySQL\MySQL Server 8.4\my.ini" --console
  ```
- **Prisma preview feature**: `omitApi` enabled in schema generator
- **JSON fields**: All `String[]` / enum arrays stored as `Json` (MySQL has no native array type)
- **Seed**: `node prisma/seed.mjs` — creates `admin@mediflow.com` / `Admin@1234`

## Key Prisma Notes
- Prisma 5.22.0 (NOT Prisma 7 — no MySQL adapter exists for v7)
- `omit` in `create`/`update` returns `never` type — use explicit `select` or spread with `undefined` instead
- `roles: { has: ... }` filter not available on Json fields — filter in JS after fetching
- `params` in Next.js 16 route handlers is `Promise<{ id: string }>` — must `await params`

## Development Rules
- No dummy/mock data — all data from real DB via Prisma
- No `/dashboard/` URL prefix in any link or redirect
- All arrays in Prisma stored as `Json`, cast with `as string[]` when needed
- Icons always via Material Symbols, never Lucide
- Form submissions show loading state; errors show inline
- Modals have backdrop blur, close button, and ESC key support
- Empty states with icon + message + CTA for all lists/tables
- Passwords hashed with bcrypt (12 rounds)
- Every mutation should log to `auditLog` table when possible

## Running the Project
```bash
npm run dev          # Dev server at http://localhost:3000
npm run build        # Production build
npm run db:push      # Sync Prisma schema to MySQL
npm run db:studio    # Prisma Studio GUI
node prisma/seed.mjs # Create first admin user
```
