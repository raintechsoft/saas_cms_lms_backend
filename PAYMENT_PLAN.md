# SaaS CMS LMS — Online Fee Payment Plan

**Status:** Planned (do not implement until school management UI is confirmed)  
**Last updated:** 2026-07-23  
**Owner (backend):** Anwin  
**Related repos:** `saas_cms_lms_backend`, `saas_cms_lms_frontend`

---

## 1. Purpose

Enable **online fee collection** for schools (tenants) so parents/students can pay dues digitally, while keeping the existing office/cash collection flow unchanged.

This document is the full product + technical plan for payments. Implementation starts only after **school management UI confirmation**.

---

## 2. Current state (as of today)

### Already built
- Campus **Fees → Collect** records payments via `POST /fees/payments`
- Supports modes: Cash, Card, Bank transfer, UPI, Cheque, Online, Other
- Creates `FeePayment` with status `COLLECTED` immediately (office collection)
- Receipt number generation via receipt books
- Partial payments, dues, revert, reports
- Portal Fees page shows dues / payment history (**view only** today)
- ERP can store provider config + **encrypted secrets** (`ErpIntegrationSetting`)
- `PaymentMode.ONLINE` enum value already exists

### Not built yet
- Live payment gateway charge (Razorpay / Stripe / etc.)
- Checkout session / order creation
- Secure **webhook** verification
- Marking fees paid only after gateway confirmation
- “Pay now” button on Parent/Student portal
- Refunds, settlements dashboard, multi-gateway routing

---

## 3. Goals

1. Parent/Student can pay outstanding fees online securely.
2. Payment is confirmed by **server webhook**, not by frontend alone.
3. Successful online payment creates the same fee/receipt records used by campus.
4. Office cash collection continues to work as today.
5. Each school can use gateway credentials (test now, company production later).
6. Design stays compatible with future UI changes in school management screens.

---

## 4. Non-goals (v1)

- SaaS subscription billing for schools (platform billing) — separate product later
- Automatic refunds / chargebacks workflow
- EMI / split settlements to multiple bank accounts
- Multiple gateways active at once per tenant (v1 = one primary gateway)
- Offline QR static collection without order tracking
- Changing core fee master/assignment rules (use existing fee engine)

---

## 5. Recommended gateway

| Region / context | Recommendation |
|------------------|----------------|
| India school SaaS (default) | **Razorpay** (UPI, cards, netbanking, wallets) |
| International-heavy | Stripe |

**Default for this project: Razorpay**  
(Final choice can change after company confirmation; architecture should keep provider adapter layer.)

---

## 6. Where payment starts (UX entry points)

### Primary (v1)
- **Parent Portal → Fees → Pay now**
- **Student Portal → Fees → Pay now** (if school allows student self-pay)

### Secondary (v1.1 / optional)
- Campus **Fees** desk can generate an online payment link/order for a parent

### Unchanged
- Campus **Collect fees** for cash/UPI-at-counter remains manual `collectPayment`

---

## 7. End-to-end flow

```text
┌─────────────┐     create-order      ┌──────────────┐     create order     ┌────────────┐
│ Parent/     │ ───────────────────► │ Backend API  │ ──────────────────► │ Razorpay   │
│ Student UI  │                      │              │                      │            │
└──────┬──────┘                      └──────┬───────┘                      └─────┬──────┘
       │                                    │                                    │
       │ open checkout (order id)           │ store PENDING order                │
       │◄───────────────────────────────────┘                                    │
       │                                                                         │
       │ pay on Razorpay UI                                                      │
       │────────────────────────────────────────────────────────────────────────►│
       │                                                                         │
       │                              webhook (signed)                           │
       │                         ┌────────────────────┐                          │
       │                         │ Backend /webhooks/ │◄─────────────────────────┘
       │                         │ razorpay           │
       │                         └─────────┬──────────┘
       │                                   │ verify signature
       │                                   │ mark order SUCCESS
       │                                   │ create FeePayment (ONLINE, COLLECTED)
       │                                   │ issue receipt
       │ poll/refresh fees                 │
       │◄──────────────────────────────────┘
       │ see paid + receipt
```

### Critical rule
**Never trust only frontend “payment success”.**  
Only a **verified webhook** (or server-side payment fetch + signature validation) may mark fees as paid.

