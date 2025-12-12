import type Stripe from "stripe";
import type { HandlerContext } from "../types";
import { logger } from "@/lib/logger";

/**
 * Handle customer.subscription.created and customer.subscription.updated events.
 * Updates subscription record and manages membership state.
 */
export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  ctx: HandlerContext
): Promise<void> {
  const { supabase } = ctx;
  const metadata = subscription.metadata;

  // Refuse to upsert if critical metadata is missing (prevents orphaned records)
  if (!metadata.organization_id || !metadata.membership_id) {
    logger.warn("Subscription update missing critical metadata - skipping upsert", {
      subscriptionId: subscription.id,
      hasOrgId: !!metadata.organization_id,
      hasMembershipId: !!metadata.membership_id,
    });
    return;
  }

  const stripeCustomerApiId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id || null;

  // TODO: Implement stripe_customers table lookup and creation
  // For now, we'll skip customer record management during development
  let stripeCustomerRecordId: string | null = null;

  if (stripeCustomerApiId) {
    logger.info("Stripe customer in subscription", { stripeCustomerApiId });
    // TODO: Look up or create stripe_customer record
    // const { data: existingCustomer } = await supabase
    //   .from("stripe_customers")
    //   .select("id")
    //   .eq("stripe_customer_id", stripeCustomerApiId)
    //   .eq("organization_id", metadata.organization_id)
    //   .maybeSingle();
  }

  // TODO: Implement stripe_subscriptions table upsert
  // This will track the subscription lifecycle
  const sub = subscription as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };

  logger.info("Subscription update - would upsert to stripe_subscriptions", {
    subscriptionId: subscription.id,
    membershipId: metadata.membership_id,
    status: subscription.status,
    currentPeriodStart: sub.current_period_start
      ? new Date(sub.current_period_start * 1000).toISOString()
      : null,
    currentPeriodEnd: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
  });

  // CRITICAL: Nullify next_billing_date when subscription is created/active
  // This prevents the billing engine from picking up this membership.
  // Stripe handles all billing for subscriptions - our billing engine should never touch them.
  if (subscription.status === "active" || subscription.status === "trialing") {
    // TODO: Update memberships table
    logger.info("Subscription active - would nullify next_billing_date on membership", {
      membershipId: metadata.membership_id,
      subscriptionStatus: subscription.status,
    });

    // Example implementation (uncomment when memberships table exists):
    // const { error: membershipUpdateError } = await supabase
    //   .from("memberships")
    //   .update({
    //     next_billing_date: null,
    //     billing_method: "stripe_subscription",
    //     status: "active",
    //   })
    //   .eq("id", metadata.membership_id);
    //
    // if (membershipUpdateError) {
    //   logger.error("Failed to update membership after subscription creation", {
    //     membershipId: metadata.membership_id,
    //     error: membershipUpdateError.message,
    //   });
    // }
  }

  logger.info("Subscription updated", { subscriptionId: subscription.id });
}

/**
 * Handle customer.subscription.deleted event.
 * Updates subscription status and optionally marks membership as lapsed.
 */
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  ctx: HandlerContext
): Promise<void> {
  const { supabase } = ctx;
  const metadata = subscription.metadata;

  // Refuse to process if critical metadata is missing
  if (!metadata.organization_id || !metadata.membership_id) {
    logger.warn("Subscription deletion missing critical metadata - skipping", {
      subscriptionId: subscription.id,
      hasOrgId: !!metadata.organization_id,
      hasMembershipId: !!metadata.membership_id,
    });
    return;
  }

  // TODO: Update subscription status to canceled in stripe_subscriptions table
  logger.info("Subscription deleted - would mark as canceled", {
    subscriptionId: subscription.id,
    membershipId: metadata.membership_id,
  });

  // Check membership billing_method before marking as lapsed
  // If billing_method is "manual", the admin converted to manual billing - keep membership active
  const canceledDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // TODO: Fetch membership to check billing_method
  // const { data: membership } = await supabase
  //   .from("memberships")
  //   .select("billing_notes, billing_method")
  //   .eq("id", metadata.membership_id)
  //   .single();

  const noteLine = `Subscription canceled ${canceledDate} (Stripe subscription deleted)`;

  // TODO: Update membership based on billing_method
  // If converted to manual, keep active; otherwise mark as lapsed
  logger.info("Subscription deleted - would update membership", {
    subscriptionId: subscription.id,
    membershipId: metadata.membership_id,
    note: noteLine,
  });

  // Example implementation (uncomment when memberships table exists):
  // if (membership?.billing_method === "manual") {
  //   // Just update notes, keep membership active
  //   await supabase
  //     .from("memberships")
  //     .update({
  //       billing_notes: membership.billing_notes
  //         ? `${membership.billing_notes}\n${noteLine}`
  //         : noteLine,
  //     })
  //     .eq("id", metadata.membership_id);
  //
  //   logger.info("Subscription deleted but membership kept active (converted to manual)", {
  //     membershipId: metadata.membership_id,
  //   });
  // } else {
  //   // Mark membership as lapsed - subscription was canceled
  //   await supabase
  //     .from("memberships")
  //     .update({
  //       status: "lapsed",
  //       next_billing_date: null,
  //       billing_notes: membership?.billing_notes
  //         ? `${membership.billing_notes}\n${noteLine}`
  //         : noteLine,
  //     })
  //     .eq("id", metadata.membership_id);
  //
  //   logger.info("Subscription deleted and membership marked as lapsed", {
  //     membershipId: metadata.membership_id,
  //   });
  // }

  logger.info("Subscription deletion handled", { subscriptionId: subscription.id });
}
