/**
 * Fix hamidaimaq@gmail.com — overcredited months from frequency switch
 *
 * What happened:
 *   1. Member was monthly ($40/mo). Had 60 paid_months, next_payment_due 2026-04-14.
 *   2. Admin switched frequency to annual to record a cash payment.
 *   3. Admin recorded $40 cash (intended as 1 month) — but system credited 12 months
 *      because frequency was now annual. next_payment_due jumped to 2027-04-14.
 *   4. Admin then recorded $480 cash (actual annual payment) — another 12 months credited.
 *      next_payment_due jumped to 2028-04-14. paid_months now 84.
 *
 * Fix:
 *   - Delete the erroneous $40 payment (it was 1 month at monthly rate, overcredited as 12)
 *   - Revert paid_months: 84 → 72 (60 original + 12 from the real $480 annual)
 *   - Revert next_payment_due: 2028-04-14 → 2027-04-14
 *
 * Usage:
 *   npx tsx scripts/fix-hamidaimaq-next-payment-due.ts              # Dry run
 *   npx tsx scripts/fix-hamidaimaq-next-payment-due.ts --execute    # Apply
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ─── Load .env.local ────────────────────────────────────────────────────────
function loadEnvFile(): void {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        const value = valueParts.join("=").replace(/^["']|["']$/g, "");
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnvFile();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DRY_RUN = !process.argv.includes("--execute");
const MEMBER_EMAIL = "hamidaimaq@gmail.com";

function log(msg: string) {
  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}${msg}`);
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Fix hamidaimaq@gmail.com — overcredited months             ║");
  console.log(`║  Mode: ${DRY_RUN ? "DRY RUN (use --execute to apply)" : "⚡ EXECUTING CHANGES ⚡"}${"".padEnd(DRY_RUN ? 15 : 18)}║`);
  console.log("╚══════════════════════════════════════════════════════════════╝");

  // Step 1: Look up the member
  const { data: member, error: memberErr } = await supabase
    .from("members")
    .select("*")
    .eq("email", MEMBER_EMAIL)
    .single();

  if (memberErr || !member) {
    console.error(`Member not found: ${MEMBER_EMAIL}`, memberErr?.message);
    process.exit(1);
  }

  console.log(`\n  Member: ${member.first_name} ${member.last_name}`);
  console.log(`  Member ID: ${member.id}`);

  // Step 2: Get membership
  const { data: membership, error: mErr } = await supabase
    .from("memberships")
    .select("*, plan:plans(*)")
    .eq("member_id", member.id)
    .single();

  if (mErr || !membership) {
    console.error(`Membership not found`, mErr?.message);
    process.exit(1);
  }

  const plan = Array.isArray(membership.plan) ? membership.plan[0] : membership.plan;

  console.log(`  Membership ID: ${membership.id}`);
  console.log(`  Plan: ${plan?.name}`);
  console.log(`  Billing Frequency: ${membership.billing_frequency}`);
  console.log(`  Paid Months: ${membership.paid_months}`);
  console.log(`  Next Payment Due: ${membership.next_payment_due}`);
  console.log(`  Auto-pay: ${membership.auto_pay_enabled}`);

  // Step 3: Show all payments
  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .eq("membership_id", membership.id)
    .order("created_at", { ascending: true });

  console.log(`\n  ── Payment History (${payments?.length || 0} records) ──`);
  for (const p of payments || []) {
    console.log(
      `  ${p.id.slice(0, 8)}.. | ${p.created_at?.slice(0, 10)} | ${String(p.type).padEnd(15)} | ` +
      `${String(p.method || "n/a").padEnd(8)} | $${String(p.amount).padStart(7)} | ` +
      `${p.months_credited || 0} mo | ${String(p.status).padEnd(10)} | ${p.period_label || ""}`
    );
  }

  // Step 4: Identify the erroneous $40 payment
  const erroneousPayment = (payments || []).find(
    (p) =>
      p.amount === 40 &&
      p.months_credited === 12 &&
      p.method === "cash" &&
      p.status === "completed"
  );

  if (!erroneousPayment) {
    console.log("\n  Could not find the erroneous $40/12-month cash payment.");
    console.log("  The data may have already been fixed, or the scenario is different than expected.");
    console.log("  Review the payment history above manually.");
    return;
  }

  console.log(`\n  ── Erroneous Payment Found ──`);
  console.log(`  ID: ${erroneousPayment.id}`);
  console.log(`  Date: ${erroneousPayment.created_at?.slice(0, 10)}`);
  console.log(`  Amount: $${erroneousPayment.amount} (monthly rate, but credited as annual = 12 months)`);
  console.log(`  Period: ${erroneousPayment.period_label}`);

  // Step 5: Calculate corrections
  const correctPaidMonths = (membership.paid_months || 0) - 12; // Remove the 12 overcredited months
  const correctNextPaymentDue = "2027-04-14"; // Roll back 12 months from 2028-04-14

  console.log(`\n  ── Planned Corrections ──`);
  console.log(`  1. Delete erroneous $40 payment (ID: ${erroneousPayment.id})`);
  console.log(`  2. paid_months: ${membership.paid_months} → ${correctPaidMonths}`);
  console.log(`  3. next_payment_due: ${membership.next_payment_due} → ${correctNextPaymentDue}`);

  if (DRY_RUN) {
    log("\nNo changes applied. Run with --execute to apply.");
    return;
  }

  // Step 6: Delete the erroneous payment
  const { error: deleteErr } = await supabase
    .from("payments")
    .delete()
    .eq("id", erroneousPayment.id);

  if (deleteErr) {
    console.error(`Failed to delete payment: ${deleteErr.message}`);
    process.exit(1);
  }
  log(`✓ Deleted erroneous payment ${erroneousPayment.id}`);

  // Step 7: Correct the membership
  const { error: updateErr } = await supabase
    .from("memberships")
    .update({
      paid_months: correctPaidMonths,
      next_payment_due: correctNextPaymentDue,
      updated_at: new Date().toISOString(),
    })
    .eq("id", membership.id);

  if (updateErr) {
    console.error(`Failed to update membership: ${updateErr.message}`);
    process.exit(1);
  }

  log(`✓ Updated paid_months: ${membership.paid_months} → ${correctPaidMonths}`);
  log(`✓ Updated next_payment_due: ${membership.next_payment_due} → ${correctNextPaymentDue}`);

  console.log("\nDone. Verify in the admin dashboard.");
}

main().catch(console.error);
