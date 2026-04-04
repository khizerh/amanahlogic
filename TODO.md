# TODO

## Platform Fee Migration (biannual/annual subs) — COMPLETED
All 8 subscriptions migrated. Old subs cancelled, new subs created with correct pricing.

Last 2 fixed (2026-04-04):
- `76428a9a` (Habiba Kochi) — was $22.97/mo, now sub_1TIcrt... at $259.84/yr. Fixed overcredited paid_months (73→62).
- `f203fa9d` (Noor Jabbar) — was $43.57/mo, now sub_1TIctA... at $507.01/yr. Fixed overcredited paid_months (73→62). Set Jan-Jan billing cycle (trial until Jan 2027).

---

## Pending
- [ ] Send email to member when pausing/resuming their subscription
- [ ] Track reminder count in memberships table (payments.ts:697)
- [ ] Calculate MRR from active memberships (payments.ts:823)
- [ ] Portal payments page (/portal/payments): Add CSV export for payment history
- [ ] Portal payments page (/portal/payments): Download/view receipts instead of print
- [ ] Create/consider a payment reminder email for manual paying members on onboarding payments page (/payments?tab=onboarding)
