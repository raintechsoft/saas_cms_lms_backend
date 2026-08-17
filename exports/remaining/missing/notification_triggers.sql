SET session_replication_role = replica;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aoa0002hm1o2rrj5bsi', 'cmrvmxa4u0014hmmkreax8o99', 'admission_confirmation', 'Admission Confirmation', 'Notify when admission is approved', 'ADMISSION', 'admission_approved', 'On Admission Approved', 'HIGH', 'IMMEDIATELY', true, true, true, true, true, true, false, 'Admission Confirmation', 'Hello {{name}},

Notify when admission is approved.

â€” {{school_name}}', true, false, 420, 1, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aoa0003hm1osoe9qs0m', 'cmrvmxa4u0014hmmkreax8o99', 'admission_rejected', 'Admission Rejected', 'Notify when application is rejected', 'ADMISSION', 'admission_rejected', 'On Admission Rejected', 'MEDIUM', 'IMMEDIATELY', true, true, true, false, false, true, false, 'Admission Rejected', 'Hello {{name}},

Notify when application is rejected.

â€” {{school_name}}', true, false, 48, 2, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aoa0004hm1obmo31zra', 'cmrvmxa4u0014hmmkreax8o99', 'admission_document_request', 'Document Request', 'Ask for pending admission documents', 'ADMISSION', 'docs_requested', 'On Documents Requested', 'MEDIUM', 'IMMEDIATELY', true, true, true, false, true, true, false, 'Document Request', 'Hello {{name}},

Ask for pending admission documents.

â€” {{school_name}}', true, false, 210, 3, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aoa0005hm1owit8qzd5', 'cmrvmxa4u0014hmmkreax8o99', 'admission_fee_pending', 'Admission Fee Pending', 'Remind unpaid admission fee', 'ADMISSION', 'admission_fee_due', 'On Fee Pending', 'HIGH', 'IMMEDIATELY', true, true, true, true, true, true, false, 'Admission Fee Pending', 'Hello {{name}},

Remind unpaid admission fee.

â€” {{school_name}}', true, false, 180, 4, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aoa0006hm1o8pkdu083', 'cmrvmxa4u0014hmmkreax8o99', 'admission_interview', 'Interview Scheduled', 'Share interview slot details', 'ADMISSION', 'interview_scheduled', 'On Interview Scheduled', 'MEDIUM', 'SCHEDULED', true, true, true, false, true, true, false, 'Interview Scheduled', 'Hello {{name}},

Share interview slot details.

â€” {{school_name}}', true, true, 95, 5, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aoa0007hm1oiriq3x54', 'cmrvmxa4u0014hmmkreax8o99', 'admission_waitlist', 'Waitlist Update', 'Update waitlisted applicants', 'ADMISSION', 'waitlist_updated', 'On Waitlist Change', 'MEDIUM', 'IMMEDIATELY', true, true, true, false, true, true, false, 'Waitlist Update', 'Hello {{name}},

Update waitlisted applicants.

â€” {{school_name}}', false, false, 12, 6, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aoa0008hm1ogo12094l', 'cmrvmxa4u0014hmmkreax8o99', 'admission_offer_letter', 'Offer Letter Issued', 'Send digital offer letter', 'ADMISSION', 'offer_issued', 'On Offer Issued', 'HIGH', 'IMMEDIATELY', true, true, true, false, true, true, false, 'Offer Letter Issued', 'Hello {{name}},

Send digital offer letter.

â€” {{school_name}}', true, false, 150, 7, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aoa0009hm1o1o436bzz', 'cmrvmxa4u0014hmmkreax8o99', 'admission_enrollment_complete', 'Enrollment Complete', 'Welcome after enrollment', 'ADMISSION', 'enrollment_complete', 'On Enrollment Complete', 'MEDIUM', 'IMMEDIATELY', true, true, true, false, true, true, false, 'Enrollment Complete', 'Hello {{name}},

