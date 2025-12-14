import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Extended Invoice type with optional fields that may be present
 */
type InvoiceWithSubscription = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null;
  payment_intent?: string | Stripe.PaymentIntent | null;
};

// PINNED API VERSION - DO NOT CHANGE
// See: https://docs.stripe.com/changelog#2025-11-17.clover
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-11-17.clover",
});

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
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events for subscription lifecycle management.
 * Key events:
 * - checkout.session.completed: Save subscription ID to membership
 * - customer.subscription.updated: Sync subscription status
 * - customer.subscription.deleted: Handle cancellation
 * - invoice.paid: Increment paid months for recurring payments
 */
export async function POST(req: Request) {
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

  console.log(`[Webhook] Processing ${event.type}`);

  const supabase = createServiceRoleClient();

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

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`[Webhook] Error processing ${event.type}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Handle checkout.session.completed
 * When a subscription checkout completes, save the subscription ID to the membership
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

    const { error } = await supabase
      .from("memberships")
      .update({
        stripe_subscription_id: subscriptionId,
        auto_pay_enabled: true,
        subscription_status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", metadata.membership_id);

    if (error) {
      console.error("[Webhook] Failed to update membership:", error);
      throw error;
    }

    console.log(`[Webhook] Membership ${metadata.membership_id} updated with subscription`);
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
 * Mark subscription as canceled
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

  const { error } = await supabase
    .from("memberships")
    .update({
      subscription_status: "canceled",
      auto_pay_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", metadata.membership_id);

  if (error) {
    console.error("[Webhook] Failed to update membership after subscription deletion:", error);
    throw error;
  }

  console.log(`[Webhook] Membership ${metadata.membership_id} marked as canceled`);
}

/**
 * Handle invoice.paid
 * For subscription invoices, increment paid months
 */
async function handleInvoicePaid(
  invoice: InvoiceWithSubscription,
  supabase: ReturnType<typeof createServiceRoleClient>
) {
  // Get membership_id from metadata or subscription
  let membershipId = (invoice.metadata as Record<string, string>)?.membership_id;

  // Try to find from subscription if not in invoice metadata
  if (!membershipId && invoice.subscription) {
    const subscriptionId = typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription.id;

    // Look up membership by subscription ID
    const { data: membership } = await supabase
      .from("memberships")
      .select("id")
      .eq("stripe_subscription_id", subscriptionId)
      .single();

    membershipId = membership?.id;
  }

  if (!membershipId) {
    console.log("[Webhook] invoice.paid - could not determine membership_id");
    return;
  }

  // Skip $0 invoices (setup fees, etc.)
  if (!invoice.amount_paid || invoice.amount_paid <= 0) {
    console.log("[Webhook] invoice.paid - skipping $0 invoice");
    return;
  }

  const amount = invoice.amount_paid / 100;
  console.log(`[Webhook] Invoice paid: $${amount} for membership ${membershipId}`);

  // Get current membership to check if payment already recorded
  const { data: membership } = await supabase
    .from("memberships")
    .select("paid_months, status")
    .eq("id", membershipId)
    .single();

  if (!membership) {
    console.error("[Webhook] Membership not found:", membershipId);
    return;
  }

  // Increment paid_months by 1 (monthly subscription)
  // TODO: Calculate months based on invoice amount if needed
  const newPaidMonths = (membership.paid_months || 0) + 1;
  const becameEligible = membership.paid_months < 60 && newPaidMonths >= 60;

  const { error } = await supabase
    .from("memberships")
    .update({
      paid_months: newPaidMonths,
      status: newPaidMonths >= 60 ? "eligible" : "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", membershipId);

  if (error) {
    console.error("[Webhook] Failed to increment paid_months:", error);
    throw error;
  }

  console.log(`[Webhook] Membership ${membershipId} paid_months updated to ${newPaidMonths}`);
  if (becameEligible) {
    console.log(`[Webhook] Membership ${membershipId} became ELIGIBLE!`);
  }

  // Create payment record for tracking
  const { error: paymentError } = await supabase
    .from("payments")
    .insert({
      organization_id: (invoice.metadata as Record<string, string>)?.organization_id,
      membership_id: membershipId,
      member_id: (invoice.metadata as Record<string, string>)?.member_id,
      type: "dues",
      method: "stripe",
      status: "completed",
      amount: amount,
      stripe_fee: parseFloat((amount * 0.029 + 0.3).toFixed(2)),
      platform_fee: 1.0,
      total_charged: amount + parseFloat((amount * 0.029 + 0.3).toFixed(2)),
      net_amount: amount - 1.0,
      months_credited: 1,
      stripe_payment_intent_id: typeof invoice.payment_intent === "string"
        ? invoice.payment_intent
        : invoice.payment_intent?.id,
      notes: `Stripe subscription payment - Invoice ${invoice.number || invoice.id}`,
      paid_at: new Date().toISOString(),
    });

  if (paymentError) {
    // Log but don't fail - paid_months already updated
    console.error("[Webhook] Failed to create payment record:", paymentError);
  }
}

/**
 * Handle invoice.payment_failed
 * Log the failure and update membership status if needed
 */
async function handleInvoiceFailed(
  invoice: InvoiceWithSubscription,
  supabase: ReturnType<typeof createServiceRoleClient>
) {
  // Get membership_id from metadata or subscription
  let membershipId = (invoice.metadata as Record<string, string>)?.membership_id;

  if (!membershipId && invoice.subscription) {
    const subscriptionId = typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription.id;

    const { data: membership } = await supabase
      .from("memberships")
      .select("id")
      .eq("stripe_subscription_id", subscriptionId)
      .single();

    membershipId = membership?.id;
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

  // Create failed payment record
  await supabase
    .from("payments")
    .insert({
      organization_id: (invoice.metadata as Record<string, string>)?.organization_id,
      membership_id: membershipId,
      member_id: (invoice.metadata as Record<string, string>)?.member_id,
      type: "dues",
      method: "stripe",
      status: "failed",
      amount: amount,
      months_credited: 0,
      notes: `Payment failed - ${invoice.last_finalization_error?.message || "Unknown error"}`,
    });
}
