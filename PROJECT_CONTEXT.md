# SaaS CMS LMS — Project Context (for Cursor / teammates)

Read this first when continuing work in a new Cursor account or chat.

## What this product is

Multi-tenant **school CMS + LMS** SaaS.

- **Super Admin** manages many schools (tenants) on one platform
- Each **school/campus** = one `Tenant` (slug like `demo-school`)
- Roles: Institution Admin, Teacher, Accountant, Student, Parent
- Separate UIs: Ops Console (Super Admin), Campus panel, Student/Parent portals

## Repos (company GitHub)

| Repo | Path on this PC | GitHub |
|------|-----------------|--------|
| Backend | `C:\Users\USER\Desktop\saas_cms_lms_backend` | `raintechsoft/saas_cms_lms_backend` |
| Frontend | `C:\Users\USER\Desktop\saas_cms_lms_frontend` | `raintechsoft/saas_cms_lms_frontend` |

Open workspace: `C:\Users\USER\Desktop\saas-cms-lms.code-workspace` (both folders).

**Do not use** the old monorepo `saas-cms-lms/apps/...` for daily work.

## Stack

- Backend: Express + Prisma + **PostgreSQL** + JWT auth
- Frontend: React + Vite + Tailwind
- Uploads: local disk `uploads/avatars/` (not S3 yet)
- Multi-tenancy: shared DB + `tenantId` on business tables

## Database (local)

```env
DATABASE_URL="postgresql://saas_admin:saas_anwin%407736@127.0.0.1:5432/saas_cms_lms"
```

- Password contains `@` → must be encoded as `%40`
- Provider in `prisma/schema.prisma` = **postgresql** (not mysql)
- Migrations: `prisma/migrations/20260721130000_init_postgresql/`

```powershell
cd C:\Users\USER\Desktop\saas_cms_lms_backend
npm run db:ensure
npm run db:migrate
npm run db:seed
npm run db:verify
npm run dev
```

## Frontend

```powershell
cd C:\Users\USER\Desktop\saas_cms_lms_frontend
npm install
Copy-Item .env.example .env
# VITE_API_URL=http://127.0.0.1:4000/api/v1
npm run dev
```

- App: http://localhost:5173  
- API: http://localhost:4000  

## Demo logins (after seed)

Password for all: `ChangeMe123!`

| Role | URL | Workspace | Email |
|------|-----|-----------|--------|
| Super Admin | `/admin/login` | (none) | `admin@saas-cms-lms.local` |
| School Admin | `/login` | `demo-school` | `admin@demo-school.local` |
| Teacher | `/login` | `demo-school` | `teacher@demo-school.local` |
| Accountant | `/login` | `demo-school` | `accountant@demo-school.local` |
| Student | `/login` | `demo-school` | `student@demo-school.local` |
| Parent | `/login` | `demo-school` | `parent@demo-school.local` |

## Architecture notes

- Super Admin UI: zinc/amber ops console (`platformUi.tsx`, `PlatformShell.tsx`)
- Campus UI: navy/teal school panel
- Always scope campus data with `tenantId`
- Images: files in `uploads/avatars/`, path in `User.avatarUrl`
- Never commit `.env` (only `.env.example`)
- Commit `package.json` + `package-lock.json`

## Done recently

- Auth: OTP, Google login, forgot/reset password
- Premium dashboards (student/staff/super admin)
- Super Admin differentiated ops UI
- Split repos for Raintech GitHub
- Migrated DB from MySQL → PostgreSQL

## Integrations roadmap (do in order)

1. **SMTP email (OTP + password reset)** — done when SMTP_* configured + `npm run mail:verify`
2. **S3 / cloud uploads** — set `STORAGE_DRIVER=s3` + S3_* then `npm run storage:verify` (default remains `local`)
3. **Payment gateway execute + webhook**
4. **SMS provider** (if product needs it)
5. Deeper LMS (live class, course content)
6. Staging deploy + shared cloud Postgres (optional)

## Team workflow

1. Branch from `main` → PR → merge  
2. Each teammate: own local Postgres + `db:migrate` + `db:seed`  
3. Clone does **not** copy another person’s DB or uploaded images  

## For the AI agent

When user says “continue this project”:

1. Work in `saas_cms_lms_backend` and/or `saas_cms_lms_frontend`
2. Keep PostgreSQL (do not revert to MySQL)
3. Preserve multi-tenant `tenantId` patterns
4. Do not invent Docker as required if local Postgres already works
5. Prefer small, focused changes; match existing code style
