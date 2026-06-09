/**
 * One-off recovery for the 2026-06-05 Jumuah terminal enrollments that were
 * charged on the WisePOS but never got a membership/subscription, due to the
 * setup_future_usage bug (fixed in f3e8203).
 *
 * For each member this records the already-collected in-person payment(s) and
 * settles them through the REAL billing engine (settlePayment) — crediting
 * months, setting next_payment_due, and activating the membership. The recurring
 * auto-pay link is sent separately via the /api/stripe/send-payment-setup
 * endpoint (run after this, with next_payment_due now in the future so the
 * subscription's first charge is deferred and they are NOT double-charged).
 *
 * Run:  NODE_ENV=development npx tsx --conditions=react-server --tsconfig tsconfig.json scripts/recover-jumuah-terminal.ts
 *
 * Re-run safe: skips any member that already has a recovery payment recorded.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

import { settlePayment } from "@/lib/billing/engine";
import {
  generateAdHocInvoiceMetadata,
  getTodayInOrgTimezone,
  parseDateInOrgTimezone,
} from "@/lib/billing/invoice-generator";

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const [k, ...v] = t.split("=");
    const val = v.join("=").replace(/^["']|["']$/g, "");
    if (k && !process.env[k]) process.env[k] = val;
  }
}
loadEnvFile();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
) as SupabaseClient;

const ORG_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const RECOVERY_MARKER = "[jumuah-2026-06-05 terminal recovery]";

interface Target {
  label: string;
  membershipId: string;
  paymentIntentId: string;
  duesAmount: number;
  monthsCredited: number;
  enrollmentFee?: number;
}

const TARGETS: Target[] = [
  {
    label: "Muhammad Maaz (Single/monthly)",
    membershipId: "307a4d48-33ed-4099-9810-893efa5a6696",
    paymentIntentId: "pi_3Tf5c505kFZ1PDWv09UodTId",
    duesAmount: 20,
    monthsCredited: 1,
  },
  {
    label: "Faheem Yunus (Married/annual + enroll fee)",
    membershipId: "bf1c46be-536c-4e71-872a-0fc4f275a9bc",
    paymentIntentId: "pi_3Tf57r05kFZ1PDWv0YOVSOQk",
    duesAmount: 480,
    monthsCredited: 12,
    enrollmentFee: 500,
  },
  {
    label: "Mohammad Hazrat Mansoori (Married/biannual)",
    membershipId: "d9239b44-b061-4b68-8bce-9cdd12e6c2e7",
    paymentIntentId: "pi_3Tf4VJ05kFZ1PDWv03eKe4Rm",
    duesAmount: 240,
    monthsCredited: 6,
  },
];

async function insertAndSettle(opts: {
  membershipId: string;
  memberId: string;
  type: "dues" | "enrollment_fee";
  amount: number;
  monthsCredited: number;
  paymentIntentId: string;
  invoiceMeta: {
    invoiceNumber: string | null;
    dueDate: string;
    periodStart: string;
    periodEnd: string;
    periodLabel: string;
  };
}) {
  const notes = `${RECOVERY_MARKER} ${opts.type} — in-person WisePOS ${opts.paymentIntentId}`;
  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      organization_id: ORG_ID,
      membership_id: opts.membershipId,
      member_id: opts.memberId,
      type: opts.type,
      method: "stripe",
      status: "pending",
      amount: opts.amount,
      stripe_fee: 0,
      platform_fee: 0,
      total_charged: opts.amount,
      net_amount: opts.amount,
      months_credited: opts.type === "enrollment_fee" ? 0 : opts.monthsCredited,
      invoice_number: opts.invoiceMeta.invoiceNumber,
      due_date: opts.invoiceMeta.dueDate,
      period_start: opts.invoiceMeta.periodStart,
      period_end: opts.invoiceMeta.periodEnd,
      period_label: opts.invoiceMeta.periodLabel,
      stripe_payment_intent_id: opts.paymentIntentId,
      stripe_payment_method_type: "card_present",
      notes,
    })
    .select()
    .single();

  if (error || !payment) throw new Error(`insert failed: ${error?.message}`);

  const result = await settlePayment({
    paymentId: payment.id,
    method: "stripe",
    paidAt: new Date().toISOString(),
    notes,
    supabase,
  });
  if (!result.success) throw new Error(`settle failed: ${result.error}`);
  return { paymentId: payment.id, result };
}

async function main() {
  for (const t of TARGETS) {
    console.log(`\n━━━ ${t.label} ━━━`);

    // Re-run guard
    const { data: existing } = await supabase
      .from("payments")
      .select("id")
      .eq("membership_id", t.membershipId)
      .ilike("notes", `%${RECOVERY_MARKER}%`)
      .limit(1);
    if (existing && existing.length) {
      console.log("  ⏭  already recovered — skipping");
      continue;
    }

    const { data: m, error: mErr } = await supabase
      .from("memberships")
      .select("member_id, status, auto_pay_enabled, stripe_subscription_id, subscription_status, billing_anniversary_day, next_payment_due, paid_months")
      .eq("id", t.membershipId)
      .single();
    if (mErr || !m) {
      console.log(`  ✗ membership not found: ${mErr?.message}`);
      continue;
    }
    if (m.auto_pay_enabled && m.stripe_subscription_id &&
        ["active", "trialing", "past_due"].includes(m.subscription_status || "")) {
      console.log("  ✗ has active subscription — refusing (would double-bill)");
      continue;
    }

    const { data: org } = await supabase
      .from("organizations").select("timezone").eq("id", ORG_ID).single();
    const tz = org?.timezone || "America/Los_Angeles";
    const today = getTodayInOrgTimezone(tz);

    // Billing anchor (mirror /api/payments/record scenario 2b)
    let billingAnchor: string;
    if (m.next_payment_due && /^\d{4}-\d{2}-\d{2}$/.test(m.next_payment_due)) {
      billingAnchor = m.next_payment_due;
    } else if (m.billing_anniversary_day) {
      const d = parseDateInOrgTimezone(today, tz);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const day = Math.min(m.billing_anniversary_day, lastDay);
      billingAnchor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    } else {
      billingAnchor = today;
    }

    // Enrollment fee first (no months credited)
    if (t.enrollmentFee && t.enrollmentFee > 0) {
      await insertAndSettle({
        membershipId: t.membershipId,
        memberId: m.member_id,
        type: "enrollment_fee",
        amount: t.enrollmentFee,
        monthsCredited: 0,
        paymentIntentId: t.paymentIntentId,
        invoiceMeta: {
          invoiceNumber: null,
          dueDate: today,
          periodStart: today,
          periodEnd: today,
          periodLabel: "Enrollment Fee",
        },
      });
      await supabase.from("memberships")
        .update({ enrollment_fee_status: "paid", updated_at: new Date().toISOString() })
        .eq("id", t.membershipId);
      console.log(`  ✓ enrollment fee $${t.enrollmentFee} recorded + marked paid`);
    }

    // Dues
    const invoiceMeta = await generateAdHocInvoiceMetadata(
      ORG_ID, billingAnchor, t.monthsCredited, tz, supabase
    );
    const { result } = await insertAndSettle({
      membershipId: t.membershipId,
      memberId: m.member_id,
      type: "dues",
      amount: t.duesAmount,
      monthsCredited: t.monthsCredited,
      paymentIntentId: t.paymentIntentId,
      invoiceMeta,
    });
    console.log(`  ✓ dues $${t.duesAmount} (${t.monthsCredited} mo) recorded + settled`);
    console.log(`     status=${result.newStatus} paid_months=${result.newPaidMonths} eligible=${result.becameEligible}`);
  }

  console.log("\n✅ Record+settle complete. Next: send setup links via the API endpoint.");
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
