import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { settlePayment } from "@/lib/billing/engine";
import {
  generateAdHocInvoiceMetadata,
  getTodayInOrgTimezone,
} from "@/lib/billing/invoice-generator";
import { calculateFees, reverseCalculateBaseAmount } from "@/lib/stripe";
import { OnboardingInvitesService } from "@/lib/database/onboarding-invites";
import type { BillingFrequency, PaymentMethod } from "@/lib/types";

export const runtime = "nodejs";

// PINNED API VERSION - DO NOT CHANGE
// See: https://docs.stripe.com/changelog#2025-12-15.clover
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2025-12-15.clover",
    })
  : null;

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Events we don't need to process
 */
const IGNORED_EVENTS = [
  "billing_portal.configuration.created",
  "billing_portal.configuration.updated",
  "billing_portal.session.created",
  "invoice.payment_succeeded", // We use invoice.paid instead
];

/**
 * Extended Invoice type with optional fields that may be present
 */
type InvoiceWithSubscription = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null;
  payment_intent?: string | Stripe.PaymentIntent | null;
};

/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events for subscription lifecycle management.
 * Routes payments through settlePayment engine for consistent state management.
 *
 * Key events:
 * - checkout.session.completed: Save subscription ID to membership
 * - customer.subscription.updated: Sync subscription status
 * - customer.subscription.deleted: Handle cancellation
 * - invoice.created: Set application_fee_amount for Connect fee splitting
 * - invoice.paid: Create payment record and settle via engine
 * - payment_intent.succeeded/failed: Handle one-off charges
 */
