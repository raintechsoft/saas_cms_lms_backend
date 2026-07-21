# SaaS CMS LMS — Backend

Express + Prisma + MySQL API for the multi-tenant CMS + LMS platform.

## Setup

```powershell
npm install
Copy-Item .env.example .env
# edit DATABASE_URL, JWT_SECRET, etc.
npm run db:generate
npm run db:ensure
npm run db:migrate
npm run db:seed
npm run dev
```

API: `http://localhost:4000`  
Health: `http://localhost:4000/api/v1/health`

## Docker MySQL

```powershell
docker compose up -d
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | API with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run test` | Vitest |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed demo data |

## Related repo

Frontend: `saas_cms_lms_frontend`
