# Project Architecture — CEO Brief

**Product:** Cloud SaaS **Campus Management System (CMS)** + **Learning Management System (LMS)**  
**Company context:** Multi-tenant platform for Schools, Coaching Centers, Colleges, with reseller / white-label options.

---

## 1. One-line pitch

> We built a **cloud school operating system**: one platform, many institutions, each school’s data isolated, selling **CMS**, **LMS**, or **Both**, with web admin + student/parent portal (desktop EXE wrapper available).

---

## 2. Who uses it

| User | What they do |
|------|----------------|
| **Super Admin / Universe AI** | Create tenants, resellers, plans, platform control |
| **School Admin / Staff** | Run campus ops (students, fees, attendance, exams, HR) |
| **Teacher** | Timetable, homework, marks, attendance (as permitted) |
| **Student / Parent** | Portal: fees, attendance, homework, results, notices |
| **Reseller** | Onboard schools under white-label (platform layer) |

---

## 3. Product packaging (business architecture)

Each school (tenant) buys one mode:

```
CMS only     → Fees, HR, Documents, ERP-heavy campus ops
LMS only     → Timetable, Homework (+ shared academics/exams)
BOTH         → Full campus + learning
```

Shared foundation for all: Students, Academics, Attendance, Exams, Reports, Settings.

This matches the sales model: school / coaching / college / individual / reseller.

---

## 4. System architecture (simple)

```
┌─────────────────────────────────────────────────────────┐
│  Clients                                                 │
│  • Web Admin (React)  • Student/Parent Portal            │
│  • Desktop shell (Electron EXE)  • Mobile apps (planned) │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS / JSON API
┌──────────────────────────▼──────────────────────────────┐
│  Backend API (Node.js + Express)                         │
│  /api/v1                                                 │
│  • Auth (login, roles, permissions)                      │
│  • Campus modules (students, fees, attendance…)          │
│  • Portal APIs (student/parent)                          │
│  • Platform APIs (super-admin / tenants)                 │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Database (PostgreSQL) + Prisma ORM                      │
│  • One database, many tenants (tenantId on every record) │
│  • Strict isolation — School A never sees School B data  │
└─────────────────────────────────────────────────────────┘
         │
         ├── Email (SMTP) / SMS (MSG91) / Push notifications
         └── File storage (local or S3) for photos & docs
```

---

## 5. Technical stack (if asked “what tech?”)

| Layer | Choice | Why (simple) |
|-------|--------|----------------|
| Frontend | React + Vite | Fast modern admin UI |
| Desktop | Electron | Windows EXE for schools that want “software feel” |
| Backend | Node.js + Express | Fast API development, scalable |
| Database | PostgreSQL | Reliable, multi-tenant enterprise DB |
| ORM | Prisma | Safe schema + migrations |
| Auth | JWT + roles/permissions | Secure staff access control |

---

## 6. Multi-tenant model (important for CEO)

- **One product, many customers (schools).**
- Each school = **tenant** with its own users, students, fees, settings.
- Every API call is scoped by `tenantId` → **data isolation**.
- Modules can be switched on/off per school (fees, homework, etc.).
- Supports **CMS / LMS / BOTH** commercial packaging.

---

## 7. Module map (what the system contains)

### CMS (Campus operations) — largely built
Students · Fees · Academics · Attendance · Exams · HR · Certificates/ID · ERP Settings · Reports

### LMS (Learning) — partially built
**Done:** Timetable · Homework (+ portal)  
**Pending:** Live classes, content/lesson plans, question bank, test series, NCERT, AI tutor, mobile apps

### Portals
Student & Parent web portal for day-to-day visibility and submissions.

---

## 8. Security & control (CEO-friendly)

- Login-based access with **roles** (Admin, Teacher, Accountant, Student, Parent…)
- **Permission checks** per action (view/manage)
- **Tenant isolation** (school data separation)
- Audit-friendly design (platform audit / change tracking direction)
- Integrations: Email, SMS, payment gateway config, web push

---

## 9. Deployment view

```
Development today:
  Frontend (localhost:5173) → Backend API (localhost:4000) → PostgreSQL

Production target:
  Cloud host (API + DB) → HTTPS domain → optional CDN/S3 for files
  Schools access via browser or desktop EXE
  Later: Android/iOS apps talking to same API
```

Same backend serves web, desktop, and future mobile — **one API, many clients**.

---

## 10. Current maturity (honest status)

| Area | Status |
|------|--------|
| SaaS foundation + CMS core | **Strong / demo-ready** |
| Student–Parent portal | **Working** |
| LMS advanced (live/AI/NCERT) | **Mostly pending** |
| Native mobile apps | **Pending** (Flutter planned) |

---

## 11. 60-second CEO speech (memorize this)

> “We’ve built a **multi-tenant SaaS campus platform**.  
> Each school is an isolated tenant. They can buy **CMS**, **LMS**, or **Both**.  
> Architecture is standard and scalable: **React clients → Node API → PostgreSQL**, with email/SMS/storage integrations.  
> CMS side is largely complete — admissions, fees, attendance, exams, HR, documents, portal.  
> LMS basics (timetable + homework) are live; advanced LMS (live class, content, AI) and mobile apps are the next build phases.  
> One API powers web admin, portal, desktop EXE, and future mobile apps — so we don’t rebuild for each channel.”

---

## 12. If CEO asks follow-ups

**Q: Is data safe between schools?**  
A: Yes — every record is tenant-scoped; School A cannot access School B.

**Q: Can we sell only fees/attendance first?**  
A: Yes — modules and CMS/LMS packaging support phased selling.

**Q: Why Electron?**  
A: Some schools prefer an installed Windows app; it still uses the same cloud API.

**Q: What’s left for full LMS vision?**  
A: Live classes, learning content, question bank/test series, NCERT, AI tutor, and Flutter mobile apps.

**Q: Scalability?**  
A: Stateless API + PostgreSQL is a proven SaaS pattern; we can scale API instances and DB as tenants grow.