export async function POST(req: Request) {
  if (!stripe) {
    console.error("[Webhook] Stripe is not configured");
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature || !webhookSecret) {
    console.error("[Webhook] Missing signature or webhook secret");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[Webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Skip non-actionable events
  if (IGNORED_EVENTS.includes(event.type)) {
    return NextResponse.json({ acknowledged: true });
  }

  console.log(`[Webhook] Processing ${event.type} (${event.id})`);

  const supabase = createServiceRoleClient();

  // IDEMPOTENCY CHECK: Has this event already been processed?
  const { data: existingEvent } = await supabase
    .from("stripe_webhook_events")
    .select("id, status")
    .eq("event_id", event.id)
    .maybeSingle();

  if (existingEvent) {
    console.log(`[Webhook] Event ${event.id} already processed (status: ${existingEvent.status})`);
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Extract metadata from event for organization context
  const eventData = event.data.object as unknown as Record<string, unknown>;
  const metadata = (eventData.metadata || {}) as Record<string, string>;
  const organizationId = metadata.organization_id;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session, supabase);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription, supabase);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription, supabase);
        break;
      }

      case "invoice.created": {
        const invoice = event.data.object as InvoiceWithSubscription;
        await handleInvoiceCreated(invoice, supabase);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as InvoiceWithSubscription;
        await handleInvoicePaid(invoice, supabase);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as InvoiceWithSubscription;
        await handleInvoiceFailed(invoice, supabase);
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(paymentIntent, supabase);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentFailed(paymentIntent, supabase);
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    // Record successful processing
    await supabase.from("stripe_webhook_events").insert({
      event_id: event.id,
      event_type: event.type,
      organization_id: organizationId || null,
      membership_id: metadata.membership_id || null,
      status: "processed",
      processed_at: new Date().toISOString(),
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`[Webhook] Error processing ${event.type}:`, error);

    // Record failed processing
    await supabase.from("stripe_webhook_events").insert({
      event_id: event.id,
      event_type: event.type,
      organization_id: organizationId || null,
      membership_id: metadata.membership_id || null,
      status: "failed",
      error_message: error instanceof Error ? error.message : String(error),
      processed_at: new Date().toISOString(),
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Handle checkout.session.completed
 * When a subscription checkout completes, save the subscription ID to the membership
 * Also handles enrollment fee if included in the checkout
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  supabase: ReturnType<typeof createServiceRoleClient>
) {
  const metadata = session.metadata;

  if (!metadata?.membership_id) {
    console.log("[Webhook] checkout.session.completed - no membership_id in metadata");
    return;
  }

  if (session.mode === "subscription" && session.subscription) {
    const subscriptionId = typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id;

    console.log(`[Webhook] Saving subscription ${subscriptionId} to membership ${metadata.membership_id}`);

    // Check if enrollment fee was included in this checkout
    const includesEnrollmentFee = metadata.includes_enrollment_fee === "true";
    const enrollmentFeeAmountCents = metadata.enrollment_fee_amount_cents
      ? parseInt(metadata.enrollment_fee_amount_cents, 10)
      : null;

    // Build update object
    const membershipUpdate: Record<string, unknown> = {
      stripe_subscription_id: subscriptionId,
      auto_pay_enabled: true,
      subscription_status: "active",
      updated_at: new Date().toISOString(),
    };

    // If enrollment fee was included, mark it as paid
    if (includesEnrollmentFee) {
      membershipUpdate.enrollment_fee_paid = true;
      console.log(`[Webhook] Marking enrollment fee as paid for membership ${metadata.membership_id}`);

      // Create enrollment fee payment record
      if (enrollmentFeeAmountCents && metadata.organization_id && metadata.member_id) {
        const enrollmentFeeAmount = enrollmentFeeAmountCents / 100;

        const { error: paymentError } = await supabase
          .from("payments")
          .insert({
            organization_id: metadata.organization_id,
            membership_id: metadata.membership_id,
            member_id: metadata.member_id,
            type: "enrollment_fee",
            method: "stripe",
            status: "completed",
            amount: enrollmentFeeAmount,
            months_credited: 0, // Enrollment fee doesn't credit months
            notes: "Enrollment fee collected via Stripe Checkout (with subscription setup)",
            paid_at: new Date().toISOString(),
          });

        if (paymentError) {
          console.error("[Webhook] Failed to create enrollment fee payment record:", paymentError);
          // Don't throw - continue with membership update
        } else {
          console.log(`[Webhook] Created enrollment fee payment record for ${metadata.membership_id}`);
        }
      }
    }

    // Fetch payment method details from the subscription so the UI can
    // display card brand / last4 immediately after checkout completes.
    if (stripe) {
      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const pmId = typeof subscription.default_payment_method === "string"
          ? subscription.default_payment_method
          : subscription.default_payment_method?.id;

        if (pmId) {
          const pm = await stripe.paymentMethods.retrieve(pmId);
          const pmDetails: Record<string, unknown> = {
            type: pm.type === "us_bank_account" ? "us_bank_account" : "card",
            last4: pm.card?.last4 || pm.us_bank_account?.last4 || "****",
          };
          if (pm.card) {
            pmDetails.brand = pm.card.brand;
            pmDetails.expiryMonth = pm.card.exp_month;
            pmDetails.expiryYear = pm.card.exp_year;
          }
          if (pm.us_bank_account) {
            pmDetails.bankName = pm.us_bank_account.bank_name;
          }

          membershipUpdate.payment_method = pmDetails;
          console.log(`[Webhook] Saved payment method (${pm.type} ****${pmDetails.last4}) for membership ${metadata.membership_id}`);
        }
      } catch (pmErr) {
        // Non-fatal — subscription is more important than card details
        console.error("[Webhook] Failed to fetch payment method details:", pmErr);
      }
    }

    const { error } = await supabase
      .from("memberships")
      .update(membershipUpdate)
      .eq("id", metadata.membership_id);

    if (error) {
      console.error("[Webhook] Failed to update membership:", error);
      throw error;
    }

    console.log(`[Webhook] Membership ${metadata.membership_id} updated with subscription${includesEnrollmentFee ? " and enrollment fee marked paid" : ""}`);

    // Mark onboarding invite as completed if one exists for this checkout session
    if (session.id) {
      try {
        const invite = await OnboardingInvitesService.getByCheckoutSessionId(session.id, supabase);
        if (invite) {
          await OnboardingInvitesService.recordFullPayment(invite.id, supabase);
          console.log(`[Webhook] Marked onboarding invite ${invite.id} as completed`);
        }
      } catch (err) {
        // Log but don't fail the webhook if invite update fails
        console.error("[Webhook] Failed to update onboarding invite:", err);
      }
    }
  }
}

/**
 * Handle customer.subscription.created/updated
 * Sync subscription status to local database
 */
async function handleSubscriptionUpdate(
  subscription: Stripe.Subscription,
  supabase: ReturnType<typeof createServiceRoleClient>
) {
  const metadata = subscription.metadata;

  if (!metadata?.membership_id) {
    console.log("[Webhook] subscription.updated - no membership_id in metadata");
    return;
  }

  // Map Stripe status to our status
  const statusMap: Record<Stripe.Subscription.Status, string> = {
    active: "active",
    trialing: "trialing",
    past_due: "past_due",
    canceled: "canceled",
    unpaid: "unpaid",
    incomplete: "incomplete",
    incomplete_expired: "incomplete_expired",
    paused: "paused",
  };

  const localStatus = statusMap[subscription.status] || subscription.status;

  console.log(`[Webhook] Updating subscription status to ${localStatus} for membership ${metadata.membership_id}`);

  const { error } = await supabase
    .from("memberships")
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: localStatus,
      auto_pay_enabled: subscription.status === "active" || subscription.status === "trialing",
      updated_at: new Date().toISOString(),
    })
    .eq("id", metadata.membership_id);

  if (error) {
    console.error("[Webhook] Failed to update membership subscription status:", error);
    throw error;
  }

  console.log(`[Webhook] Membership ${metadata.membership_id} subscription status updated to ${localStatus}`);
}

