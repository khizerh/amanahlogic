import { NextResponse } from "next/server";

import { MembershipsService } from "@/lib/database/memberships";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { stripe, isStripeConfigured } from "@/lib/stripe";

interface SwitchToManualBody {
  membershipId: string;
}

/**
 * POST /api/memberships/switch-to-manual
 *
 * Switch a member from Stripe recurring payments to manual payments.
 * This will:
 * 1. Cancel the Stripe subscription (if exists)
 * 2. Set auto_pay_enabled = false
 * 3. Clear stripe_subscription_id
 * 4. Set subscription_status = 'canceled'
 *
 * After this, manual payments (cash/check/zelle) can be recorded.
 */
export async function POST(req: Request) {
  try {
    const organizationId = await getOrganizationId();

    const { membershipId }: SwitchToManualBody = await req.json();

    if (!membershipId) {
      return NextResponse.json(
        { error: "membershipId is required" },
        { status: 400 }
      );
    }

    // Get membership
    const membership = await MembershipsService.getById(membershipId);
    if (!membership || membership.organizationId !== organizationId) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    // Check if already on manual payments
    if (!membership.autoPayEnabled && !membership.stripeSubscriptionId) {
      return NextResponse.json({
        success: true,
        message: "Member is already on manual payments",
        alreadyManual: true,
      });
    }

    let subscriptionCanceled = false;
    let stripeError: string | null = null;

    // Cancel Stripe subscription if it exists
    if (membership.stripeSubscriptionId && isStripeConfigured() && stripe) {
      try {
        const subscription = await stripe.subscriptions.retrieve(
          membership.stripeSubscriptionId
        );

        // Only cancel if not already canceled
        if (subscription.status !== "canceled") {
          await stripe.subscriptions.cancel(membership.stripeSubscriptionId, {
            // Cancel immediately, not at period end
            // If you want to let them use remaining time, use:
            // cancel_at_period_end: true
          });
          subscriptionCanceled = true;
        } else {
          // Already canceled in Stripe
          subscriptionCanceled = true;
        }
      } catch (error) {
        // Subscription might not exist in Stripe (deleted, test mode, etc.)
        // Log but continue with local updates
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn("Failed to cancel Stripe subscription:", {
          subscriptionId: membership.stripeSubscriptionId,
          error: errorMessage,
        });
        stripeError = errorMessage;

        // If subscription doesn't exist in Stripe, that's fine - continue
        if (errorMessage.includes("No such subscription")) {
          subscriptionCanceled = true;
          stripeError = null;
        }
      }
    } else if (membership.stripeSubscriptionId && !isStripeConfigured()) {
      // Stripe not configured but subscription ID exists
      stripeError = "Stripe is not configured. Subscription may still be active in Stripe.";
    }

    // Update membership to disable recurring payments
    await MembershipsService.update({
      id: membershipId,
      autoPayEnabled: false,
      stripeSubscriptionId: null,
      subscriptionStatus: "canceled",
      // Keep stripeCustomerId for future use if they want to set up recurring payments again
      // Keep paymentMethod for display purposes
    });

    return NextResponse.json({
      success: true,
      message: "Switched to manual payments",
      subscriptionCanceled,
      previousSubscriptionId: membership.stripeSubscriptionId,
      ...(stripeError && { stripeWarning: stripeError }),
    });
  } catch (error) {
    console.error("Error switching to manual:", error);
    const message = error instanceof Error ? error.message : "Failed to switch to manual payments";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
