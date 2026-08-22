-- Super Admin login fix (from working cms.daddytheme.com login response)
-- User: admin@saas-cms-lms.local (cmrvmxa4p0013hmmk5ucizcek)
-- Role: UNIVERSE_SUPER_ADMIN (cmrvmx9xi0012hmmkb6i3zicz)
-- Fixes empty roles/permissions on client DB after partial supabase_data_only.sql import.
--
-- Run on client PostgreSQL:
--   psql "$DATABASE_URL" -f exports/super_admin_login_fix.sql
--
-- Then restart API and verify login at /#/admin/login returns:
--   roles: ["UNIVERSE_SUPER_ADMIN"]
--   permissions includes: platform.manage, tenants.manage
--
-- Source: working login API response (2026-08-22). Access token omitted from this file.

BEGIN;

-- Permissions (upsert by key)
INSERT INTO public.permissions (id, key, description) VALUES ('cmsr1pdzv000yhms8vg1730ta', 'question_bank.view', 'View question bank questions and categories') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmspv3tb2000lhmzk5ahj0bbm', 'inventory.view', 'View inventory stock and movements') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx8zw0001hmmkt6ze4jxd', 'exams.view', 'View exam schedules, results, and print records') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx9vi0010hmmkzepb5xhg', 'fees.collect', 'Collect and revert fee payments') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx9eu000shmmke115zi9e', 'users.view', 'View tenant users') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx902000lhmmkyb9ilaaq', 'erp.backup', 'Create and restore tenant configuration backups') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx8zx0004hmmkjux3d0uu', 'hr.view', 'View staff, attendance, leave, ratings, and payroll') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx901000ihmmk5n129xzi', 'homework.evaluate', 'Evaluate homework and request resubmission') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmsr2ffqj0027hm2016mrned3', 'test_series.manage', 'Create and manage LMS test series from the Question Bank') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmsim4eqo0003hmjkvpnrt8qc', 'hostel.manage', 'Manage hostel blocks, rooms, and assignments') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx8zz000ahmmk58tfct8i', 'documents.generate', 'Generate certificates, ID cards, admit cards, and marksheets') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx96f000ohmmk4zyp7bcj', 'academics.view', 'View academic structure') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx9pi000xhmmk84d44ual', 'attendance.manage', 'Mark attendance, review leave, and award points') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmsim4eqj0001hmjkr5gposai', 'transport.manage', 'Manage transport routes and assignments') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx9j6000uhmmk236gj4v2', 'roles.manage', 'Manage roles and permissions') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cms6zjods000fhmt0mmzq82jj', 'rm.manage', 'Full Rich Mount ERP administration') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmsr6vji10012hmkk27m88b0b', 'live_classes.manage', 'Create and manage LMS live class sessions') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cms6zjodt000hhmt0huwuqio0', 'rm.quotes.manage', 'Prepare and manage quotations') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cms6zjodu000ihmt0tvzqfz58', 'rm.quotes.approve', 'Approve and send quotations') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cms6zjodu000jhmt032hrls9t', 'rm.leads.manage', 'Create and assign leads') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cms6zjodu000khmt0kfug9iro', 'rm.view', 'View Rich Mount ERP operations') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx9ti000zhmmknuczplj9', 'academics.manage', 'Manage academic structure') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx8zx0002hmmkq6qjhy1s', 'exams.manage', 'Manage exams, students, schedules, and marks') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx9le000vhmmkz2u50gtz', 'roles.view', 'View roles and permissions') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cms6zjodw000qhmt02a3jkhan', 'rm.projects.manage', 'Open and close projects') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx8zx0003hmmkgihj2pcd', 'exams.publish', 'Publish examination results') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx902000khmmknp736gjh', 'erp.manage', 'Manage ERP configuration') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cms6zjodw000thmt0rsxa8fyi', 'rm.expenses.approve', 'Approve expenses and post to Zoho') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cms6zjodw000uhmt0rzo1un5d', 'rm.expenses.manage', 'Record expenses and transfers') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cms6zjodx000vhmt0ehrlsewm', 'rm.reports.view', 'View and export financial reports') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cms6zjodx000whmt0eobn4agr', 'rm.zoho.manage', 'Manage Zoho Books integration') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cms6zjodx000xhmt0fmg8s4ui', 'rm.ocr.manage', 'Upload and confirm OCR receipts') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmsr1pdzv0010hms8ccg7vl2a', 'question_bank.manage', 'Manage question bank questions, types, and settings') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx8zy0005hmmkw3ozeodl', 'hr.manage', 'Manage staff, attendance, leave, and ratings') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx9nh000whmmksua5qajj', 'attendance.view', 'View student attendance and reports') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx9xf0011hmmkjnfd5aln', 'sessions.manage', 'Manage academic sessions') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmsr2ffqh0026hm207b4e8g0n', 'test_series.view', 'View LMS test series and papers') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmsim4eqm0002hmjk8ty5mfzh', 'hostel.view', 'View hostel blocks, rooms, and assignments') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx9rg000yhmmk1s0bj88h', 'users.manage', 'Manage tenant users') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx901000fhmmkr30wzjfy', 'homework.manage', 'Create and manage homework assignments') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx9h2000thmmk1runs8b8', 'fees.manage', 'Manage fee setup and assignments') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmspv3tax000jhmzk439r8x0i', 'library.view', 'View library books and loans') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx9co000rhmmk54n8bozo', 'students.manage', 'Manage students and enrolments') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx925000mhmmkvdtwtt8a', 'settings.manage', 'Manage tenant settings') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx902000jhmmkvgauqoji', 'erp.view', 'View ERP configuration') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmspv3tb2000mhmzkzpwj8me7', 'inventory.manage', 'Manage inventory stock and issue items') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmsrd461n0013hm58pl72pbq0', 'ncert.manage', 'Create and manage LMS NCERT study resources') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx946000nhmmkxuw7qsm9', 'platform.manage', 'Manage the SaaS CMS LMS platform') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmsr5kg8v0010hm9ody2lr6yh', 'lesson_planning.view', 'View LMS lesson plans') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmsrd461l0011hm58h7k94dpm', 'ncert.view', 'View LMS NCERT study resources') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx900000dhmmkfn2tioxy', 'homework.view', 'View homework, submissions, and reports') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx901000hhmmkk536cn6p', 'homework.submit', 'Submit and resubmit homework') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmsrfswge000ghmrsftlucb1x', 'academic_calendar.view', 'View LMS academic calendar events') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx8zz0009hmmk61uvtfdi', 'payroll.manage', 'Generate and pay staff payroll') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx900000bhmmkq4dm6u1o', 'reports.view', 'View consolidated module reports and audit trail') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmsr5kg900013hm9o01u3w9xr', 'lesson_planning.manage', 'Create and manage LMS lesson plans') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx9al000qhmmk8l9j0zzj', 'fees.view', 'View fees, dues, receipts, and reports') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx98m000phmmkc97o4j68', 'settings.view', 'View tenant settings') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx8zz0007hmmklbvn9yy3', 'documents.view', 'View templates and generated documents') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmspv3tb3000nhmzkw5eautgl', 'online_exam.view', 'View online exams, attempts, and ranks') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx900000chmmkvama9xz0', 'timetable.manage', 'Create and manage timetable periods') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx8zz0008hmmk8m7vd2ut', 'students.view', 'View students and enrolments') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx900000ehmmky7ydk11m', 'timetable.view', 'View class and teacher timetables') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx901000ghmmk2v5ga1w6', 'sessions.view', 'View academic sessions') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx8zk0000hmmkteq0gjsz', 'tenants.manage', 'Create and administer tenants') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmrvmx8zy0006hmmk2aer223s', 'documents.manage', 'Design certificate, ID card, and exam templates') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cms6zjodu000lhmt0jb793itk', 'notifications.manage', 'Send campus notifications and announcements') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmsr6vjhu000whmkkqj85j3b3', 'live_classes.view', 'View LMS live class sessions') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmsrfswge000hhmrslus4v06f', 'academic_calendar.manage', 'Create and manage LMS academic calendar events') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmspv3tb1000khmzkxf5g2h6t', 'library.manage', 'Manage library books and issue/return') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmsim4eq50000hmjkjhevijq1', 'transport.view', 'View transport routes and assignments') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO public.permissions (id, key, description) VALUES ('cmspv3tb4000ohmzktb3alda3', 'online_exam.manage', 'Manage online exams, questions, attempts, and grading') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

