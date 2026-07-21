# SaaS CMS LMS

Completed CMS foundation and operations baseline for the multi-tenant CMS + LMS SaaS platform.

## Included

- npm-workspaces monorepo with `apps/backend` and `apps/frontend`
- Express API using modular controllers, services, routes, and middleware
- Prisma/MySQL tenant, reseller, user, role, permission, and academic-session schema
- JWT authentication, role/permission context, tenant-scoped query helper
- CMS/LMS/BOTH product entitlements; individual tenants are forced to LMS
- Tenant settings, user management, and configurable RBAC
- Student categories, houses, records, enrolments, and coaching-only multi-class rules
- Classes, sections, subjects, class teachers, and subject-teacher assignments
- Fee types, groups, masters, discounts, assignments, partial collection, receipts, reversals, carry-forward, reminders, dues, and summary reports
- Day/period attendance, in/out times, leave approval, attendance points, and attendance reports
- General, school, college, and GPA examination groups; subject schedules; student assignment; mark components; aspects; ranking; publication; admit cards; and marksheets
- Departments, designations, staff 360 profiles, staff attendance/in-out records, leave approval, teacher ratings, recurring earnings/deductions, and payroll generation/payment
- Custom certificate, ID card, admit card, and marksheet templates with backgrounds, dimensions, photos, dynamic snapshots, serial numbers, printable layouts, and barcodes
- Consolidated student, finance, attendance, examination, HR/payroll, generated-document, and audit reports
- Conflict-safe class/teacher timetables, free-period reports, and panel-aware timetable access
- Homework assignment, controlled submission/resubmission, evaluation, due/progress/completion reports, and student self-service
- ERP provider configuration with encrypted credentials, payment methods, module visibility, languages, custom/system fields, shortcut keys, profile rights, holidays, student document folders, and configuration backup/restore
- React/Vite/Tailwind management workspace for the complete CMS scope
- Universe Super Admin, demo school, teacher/staff, academics, student, fee, attendance, exam, payroll, timetable, homework, ERP, holiday, and student-document seed data
- MySQL connection verification, unit tests, and tenant API integration tests

Unique LMS delivery modules and provider-specific SMS/email/payment/live-class execution remain later phases.

## Phase B campus depth

- Student 360 profile (edit, disable/enable with reason masters, documents, fees snapshot, siblings detect/link)
- Bulk student CSV import and permanent delete
- Online admission public form at `/admit/:tenantSlug` (when Settings → Enable online admission) plus staff review on Students → Admissions
- Fees polish: partial collect, dues search, reminders UI, receipt search/revert/print at `/print/fees/:id`
- Tenant white-label branding applied in campus shell (primary color + logo text from tenant branding)

## Phase C portals

- Separate Student (`/portal/student`) and Parent (`/portal/parent`) shells with role-specific navigation
- Portal pages: Home, Notices, Attendance, Leave, Exams, Timetable/Homework (LMS), Fees/Documents (CMS)
- Parent multi-child switcher with relation metadata; homework submit is student-only
- Campus Notices admin at `/notices` for circulars to students/parents
- Portal APIs under `/api/v1/portal/*` for child-scoped attendance, leaves, fees+payments, documents, timetable, homework

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- MySQL 8 (or Docker Desktop)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment files:

   ```powershell
   Copy-Item apps/backend/.env.example apps/backend/.env
   Copy-Item apps/frontend/.env.example apps/frontend/.env
   ```

   Replace the development passwords and set a random `JWT_SECRET` of at least 32 characters.

3. Start MySQL. With Docker:

   ```bash
   docker compose up -d mysql
   ```

   Or point `DATABASE_URL` in `apps/backend/.env` at an existing MySQL server.
   On Windows, prefer `127.0.0.1` over `localhost`. Example with an empty root password:

   ```env
   DATABASE_URL=mysql://root@127.0.0.1:3306/saas-cms-lms-db
   ```

   If a shell already exports `DATABASE_URL`, unset it first so Prisma uses the `.env` file.

4. Create the database (name contains hyphens), apply migrations, verify, and seed:

   ```bash
   npm run db:generate
   npm run db:ensure
   npm run db:migrate
   npm run db:verify
   npm run db:seed
   ```

5. Start both applications:

   ```bash
   npm run dev
   ```

   Frontend: `http://localhost:5173`  
   Backend health: `http://localhost:4000/api/v1/health`

## Seeded development accounts

- Universe Super Admin (dedicated login at `/admin/login`, control plane at
  `/admin/dashboard`): use `admin@saas-cms-lms.local` / `ChangeMe123!` with no
  workspace slug. Phase A screens cover dashboard KPIs, tenants (list / create /
  edit / detail with Activate·Suspend·Archive), resellers (assign tenants),
  cross-tenant users (enable/disable), filtered audit trail, and platform
  branding settings.
- Demo Institution Admin: use workspace `demo-school` and
  `admin@demo-school.local` / `ChangeMe123!`.
- Demo Teacher: use workspace `demo-school` and
  `teacher@demo-school.local` / `ChangeMe123!`.
- Demo Accountant: use workspace `demo-school` and
  `accountant@demo-school.local` / `ChangeMe123!`.
- Demo Student (opens the Student portal): use workspace `demo-school` and
  `student@demo-school.local` / `ChangeMe123!`.
- Demo Parent (opens the Parent portal, linked to the demo student): use workspace
  `demo-school` and `parent@demo-school.local` / `ChangeMe123!`.

Admin/Teacher/Accountant/Staff share the management workspace (menus filtered by
permission and module visibility). Student and Parent accounts are redirected to a
dedicated read-only portal at `/portal` showing only their own profile, timetable,
attendance, homework, published exam results, and fees. Students may also submit
homework from the portal.