Welcome after enrollment.

â€” {{school_name}}', true, false, 130, 8, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aoa000ahm1o8fyb7rd0', 'cmrvmxa4u0014hmmkreax8o99', 'fee_due_reminder', 'Fee Due Reminder', 'Remind before fee due date', 'FEES', 'fee_due_soon', '3 Days Before Due Date', 'HIGH', 'SCHEDULED', true, true, true, true, true, true, false, 'Fee Due Reminder', 'Hello {{name}},

Remind before fee due date.

â€” {{school_name}}', true, true, 980, 9, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aoa000bhm1ot5n558l0', 'cmrvmxa4u0014hmmkreax8o99', 'fee_overdue', 'Fee Overdue Alert', 'Alert after due date passes', 'FEES', 'fee_overdue', 'On Fee Overdue', 'HIGH', 'IMMEDIATELY', true, true, true, true, true, true, false, 'Fee Overdue Alert', 'Hello {{name}},

Alert after due date passes.

â€” {{school_name}}', true, false, 640, 10, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aob000chm1ojtofiwj9', 'cmrvmxa4u0014hmmkreax8o99', 'fee_payment_success', 'Payment Success', 'Confirm successful payment', 'FEES', 'payment_success', 'On Payment Success', 'MEDIUM', 'IMMEDIATELY', true, true, true, false, true, true, false, 'Payment Success', 'Hello {{name}},

Confirm successful payment.

â€” {{school_name}}', true, false, 720, 11, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aob000dhm1ork5w95ky', 'cmrvmxa4u0014hmmkreax8o99', 'fee_payment_failed', 'Payment Failed', 'Notify failed online payment', 'FEES', 'payment_failed', 'On Payment Failed', 'HIGH', 'IMMEDIATELY', true, true, true, false, true, true, false, 'Payment Failed', 'Hello {{name}},

Notify failed online payment.

â€” {{school_name}}', true, false, 88, 12, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aob000ehm1ov6vj0fde', 'cmrvmxa4u0014hmmkreax8o99', 'fee_receipt_generated', 'Receipt Generated', 'Share fee receipt link', 'FEES', 'receipt_generated', 'On Receipt Generated', 'MEDIUM', 'IMMEDIATELY', true, true, false, false, true, true, false, 'Receipt Generated', 'Hello {{name}},

Share fee receipt link.

â€” {{school_name}}', true, false, 510, 13, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aob000fhm1om2g30eii', 'cmrvmxa4u0014hmmkreax8o99', 'fee_concession_approved', 'Concession Approved', 'Notify concession approval', 'FEES', 'concession_approved', 'On Concession Approved', 'MEDIUM', 'IMMEDIATELY', true, true, true, false, true, true, true, 'Concession Approved', 'Hello {{name}},

Notify concession approval.

â€” {{school_name}}', true, false, 34, 14, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aob000ghm1oc3mroip7', 'cmrvmxa4u0014hmmkreax8o99', 'fee_installment_due', 'Installment Due', 'Upcoming installment reminder', 'FEES', 'installment_due', '2 Days Before Installment', 'MEDIUM', 'SCHEDULED', true, true, true, false, true, true, false, 'Installment Due', 'Hello {{name}},

Upcoming installment reminder.

â€” {{school_name}}', true, true, 290, 15, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aob000hhm1o8duce1km', 'cmrvmxa4u0014hmmkreax8o99', 'fee_partial_payment', 'Partial Payment Received', 'Acknowledge partial payment', 'FEES', 'partial_payment', 'On Partial Payment', 'MEDIUM', 'IMMEDIATELY', true, true, true, false, true, true, false, 'Partial Payment Received', 'Hello {{name}},

Acknowledge partial payment.