-- Universe Super Admin role
INSERT INTO public.roles (id, tenant_id, code, name, description, is_system, created_at, updated_at, is_active) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', NULL, 'UNIVERSE_SUPER_ADMIN', 'Universe Super Admin', NULL, true, '2026-07-22 05:21:28.711', '2026-07-22 05:21:28.711', true) ON CONFLICT (id) DO NOTHING;

-- Role -> permission links for UNIVERSE_SUPER_ADMIN
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx96f000ohmmk4zyp7bcj') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx9eu000shmmke115zi9e') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx9co000rhmmk54n8bozo') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx9nh000whmmksua5qajj') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx98m000phmmkc97o4j68') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx9rg000yhmmk1s0bj88h') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx8zw0001hmmkt6ze4jxd') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx946000nhmmkxuw7qsm9') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx9ti000zhmmknuczplj9') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx8zz0008hmmk8m7vd2ut') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx9le000vhmmkz2u50gtz') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx8zx0004hmmkjux3d0uu') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx900000bhmmkq4dm6u1o') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx901000ihmmk5n129xzi') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx9xf0011hmmkjnfd5aln') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx8zz0009hmmk61uvtfdi') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx8zy0005hmmkw3ozeodl') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx901000fhmmkr30wzjfy') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx900000dhmmkfn2tioxy') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx901000hhmmkk536cn6p') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx902000jhmmkvgauqoji') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx900000chmmkvama9xz0') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx900000ehmmky7ydk11m') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx8zx0002hmmkq6qjhy1s') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx902000lhmmkyb9ilaaq') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmsr1pdzv0010hms8ccg7vl2a') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cms6zjodu000lhmt0jb793itk') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx9al000qhmmk8l9j0zzj') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx9h2000thmmk1runs8b8') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmspv3tb2000lhmzk5ahj0bbm') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmsim4eq50000hmjkjhevijq1') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cms6zjodt000hhmt0huwuqio0') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cms6zjodu000jhmt032hrls9t') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cms6zjodw000qhmt02a3jkhan') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmsrd461l0011hm58h7k94dpm') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmsrd461n0013hm58pl72pbq0') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cms6zjods000fhmt0mmzq82jj') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx925000mhmmkvdtwtt8a') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx902000khmmknp736gjh') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx8zx0003hmmkgihj2pcd') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmspv3tb4000ohmzktb3alda3') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmspv3tb1000khmzkxf5g2h6t') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cms6zjodu000khmt0kfug9iro') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx8zk0000hmmkteq0gjsz') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx8zz0007hmmklbvn9yy3') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmspv3tax000jhmzk439r8x0i') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmspv3tb3000nhmzkw5eautgl') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx9j6000uhmmk236gj4v2') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx8zz000ahmmk58tfct8i') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmsim4eqm0002hmjk8ty5mfzh') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmsim4eqo0003hmjkvpnrt8qc') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cms6zjodu000ihmt0tvzqfz58') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cms6zjodw000uhmt0rzo1un5d') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmsim4eqj0001hmjkr5gposai') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cms6zjodw000thmt0rsxa8fyi') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx901000ghmmk2v5ga1w6') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx9pi000xhmmk84d44ual') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmspv3tb2000mhmzkzpwj8me7') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cms6zjodx000whmt0eobn4agr') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cms6zjodx000vhmt0ehrlsewm') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmsr1pdzv000yhms8vg1730ta') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmsr5kg8v0010hm9ody2lr6yh') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmsr6vjhu000whmkkqj85j3b3') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cms6zjodx000xhmt0fmg8s4ui') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx9vi0010hmmkzepb5xhg') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmrvmx8zy0006hmmk2aer223s') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmsr2ffqh0026hm207b4e8g0n') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmsr2ffqj0027hm2016mrned3') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmsr6vji10012hmkk27m88b0b') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmsr5kg900013hm9o01u3w9xr') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmsrfswge000ghmrsftlucb1x') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('cmrvmx9xi0012hmmkb6i3zicz', 'cmsrfswge000hhmrslus4v06f') ON CONFLICT DO NOTHING;
-- Assign super admin user to UNIVERSE_SUPER_ADMIN role
INSERT INTO public.user_roles (user_id, role_id, tenant_id)
VALUES ('cmrvmxa4p0013hmmk5ucizcek', 'cmrvmx9xi0012hmmkb6i3zicz', NULL)
ON CONFLICT (user_id, role_id) DO NOTHING;

COMMIT;