/**
 * Handle customer.subscription.deleted
 * Mark subscription as canceled and CLEAR stripe_subscription_id
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  supabase: ReturnType<typeof createServiceRoleClient>
) {
  const metadata = subscription.metadata;

  if (!metadata?.membership_id) {
    console.log("[Webhook] subscription.deleted - no membership_id in metadata");
    return;
  }

  console.log(`[Webhook] Subscription deleted for membership ${metadata.membership_id}`);

  // IMPORTANT: Clear stripe_subscription_id so the record doesn't look tied to Stripe
  const { error } = await supabase
    .from("memberships")
    .update({
      stripe_subscription_id: null, // Clear the subscription ID
      subscription_status: "canceled",
      auto_pay_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", metadata.membership_id);

  if (error) {
    console.error("[Webhook] Failed to update membership after subscription deletion:", error);
    throw error;
  }

  console.log(`[Webhook] Membership ${metadata.membership_id} subscription cleared and marked as canceled`);
}

/**
 * Handle invoice.created
 * Sets application_fee_amount on subscription invoices for Connect accounts.
 * This ensures the platform keeps its fee when money is transferred to the org.
 *
 * Stripe fires this when a draft invoice is created for a subscription.
 * We update the invoice before it's finalized and charged.
 */
async function handleInvoiceCreated(
  invoice: InvoiceWithSubscription,
  supabase: ReturnType<typeof createServiceRoleClient>
) {
  if (!stripe) return;

  // Only process subscription invoices
  if (!invoice.subscription) {
    console.log("[Webhook] invoice.created - not a subscription invoice, skipping");
    return;
  }

  // Skip if invoice already has an application fee set
  if ((invoice as any).application_fee_amount) {
    console.log("[Webhook] invoice.created - application_fee_amount already set, skipping");
    return;
  }

  const subscriptionId = typeof invoice.subscription === "string"
    ? invoice.subscription
    : invoice.subscription.id;

  // Look up membership by subscription ID
  const { data: membership } = await supabase
    .from("memberships")
    .select("id, organization_id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (!membership) {
    console.log(`[Webhook] invoice.created - no membership found for subscription ${subscriptionId}`);
    return;
  }

  // Get org's Connect and fee settings
  const { data: org } = await supabase
    .from("organizations")
    .select("stripe_connect_id, stripe_onboarded, platform_fee, pass_fees_to_member")
    .eq("id", membership.organization_id)
    .single();

  if (!org?.stripe_connect_id || !org.stripe_onboarded) {
    // No Connect account — nothing to split, platform holds all funds
    console.log("[Webhook] invoice.created - org has no Connect account, skipping fee split");
    return;
  }

  // Calculate fees based on the invoice amount
  const invoiceAmountCents = invoice.amount_due || 0;
  if (invoiceAmountCents <= 0) {
    console.log("[Webhook] invoice.created - $0 invoice, skipping");
    return;
  }

  const platformFeeDollars = org.platform_fee || 0;
  const passFeesToMember = org.pass_fees_to_member || false;

  // Determine the base amount for fee calculation
  // In both modes, the invoice amount includes the platform fee, so we reverse calculate
  const baseAmountCents = reverseCalculateBaseAmount(invoiceAmountCents, platformFeeDollars, passFeesToMember);

  const fees = calculateFees(baseAmountCents, platformFeeDollars, passFeesToMember);

  console.log(`[Webhook] Setting application_fee_amount on invoice ${invoice.id}`, {
    invoiceAmount: invoiceAmountCents,
    applicationFee: fees.applicationFeeCents,
    platformFee: fees.platformFeeCents,
    stripeFee: fees.stripeFeeCents,
    orgReceives: fees.netAmountCents,
  });

  try {
    await stripe.invoices.update(invoice.id, {
      application_fee_amount: fees.applicationFeeCents,
    });
    console.log(`[Webhook] application_fee_amount set to ${fees.applicationFeeCents} cents on invoice ${invoice.id}`);
  } catch (err) {
    // If the invoice is already finalized we can't update it — log but don't fail the webhook
    console.error(`[Webhook] Failed to set application_fee_amount on invoice ${invoice.id}:`, err);
  }
}

