# TODO

## Platform Fee Migration (biannual/annual subs)
New fees are LIVE: monthly=$2, biannual=$9, annual=$12. New signups get the right fee automatically.

8 existing biannual/annual subs have the old $2 fee baked into their Stripe subscription price. Need to cancel old sub → create new sub with correct price before their next invoice fires.

**Biannual (2) — old price has $2 fee, should be $9:**
- `45097427` — sub_1T3J9D... ($240 dues)
- `a9c0126f` — sub_1T382l... ($120 dues)

**Annual (6) — old price has $2 fee, should be $12:**
- `76428a9a` — sub_1Szr6W... ($20 dues)
- `ea4fecab` — sub_1T1M8a... ($480 dues)
- `5119c1c9` — sub_1T1tF4... ($480 dues)
- `f203fa9d` — sub_1T1Xft... ($40 dues)
- `1e972268` — sub_1T2xUp... ($480 dues)
- `49ae93ce` — sub_1T3R2C... ($480 dues)

**Migration steps per member:**
1. Cancel old Stripe subscription immediately
2. Create new subscription with new fee baked into price
3. Set trial_end to next_payment_due so they aren't double-charged
4. Update membership record with new stripe_subscription_id

Monthly members (26) and pending members — no action needed.

---

## Pending
- [ ] Send email to member when pausing/resuming their subscription
- [ ] Track reminder count in memberships table (payments.ts:697)
- [ ] Calculate MRR from active memberships (payments.ts:823)
- [ ] Portal payments page (/portal/payments): Add CSV export for payment history
- [ ] Portal payments page (/portal/payments): Download/view receipts instead of print
- [ ] Create/consider a payment reminder email for manual paying members on onboarding payments page (/payments?tab=onboarding)
