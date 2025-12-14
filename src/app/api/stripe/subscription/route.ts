import { NextResponse } from "next/server";

import { MembershipsService } from "@/lib/database/memberships";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import {
  isStripeConfigured,
  pauseSubscription,
  resumeSubscription,
} from "@/lib/stripe";

interface SubscriptionActionBody {
  membershipId: string;
  action: "pause" | "resume";
}

/**
 * POST /api/stripe/subscription
 *
 * Pause or resume a Stripe subscription.
 */
export async function POST(req: Request) {
  try {
    const organizationId = await getOrganizationId();

    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 503 }
      );
    }

    const { membershipId, action }: SubscriptionActionBody = await req.json();

    if (!membershipId || !action) {
      return NextResponse.json(
        { error: "membershipId and action are required" },
        { status: 400 }
      );
    }

    if (action !== "pause" && action !== "resume") {
      return NextResponse.json(
        { error: "action must be 'pause' or 'resume'" },
        { status: 400 }
      );
    }

    // Get membership
    const membership = await MembershipsService.getById(membershipId);
    if (!membership || membership.organizationId !== organizationId) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    // Check for subscription
    if (!membership.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "Member does not have an active Stripe subscription" },
        { status: 400 }
      );
    }

    // Perform action
    if (action === "pause") {
      if (membership.subscriptionStatus === "paused") {
        return NextResponse.json({
          success: true,
          message: "Subscription is already paused",
          alreadyPaused: true,
        });
      }

      await pauseSubscription(membership.stripeSubscriptionId);

      // Update local status
      await MembershipsService.update({
        id: membershipId,
        subscriptionStatus: "paused",
      });

      return NextResponse.json({
        success: true,
        message: "Subscription paused",
        newStatus: "paused",
      });
    } else {
      // Resume
      if (membership.subscriptionStatus === "active") {
        return NextResponse.json({
          success: true,
          message: "Subscription is already active",
          alreadyActive: true,
        });
      }

      await resumeSubscription(membership.stripeSubscriptionId);

      // Update local status
      await MembershipsService.update({
        id: membershipId,
        subscriptionStatus: "active",
      });

      return NextResponse.json({
        success: true,
        message: "Subscription resumed",
        newStatus: "active",
      });
    }
  } catch (error) {
    console.error("Error managing subscription:", error);
    const message = error instanceof Error ? error.message : "Failed to manage subscription";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
