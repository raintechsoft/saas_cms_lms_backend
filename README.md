# SaaS CMS LMS — Backend

Express + Prisma + PostgreSQL API for the multi-tenant CMS + LMS platform.

## Setup (local PostgreSQL)

```powershell
npm install
Copy-Item .env.example .env
# If your password contains @, encode it as %40 in DATABASE_URL
npm run db:generate
npm run db:ensure
npm run db:migrate
npm run db:seed
npm run db:verify
npm run dev
```

API: `http://localhost:4000`  
Health: `http://localhost:4000/api/v1/health`

## DATABASE_URL example

```env
DATABASE_URL="postgresql://saas_admin:saas_anwin%407736@127.0.0.1:5432/saas_cms_lms"
```

Password `saas_anwin@7736` must be written as `saas_anwin%407736`.

## Optional Docker PostgreSQL

```powershell
docker compose up -d
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | API with hot reload |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed demo data |

## Related repo

Frontend: `saas_cms_lms_frontend`