â€” {{school_name}}', true, false, 76, 16, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aob000ihm1oldeylwxq', 'cmrvmxa4u0014hmmkreax8o99', 'fee_defaulter_list', 'Defaulter List Alert', 'Daily defaulter digest for staff', 'FEES', 'defaulter_digest', 'Daily at 9 AM', 'MEDIUM', 'SCHEDULED', true, true, true, false, false, false, true, 'Defaulter List Alert', 'Hello {{name}},

Daily defaulter digest for staff.

â€” {{school_name}}', true, true, 40, 17, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aob000jhm1o13hx732a', 'cmrvmxa4u0014hmmkreax8o99', 'fee_refund_processed', 'Refund Processed', 'Confirm refund completion', 'FEES', 'refund_processed', 'On Refund Processed', 'MEDIUM', 'IMMEDIATELY', true, true, true, false, true, true, false, 'Refund Processed', 'Hello {{name}},

Confirm refund completion.

â€” {{school_name}}', false, false, 8, 18, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aob000khm1oulwnabls', 'cmrvmxa4u0014hmmkreax8o99', 'timetable_updated', 'Timetable Updated', 'Notify timetable changes', 'ACADEMICS', 'timetable_updated', 'On Timetable Update', 'MEDIUM', 'IMMEDIATELY', true, true, true, false, true, true, false, 'Timetable Updated', 'Hello {{name}},

Notify timetable changes.

â€” {{school_name}}', true, false, 260, 19, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aob000lhm1othb987ht', 'cmrvmxa4u0014hmmkreax8o99', 'homework_assigned', 'Homework Assigned', 'New homework notification', 'ACADEMICS', 'homework_assigned', 'On Homework Assigned', 'MEDIUM', 'IMMEDIATELY', true, true, true, false, true, true, false, 'Homework Assigned', 'Hello {{name}},

New homework notification.

â€” {{school_name}}', true, false, 540, 20, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aob000mhm1oaghl9vba', 'cmrvmxa4u0014hmmkreax8o99', 'homework_due', 'Homework Due Reminder', 'Remind before homework due', 'ACADEMICS', 'homework_due', '1 Day Before Due', 'MEDIUM', 'SCHEDULED', true, true, true, false, true, true, false, 'Homework Due Reminder', 'Hello {{name}},

Remind before homework due.

â€” {{school_name}}', true, false, 410, 21, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aob000nhm1or2wytxa6', 'cmrvmxa4u0014hmmkreax8o99', 'class_cancelled', 'Class Cancelled', 'Notify cancelled class', 'ACADEMICS', 'class_cancelled', 'On Class Cancelled', 'HIGH', 'IMMEDIATELY', true, true, true, true, true, true, false, 'Class Cancelled', 'Hello {{name}},

Notify cancelled class.

â€” {{school_name}}', true, false, 120, 22, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aob000ohm1o96ui5neu', 'cmrvmxa4u0014hmmkreax8o99', 'substitution_assigned', 'Substitution Assigned', 'Staff substitution alert', 'ACADEMICS', 'substitution', 'On Substitution Assigned', 'MEDIUM', 'IMMEDIATELY', true, true, true, false, false, false, true, 'Substitution Assigned', 'Hello {{name}},

Staff substitution alert.

â€” {{school_name}}', true, false, 65, 23, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aob000phm1oyvv3xbq7', 'cmrvmxa4u0014hmmkreax8o99', 'syllabus_published', 'Syllabus Published', 'New syllabus available', 'ACADEMICS', 'syllabus_published', 'On Syllabus Publish', 'MEDIUM', 'IMMEDIATELY', true, true, true, false, true, true, false, 'Syllabus Published', 'Hello {{name}},

New syllabus available.

â€” {{school_name}}', true, false, 90, 24, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aob000qhm1o6mb767s2', 'cmrvmxa4u0014hmmkreax8o99', 'live_class_starting', 'Live Class Starting', 'Join reminder for live class', 'ACADEMICS', 'live_class_soon', '15 Min Before Start', 'MEDIUM', 'SCHEDULED', true, true, true, false, true, true, false, 'Live Class Starting', 'Hello {{name}},

