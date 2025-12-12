import type Stripe from "stripe";
import type { HandlerContext } from "../types";
import { logger } from "@/lib/logger";

/**
 * Handle payment_intent.succeeded event.
 * Updates or creates payment records for one-time payments.
 */
export async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  ctx: HandlerContext
): Promise<void> {
  const { organization_id, supabase } = ctx;
  const metadata = paymentIntent.metadata;

  if (!metadata?.membership_id) {
    logger.warn("Skipping payment_intent without membership metadata", {
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  const amountReceived = paymentIntent.amount / 100; // Convert from cents to dollars

  // TODO: Check if payment already exists by payment intent ID
  // const { data: existing } = await supabase
  //   .from("payments")
  //   .select("id, status")
  //   .eq("stripe_payment_intent_id", paymentIntent.id)
  //   .maybeSingle();
  //
  // if (existing && existing.status === "succeeded") {
  //   logger.info("Payment already recorded", { paymentIntentId: paymentIntent.id });
  //   return;
  // }

  // Try to find pending payment record (created by checkout or payment link generation)
  logger.info("Payment intent succeeded - looking for pending payment", {
    paymentIntentId: paymentIntent.id,
    membershipId: metadata.membership_id,
  });

  // TODO: Try to find and update pending payment
  // const { data: pendingPayments } = await supabase
  //   .from("payments")
  //   .select("id")
  //   .eq("stripe_payment_intent_id", paymentIntent.id)
  //   .eq("status", "pending")
  //   .limit(1);
  //
  // const pendingPayment = pendingPayments?.[0];
  //
  // if (pendingPayment) {
  //   // Update existing pending payment to succeeded
  //   const { data: updatedPayment } = await supabase
  //     .from("payments")
  //     .update({
  //       status: "succeeded",
  //       amount: amountReceived,
  //       currency: paymentIntent.currency.toUpperCase(),
  //       payment_method:
  //         paymentIntent.payment_method_types[0] === "us_bank_account"
  //           ? "stripe_ach"
  //           : "stripe_card",
  //       paid_at: new Date(paymentIntent.created * 1000).toISOString(),
  //       notes: "Payment completed via Stripe",
  //     })
  //     .eq("id", pendingPayment.id)
  //     .select()
  //     .single();
  //
  //   logger.info("Updated pending payment to succeeded", {
  //     paymentId: pendingPayment.id,
  //   });
  // } else {
  //   // No pending payment found - create new payment record
  //   const { data: newPayment } = await supabase
  //     .from("payments")
  //     .insert({
  //       organization_id,
  //       membership_id: metadata.membership_id,
  //       member_id: metadata.member_id,
  //       amount: amountReceived,
  //       currency: paymentIntent.currency.toUpperCase(),
  //       payment_source: "stripe",
  //       payment_method:
  //         paymentIntent.payment_method_types[0] === "us_bank_account"
  //           ? "stripe_ach"
  //           : "stripe_card",
  //       stripe_payment_intent_id: paymentIntent.id,
  //       status: "succeeded",
  //       paid_at: new Date(paymentIntent.created * 1000).toISOString(),
  //     })
  //     .select()
  //     .single();
  //
  //   logger.info("Created new payment record", {
  //     paymentIntentId: paymentIntent.id,
  //   });
  // }

  logger.info("Payment intent succeeded - would create/update payment and increment paidMonths", {
    paymentIntentId: paymentIntent.id,
    membershipId: metadata.membership_id,
    amount: amountReceived,
  });

  // CRITICAL: Increment paidMonths on membership when one-time payment succeeds
  // TODO: Increment paidMonths on membership
  // const monthsToAdd = calculateMonthsFromAmount(amountReceived, membership);
  // await supabase.rpc("increment_paid_months", {
  //   p_membership_id: metadata.membership_id,
  //   p_months: monthsToAdd,
  // });

  // TODO: Send receipt email
  // await queueReceiptEmail(payment);

  logger.info("Payment intent succeeded", { paymentIntentId: paymentIntent.id });
}

/**
 * Handle payment_intent.payment_failed event.
 * Updates or creates failed payment records.
 */
export async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent,
  ctx: HandlerContext
): Promise<void> {
  const { organization_id, supabase } = ctx;
  const metadata = paymentIntent.metadata;

  if (!metadata?.membership_id) {
    logger.warn("Skipping failed payment_intent without membership metadata", {
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  const amountFailed = paymentIntent.amount / 100; // Convert from cents to dollars

  logger.info("Payment intent failed", {
    paymentIntentId: paymentIntent.id,
    membershipId: metadata.membership_id,
    amount: amountFailed,
    errorMessage: paymentIntent.last_payment_error?.message,
  });

  // TODO: Try to find a pending payment for this membership to update instead of inserting a duplicate
  // const { data: pendingPayments } = await supabase
  //   .from("payments")
  //   .select("id, amount, due_date")
  //   .eq("organization_id", organization_id)
  //   .eq("membership_id", metadata.membership_id)
  //   .eq("payment_source", "stripe")
  //   .eq("status", "pending")
  //   .limit(1);
  //
  // const pendingPayment = pendingPayments?.[0];
  //
  // if (pendingPayment) {
  //   // Update existing pending payment to failed
  //   await supabase
  //     .from("payments")
  //     .update({
  //       status: "failed",
  //       failed_at: new Date().toISOString(),
  //       stripe_payment_intent_id: paymentIntent.id,
  //       payment_method:
  //         paymentIntent.payment_method_types[0] === "us_bank_account"
  //           ? "stripe_ach"
  //           : "stripe_card",
  //       notes: paymentIntent.last_payment_error?.message,
  //     })
  //     .eq("id", pendingPayment.id);
  //
  //   logger.info("Updated pending payment to failed", {
  //     paymentId: pendingPayment.id,
  //   });
  // } else {
  //   // Create new failed payment record
  //   const { data: newPayment } = await supabase
  //     .from("payments")
  //     .insert({
  //       organization_id,
  //       membership_id: metadata.membership_id,
  //       member_id: metadata.member_id,
  //       amount: amountFailed,
  //       currency: paymentIntent.currency.toUpperCase(),
  //       payment_source: "stripe",
  //       payment_method:
  //         paymentIntent.payment_method_types[0] === "us_bank_account"
  //           ? "stripe_ach"
  //           : "stripe_card",
  //       stripe_payment_intent_id: paymentIntent.id,
  //       status: "failed",
  //       failed_at: new Date().toISOString(),
  //       notes: paymentIntent.last_payment_error?.message,
  //       due_date: new Date().toISOString().split("T")[0],
  //     })
  //     .select()
  //     .single();
  //
  //   logger.info("Created failed payment record", {
  //     paymentIntentId: paymentIntent.id,
  //   });
  // }

  logger.info("Payment intent failed - would create/update failed payment record", {
    paymentIntentId: paymentIntent.id,
    membershipId: metadata.membership_id,
  });

  // TODO: Optionally mark membership as having payment issues
  // await supabase
  //   .from("memberships")
  //   .update({
  //     billing_notes: `Payment failed: ${paymentIntent.last_payment_error?.message || "Unknown error"}`,
  //   })
  //   .eq("id", metadata.membership_id);

  // TODO: Send failure notification email
  // await queueFailureEmail({
  //   organization_id,
  //   membership_id: metadata.membership_id,
  //   payment_id: payment.id,
  //   amount: amountFailed,
  //   reason: paymentIntent.last_payment_error?.message,
  // });

  logger.info("Payment intent failure handled", { paymentIntentId: paymentIntent.id });
}
