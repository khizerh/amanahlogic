import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { settlePayment } from "@/lib/billing/engine";
import {
  generateInvoiceMetadata,
  getTodayInOrgTimezone,
  parseDateInOrgTimezone,
} from "@/lib/billing/invoice-generator";
import { logger } from "@/lib/logger";
import type { BillingFrequency } from "@/lib/types";
import { sendPaymentFailedEmail } from "@/lib/email/send-payment-failed";

interface HandlerContext {
  organization_id: string;
  supabase: SupabaseClient;
}

/**
 * Handle payment_intent.succeeded event.
 *
 * This is called when a Stripe payment completes successfully.
 * It finds the corresponding pending payment record and settles it,
 * which credits the membership and updates status.
 */
export async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  ctx: HandlerContext
): Promise<void> {
  const { organization_id, supabase } = ctx;
  const metadata = paymentIntent.metadata;

  // Extract IDs from metadata
  const membershipId = metadata?.membership_id;
  const paymentId = metadata?.payment_id;

  if (!membershipId) {
    logger.warn("Skipping payment_intent without membership metadata", {
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  const amountReceived = paymentIntent.amount / 100; // Convert from cents to dollars

  // All Stripe payments are stored as 'stripe' method
  const paymentMethod = "stripe";

  // If we have a specific payment_id in metadata, settle that payment
  if (paymentId) {
    logger.info("Settling specific payment from metadata", {
      paymentIntentId: paymentIntent.id,
      paymentId,
      membershipId,
      amount: amountReceived,
    });

    const result = await settlePayment({
      paymentId,
      method: paymentMethod,
      paidAt: new Date(paymentIntent.created * 1000).toISOString(),
      stripePaymentIntentId: paymentIntent.id,
      supabase,
    });

    if (!result.success) {
      logger.error("Failed to settle payment from webhook", {
        paymentIntentId: paymentIntent.id,
        paymentId,
        error: result.error,
      });
      throw new Error(`Failed to settle payment: ${result.error}`);
    }

    logger.info("Payment settled successfully", {
      paymentIntentId: paymentIntent.id,
      paymentId,
      newPaidMonths: result.newPaidMonths,
      newStatus: result.newStatus,
      becameEligible: result.becameEligible,
    });

    return;
  }

  // No specific payment_id - find pending payment by stripe_payment_intent_id
  const { data: existingPayment } = await supabase
    .from("payments")
    .select("id, status")
    .eq("stripe_payment_intent_id", paymentIntent.id)
    .maybeSingle();

  if (existingPayment) {
    if (existingPayment.status === "completed") {
      logger.info("Payment already completed, skipping", {
        paymentIntentId: paymentIntent.id,
        paymentId: existingPayment.id,
      });
      return;
    }

    // Settle the existing payment
    const result = await settlePayment({
      paymentId: existingPayment.id,
      method: paymentMethod,
      paidAt: new Date(paymentIntent.created * 1000).toISOString(),
      stripePaymentIntentId: paymentIntent.id,
      supabase,
    });

    if (!result.success) {
      logger.error("Failed to settle existing payment", {
        paymentIntentId: paymentIntent.id,
        paymentId: existingPayment.id,
        error: result.error,
      });
      throw new Error(`Failed to settle payment: ${result.error}`);
    }

    logger.info("Existing payment settled", {
      paymentIntentId: paymentIntent.id,
      paymentId: existingPayment.id,
      newPaidMonths: result.newPaidMonths,
      newStatus: result.newStatus,
    });

    return;
  }

  // No existing payment - try to find a pending payment for this membership
  const { data: pendingPayment } = await supabase
    .from("payments")
    .select("id, amount, due_date")
    .eq("membership_id", membershipId)
    .eq("status", "pending")
    .is("stripe_payment_intent_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingPayment) {
    // Update the pending payment with the stripe_payment_intent_id first
    await supabase
      .from("payments")
      .update({ stripe_payment_intent_id: paymentIntent.id })
      .eq("id", pendingPayment.id);

    // Then settle it
    const result = await settlePayment({
      paymentId: pendingPayment.id,
      method: paymentMethod,
      paidAt: new Date(paymentIntent.created * 1000).toISOString(),
      stripePaymentIntentId: paymentIntent.id,
      supabase,
    });

    if (!result.success) {
      logger.error("Failed to settle pending payment", {
        paymentIntentId: paymentIntent.id,
        paymentId: pendingPayment.id,
        error: result.error,
      });
      throw new Error(`Failed to settle payment: ${result.error}`);
    }

    logger.info("Pending payment linked and settled", {
      paymentIntentId: paymentIntent.id,
      paymentId: pendingPayment.id,
      newPaidMonths: result.newPaidMonths,
      newStatus: result.newStatus,
    });

    return;
  }

  // No pending payment found - create a new one
  // This handles ad-hoc Stripe payments not created by our billing engine
  logger.info("Creating new payment record for Stripe payment", {
    paymentIntentId: paymentIntent.id,
    membershipId,
    amount: amountReceived,
  });

  // Get membership details
  const { data: membership } = await supabase
    .from("memberships")
    .select("member_id, billing_frequency, billing_anniversary_day, next_payment_due")
    .eq("id", membershipId)
    .single();

  if (!membership) {
    logger.error("Membership not found for payment", {
      paymentIntentId: paymentIntent.id,
      membershipId,
    });
    throw new Error("Membership not found");
  }

  // Get organization timezone for invoice metadata
  const { data: org } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", organization_id)
    .single();

  const orgTimezone = org?.timezone || "America/Los_Angeles";
  const today = getTodayInOrgTimezone(orgTimezone);
  const billingFrequency = (membership.billing_frequency || "monthly") as BillingFrequency;

  // Determine billing anchor for period calculation
  let billingAnchor: string;
  if (
    membership.next_payment_due &&
    /^\d{4}-\d{2}-\d{2}$/.test(membership.next_payment_due)
  ) {
    billingAnchor = membership.next_payment_due;
  } else if (membership.billing_anniversary_day) {
    // First payment — use billing anniversary day of current month
    const todayDate = parseDateInOrgTimezone(today, orgTimezone);
    const anniversaryDay = membership.billing_anniversary_day;
    const lastDayOfMonth = new Date(
      todayDate.getFullYear(),
      todayDate.getMonth() + 1,
      0
    ).getDate();
    const day = Math.min(anniversaryDay, lastDayOfMonth);
    billingAnchor = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  } else {
    billingAnchor = today;
  }

  // Generate invoice metadata
  const invoiceMetadata = await generateInvoiceMetadata(
    organization_id,
    billingAnchor,
    billingFrequency,
    orgTimezone,
    supabase
  );

  // Create new payment record with full invoice metadata
  const { data: newPayment, error: createError } = await supabase
    .from("payments")
    .insert({
      organization_id,
      membership_id: membershipId,
      member_id: membership.member_id,
      type: "dues",
      method: paymentMethod,
      status: "pending",
      amount: amountReceived,
      stripe_fee: 0, // Will be updated from Stripe if available
      platform_fee: 0,
      total_charged: amountReceived,
      net_amount: amountReceived,
      months_credited: invoiceMetadata.monthsCredited,
      // Invoice metadata
      invoice_number: invoiceMetadata.invoiceNumber,
      due_date: invoiceMetadata.dueDate,
      period_start: invoiceMetadata.periodStart,
      period_end: invoiceMetadata.periodEnd,
      period_label: invoiceMetadata.periodLabel,
      // Other fields
      stripe_payment_intent_id: paymentIntent.id,
      notes: `Stripe payment - ${invoiceMetadata.periodLabel}`,
    })
    .select()
    .single();

  if (createError || !newPayment) {
    logger.error("Failed to create payment record", {
      paymentIntentId: paymentIntent.id,
      error: createError?.message,
    });
    throw new Error(`Failed to create payment: ${createError?.message}`);
  }

  // Settle the new payment
  const result = await settlePayment({
    paymentId: newPayment.id,
    method: paymentMethod,
    paidAt: new Date(paymentIntent.created * 1000).toISOString(),
    stripePaymentIntentId: paymentIntent.id,
    supabase,
  });

  if (!result.success) {
    logger.error("Failed to settle new payment", {
      paymentIntentId: paymentIntent.id,
      paymentId: newPayment.id,
      error: result.error,
    });
    throw new Error(`Failed to settle payment: ${result.error}`);
  }

  logger.info("New payment created and settled", {
    paymentIntentId: paymentIntent.id,
    paymentId: newPayment.id,
    newPaidMonths: result.newPaidMonths,
    newStatus: result.newStatus,
    becameEligible: result.becameEligible,
  });
}

/**
 * Handle payment_intent.payment_failed event.
 * Updates or creates failed payment records.
 */
export async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent,
  ctx: HandlerContext
): Promise<void> {
  const { supabase } = ctx;
  const metadata = paymentIntent.metadata;

  if (!metadata?.membership_id) {
    logger.warn("Skipping failed payment_intent without membership metadata", {
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  const errorMessage = paymentIntent.last_payment_error?.message || "Payment failed";

  // Find existing payment to update
  const { data: existingPayment } = await supabase
    .from("payments")
    .select("id")
    .or(`stripe_payment_intent_id.eq.${paymentIntent.id},and(membership_id.eq.${metadata.membership_id},status.eq.pending)`)
    .limit(1)
    .maybeSingle();

  if (existingPayment) {
    // Update to failed status
    await supabase
      .from("payments")
      .update({
        status: "failed",
        stripe_payment_intent_id: paymentIntent.id,
        notes: `Payment failed: ${errorMessage}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingPayment.id);

    logger.info("Payment marked as failed", {
      paymentIntentId: paymentIntent.id,
      paymentId: existingPayment.id,
      reason: errorMessage,
    });
  } else {
    logger.warn("No payment found to mark as failed", {
      paymentIntentId: paymentIntent.id,
      membershipId: metadata.membership_id,
    });
  }

  // Send failure notification email to the member
  try {
    const { data: membership } = await supabase
      .from("memberships")
      .select("member_id")
      .eq("id", metadata.membership_id)
      .single();

    if (membership) {
      const { data: member } = await supabase
        .from("members")
        .select("id, email, first_name, last_name, preferred_language")
        .eq("id", membership.member_id)
        .single();

      if (member?.email) {
        const amount = paymentIntent.amount ? (paymentIntent.amount / 100).toFixed(2) : "0.00";
        await sendPaymentFailedEmail({
          to: member.email,
          memberName: `${member.first_name} ${member.last_name}`,
          memberId: member.id,
          organizationId: ctx.organization_id,
          amount,
          failureReason: errorMessage,
          language: (member.preferred_language as "en" | "fa") || "en",
        });
      }
    }
  } catch (emailErr) {
    // Don't fail the webhook handler if email sending fails
    logger.error("Failed to send payment failure email", {
      paymentIntentId: paymentIntent.id,
      error: emailErr instanceof Error ? emailErr.message : String(emailErr),
    });
  }
}