Join reminder for live class.

â€” {{school_name}}', true, true, 380, 25, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aob000rhm1ocogun82o', 'cmrvmxa4u0014hmmkreax8o99', 'assignment_graded', 'Assignment Graded', 'Notify when marks are published', 'ACADEMICS', 'assignment_graded', 'On Assignment Graded', 'MEDIUM', 'IMMEDIATELY', true, true, true, false, true, true, false, 'Assignment Graded', 'Hello {{name}},

Notify when marks are published.

â€” {{school_name}}', true, false, 300, 26, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aob000shm1o7a091wa4', 'cmrvmxa4u0014hmmkreax8o99', 'academic_calendar_update', 'Calendar Update', 'Academic calendar change', 'ACADEMICS', 'calendar_updated', 'On Calendar Update', 'MEDIUM', 'IMMEDIATELY', true, true, true, false, true, true, false, 'Calendar Update', 'Hello {{name}},

Academic calendar change.

â€” {{school_name}}', false, false, 22, 27, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aob000thm1oi36vydr4', 'cmrvmxa4u0014hmmkreax8o99', 'exam_schedule_published', 'Exam Schedule Published', 'Share exam timetable', 'EXAMINATIONS', 'exam_schedule', 'On Schedule Published', 'HIGH', 'IMMEDIATELY', true, true, true, false, true, true, false, 'Exam Schedule Published', 'Hello {{name}},

Share exam timetable.

â€” {{school_name}}', true, false, 450, 28, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aob000uhm1o0worcdrh', 'cmrvmxa4u0014hmmkreax8o99', 'admit_card_ready', 'Admit Card Ready', 'Admit card download link', 'EXAMINATIONS', 'admit_card_ready', 'On Admit Card Ready', 'MEDIUM', 'IMMEDIATELY', true, true, true, false, true, true, false, 'Admit Card Ready', 'Hello {{name}},

Admit card download link.

â€” {{school_name}}', true, false, 390, 29, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aob000vhm1o4rdgiln1', 'cmrvmxa4u0014hmmkreax8o99', 'exam_reminder', 'Exam Reminder', 'Day-before exam reminder', 'EXAMINATIONS', 'exam_tomorrow', '1 Day Before Exam', 'MEDIUM', 'SCHEDULED', true, true, true, false, true, true, false, 'Exam Reminder', 'Hello {{name}},

Day-before exam reminder.

â€” {{school_name}}', true, true, 520, 30, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aob000whm1ongj0ask9', 'cmrvmxa4u0014hmmkreax8o99', 'result_published', 'Result Published', 'Notify when results go live', 'EXAMINATIONS', 'result_published', 'On Result Published', 'HIGH', 'IMMEDIATELY', true, true, true, true, true, true, false, 'Result Published', 'Hello {{name}},

Notify when results go live.

â€” {{school_name}}', true, false, 610, 31, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aob000xhm1o7x0db99m', 'cmrvmxa4u0014hmmkreax8o99', 'revaluation_update', 'Revaluation Update', 'Revaluation status change', 'EXAMINATIONS', 'revaluation_update', 'On Revaluation Update', 'MEDIUM', 'IMMEDIATELY', true, true, true, false, true, true, false, 'Revaluation Update', 'Hello {{name}},

Revaluation status change.

â€” {{school_name}}', true, false, 40, 32, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aob000yhm1ogjlga8bi', 'cmrvmxa4u0014hmmkreax8o99', 'marksheet_available', 'Marksheet Available', 'Digital marksheet ready', 'EXAMINATIONS', 'marksheet_ready', 'On Marksheet Ready', 'MEDIUM', 'IMMEDIATELY', true, true, true, false, true, true, false, 'Marksheet Available', 'Hello {{name}},