---

## 8. Functional requirements

### FR-1 Create online order
- Input: tenant, student, session, selected fee assignment items + amounts
- Validate outstanding balance (reuse existing due calculation)
- Create internal order with status `PENDING`
- Call gateway to create order/checkout
- Return gateway order id + public key/checkout payload to UI

### FR-2 Checkout
- UI opens Razorpay Checkout with order details
- User completes/cancels/fails payment

### FR-3 Webhook handling
- Receive gateway events (authorized/captured/failed)
- Verify webhook signature
- Idempotent processing (same event twice must be safe)
- On success: create `FeePayment` + items, link to online order
- On failure/cancel: mark order `FAILED` / `CANCELLED` (no fee payment row)

### FR-4 Status for UI
- UI can query order status while waiting for webhook
- After success, fees/dues/receipts reflect paid amount

### FR-5 Security
- Gateway secrets encrypted at rest (existing ERP encryption pattern)
- Webhook endpoint public but signature-verified
- Tenant isolation on every order and payment write

### FR-6 Audit
- Audit log for order created / payment captured / webhook received

---

## 9. Data model (proposed)

### New table: `online_fee_orders` (name may vary)

| Field | Notes |
|-------|--------|
| id | cuid |
| tenantId | required |
| studentId | required |
| academicSessionId | required |
| amount | decimal |
| currency | default `INR` |
| status | `PENDING`, `SUCCESS`, `FAILED`, `CANCELLED`, `EXPIRED` |
| gateway | `RAZORPAY` (extensible) |
| gatewayOrderId | Razorpay order id |
| gatewayPaymentId | set after success |
| gatewaySignature | optional store for audit |
| receiptNumber | filled after FeePayment created |
| feePaymentId | FK to `FeePayment` when success |
| createdByUserId | parent/student/staff user |
| items (JSON or child table) | assignmentId + amount |
| metadata | raw gateway payload refs |
| createdAt / updatedAt | |

### Existing tables (reuse)
- `FeePayment` — final accounting record (`paymentMode = ONLINE`, `status = COLLECTED`)
- `FeePaymentItem` — allocation to fee assignments
- `ErpIntegrationSetting` — provider + encrypted key/secret/webhook secret
- `TenantPaymentMethod` — optional display of enabled methods

### Status mapping

| Online order | FeePayment |
|--------------|------------|
| PENDING | none |
| SUCCESS | created COLLECTED |
| FAILED / CANCELLED / EXPIRED | none |

---

## 10. API design (proposed)

### Authenticated (portal / campus)
- `POST /api/v1/fees/online/orders`  
  Create order + return checkout payload
- `GET /api/v1/fees/online/orders/:id`  
  Get order status for UI polling
- `GET /api/v1/fees/online/config`  
  Public checkout key / enabled flag for tenant (no secrets)

### Public webhook (no user JWT)
- `POST /api/v1/webhooks/razorpay`  
  Raw body + signature header verification

### Keep existing
- `POST /api/v1/fees/payments` — office collection only  
- Revert flow remains staff-controlled; online refunds are later phase

---

## 11. Backend module plan

```text
src/modules/fees/
  fees.service.ts              (existing collect/dues)
  online-payments.service.ts   (NEW: create order, capture)
  online-payments.controller.ts
  providers/
    payment-provider.ts        (interface)
    razorpay.provider.ts       (NEW)
    stripe.provider.ts         (FUTURE)

src/routes/
  webhooks/index.ts            (NEW public webhook router)
```

### Provider adapter interface (so UI changes don’t force rewrite)
- `createOrder(amount, currency, receipt, notes)`
- `verifyWebhook(signature, rawBody)`
- `fetchPayment(paymentId)` (fallback reconciliation)

---

## 12. Frontend plan (after UI confirmation)

### Portal
- Fees page: show outstanding + **Pay now**
- Item selection (full or partial — confirm with product)
- Open Razorpay Checkout
- Success/pending/failure screens
- Refresh dues + show receipt when order SUCCESS

### Campus (optional v1.1)
- “Generate online payment” action on student dues
- Copy link / notify parent

### Super Admin / ERP settings
- Enable online payments per tenant
- Store Key ID / Key Secret / Webhook Secret (encrypted)
- Test vs Live mode flag

