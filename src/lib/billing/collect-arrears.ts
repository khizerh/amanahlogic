/**
 * Charge past dues against a saved payment method and settle them in the
 * ledger. One implementation for both entry points:
 *
 *   - setup_intent.succeeded webhook: the member just saved a card via a setup
 *     link that carried an admin-approved arrears count.
 *   - POST /api/stripe/collect-past-dues: the member is already on auto-pay
 *     (so no setup link applies) and the admin wants to collect the gap now.
 *
 * Money rules (see ./arrears.ts for the month math):
 *   - Charged as ONE off-session PaymentIntent of type back_dues, N months
 *     credited, so the ledger's next_payment_due moves past the gap.
 *   - Months the admin waived are written as a $0 back_dues row and settled
 *     too; otherwise the member stays "overdue" forever.
 *   - A decline is recorded (requires_review) and reported, never thrown, so
 *     the caller can keep going (the webhook still starts the subscription).
 */

import "server-only";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { settlePayment } from "@/lib/billing/engine";
import { calculateArrearsCharge } from "@/lib/stripe";
import { arrearsPeriodLabel } from "@/lib/billing/arrears";

export interface ChargeArrearsParams {
  stripe: Stripe;
  supabase: SupabaseClient;
  organizationId: string;
  membershipId: string;
  memberId: string;
  customerId: string;
  paymentMethodId: string;
  /** Stripe PaymentMethod.type, stored on the payments row. */
  paymentMethodType: string;
  receiptEmail?: string | null;
  planName: string;
  monthlyDuesCents: number;
  platformFeeMonthlyDollars: number;
  passFeesToMember: boolean;
  /** Connected account to route funds to. Omit when the org isn't onboarded. */
  connectAccountId?: string | null;
  /** The membership's next_payment_due BEFORE this charge. */
  nextPaymentDue: string | null;
  /** Months to charge. Caller has already clamped to what is owed. */
  arrearsMonths: number;
  /** Months to forgive. Caller computed owed - arrearsMonths (or 0). */
  waivedMonths: number;
  /** Free-text origin for the notes, e.g. "at card setup" / "by admin". */
  origin: string;
  recordedBy?: string;
}

export interface ChargeArrearsResult {
  chargedMonths: number;
  chargeAmountCents: number;
  periodLabel: string;
  paymentId?: string;
  paymentIntentId?: string;
  /** none = nothing to charge; processing = ACH in flight, webhook settles. */
  status: "none" | "succeeded" | "processing" | "failed";
  failureMessage?: string;
  waivedMonths: number;
  waivedPaymentId?: string;
}