Digital marksheet ready.

â€” {{school_name}}', true, false, 280, 33, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aoc000zhm1oiwlbur15', 'cmrvmxa4u0014hmmkreax8o99', 'exam_hall_ticket', 'Hall Ticket Issued', 'Hall ticket notification', 'EXAMINATIONS', 'hall_ticket', 'On Hall Ticket Issued', 'MEDIUM', 'IMMEDIATELY', true, true, true, false, true, true, false, 'Hall Ticket Issued', 'Hello {{name}},

Hall ticket notification.

â€” {{school_name}}', true, false, 200, 34, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aoc0010hm1o0px0u8fx', 'cmrvmxa4u0014hmmkreax8o99', 'exam_cancelled', 'Exam Cancelled', 'Urgent exam cancellation', 'EXAMINATIONS', 'exam_cancelled', 'On Exam Cancelled', 'HIGH', 'IMMEDIATELY', true, true, true, true, true, true, false, 'Exam Cancelled', 'Hello {{name}},

Urgent exam cancellation.

â€” {{school_name}}', false, false, 5, 35, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aoc0011hm1o0xhfwt0a', 'cmrvmxa4u0014hmmkreax8o99', 'student_absent', 'Student Absent Alert', 'Notify parents on absence', 'ATTENDANCE', 'student_absent', 'On Marked Absent', 'HIGH', 'IMMEDIATELY', true, true, true, true, false, true, false, 'Student Absent Alert', 'Hello {{name}},

Notify parents on absence.

â€” {{school_name}}', true, false, 860, 36, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aoc0012hm1ouiby5u3n', 'cmrvmxa4u0014hmmkreax8o99', 'late_arrival', 'Late Arrival', 'Notify late check-in', 'ATTENDANCE', 'late_arrival', 'On Late Arrival', 'MEDIUM', 'IMMEDIATELY', true, true, true, false, true, true, false, 'Late Arrival', 'Hello {{name}},

Notify late check-in.

â€” {{school_name}}', true, false, 190, 37, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aoc0013hm1ougtgs8ky', 'cmrvmxa4u0014hmmkreax8o99', 'attendance_summary', 'Weekly Attendance Summary', 'Weekly attendance digest', 'ATTENDANCE', 'attendance_weekly', 'Every Monday 8 AM', 'MEDIUM', 'SCHEDULED', true, true, true, false, true, true, false, 'Weekly Attendance Summary', 'Hello {{name}},

Weekly attendance digest.

â€” {{school_name}}', true, false, 110, 38, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aoc0014hm1oeje122mu', 'cmrvmxa4u0014hmmkreax8o99', 'low_attendance_warning', 'Low Attendance Warning', 'Alert when attendance drops', 'ATTENDANCE', 'low_attendance', 'Below 75% Threshold', 'HIGH', 'IMMEDIATELY', true, true, true, false, true, true, false, 'Low Attendance Warning', 'Hello {{name}},

Alert when attendance drops.

â€” {{school_name}}', true, false, 70, 39, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aoc0015hm1od4007yz5', 'cmrvmxa4u0014hmmkreax8o99', 'staff_absent', 'Staff Absent Alert', 'Notify HR of staff absence', 'ATTENDANCE', 'staff_absent', 'On Staff Absent', 'MEDIUM', 'IMMEDIATELY', true, true, true, false, false, false, true, 'Staff Absent Alert', 'Hello {{name}},

Notify HR of staff absence.

â€” {{school_name}}', false, false, 18, 40, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aoc0016hm1owiyl5gaf', 'cmrvmxa4u0014hmmkreax8o99', 'leave_approved', 'Leave Approved', 'Staff leave approval notice', 'HR', 'leave_approved', 'On Leave Approved', 'MEDIUM', 'IMMEDIATELY', true, true, true, false, false, false, true, 'Leave Approved', 'Hello {{name}},

Staff leave approval notice.