These are local defaults only. Override them in `apps/backend/.env` before seeding any shared environment.

## Verification

```bash
npm test
npm run build
npm run db:verify
```

`db:verify` executes a live query and fails unless Prisma is connected specifically to
`saas-cms-lms-db`.

Run the live tenant integration suite with:

```powershell
$env:RUN_INTEGRATION_TESTS="true"
npm test
```

## Phase 1 API

- `/api/v1/settings` — tenant profile and general settings
- `/api/v1/users`, `/api/v1/roles`, `/api/v1/permissions` — tenant access management
- `/api/v1/academic-sessions`, `/api/v1/academics/*` — academic structure
- `/api/v1/students`, `/api/v1/students/setup` — student records and enrolment
- `/api/v1/student-masters/*` — categories and houses

Every Phase 1 route requires a JWT, a tenant context, and its corresponding view/manage permission.

## Phase 2 API

- `/api/v1/fees/setup` — fee types, groups, masters, discounts, receipt books, and reminder configuration
- `/api/v1/fees/students/:id` — assigned fees, discounts, fines, payments, and current balance
- `/api/v1/fees/payments` — partial/multi-head collection, payment search, generated receipts, and reversal
- `/api/v1/fees/carry-forward` — move calculated previous-session dues into the current enrolment
- `/api/v1/fees/reports/summary` — assigned, discounted, fined, collected, and due totals
- `/api/v1/attendance/setup` and `/api/v1/attendance/records` — class roster and day/period marking
- `/api/v1/attendance/leaves` — leave requests and approval
- `/api/v1/attendance/points` — attendance-point awards and totals
- `/api/v1/attendance/reports` — daily/custom, class, period, in/out, and student summaries

Fees, HR, certificates/documents, and ERP require CMS entitlement (`CMS` or `BOTH`).
Timetable and homework require LMS entitlement (`LMS` or `BOTH`).
Students, academics, attendance, and examinations are shared by CMS and LMS.
Attendance follows the tenant's configured attendance type.

## Phase 3 API

- `/api/v1/exams/setup`, `/api/v1/exams/groups`, and `/api/v1/exams` — grading systems, exam groups, exams, and schedules
- `/api/v1/exams/:id/students` and `/api/v1/exams/schedules/:id/marks` — roster assignment and bulk/manual marks entry
- `/api/v1/exams/:id/results`, `/api/v1/exams/groups/:id/results`, and `/api/v1/exams/:id/publish` — calculated grades, pass/fail, rank, consolidated results, and publication
- `/api/v1/hr/setup`, `/api/v1/hr/staff`, `/api/v1/hr/attendance`, and `/api/v1/hr/leaves` — staff 360, in/out attendance, and leave workflows
- `/api/v1/hr/payroll` and `/api/v1/hr/payroll/:id/pay` — attendance-aware payroll with earnings and deductions
- `/api/v1/documents/templates` and `/api/v1/documents/generated` — certificate, ID card, admit card, and marksheet design/generation
- `/api/v1/reports` and `/api/v1/reports/:module` — consolidated reports and audit trail

Examinations are shared-core routes. HR/payroll and documents require CMS entitlement. Timetable and homework require LMS entitlement. Every Phase 3 endpoint also requires its specific RBAC permission.

## CMS completion API

- `/api/v1/timetable/setup`, `/api/v1/timetable/entries`, and `/api/v1/timetable/reports/free-periods` — class/teacher timetable and collision reporting
- `/api/v1/homework/setup`, `/api/v1/homework/:id/submissions`, `/api/v1/homework/submissions/:id/evaluate`, and `/api/v1/homework-reports` — complete homework workflow
- `/api/v1/erp/setup` and `/api/v1/erp/integrations/:category` — consolidated ERP configuration and encrypted provider credentials
- `/api/v1/erp/payment-methods`, `/api/v1/erp/modules/:key`, `/api/v1/erp/languages`, and `/api/v1/erp/custom-fields` — tenant configuration
- `/api/v1/erp/holidays`, `/api/v1/erp/document-folders`, and `/api/v1/erp/student-documents` — calendar and student document management
- `/api/v1/erp/backups` and `/api/v1/erp/backups/:id/restore` — tenant-scoped configuration snapshots and restore

See `CMS_COMPLETION.md` for workflows, security behavior, and external-provider boundaries.

## Tenant-isolation rules

- Tenant users authenticate with a workspace slug; tenant-less logins are reserved for platform or reseller users.
- JWTs contain the authenticated user, tenant, and reseller identifiers.
- Every request re-resolves the user and tenant from the database, so disabled users, suspended tenants, or changed tenant assignments invalidate existing access.
- Tenant routes must use `authenticate` plus `requireTenant`.
- Services must build business-record filters with `tenantScope(auth.tenantId, where)`. The helper rejects missing tenant context and overrides caller-supplied tenant IDs.
- Platform-level actions require platform permissions and must not reuse tenant business-data services.


## Project structure

```text
apps/
  backend/                 # Express + Prisma API (single deployable server)
    prisma/                # Schema, migrations, seed, DB verification
    src/
      middleware/          # Authentication, RBAC, entitlements
      modules/             # Modular MVC controllers/services
      routes/
        auth/              # Shared login, current-user, dashboard
        campus/            # Institution Admin, Teacher, Accountant, HR/Staff
        super-admin/       # Platform tenant/reseller/user administration
        student-parent/    # Student and guardian self-service
  frontend/                # React + Vite + Tailwind UI (combined for now)
    src/
      auth/
      lib/
      pages/
        auth/
        campus/
        super-admin/
        student-parent/
```
