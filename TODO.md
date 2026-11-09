# TODO

## Platform Fee Migration (biannual/annual subs) — COMPLETED
All 8 subscriptions migrated. Old subs cancelled, new subs created with correct pricing.

Last 2 fixed (2026-04-04):
- `76428a9a` (Habiba Kochi) — was $22.97/mo, now sub_1TIcrt... at $259.84/yr. Fixed overcredited paid_months (73→62).
- `f203fa9d` (Noor Jabbar) — was $43.57/mo, now sub_1TIctA... at $507.01/yr. Fixed overcredited paid_months (73→62). Set Jan-Jan billing cycle (trial until Jan 2027).

---

## Open as of 2026-11-09 (parked — nothing in flight)

### Money (Khizer's, not Mohib's)
- [ ] **Collect $959.02 from Muhajireen.** Three refunds were paid out of the Amanah Logic Stripe
      balance without reversing the transfer to the masjid, so the masjid kept the original payment:
      Mohammad Kochi dupe charge, $260 + $247.01 (Mar 2026, ch_3T7gaC05kFZ1PDWv0ZqRmQUZ);
      ACH "Subscription creation" $427.01 (2026-04-06, py_3TIupc05kFZ1PDWv0NOGW2ZT);
      $25 partial refund on a Qur'anic study charge (Sep 2025).
      Options: Stripe transfer reversal / connected-account debit, or Mohib Zelles it.
- [ ] **Refund path must always reverse the transfer** (`reverse_transfer: true` + refund the
      application fee) so this can't recur. ~1 hour. The other 6 refunds were done correctly.
- [ ] Ledger has zero `refunded` payments; none of the 10 Stripe refunds exist in the DB.
- [ ] Stripe side fees nobody passes through: ~$60/mo (Billing usage, Connect volume/payout/active).
      Cash members (a third of dues volume) pay $0 platform fee. Economics, not a bug.

### Mohib's site list — remaining
- [ ] Revised agreement PDFs (English + Dari, "Revised November 2026"): WAITING ON MOHIB to send.
      He uploads them himself in Settings → agreements; no code. Open question for his board:
      do existing (~96) members re-sign the new terms, or new signers only.
- [ ] Unified Sign In page (member + admin, route by role). Do it WITHOUT his org dropdown.
      Half-day to a day. Members hitting /dashboard today get an error page, not data — ugly, not a leak.
      Low priority: the Sign In button already works.
- [ ] SKIPPED by Khizer (2026-11-09): agreement text on /join, checkbox-as-signature, Continue
      gating on checkbox, one-email onboarding. Revisit only if the paid-but-never-signed gap hurts.
- [ ] Demo org with fake data for showing other masajid (asked weeks ago; more relevant now that
      /request-demo is live). ~1 day. Only worth it if Amanah is meant to grow past one customer.
- [ ] Confirm support@amanahlogic.com is actually read — /request-demo emails land there unless
      `DEMO_REQUEST_TO` is set in Vercel (comma-separated). Rows also persist in `demo_requests`.
- [ ] Mohib's 20 existing sponsorships still need `payer_relationship` set (his call, college kids only).

### Shipped 2026-11-09 (for context)
- Public site revamp f5c259f: homepage org picker, /join short URL, /request-demo + `demo_requests`
  table, shared SiteNav/SiteFooter, plots removed, dupe login link removed.
- Auto-lapse ON, lapseDays 7→180 (revised bylaws: suspension at 6 months unpaid). Set via SQL on
  `organization_settings.billing_config`; no settings UI. First to lapse: Naazi Karim, Feroz Muntazir.
- QR code for amanahlogic.com/join generated (scratchpad, temporary) — regenerate with
  `npx -y qrcode -t png -w 1200 -o join-qr.png https://www.amanahlogic.com/join` if needed.

---

## Pending
- [ ] Send email to member when pausing/resuming their subscription
- [ ] Track reminder count in memberships table (payments.ts:697)
- [ ] Calculate MRR from active memberships (payments.ts:823)
- [ ] Portal payments page (/portal/payments): Add CSV export for payment history
- [ ] Portal payments page (/portal/payments): Download/view receipts instead of print
- [ ] Create/consider a payment reminder email for manual paying members on onboarding payments page (/payments?tab=onboarding)
