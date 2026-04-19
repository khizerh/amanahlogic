/**
 * Backfill missing subscription payment records after the Stripe-API-shape bug.
 *
 * Context:
 *   API version 2026-02-25.clover moved invoice.subscription / invoice.payment_intent
 *   under invoice.parent.subscription_details.* and invoice.payments.data[].payment.*.
 *   route.ts used the legacy paths, so handleInvoicePaid / handleInvoiceFailed bailed
 *   without creating payment records from Feb onwards. `paid_months` stopped
 *   incrementing and `next_payment_due` stopped advancing. No receipts were sent.
 *
 * This script re-creates the missing payment records by:
 *   1. Finding every membership with a stripe_subscription_id
 *   2. Listing its Stripe invoices since Feb 1, 2026
 *   3. For any paid invoice without a matching DB payment:
 *      - Insert a pending dues payment row with full metadata
 *      - Call settlePayment() to advance paid_months + next_payment_due and send receipt
 *   4. For any failed invoice without a matching DB failed row:
 *      - Insert a failed dues payment row for audit trail
 *
 * Usage:
 *   npx tsx scripts/backfill-subscription-payments.ts                # dry run
 *   npx tsx scripts/backfill-subscription-payments.ts --sql          # dry run + print SQL
 *   npx tsx scripts/backfill-subscription-payments.ts --execute      # apply
 *   npx tsx scripts/backfill-subscription-payments.ts --execute --no-receipts
 *   npx tsx scripts/backfill-subscription-payments.ts --only <membership-id>
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import * as fs from "fs";
import * as path from "path";

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

const EXECUTE = process.argv.includes("--execute");
const PRINT_SQL = process.argv.includes("--sql");
const SKIP_RECEIPTS = process.argv.includes("--no-receipts");
const onlyArgIdx = process.argv.indexOf("--only");
const ONLY_MEMBERSHIP = onlyArgIdx >= 0 ? process.argv[onlyArgIdx + 1] : null;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
) as SupabaseClient;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

// ── helpers mirroring route.ts so we don't import server-only code ────────────
type InvLike = Stripe.Invoice & {
  parent?: {
    subscription_details?: {
      subscription?: string | { id: string } | null;
      metadata?: Record<string, string> | null;
    } | null;
  } | null;
  payments?: {
    data?: Array<{
      payment?: {
        payment_intent?: string | { id: string; payment_method?: string | { id: string } | null } | null;
      } | null;
    }>;
  } | null;
};

function extractSubId(inv: InvLike): string | null {
  const n = inv.parent?.subscription_details?.subscription;
  if (typeof n === "string") return n;
  if (n && typeof n === "object" && "id" in n) return n.id;
  const legacy = (inv as unknown as { subscription?: string | { id: string } }).subscription;
  if (typeof legacy === "string") return legacy;
  if (legacy && typeof legacy === "object" && "id" in legacy) return legacy.id;
  return null;
}
function extractSubMetadata(inv: InvLike): Record<string, string> {
  const legacy = (inv as unknown as { subscription_details?: { metadata?: Record<string, string> } }).subscription_details?.metadata;
  return (legacy || inv.parent?.subscription_details?.metadata || {}) as Record<string, string>;
}
function extractLineMetadata(inv: InvLike): Record<string, string> {
  return ((inv.lines?.data?.[0] as { metadata?: Record<string, string> } | undefined)?.metadata || {});
}
function extractPiId(inv: InvLike): string | null {
  const legacy = (inv as unknown as { payment_intent?: string | { id: string } }).payment_intent;
  if (typeof legacy === "string") return legacy;
  if (legacy && typeof legacy === "object" && "id" in legacy) return legacy.id;
  for (const p of inv.payments?.data || []) {
    const pi = p.payment?.payment_intent;
    if (typeof pi === "string") return pi;
    if (pi && typeof pi === "object" && "id" in pi) return pi.id;
  }
  return null;
}

// ── fee math (mirrors src/lib/stripe/index.ts) ────────────────────────────────
interface FeeBreakdown {
  chargeAmountCents: number;
  baseAmountCents: number;
  stripeFeeCents: number;
  platformFeeCents: number;
  netAmountCents: number;
}
function reverseBase(chargeCents: number, platformDollars: number, passFees: boolean): number {
  const platformCents = Math.round(platformDollars * 100);
  if (passFees) {
    const baseCents = Math.floor(chargeCents * (1 - 0.029) - platformCents - 30);
    return Math.max(0, baseCents);
  }
  return Math.max(0, chargeCents - platformCents);
}
function calcFees(baseCents: number, platformDollars: number, passFees: boolean): FeeBreakdown {
  const platformCents = Math.round(platformDollars * 100);
  let chargeCents: number;
  let stripeFeeCents: number;
  let netCents: number;
  if (passFees) {
    chargeCents = Math.ceil((baseCents + platformCents + 30) / (1 - 0.029));
    stripeFeeCents = Math.round(chargeCents * 0.029) + 30;
    netCents = baseCents;
  } else {
    chargeCents = baseCents + platformCents;
    stripeFeeCents = Math.round(chargeCents * 0.029) + 30;
    netCents = baseCents - stripeFeeCents;
  }
  return { chargeAmountCents: chargeCents, baseAmountCents: baseCents, stripeFeeCents, platformFeeCents: platformCents, netAmountCents: netCents };
}

// ── date helpers ──────────────────────────────────────────────────────────────
function addMonthsPreserveDay(dateStr: string, months: number, day?: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const preferred = day || d;
  const total = m - 1 + months;
  const ty = y + Math.floor(total / 12);
  const tm = ((total % 12) + 12) % 12;
  const daysInMonth = new Date(ty, tm + 1, 0).getDate();
  const td = Math.min(preferred, daysInMonth);
  return `${ty}-${String(tm + 1).padStart(2, "0")}-${String(td).padStart(2, "0")}`;
}

function sqlStringify(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}
function insertSql(table: string, row: Record<string, unknown>): string {
  const cols = Object.keys(row);
  return `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map((c) => sqlStringify(row[c])).join(", ")});`;
}
function updateSql(table: string, updates: Record<string, unknown>, where: Record<string, unknown>): string {
  const set = Object.entries(updates).map(([k, v]) => `${k} = ${sqlStringify(v)}`).join(", ");
  const whereStr = Object.entries(where).map(([k, v]) => `${k} = ${sqlStringify(v)}`).join(" AND ");
  return `UPDATE ${table} SET ${set} WHERE ${whereStr};`;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Mode: ${EXECUTE ? "⚡ EXECUTE" : "DRY RUN"}${PRINT_SQL ? " + print SQL" : ""}${SKIP_RECEIPTS ? " + skip receipts" : ""}${ONLY_MEMBERSHIP ? ` + only ${ONLY_MEMBERSHIP}` : ""}`);
  console.log();

  // pull memberships with a stripe_subscription_id
  let all: Array<Record<string, unknown>> = [];
  let from = 0;
  const pageSize = 1000;
  for (;;) {
    const q = supabase
      .from("memberships")
      .select("id, member_id, organization_id, stripe_subscription_id, paid_months, next_payment_due, subscription_status, billing_frequency, billing_anniversary_day, last_payment_date, status, plan:plans(pricing, name), member:members!memberships_member_id_fkey(first_name, middle_name, last_name, email, preferred_language)")
      .not("stripe_subscription_id", "is", null)
      .range(from, from + pageSize - 1);
    const { data, error } = ONLY_MEMBERSHIP ? await q.eq("id", ONLY_MEMBERSHIP) : await q;
    if (error) { console.error("Query error:", error); process.exit(1); }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize || ONLY_MEMBERSHIP) break;
    from += pageSize;
  }

  const sqlLines: string[] = [];

  let totalPaidBackfilled = 0;
  let totalFailedBackfilled = 0;
  let totalMembershipsTouched = 0;

  for (const mRaw of all) {
    const m = mRaw as {
      id: string;
      member_id: string;
      organization_id: string;
      stripe_subscription_id: string;
      paid_months: number;
      next_payment_due: string;
      subscription_status: string | null;
      billing_frequency: string;
      billing_anniversary_day: number | null;
      last_payment_date: string | null;
      status: string;
      plan: { pricing: { monthly?: number; biannual?: number; annual?: number }; name: string } | null;
      member: { first_name: string; middle_name?: string | null; last_name: string; email: string | null; preferred_language?: string | null } | Array<{ first_name: string; middle_name?: string | null; last_name: string; email: string | null; preferred_language?: string | null }> | null;
    };
    const member = Array.isArray(m.member) ? m.member[0] : m.member;
    const plan = Array.isArray(m.plan) ? m.plan[0] : m.plan;
    const name = member ? `${member.first_name} ${member.last_name}` : "?";

    let invoices: Stripe.Invoice[];
    try {
      const list = await stripe.invoices.list({
        subscription: m.stripe_subscription_id,
        limit: 50,
        expand: ["data.payments"],
      });
      invoices = list.data;
    } catch (err) {
      console.log(`  ${m.id.slice(0, 8)} ${name}: Stripe list failed: ${err instanceof Error ? err.message : err}`);
      continue;
    }

    const threshold = Math.floor(new Date("2026-02-01").getTime() / 1000);
    const recent = invoices.filter((i) => i.created >= threshold).sort((a, b) => a.created - b.created);

    const missingPaid: InvLike[] = [];
    const missingFailed: InvLike[] = [];
    const stuckProcessing: Array<{ invoice: InvLike; rowId: string }> = [];

    for (const invRaw of recent) {
      const inv = invRaw as InvLike;
      const piId = extractPiId(inv);

      if (inv.status === "paid" && (inv.amount_paid || 0) > 0) {
        // Strategy: consider a DB payment "matching" this invoice if ANY of:
        //   - it has this invoice's PI on it (strongest),
        //   - it's a dues/enrollment row whose paid_at is within ±2d of invoice paid_at
        //     AND the amount roughly matches (excluding enrollment-fee rows from dues match),
        //   - it's a processing/pending dues row whose PI or inferred window matches
        //     (counts as "will settle", do not recreate).
        const paidAtUnix = inv.status_transitions?.paid_at || inv.created;
        const windowStart = new Date(paidAtUnix * 1000 - 86400 * 1000 * 2).toISOString();
        const windowEnd = new Date(paidAtUnix * 1000 + 86400 * 1000 * 3).toISOString();

        // 1. By PI
        let piMatches: Array<{ id: string; status: string; type: string }> = [];
        if (piId) {
          const { data: byPi } = await supabase
            .from("payments")
            .select("id, status, type")
            .eq("membership_id", m.id)
            .eq("stripe_payment_intent_id", piId)
            .limit(5);
          piMatches = byPi || [];
          const completed = piMatches.find((p) => p.type === "dues" && p.status === "completed");
          if (completed) continue;
          const stuck = piMatches.find((p) => p.type === "dues" && (p.status === "processing" || p.status === "pending"));
          if (stuck) {
            stuckProcessing.push({ invoice: inv, rowId: stuck.id });
            continue;
          }
        }

        // 2. By dues row in paid-at window (ignore enrollment-fee rows)
        const { data: byWindow } = await supabase
          .from("payments")
          .select("id, status, type, amount, paid_at, created_at, stripe_payment_intent_id")
          .eq("membership_id", m.id)
          .eq("type", "dues")
          .gte("paid_at", windowStart)
          .lte("paid_at", windowEnd);
        const matched = (byWindow || []).filter((p) => p.status === "completed" || p.status === "processing" || p.status === "pending");
        if (matched.some((p) => p.status === "completed")) continue;
        const stuckInWindow = matched.find((p) => p.status === "processing" || p.status === "pending");
        if (stuckInWindow) {
          stuckProcessing.push({ invoice: inv, rowId: stuckInWindow.id });
          continue;
        }

        missingPaid.push(inv);
      } else if (inv.status === "open" && inv.attempted) {
        // Failed invoice — dedup by PI first; otherwise by a failed dues row in date window.
        if (piId) {
          const { data: existingByPi } = await supabase
            .from("payments")
            .select("id")
            .eq("stripe_payment_intent_id", piId)
            .eq("status", "failed")
            .maybeSingle();
          if (existingByPi) continue;
        }
        const { data: existingFailed } = await supabase
          .from("payments")
          .select("id")
          .eq("membership_id", m.id)
          .eq("status", "failed")
          .eq("type", "dues")
          .gte("created_at", new Date(inv.created * 1000 - 86400 * 1000 * 2).toISOString())
          .lte("created_at", new Date(inv.created * 1000 + 86400 * 1000 * 20).toISOString())
          .limit(5);
        if ((existingFailed || []).length > 0) continue;
        missingFailed.push(inv);
      }
    }

    if (missingPaid.length === 0 && missingFailed.length === 0 && stuckProcessing.length === 0) continue;

    totalMembershipsTouched++;

    // Fetch org for fee config and timezone
    const { data: org } = await supabase
      .from("organizations")
      .select("id, timezone, platform_fees, pass_fees_to_member, name, slug, email")
      .eq("id", m.organization_id)
      .single();
    const platformFeeDollars = (org?.platform_fees as { monthly?: number; biannual?: number; annual?: number } | null)?.[m.billing_frequency as "monthly" | "biannual" | "annual"] || 0;
    const passFees = !!org?.pass_fees_to_member;
    const orgTz = org?.timezone || "America/Los_Angeles";

    console.log(`── ${m.id.slice(0, 8)} | ${name} | ${member?.email || "?"} | ${plan?.name} | freq ${m.billing_frequency} ──`);
    console.log(`  Current: paid_months=${m.paid_months}, next_due=${m.next_payment_due}, last_payment=${m.last_payment_date}, sub_status=${m.subscription_status}`);

    // PAID INVOICES — chronological so paid_months and next_due advance correctly
    let runningPaidMonths = m.paid_months || 0;
    let runningNextDue = m.next_payment_due;
    let runningLastPayment = m.last_payment_date;
    const anniversaryDay = m.billing_anniversary_day || (runningNextDue ? parseInt(runningNextDue.split("-")[2], 10) : 1);

    // STUCK PROCESSING — settle existing rows (don't create duplicates)
    for (const { invoice: inv, rowId } of stuckProcessing) {
      const paidAtUnix = inv.status_transitions?.paid_at || inv.created;
      const paidAtIso = new Date(paidAtUnix * 1000).toISOString();
      const piId = extractPiId(inv);

      let pmType: string | null = null;
      if (piId) {
        try {
          const pi = await stripe.paymentIntents.retrieve(piId);
          const pmRef = typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id;
          if (pmRef) {
            const pm = await stripe.paymentMethods.retrieve(pmRef);
            pmType = pm.type;
          }
        } catch { /* non-fatal */ }
      }

      // Fetch row to know months_credited & amount already stored
      const { data: existingRow } = await supabase
        .from("payments")
        .select("id, amount, months_credited, total_charged")
        .eq("id", rowId)
        .single();
      const monthsCredited = existingRow?.months_credited || 1;
      const newNextDue = addMonthsPreserveDay(runningNextDue, monthsCredited, anniversaryDay);

      console.log(`  ↻ SETTLE existing processing row ${rowId.slice(0, 8)} | inv ${inv.id} | paid ${paidAtIso.slice(0, 10)} | $${existingRow?.amount} × ${monthsCredited}mo`);
      console.log(`    paid_months ${runningPaidMonths} → ${runningPaidMonths + monthsCredited}, next_due ${runningNextDue} → ${newNextDue}`);

      if (PRINT_SQL) {
        sqlLines.push(`-- ${name} / ${m.id} — settle processing row ${rowId} for invoice ${inv.id}`);
        sqlLines.push(updateSql("payments", {
          status: "completed",
          paid_at: paidAtIso,
          stripe_payment_intent_id: piId,
          stripe_payment_method_type: pmType,
          updated_at: new Date().toISOString(),
        }, { id: rowId }));
      }

      if (EXECUTE) {
        const { error: upErr } = await supabase
          .from("payments")
          .update({
            status: "completed",
            paid_at: paidAtIso,
            stripe_payment_intent_id: piId,
            stripe_payment_method_type: pmType,
            updated_at: new Date().toISOString(),
          })
          .eq("id", rowId);
        if (upErr) { console.error(`    ✗ settle failed:`, upErr); continue; }
        console.log(`    ✓ settled`);

        const newPaidMonths = runningPaidMonths + monthsCredited;
        let newStatus = m.status;
        if (newStatus === "lapsed" || newStatus === "pending") newStatus = "current";
        const msUpdate: Record<string, unknown> = {
          paid_months: newPaidMonths,
          next_payment_due: newNextDue,
          status: newStatus,
          updated_at: new Date().toISOString(),
        };
        const paidDate = paidAtIso.slice(0, 10);
        if (!runningLastPayment || paidDate > runningLastPayment) {
          msUpdate.last_payment_date = paidDate;
        }
        const { error: mErr } = await supabase.from("memberships").update(msUpdate).eq("id", m.id);
        if (mErr) console.error(`    ✗ membership update failed:`, mErr);
        else console.log(`    ✓ membership updated`);

        if (!SKIP_RECEIPTS && member?.email) {
          try {
            const { sendPaymentReceiptEmail } = await import("../src/lib/email/send-payment-receipt");
            const pmLabel = pmType === "us_bank_account" ? "Bank Account" : "Credit Card";
            const paidDate = new Date(paidAtIso).toLocaleDateString("en-US", {
              year: "numeric", month: "long", day: "numeric", timeZone: orgTz,
            });
            const res = await sendPaymentReceiptEmail({
              to: member.email,
              memberId: m.member_id,
              memberName: [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(" "),
              organizationId: m.organization_id,
              amount: `$${(existingRow?.total_charged ?? existingRow?.amount ?? 0).toFixed(2)}`,
              paymentDate: paidDate,
              paymentMethod: pmLabel,
              periodLabel: "",
              language: (member.preferred_language as "en" | "fa") || "en",
            });
            console.log(`    ✉ receipt email: ${res.success ? "sent" : `FAILED (${res.error})`}`);
          } catch (err) {
            console.error(`    ✗ receipt email crashed:`, err instanceof Error ? err.message : err);
          }
        }
      }

      runningPaidMonths += monthsCredited;
      runningNextDue = newNextDue;
      const _paidDateStr = paidAtIso.slice(0, 10);
      if (!runningLastPayment || _paidDateStr > runningLastPayment) runningLastPayment = _paidDateStr;
      totalPaidBackfilled++;
    }

    for (const inv of missingPaid) {
      const paidAtUnix = inv.status_transitions?.paid_at || inv.created;
      const paidAtIso = new Date(paidAtUnix * 1000).toISOString();
      const piId = extractPiId(inv);

      // Fetch PM type
      let pmType: string | null = null;
      if (piId) {
        try {
          const pi = await stripe.paymentIntents.retrieve(piId);
          const pmRef = typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id;
          if (pmRef) {
            const pm = await stripe.paymentMethods.retrieve(pmRef);
            pmType = pm.type;
          }
        } catch { /* non-fatal */ }
      }

      const chargeCents = inv.amount_paid || 0;
      const baseCents = reverseBase(chargeCents, platformFeeDollars, passFees);
      const baseAmount = baseCents / 100;
      const fees = calcFees(baseCents, platformFeeDollars, passFees);

      // Determine months credited from base amount vs plan pricing
      let monthsCredited = 1;
      if (plan?.pricing) {
        if (plan.pricing.monthly && Math.abs(baseAmount - plan.pricing.monthly) < 1) monthsCredited = 1;
        else if (plan.pricing.biannual && Math.abs(baseAmount - plan.pricing.biannual) < 1) monthsCredited = 6;
        else if (plan.pricing.annual && Math.abs(baseAmount - plan.pricing.annual) < 1) monthsCredited = 12;
        else {
          switch (m.billing_frequency) {
            case "monthly": monthsCredited = 1; break;
            case "biannual": monthsCredited = 6; break;
            case "annual": monthsCredited = 12; break;
          }
        }
      }

      // Invoice metadata (period + label) — use paidAt as anchor
      const periodStart = paidAtIso.slice(0, 10);
      const periodEndDate = addMonthsPreserveDay(periodStart, monthsCredited, anniversaryDay);
      const periodLabel = (() => {
        const d = new Date(periodStart);
        const monthName = d.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
        if (monthsCredited === 1) return `${monthName} ${d.getUTCFullYear()}`;
        return `${monthsCredited} months starting ${monthName} ${d.getUTCFullYear()}`;
      })();

      const newNextDue = addMonthsPreserveDay(runningNextDue, monthsCredited, anniversaryDay);

      const paymentRow = {
        organization_id: m.organization_id,
        membership_id: m.id,
        member_id: m.member_id,
        type: "dues",
        method: "stripe",
        status: "completed",
        amount: baseAmount,
        stripe_fee: fees.stripeFeeCents / 100,
        platform_fee: fees.platformFeeCents / 100,
        total_charged: fees.chargeAmountCents / 100,
        net_amount: fees.netAmountCents / 100,
        months_credited: monthsCredited,
        period_start: periodStart,
        period_end: periodEndDate,
        period_label: periodLabel,
        stripe_payment_intent_id: piId,
        stripe_payment_method_type: pmType,
        paid_at: paidAtIso,
        notes: `Backfilled from Stripe invoice ${inv.number || inv.id} (webhook skipped due to API-shape bug)`,
      };

      console.log(`  + PAID ${inv.id} | ${inv.number} | paid ${paidAtIso.slice(0, 10)} | $${(chargeCents / 100).toFixed(2)} → base $${baseAmount.toFixed(2)} × ${monthsCredited}mo | PI ${piId || "—"} | PM ${pmType || "—"}`);
      console.log(`    paid_months ${runningPaidMonths} → ${runningPaidMonths + monthsCredited}, next_due ${runningNextDue} → ${newNextDue}`);

      if (PRINT_SQL) {
        sqlLines.push(`-- ${name} / ${m.id} — paid invoice ${inv.id}`);
        sqlLines.push(insertSql("payments", paymentRow));
      }

      if (EXECUTE) {
        const { data: inserted, error: insErr } = await supabase
          .from("payments")
          .insert(paymentRow)
          .select("id")
          .single();
        if (insErr || !inserted) {
          console.error(`    ✗ insert failed:`, insErr);
          continue;
        }
        console.log(`    ✓ inserted payment ${inserted.id}`);

        // Mirror what settlePayment does for membership state
        // (we set status completed directly above; we still advance paid_months, next_due,
        // and last_payment_date — and optionally send a receipt — here, to avoid importing
        // server-only code into this script.)
        const newPaidMonths = runningPaidMonths + monthsCredited;
        let newStatus = m.status;
        if (newStatus === "lapsed" || newStatus === "pending") newStatus = "current";
        const msUpdate: Record<string, unknown> = {
          paid_months: newPaidMonths,
          next_payment_due: newNextDue,
          status: newStatus,
          updated_at: new Date().toISOString(),
        };
        // Only advance last_payment_date; never move it backwards (preserves more-recent completed payments)
        const paidDate = paidAtIso.slice(0, 10);
        if (!runningLastPayment || paidDate > runningLastPayment) {
          msUpdate.last_payment_date = paidDate;
        }

        const { error: upErr } = await supabase
          .from("memberships")
          .update(msUpdate)
          .eq("id", m.id);
        if (upErr) {
          console.error(`    ✗ membership update failed:`, upErr);
        } else {
          console.log(`    ✓ membership updated`);
        }

        // Send receipt email
        if (!SKIP_RECEIPTS && member?.email) {
          try {
            const { sendPaymentReceiptEmail } = await import("../src/lib/email/send-payment-receipt");
            const pmLabel = pmType === "us_bank_account" ? "Bank Account" : "Credit Card";
            const paidDate = new Date(paidAtIso).toLocaleDateString("en-US", {
              year: "numeric", month: "long", day: "numeric", timeZone: orgTz,
            });
            const res = await sendPaymentReceiptEmail({
              to: member.email,
              memberId: m.member_id,
              memberName: [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(" "),
              organizationId: m.organization_id,
              amount: `$${(fees.chargeAmountCents / 100).toFixed(2)}`,
              paymentDate: paidDate,
              paymentMethod: pmLabel,
              periodLabel,
              language: (member.preferred_language as "en" | "fa") || "en",
            });
            console.log(`    ✉ receipt email: ${res.success ? "sent" : `FAILED (${res.error})`}`);
          } catch (err) {
            console.error(`    ✗ receipt email crashed:`, err instanceof Error ? err.message : err);
          }
        }
      }

      const paidDateStr = paidAtIso.slice(0, 10);
      const advanceLastPayment = !runningLastPayment || paidDateStr > runningLastPayment;
      if (PRINT_SQL) {
        const sqlUpdate: Record<string, unknown> = {
          paid_months: runningPaidMonths + monthsCredited,
          next_payment_due: newNextDue,
          updated_at: new Date().toISOString(),
        };
        if (advanceLastPayment) sqlUpdate.last_payment_date = paidDateStr;
        sqlLines.push(updateSql("memberships", sqlUpdate, { id: m.id }));
      }

      runningPaidMonths += monthsCredited;
      runningNextDue = newNextDue;
      if (advanceLastPayment) runningLastPayment = paidDateStr;
      totalPaidBackfilled++;
    }

    // FAILED INVOICES — audit trail only (no months credited)
    for (const inv of missingFailed) {
      const piId = extractPiId(inv);
      let pmType: string | null = null;
      let failureMsg = inv.last_finalization_error?.message || "Payment failed";
      if (piId) {
        try {
          const pi = await stripe.paymentIntents.retrieve(piId);
          const pmRef = typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id;
          if (pmRef) {
            const pm = await stripe.paymentMethods.retrieve(pmRef);
            pmType = pm.type;
          }
          if (pi.last_payment_error?.message) failureMsg = pi.last_payment_error.message;
        } catch { /* non-fatal */ }
      }
      const amt = (inv.amount_due || 0) / 100;
      const row = {
        organization_id: m.organization_id,
        membership_id: m.id,
        member_id: m.member_id,
        type: "dues",
        method: "stripe",
        status: "failed",
        amount: amt,
        total_charged: amt,
        net_amount: 0,
        months_credited: 0,
        stripe_payment_intent_id: piId,
        stripe_payment_method_type: pmType,
        notes: `Backfilled failed payment - Invoice ${inv.number || inv.id} - ${failureMsg}`,
      };
      console.log(`  + FAILED ${inv.id} | ${inv.number} | ${new Date(inv.created * 1000).toISOString().slice(0, 10)} | $${((inv.amount_due || 0) / 100).toFixed(2)} | ${failureMsg}`);
      if (PRINT_SQL) {
        sqlLines.push(`-- ${name} / ${m.id} — failed invoice ${inv.id}`);
        sqlLines.push(insertSql("payments", row));
      }
      if (EXECUTE) {
        const { error: insErr } = await supabase.from("payments").insert(row);
        if (insErr) console.error(`    ✗ insert failed:`, insErr);
        else console.log(`    ✓ inserted failed record`);
      }
      totalFailedBackfilled++;
    }

    console.log(`  After: paid_months=${runningPaidMonths}, next_due=${runningNextDue}, last_payment=${runningLastPayment}`);
    console.log();
  }

  console.log("══════════════════════════════════════════════════════");
  console.log(`Memberships touched: ${totalMembershipsTouched}`);
  console.log(`Paid records backfilled: ${totalPaidBackfilled}`);
  console.log(`Failed records backfilled: ${totalFailedBackfilled}`);
  if (!EXECUTE) console.log("(dry run — re-run with --execute to apply)");
  if (PRINT_SQL) {
    const sqlPath = path.resolve(process.cwd(), "scripts/backfill.sql");
    fs.writeFileSync(sqlPath, sqlLines.join("\n") + "\n");
    console.log(`SQL written to: ${sqlPath}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
