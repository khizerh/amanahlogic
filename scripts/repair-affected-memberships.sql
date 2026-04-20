-- ============================================================================
-- Repair memberships left in a broken state by the "[object Object]" webhook
-- failures on customer.subscription.created/updated events.
--
-- Context:
--   The stripe webhook handler re-threw supabase PostgrestErrors, which aren't
--   Error subclasses, so the catch block serialized them as literally
--   "[object Object]". 15 events failed silently (9 have now aged out of Stripe
--   retention). Meanwhile the idempotency check short-circuited on any prior
--   row including 'failed', so Stripe redelivery could never recover.
--
-- Actual findings for each affected membership after cross-checking with Stripe:
--   ✓ Wais, Qais, Habiba, Noor, Mohammad Amin   → DB matches Stripe, no action
--   ✓ Zahuran Mohammed                          → abandoned enrollment, no action
--   ✗ Sabba Atai       → DB missing sub_id; Stripe has monthly sub but with a
--                        BOGUS 1-year trial (trial_end=2027-02-13). She has NOT
--                        been billed for 2 months and won't be billed for 10
--                        more unless we also fix Stripe-side. See note below.
--   ✗ Nazrul Hussein   → DB missing sub_id; Stripe has annual sub in legit
--                        trialing state until 2027-03-01 (normal pattern for
--                        prepaid annual members). DB-only fix suffices.
--   ✗ Hedayat Hamid    → sub_id correct, just subscription_status stuck at NULL.
-- ============================================================================

BEGIN;

-- Nazrul Hussein — link the annual subscription that was created 2026-03-03
UPDATE memberships
SET stripe_subscription_id = 'sub_1T70cU05kFZ1PDWv3URhrrKf',
    subscription_status = 'trialing',
    auto_pay_enabled = TRUE,
    updated_at = NOW()
WHERE id = '7d2ff833-1e2b-4a63-aa9d-bdb44d472f9f'
  AND stripe_subscription_id IS NULL;  -- guard against re-run

-- Hedayat Hamid — cosmetic: fill in subscription_status
UPDATE memberships
SET subscription_status = 'trialing',
    auto_pay_enabled = TRUE,
    updated_at = NOW()
WHERE id = '2596d912-686e-4d92-b8ef-de147e871f2a'
  AND stripe_subscription_id = 'sub_1TLtw705kFZ1PDWvHKKmSxld'
  AND subscription_status IS NULL;

-- Sabba Atai — link the monthly sub so the DB reflects reality.
-- WARNING: this alone does NOT fix the billing problem. Her Stripe sub has
-- trial_end=2027-02-13 (one full year) on a MONTHLY plan, so she will not be
-- charged anything for ~10 more months. To actually start billing her, run one
-- of the following in Stripe AFTER this SQL:
--
--   (a) End trial immediately and start billing now:
--       stripe.subscriptions.update(
--         "sub_1T2uJT05kFZ1PDWvC2UY0TLc",
--         { trial_end: "now", proration_behavior: "none" }
--       )
--   (b) Cancel and recreate the sub with correct monthly trial_end (e.g. the
--       13th or whatever her billing_anniversary_day is).
--
-- After fixing trial_end on Stripe, set next_payment_due on the membership
-- row accordingly. Leaving next_payment_due=2027-02-13 for now because that
-- matches the current (broken) Stripe state.
UPDATE memberships
SET stripe_subscription_id = 'sub_1T2uJT05kFZ1PDWvC2UY0TLc',
    subscription_status = 'trialing',
    auto_pay_enabled = TRUE,
    updated_at = NOW()
WHERE id = '997e937a-cf81-4fcf-8233-bc99782d0d38'
  AND stripe_subscription_id IS NULL;

-- Verify — 3 rows expected
SELECT id,
       (SELECT first_name||' '||last_name FROM members WHERE id = memberships.member_id) AS name,
       stripe_subscription_id,
       subscription_status,
       last_payment_date,
       next_payment_due
FROM memberships
WHERE id IN (
  '7d2ff833-1e2b-4a63-aa9d-bdb44d472f9f',
  '2596d912-686e-4d92-b8ef-de147e871f2a',
  '997e937a-cf81-4fcf-8233-bc99782d0d38'
);

COMMIT;