/**
 * Handle invoice.paid
 * Creates a payment record and routes through settlePayment engine
 */
async function handleInvoicePaid(
  invoice: InvoiceWithSubscription,
  supabase: ReturnType<typeof createServiceRoleClient>
) {
  // Get membership_id from metadata or subscription
  let membershipId = (invoice.metadata as Record<string, string>)?.membership_id;
  let organizationId = (invoice.metadata as Record<string, string>)?.organization_id;
  let memberId = (invoice.metadata as Record<string, string>)?.member_id;

  // Try to find from subscription if not in invoice metadata
  if (!membershipId && invoice.subscription) {
    const subscriptionId = typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription.id;

    // Look up membership by subscription ID
    const { data: membership } = await supabase
      .from("memberships")
      .select("id, organization_id, member_id, billing_frequency, plan:plans(pricing)")
      .eq("stripe_subscription_id", subscriptionId)
      .single();

    if (membership) {
      membershipId = membership.id;
      organizationId = membership.organization_id;
      memberId = membership.member_id;
    }
  }

  if (!membershipId || !organizationId) {
    console.log("[Webhook] invoice.paid - could not determine membership_id or organization_id");
    return;
  }

  // Skip $0 invoices (setup fees, etc.)
  if (!invoice.amount_paid || invoice.amount_paid <= 0) {
    console.log("[Webhook] invoice.paid - skipping $0 invoice");
    return;
  }

  // Check if this invoice includes enrollment fee (from subscription metadata)
  // We need to subtract it since enrollment fee is handled separately in checkout.session.completed
  let enrollmentFeeAmountCents = 0;
  const subscriptionMetadata = (invoice as any).subscription_details?.metadata || {};
  if (subscriptionMetadata.includes_enrollment_fee === "true" && invoice.billing_reason === "subscription_create") {
    // This is the first invoice with enrollment fee - we need to exclude it from dues calculation
    enrollmentFeeAmountCents = subscriptionMetadata.enrollment_fee_amount_cents
      ? parseInt(subscriptionMetadata.enrollment_fee_amount_cents, 10)
      : 0;
    console.log(`[Webhook] First invoice includes enrollment fee of ${enrollmentFeeAmountCents} cents - will exclude from dues`);
  }

  // Calculate dues amount (total paid minus enrollment fee if applicable)
  const totalAmountCents = invoice.amount_paid;
  const duesAmountCents = totalAmountCents - enrollmentFeeAmountCents;

  // If after subtracting enrollment fee there's nothing left for dues, skip
  if (duesAmountCents <= 0) {
    console.log("[Webhook] invoice.paid - no dues amount after enrollment fee, skipping");
    return;
  }

  const amount = duesAmountCents / 100;
  const paymentIntentId = typeof invoice.payment_intent === "string"
    ? invoice.payment_intent
    : invoice.payment_intent?.id;

  console.log(`[Webhook] Invoice paid: $${amount} for membership ${membershipId}`);

  // Check if payment already exists for this invoice (idempotency at payment level)
  const { data: existingPayment } = await supabase
    .from("payments")
    .select("id")
    .or(`stripe_payment_intent_id.eq.${paymentIntentId}`)
    .eq("membership_id", membershipId)
    .eq("status", "completed")
    .maybeSingle();

  if (existingPayment) {
    console.log(`[Webhook] Payment already exists for this invoice (payment_id: ${existingPayment.id})`);
    return;
  }

  // Get membership details for months calculation
  const { data: membershipData } = await supabase
    .from("memberships")
    .select("billing_frequency, plan:plans(pricing)")
    .eq("id", membershipId)
    .single();

  if (!membershipData) {
    console.error("[Webhook] Membership not found:", membershipId);
    return;
  }

  // Get organization for timezone, platform fee, and fee settings
  const { data: org } = await supabase
    .from("organizations")
    .select("timezone, platform_fee, stripe_connect_id, pass_fees_to_member")
    .eq("id", organizationId)
    .single();

  const orgTimezone = org?.timezone || "America/Los_Angeles";
  const platformFeeDollars = org?.platform_fee || 0;
  const isConnectPayment = !!org?.stripe_connect_id;
  const passFeesToMember = org?.pass_fees_to_member || false;
  const today = getTodayInOrgTimezone(orgTimezone);

  // Determine base amount (dues) vs total charged
  // In both modes, the charge includes the platform fee, so we always reverse calculate
  const chargeAmountCents = Math.round(amount * 100);
  const baseAmountCents = reverseCalculateBaseAmount(chargeAmountCents, platformFeeDollars, passFeesToMember);
  const baseAmount = baseAmountCents / 100;

  // Calculate months credited based on billing frequency and plan pricing
  // Use baseAmount (actual dues) for comparison, not the charged amount
  const billingFrequency = membershipData.billing_frequency as BillingFrequency;
  // Type assertion for joined plan data
  const planData = membershipData.plan as unknown as { pricing: { monthly: number; biannual: number; annual: number } } | { pricing: { monthly: number; biannual: number; annual: number } }[] | null;
  const planPricing = Array.isArray(planData)
    ? planData[0]?.pricing
    : planData?.pricing;

  let monthsCredited = 1;
  if (planPricing) {
    // Determine months from base amount vs plan pricing
    const monthlyPrice = planPricing.monthly || 0;
    const biannualPrice = planPricing.biannual || 0;
    const annualPrice = planPricing.annual || 0;

    if (monthlyPrice > 0 && Math.abs(baseAmount - monthlyPrice) < 1) {
      monthsCredited = 1;
    } else if (biannualPrice > 0 && Math.abs(baseAmount - biannualPrice) < 1) {
      monthsCredited = 6;
    } else if (annualPrice > 0 && Math.abs(baseAmount - annualPrice) < 1) {
      monthsCredited = 12;
    } else {
      // Fallback: use billing frequency
      switch (billingFrequency) {
        case "monthly":
          monthsCredited = 1;
          break;
        case "biannual":
          monthsCredited = 6;
          break;
        case "annual":
          monthsCredited = 12;
          break;
      }
    }
  }

  // Generate invoice metadata
  const invoiceMetadata = await generateAdHocInvoiceMetadata(
    organizationId,
    today,
    monthsCredited,
    orgTimezone,
    supabase
  );

  // Calculate fees using org's settings
  const fees = calculateFees(baseAmountCents, platformFeeDollars, passFeesToMember);
  const stripeFee = fees.breakdown.stripeFee;
  const platformFee = fees.breakdown.platformFee;
  const netAmount = fees.netAmountCents / 100;
  const totalCharged = fees.breakdown.chargeAmount;

  // Build notes
  let notes = `Stripe subscription payment - Invoice ${invoice.number || invoice.id}`;
  if (passFeesToMember) {
    notes += ` | Base: $${baseAmount.toFixed(2)} + Fees: $${fees.breakdown.totalFees.toFixed(2)}`;
  }
  if (isConnectPayment) {
    notes += " (via Connect)";
  }

  // Create payment record
  const { data: newPayment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      organization_id: organizationId,
      membership_id: membershipId,
      member_id: memberId,
      type: "dues",
      method: "stripe" as PaymentMethod,
      status: "pending", // Will be settled below
      amount: baseAmount, // Base dues amount
      stripe_fee: stripeFee,
      platform_fee: platformFee,
      total_charged: totalCharged, // What member actually paid
      net_amount: netAmount, // What org receives
      months_credited: monthsCredited,
      invoice_number: invoiceMetadata.invoiceNumber,
      due_date: invoiceMetadata.dueDate,
      period_start: invoiceMetadata.periodStart,
      period_end: invoiceMetadata.periodEnd,
      period_label: invoiceMetadata.periodLabel,
      stripe_payment_intent_id: paymentIntentId,
      notes,
    })
    .select()
    .single();

  if (paymentError || !newPayment) {
    console.error("[Webhook] Failed to create payment record:", paymentError);
    throw paymentError;
  }

  console.log(`[Webhook] Created payment ${newPayment.id}, now settling via engine`);

  // Settle payment through the billing engine
  const result = await settlePayment({
    paymentId: newPayment.id,
    method: "stripe",
    paidAt: new Date().toISOString(),
    stripePaymentIntentId: paymentIntentId,
    supabase,
  });

  if (!result.success) {
    console.error("[Webhook] Failed to settle payment:", result.error);
    throw new Error(result.error || "Settlement failed");
  }

  console.log(`[Webhook] Payment settled: ${newPayment.id}, new paid_months: ${result.newPaidMonths}, status: ${result.newStatus}`);
  if (result.becameEligible) {
    console.log(`[Webhook] Membership ${membershipId} became ELIGIBLE!`);
  }
}

