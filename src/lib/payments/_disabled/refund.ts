/**
 * Refund processing logic
 * @module lib/payments/refund
 */

import "server-only";

import { logger } from "@/lib/logger";
import { getStripeClient } from "@/lib/stripe";
import { getTodayInOrgTimezone } from "@/lib/utils/timezone";
import type { PaymentActionResult } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface RefundPaymentParams {
  payment_id: string;
  organization_id: string;
  supabase: SupabaseClient;
}

export interface RefundResult {
  id: string;
  status: string;
  refunded_at: string;
  notes: string | null;
  [key: string]: unknown;
}

/**
 * Process a refund for a payment (Stripe or manual)
 *
 * For Stripe payments: Creates refund in Stripe and updates DB
 * For manual payments: Updates DB to mark as refunded
 */
export async function processRefund({
  payment_id,
  organization_id,
  supabase,
}: RefundPaymentParams): Promise<PaymentActionResult<RefundResult> & { message?: string }> {
  // Fetch payment details
  const { data: payment, error: fetchError } = await supabase
    .from("payments")
    .select(
      "id, organization_id, payment_source, stripe_payment_intent_id, stripe_charge_id, amount, status, notes"
    )
    .eq("id", payment_id)
    .eq("organization_id", organization_id)
    .single();

  if (fetchError || !payment) {
    throw new Error("Payment not found or access denied");
  }

  // Get organization timezone for accurate date recording
  const { data: orgData } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", organization_id)
    .single();
  const orgTimezone = orgData?.timezone || "America/Los_Angeles";

  if (payment.status !== "succeeded") {
    throw new Error("Only succeeded payments can be refunded");
  }

  // Handle Stripe refunds
  if (payment.payment_source === "stripe") {
    return processStripeRefund({
      payment,
      organization_id,
      supabase,
    });
  }

  // Handle manual refunds
  return processManualRefund({
    payment,
    payment_id,
    orgTimezone,
    supabase,
  });
}

interface StripeRefundParams {
  payment: {
    id: string;
    organization_id: string;
    stripe_payment_intent_id?: string | null;
    stripe_charge_id?: string | null;
    notes?: string | null;
  };
  organization_id: string;
  supabase: SupabaseClient;
}

async function processStripeRefund({
  payment,
  organization_id,
  supabase,
}: StripeRefundParams): Promise<PaymentActionResult<RefundResult> & { message?: string }> {
  const stripeId = payment.stripe_charge_id || payment.stripe_payment_intent_id;
  if (!stripeId) {
    throw new Error("No Stripe charge or payment intent ID found");
  }

  // Get Stripe client for this organization
  const stripe = await getStripeClient(organization_id);

  // Create refund in Stripe
  const refund = await stripe.refunds.create({
    payment_intent: payment.stripe_payment_intent_id!,
    metadata: {
      organization_id: payment.organization_id,
      payment_id: payment.id,
    },
  });

  // Update DB - Stripe refunds are instant in their system
  const { data: updatedPayment, error: updateError } = await supabase
    .from("payments")
    .update({
      status: "refunded",
      refunded_at: new Date().toISOString(),
      notes: payment.notes
        ? `${payment.notes}\n\nRefund initiated in Stripe: ${refund.id}`
        : `Refund initiated in Stripe: ${refund.id}`,
    })
    .eq("id", payment.id)
    .select()
    .single();

  if (updateError) throw updateError;

  return {
    success: true,
    data: updatedPayment as RefundResult,
    message: "Stripe refund initiated. Customer will receive refund in 5-10 business days.",
  };
}

interface ManualRefundParams {
  payment: {
    id: string;
    notes?: string | null;
  };
  payment_id: string;
  orgTimezone: string;
  supabase: SupabaseClient;
}

async function processManualRefund({
  payment,
  payment_id,
  orgTimezone,
  supabase,
}: ManualRefundParams): Promise<PaymentActionResult<RefundResult> & { message?: string }> {
  const refundDate = getTodayInOrgTimezone(orgTimezone);

  const { data: updatedPayment, error: updateError } = await supabase
    .from("payments")
    .update({
      status: "refunded",
      refunded_at: new Date().toISOString(),
      notes: payment.notes
        ? `${payment.notes}\n\nManual refund issued on ${refundDate}`
        : `Manual refund issued on ${refundDate}`,
    })
    .eq("id", payment_id)
    .select()
    .single();

  if (updateError) throw updateError;

  return {
    success: true,
    data: updatedPayment as RefundResult,
    message: "Manual payment marked as refunded. Ensure cash/check refund was issued to family.",
  };
}
