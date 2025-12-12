import type Stripe from "stripe";
import type { HandlerContext } from "../types";
import { logger } from "@/lib/logger";

/**
 * Handle invoice.paid event.
 * Creates payment records and increments paidMonths on membership.
 */
export async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  ctx: HandlerContext
): Promise<void> {
  const { organization_id, supabase } = ctx;
  const metadata = (invoice.metadata || {}) as Stripe.Metadata;

  let membership_id = metadata?.membership_id as string | undefined;

  // Try to resolve membership_id from subscription if not in metadata
  const invoiceSubscription = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };

  if (!membership_id && invoiceSubscription.subscription) {
    // TODO: Look up subscription to get membership_id
    const subscriptionId =
      typeof invoiceSubscription.subscription === "string"
        ? invoiceSubscription.subscription
        : invoiceSubscription.subscription.id;

    logger.info("Looking up membership from subscription", { subscriptionId });
    // const { data: subscriptionRecord } = await supabase
    //   .from("stripe_subscriptions")
    //   .select("membership_id")
    //   .eq("stripe_subscription_id", subscriptionId)
    //   .single();
    // membership_id = subscriptionRecord?.membership_id;
  }

  if (!membership_id) {
    logger.error("Missing membership_id in invoice paid event", {
      invoiceId: invoice.id,
    });
    return;
  }

  // TODO: Check if this invoice is already recorded to prevent duplicates
  // const { data: existingPayment } = await supabase
  //   .from("payments")
  //   .select("id")
  //   .eq("stripe_invoice_id", invoice.id)
  //   .maybeSingle();
  //
  // if (existingPayment) {
  //   logger.info("Invoice already recorded", { invoiceId: invoice.id });
  //   return;
  // }

  const paymentIntentValue = (
    invoice as Stripe.Invoice & {
      payment_intent?: string | Stripe.PaymentIntent | null;
    }
  ).payment_intent;
  const paymentIntentId = typeof paymentIntentValue === "string" ? paymentIntentValue : undefined;

  const amountPaid = (invoice.amount_paid || 0) / 100; // Convert from cents to dollars

  logger.info("Invoice paid - would create payment record", {
    invoiceId: invoice.id,
    membershipId: membership_id,
    amount: amountPaid,
    currency: invoice.currency,
    paymentIntentId,
    periodStart: invoice.period_start
      ? new Date(invoice.period_start * 1000).toISOString()
      : null,
    periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
  });

  // TODO: Create payment record in payments table
  // const { data: payment } = await supabase
  //   .from("payments")
  //   .insert({
  //     organization_id,
  //     membership_id,
  //     member_id: metadata.member_id,
  //     amount: amountPaid,
  //     currency: invoice.currency.toUpperCase(),
  //     payment_source: "stripe",
  //     payment_method: "stripe_card",
  //     stripe_invoice_id: invoice.id,
  //     stripe_payment_intent_id: paymentIntentId,
  //     status: "succeeded",
  //     paid_at: invoice.status_transitions?.paid_at
  //       ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
  //       : new Date().toISOString(),
  //     period_start: invoice.period_start
  //       ? new Date(invoice.period_start * 1000).toISOString()
  //       : undefined,
  //     period_end: invoice.period_end
  //       ? new Date(invoice.period_end * 1000).toISOString()
  //       : undefined,
  //   })
  //   .select()
  //   .single();

  // CRITICAL: Increment paidMonths on membership when payment succeeds
  // This tracks how many months the member has paid for
  logger.info("Invoice paid - would increment paidMonths on membership", {
    membershipId: membership_id,
  });

  // TODO: Increment paidMonths on membership
  // await supabase.rpc("increment_paid_months", {
  //   p_membership_id: membership_id,
  //   p_months: 1, // Adjust based on payment frequency (1 for monthly, 3 for quarterly, etc.)
  // });
  //
  // OR manually:
  // const { data: membership } = await supabase
  //   .from("memberships")
  //   .select("paid_months")
  //   .eq("id", membership_id)
  //   .single();
  //
  // await supabase
  //   .from("memberships")
  //   .update({
  //     paid_months: (membership?.paid_months || 0) + 1,
  //     status: "active",
  //   })
  //   .eq("id", membership_id);

  // TODO: Send receipt email
  // await queueReceiptEmail(payment);

  logger.info("Invoice paid successfully", { invoiceId: invoice.id });
}

/**
 * Handle invoice.payment_failed event.
 * Creates failed payment record and potentially marks membership as lapsed.
 */
export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  ctx: HandlerContext
): Promise<void> {
  const { organization_id, supabase } = ctx;
  const metadata = (invoice.metadata || {}) as Stripe.Metadata;

  let membership_id = metadata?.membership_id as string | undefined;

  // Try to resolve membership_id from subscription if not in metadata
  const invoiceWithSub = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };

  if (!membership_id && invoiceWithSub.subscription) {
    const subscriptionId =
      typeof invoiceWithSub.subscription === "string"
        ? invoiceWithSub.subscription
        : invoiceWithSub.subscription.id;

    logger.info("Looking up membership from subscription", { subscriptionId });
    // TODO: Look up subscription to get membership_id
  }

  if (!membership_id) {
    logger.error("Missing membership_id in invoice payment failed", {
      invoiceId: invoice.id,
    });
    return;
  }

  const paymentIntentFailedValue = (
    invoice as Stripe.Invoice & {
      payment_intent?: string | Stripe.PaymentIntent | null;
    }
  ).payment_intent;
  const paymentIntentFailedId =
    typeof paymentIntentFailedValue === "string" ? paymentIntentFailedValue : undefined;

  const amountDue = (invoice.amount_due || 0) / 100; // Convert from cents to dollars

  logger.info("Invoice payment failed - would create failed payment record", {
    invoiceId: invoice.id,
    membershipId: membership_id,
    amount: amountDue,
    currency: invoice.currency,
    paymentIntentId: paymentIntentFailedId,
    errorMessage: invoice.last_finalization_error?.message,
  });

  // TODO: Create failed payment record in payments table
  // const { data: payment } = await supabase
  //   .from("payments")
  //   .insert({
  //     organization_id,
  //     membership_id,
  //     member_id: metadata.member_id,
  //     amount: amountDue,
  //     currency: invoice.currency.toUpperCase(),
  //     payment_source: "stripe",
  //     payment_method: "stripe_card",
  //     stripe_invoice_id: invoice.id,
  //     stripe_payment_intent_id: paymentIntentFailedId,
  //     status: "failed",
  //     failed_at: new Date().toISOString(),
  //     notes: invoice.last_finalization_error?.message,
  //   })
  //   .select()
  //   .single();

  // CRITICAL: Consider marking membership as lapsed after payment failure
  // This depends on your business logic (e.g., mark as lapsed immediately, or after N failures)
  logger.info("Invoice payment failed - consider marking membership as lapsed", {
    membershipId: membership_id,
  });

  // TODO: Optionally mark membership as lapsed after payment failure
  // await supabase
  //   .from("memberships")
  //   .update({
  //     status: "lapsed", // or "payment_failed"
  //     billing_notes: `Payment failed on ${new Date().toISOString().split("T")[0]}: ${
  //       invoice.last_finalization_error?.message || "Unknown error"
  //     }`,
  //   })
  //   .eq("id", membership_id);

  // TODO: Send failure notification email
  // await queueFailureEmail({
  //   organization_id,
  //   membership_id,
  //   payment_id: payment.id,
  //   amount: amountDue,
  //   reason: invoice.last_finalization_error?.message,
  // });

  logger.info("Invoice payment failure handled", { invoiceId: invoice.id });
}