â€” {{school_name}}', true, false, 55, 41, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aoc0017hm1ouyrdhrih', 'cmrvmxa4u0014hmmkreax8o99', 'leave_rejected', 'Leave Rejected', 'Staff leave rejection notice', 'HR', 'leave_rejected', 'On Leave Rejected', 'MEDIUM', 'IMMEDIATELY', true, true, true, false, false, false, true, 'Leave Rejected', 'Hello {{name}},

Staff leave rejection notice.

â€” {{school_name}}', true, false, 20, 42, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aoc0018hm1oj70k9q5i', 'cmrvmxa4u0014hmmkreax8o99', 'payroll_processed', 'Payroll Processed', 'Salary processed confirmation', 'HR', 'payroll_processed', 'On Payroll Processed', 'HIGH', 'IMMEDIATELY', true, true, true, false, false, false, true, 'Payroll Processed', 'Hello {{name}},

Salary processed confirmation.

â€” {{school_name}}', true, false, 140, 43, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aoc0019hm1o0xqt6fuy', 'cmrvmxa4u0014hmmkreax8o99', 'staff_announcement', 'Staff Announcement', 'Broadcast HR announcements', 'HR', 'staff_announcement', 'On Announcement Publish', 'MEDIUM', 'IMMEDIATELY', true, true, true, false, false, false, true, 'Staff Announcement', 'Hello {{name}},

Broadcast HR announcements.

â€” {{school_name}}', true, false, 80, 44, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aoc001ahm1o5z5pjz7t', 'cmrvmxa4u0014hmmkreax8o99', 'appraisal_reminder', 'Appraisal Reminder', 'Upcoming appraisal cycle', 'HR', 'appraisal_reminder', '7 Days Before Cycle', 'MEDIUM', 'SCHEDULED', true, true, true, false, false, false, true, 'Appraisal Reminder', 'Hello {{name}},

Upcoming appraisal cycle.

â€” {{school_name}}', false, false, 15, 45, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aoc001bhm1ob8js9nat', 'cmrvmxa4u0014hmmkreax8o99', 'school_announcement', 'School Announcement', 'General campus announcements', 'GENERAL', 'announcement', 'On Announcement Publish', 'MEDIUM', 'IMMEDIATELY', true, true, true, false, true, true, true, 'School Announcement', 'Hello {{name}},

General campus announcements.

â€” {{school_name}}', true, false, 320, 46, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aoc001chm1o00bmir8x', 'cmrvmxa4u0014hmmkreax8o99', 'holiday_notice', 'Holiday Notice', 'Notify declared holidays', 'GENERAL', 'holiday_declared', 'On Holiday Declared', 'MEDIUM', 'IMMEDIATELY', true, true, true, false, true, true, true, 'Holiday Notice', 'Hello {{name}},

Notify declared holidays.

â€” {{school_name}}', true, false, 95, 47, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
INSERT INTO public.notification_triggers (id, tenant_id, key, name, description, module, event_key, event_label, priority, send_timing, channel_whatsapp, channel_email, channel_push, channel_sms, recipient_student, recipient_parent, recipient_staff, message_subject, message_body, is_active, is_scheduled_today, week_sent_count, sort_order, created_at, updated_at) VALUES ('cmsmu9aoc001dhm1ow4izxzh8', 'cmrvmxa4u0014hmmkreax8o99', 'emergency_alert', 'Emergency Alert', 'Critical campus emergency', 'GENERAL', 'emergency', 'On Emergency Raised', 'HIGH', 'IMMEDIATELY', true, true, true, true, true, true, true, 'Emergency Alert', 'Hello {{name}},

Critical campus emergency.

â€” {{school_name}}', true, false, 6, 48, '2026-08-10 06:16:33.61', '2026-08-10 06:16:33.61') ON CONFLICT DO NOTHING;
SET session_replication_role = DEFAULT;