/** Add whole months to a YYYY-MM-DD string, keeping the day. */
export function shiftYmdByMonths(ymd: string, months: number): string {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  const total = m - 1 + months;
  const year = y + Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export async function chargeArrears(params: ChargeArrearsParams): Promise<ChargeArrearsResult> {
  const {
    stripe,
    supabase,
    organizationId,
    membershipId,
    memberId,
    customerId,
    paymentMethodId,
    paymentMethodType,
    receiptEmail,
    planName,
    monthlyDuesCents,
    platformFeeMonthlyDollars,
    passFeesToMember,
    connectAccountId,
    nextPaymentDue,
    arrearsMonths,
    waivedMonths,
    origin,
    recordedBy,
  } = params;

  const periodLabel = arrearsPeriodLabel(nextPaymentDue, arrearsMonths);
  const result: ChargeArrearsResult = {
    chargedMonths: 0,
    chargeAmountCents: 0,
    periodLabel,
    status: "none",
    waivedMonths: 0,
  };
  const nowIso = new Date().toISOString();
  const plural = (n: number) => (n === 1 ? "month" : "months");

  // ---------------------------------------------------------------------------
  // 1. Charge the collected months
  // ---------------------------------------------------------------------------
  if (arrearsMonths > 0) {
    const fees = calculateArrearsCharge({
      months: arrearsMonths,
      monthlyDuesCents,
      platformFeeMonthlyDollars,
      passFeesToMember,
    });

    if (fees.chargeAmountCents > 0) {
      result.chargeAmountCents = fees.chargeAmountCents;

      // Row first, so payment_intent.succeeded / payment_failed can find it
      // even if we die between creating the PI and recording its id.
      const { data: row, error: insertError } = await supabase
        .from("payments")
        .insert({
          organization_id: organizationId,
          membership_id: membershipId,
          member_id: memberId,
          type: "back_dues",
          method: "stripe",
          status: "pending",
          amount: fees.baseAmountCents / 100,
          stripe_fee: fees.breakdown.stripeFee,
          platform_fee: fees.breakdown.platformFee,
          total_charged: fees.breakdown.chargeAmount,
          net_amount: fees.netAmountCents / 100,
          months_credited: arrearsMonths,
          period_label: periodLabel,
          stripe_payment_method_type: paymentMethodType,
          notes: `Past dues (${arrearsMonths} ${plural(arrearsMonths)}: ${periodLabel}) collected ${origin}`,
          ...(recordedBy && { recorded_by: recordedBy }),
        })
        .select("id")
        .single();

      if (insertError || !row) {
        console.error("[Arrears] Failed to create back_dues payment record:", insertError);
        result.status = "failed";
        result.failureMessage = "Could not create payment record";
        return result;
      }
      result.paymentId = row.id;

      try {
        const piParams: Stripe.PaymentIntentCreateParams = {
          amount: fees.chargeAmountCents,
          currency: "usd",
          customer: customerId,
          payment_method: paymentMethodId,
          off_session: true,
          confirm: true,
          description: `${planName || "Membership"} Past Dues (${periodLabel})`,
          ...(receiptEmail && { receipt_email: receiptEmail }),
          metadata: {
            membership_id: membershipId,
            member_id: memberId,
            organization_id: organizationId,
            type: "back_dues",
            months: String(arrearsMonths),
          },
        };
        if (connectAccountId) {
          piParams.application_fee_amount = fees.applicationFeeCents;
          piParams.transfer_data = { destination: connectAccountId };
        }

        const pi = await stripe.paymentIntents.create(piParams);
        const chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id ?? null;
        await supabase
          .from("payments")
          .update({ stripe_payment_intent_id: pi.id, stripe_charge_id: chargeId })
          .eq("id", row.id);
        result.paymentIntentId = pi.id;
        console.log(`[Arrears] PaymentIntent ${pi.id} (${pi.status}) for ${arrearsMonths} months, membership ${membershipId}`);

        if (pi.status === "succeeded") {
          const settled = await settlePayment({
            paymentId: row.id,
            method: "stripe",
            paidAt: nowIso,
            stripePaymentIntentId: pi.id,
            supabase,
          });
          if (!settled.success) {
            console.error("[Arrears] Charge succeeded but settlement failed:", settled.error);
            result.status = "failed";
            result.failureMessage = `Charged but not settled: ${settled.error}`;
          } else {
            result.status = "succeeded";
            result.chargedMonths = arrearsMonths;
          }
        } else {
          // ACH etc.: payment_intent.succeeded settles the pending row later.
          result.status = "processing";
          result.chargedMonths = arrearsMonths;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Arrears] Charge failed for membership ${membershipId}:`, message);
        await supabase
          .from("payments")
          .update({
            status: "failed",
            requires_review: true,
            notes: `Past dues (${arrearsMonths} ${plural(arrearsMonths)}: ${periodLabel}) declined ${origin} - ${message}`,
            updated_at: nowIso,
          })
          .eq("id", row.id);
        result.status = "failed";
        result.failureMessage = message;
        // Don't waive on top of a decline: the admin needs to look first.
        return result;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Waived months: $0 row so the ledger moves past the gap
  // ---------------------------------------------------------------------------
  if (waivedMonths > 0) {
    const waivedStart =
      nextPaymentDue && arrearsMonths > 0 ? shiftYmdByMonths(nextPaymentDue, arrearsMonths) : nextPaymentDue;
    const waivedLabel = arrearsPeriodLabel(waivedStart, waivedMonths);
    const { data: row } = await supabase
      .from("payments")
      .insert({
        organization_id: organizationId,
        membership_id: membershipId,
        member_id: memberId,
        type: "back_dues",
        method: "stripe",
        status: "pending",
        amount: 0,
        stripe_fee: 0,
        platform_fee: 0,
        total_charged: 0,
        net_amount: 0,
        months_credited: waivedMonths,
        period_label: waivedLabel,
        notes: `Waived ${waivedMonths} ${plural(waivedMonths)} of past dues (${waivedLabel}) ${origin} - no charge`,
        ...(recordedBy && { recorded_by: recordedBy }),
      })
      .select("id")
      .single();
    if (row) {
      const settled = await settlePayment({ paymentId: row.id, method: "stripe", paidAt: nowIso, supabase });
      if (!settled.success) {
        console.error("[Arrears] Failed to settle waived row:", settled.error);
      } else {
        result.waivedMonths = waivedMonths;
        result.waivedPaymentId = row.id;
        console.log(`[Arrears] Waived ${waivedMonths} months for membership ${membershipId}`);
      }
    }
  }

  return result;
}