/**
 * Handle invoice.payment_failed
 * Log the failure and update membership status
 */
async function handleInvoiceFailed(
  invoice: InvoiceWithSubscription,
  supabase: ReturnType<typeof createServiceRoleClient>
) {
  // Get membership_id from metadata or subscription
  let membershipId = (invoice.metadata as Record<string, string>)?.membership_id;
  let organizationId = (invoice.metadata as Record<string, string>)?.organization_id;

  if (!membershipId && invoice.subscription) {
    const subscriptionId = typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription.id;

    const { data: membership } = await supabase
      .from("memberships")
      .select("id, organization_id")
      .eq("stripe_subscription_id", subscriptionId)
      .single();

    if (membership) {
      membershipId = membership.id;
      organizationId = membership.organization_id;
    }
  }

  if (!membershipId) {
    console.log("[Webhook] invoice.payment_failed - could not determine membership_id");
    return;
  }

  const amount = (invoice.amount_due || 0) / 100;
  console.log(`[Webhook] Invoice payment failed: $${amount} for membership ${membershipId}`);

  // Update subscription status to reflect payment issue
  const { error } = await supabase
    .from("memberships")
    .update({
      subscription_status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("id", membershipId);

  if (error) {
    console.error("[Webhook] Failed to update membership after payment failure:", error);
  }

  // Create failed payment record for audit trail
  await supabase
    .from("payments")
    .insert({
      organization_id: organizationId,
      membership_id: membershipId,
      type: "dues",
      method: "stripe",
      status: "failed",
      amount: amount,
      months_credited: 0,
      notes: `Payment failed - ${invoice.last_finalization_error?.message || "Unknown error"}`,
    });
}

/**
 * Handle payment_intent.succeeded
 * For one-off charges not tied to subscriptions/invoices
 */
async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  supabase: ReturnType<typeof createServiceRoleClient>
) {
  const metadata = paymentIntent.metadata;

  // Skip if no membership context (could be unrelated Stripe charge)
  if (!metadata?.membership_id) {
    console.log("[Webhook] payment_intent.succeeded - no membership_id in metadata, skipping");
    return;
  }

  // Check if there's a pending payment for this intent
  const { data: existingPayment } = await supabase
    .from("payments")
    .select("id, status")
    .eq("stripe_payment_intent_id", paymentIntent.id)
    .maybeSingle();

  if (existingPayment) {
    if (existingPayment.status === "completed") {
      console.log(`[Webhook] Payment ${existingPayment.id} already completed for intent ${paymentIntent.id}`);
      return;
    }

    if (existingPayment.status === "pending") {
      // Settle the existing payment
      console.log(`[Webhook] Settling existing payment ${existingPayment.id} for intent ${paymentIntent.id}`);

      const result = await settlePayment({
        paymentId: existingPayment.id,
        method: "stripe",
        paidAt: new Date().toISOString(),
        stripePaymentIntentId: paymentIntent.id,
        supabase,
      });

      if (!result.success) {
        console.error("[Webhook] Failed to settle payment:", result.error);
        throw new Error(result.error || "Settlement failed");
      }

      console.log(`[Webhook] Payment settled: ${existingPayment.id}`);
      return;
    }
  }

  // No existing payment - this might be from a different flow
  // Log but don't create a new payment (avoid orphaned records)
  console.log(`[Webhook] payment_intent.succeeded with no matching payment record, intent: ${paymentIntent.id}`);
}

/**
 * Handle payment_intent.payment_failed
 * For one-off charge failures
 */
async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent,
  supabase: ReturnType<typeof createServiceRoleClient>
) {
  const metadata = paymentIntent.metadata;

  if (!metadata?.membership_id) {
    console.log("[Webhook] payment_intent.payment_failed - no membership_id in metadata, skipping");
    return;
  }

  // Check if there's a pending payment for this intent
  const { data: existingPayment } = await supabase
    .from("payments")
    .select("id, status, notes")
    .eq("stripe_payment_intent_id", paymentIntent.id)
    .maybeSingle();

  if (existingPayment && existingPayment.status === "pending") {
    // Mark as failed
    const errorMessage = paymentIntent.last_payment_error?.message || "Payment failed";

    await supabase
      .from("payments")
      .update({
        status: "failed",
        notes: existingPayment.notes
          ? `${existingPayment.notes}\nFailed: ${errorMessage}`
          : `Failed: ${errorMessage}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingPayment.id);

    console.log(`[Webhook] Marked payment ${existingPayment.id} as failed`);
  }
}