**Note:** Do not hardcode button placement until school management UI is finalized.

---

## 13. Configuration

### Development / staging
```env
# Example — exact names to finalize during implementation
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx
# Or per-tenant via ERP encrypted secrets (preferred for multi-school SaaS)
```

### Production
- Company Razorpay/AWS account (not personal)
- Live keys in server env / secret manager
- Webhook URL must be public HTTPS endpoint

### Local webhook testing
- Use Razorpay test mode + tunnel (ngrok / Cloudflare Tunnel) to `localhost:4000`

---

## 14. Implementation phases

### Phase 0 — Wait for UI confirmation (current)
- No payment coding until school management UI is confirmed
- Avoid rework on checkout entry points and fee screens

### Phase A — Backend foundation
1. Migration for `online_fee_orders`
2. Razorpay provider adapter
3. Create-order API
4. Webhook API + signature verify + idempotency
5. On success → create `FeePayment` / items / receipt
6. Integration tests with mocked Razorpay

### Phase B — Portal UI
1. Pay now on confirmed Fees UI
2. Checkout integration
3. Pending/success/failure states
4. Receipt visibility

### Phase C — Operations hardening
1. ERP UI for gateway keys per school
2. Reconciliation job (fetch unsettled PENDING orders)
3. Admin view of online orders / failures
4. Basic alerts on webhook verify failures

### Phase D — Production cutover
1. Company Razorpay live account
2. Webhook HTTPS endpoint
3. Go-live checklist + monitoring

---

## 15. Security & compliance checklist

- [ ] Secrets never returned by API
- [ ] Secrets encrypted at rest
- [ ] Webhook signature mandatory
- [ ] Idempotent webhook handler
- [ ] Tenant scoping on all reads/writes
- [ ] Amount server-calculated (client cannot inflate/reduce unpaid beyond due rules)
- [ ] HTTPS only in production
- [ ] PCI: do not store card numbers (Razorpay handles card UI)
- [ ] Audit trail for money movement

---

## 16. Test plan

### Unit / integration
- Create order rejects amount > due
- Webhook with invalid signature → 401/400
- Valid success webhook → FeePayment created once
- Duplicate webhook → no double collection
- Failed payment → no FeePayment

### Manual (Razorpay test mode)
1. Seed student with dues
2. Parent login → Pay now
3. Pay with test UPI/card
4. Confirm webhook received in API logs
5. Confirm dues reduced + receipt exists
6. Confirm campus Fees/receipts show ONLINE payment

---

## 17. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| UI changes after coding | Wait for UI confirmation (Phase 0) |
| Webhook delayed | UI polling + reconciliation job |
| Double charge / double post | Idempotency keys + unique gateway payment id |
| Wrong tenant credentials | Per-tenant secrets + explicit tenant on order |
| Local storage/email confusion | Payments independent of S3/SMTP; use test gateway keys |

---

## 18. Team split suggestion

| Person | Ownership |
|--------|-----------|
| Backend (Anwin) | Orders, Razorpay adapter, webhook, FeePayment posting |
| Frontend (Suja) | Pay now UI, checkout, status screens (after UI lock) |
| Team lead / company | Razorpay account, production keys, webhook domain |

Use branches: `branchAnwin-payments`, `branchSuja-payments-ui` → PR to `main`.

---

## 19. Success criteria (v1 done)

- Parent can pay at least one due online in test mode
- Webhook verified and fee marked collected automatically
- Receipt number generated like normal fee collection
- Campus reports include online collections
- Cash collection still works without gateway
- No secrets in git; config via `.env` / ERP settings

---

## 20. Decision log (fill during confirmation)

| Decision | Choice | Date | By |
|----------|--------|------|----|
| Gateway | Razorpay (proposed) | TBD | |
| First payer UX | Parent portal (proposed) | TBD | |
| Partial online pay | TBD | TBD | |
| Keys storage | ERP per tenant vs platform env | TBD | |
| UI confirmation | Waiting | 2026-07-23 | School management UI |

---

## 21. Next action

1. Wait for **school management UI confirmation**
2. Confirm gateway = Razorpay (or change)
3. Start **Phase A** on `branchAnwin-payments`
4. Then Phase B with frontend after UI lock

Until then: keep using current office fee collection; SMTP and local file storage remain as already delivered.
