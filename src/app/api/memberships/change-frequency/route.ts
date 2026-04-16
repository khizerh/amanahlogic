import { NextResponse } from "next/server";

import { MembershipsService } from "@/lib/database/memberships";
import { PlansService } from "@/lib/database/plans";
import { OrganizationsService } from "@/lib/database/organizations";
import { OnboardingInvitesService } from "@/lib/database/onboarding-invites";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { updateSubscriptionPricing, getPlatformFee, cancelSetupIntent } from "@/lib/stripe";
import type { BillingFrequency, PlatformFees } from "@/lib/types";

interface ChangeFrequencyBody {
  membershipId: string;
  newFrequency: BillingFrequency;
}

const VALID_FREQUENCIES: BillingFrequency[] = ["monthly", "biannual", "annual"];

/**
 * POST /api/memberships/change-frequency
 *
 * Change the billing frequency of a membership.
 * If the membership has an active Stripe subscription, updates it too.
 */
export async function POST(req: Request) {
  try {
    const organizationId = await getOrganizationId();

    const { membershipId, newFrequency }: ChangeFrequencyBody = await req.json();

    if (!membershipId || !newFrequency) {
      return NextResponse.json(
        { error: "membershipId and newFrequency are required" },
        { status: 400 }
      );
    }

    if (!VALID_FREQUENCIES.includes(newFrequency)) {
      return NextResponse.json(
        { error: `Invalid frequency. Must be one of: ${VALID_FREQUENCIES.join(", ")}` },
        { status: 400 }
      );
    }

    // Get membership and verify it belongs to this organization
    const membership = await MembershipsService.getById(membershipId);
    if (!membership || membership.organizationId !== organizationId) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    const previousFrequency = membership.billingFrequency;

    // Update billing frequency in DB
    await MembershipsService.update({
      id: membershipId,
      billingFrequency: newFrequency,
    });

    // Sync Stripe subscription if one exists
    let stripeUpdated = false;
    if (membership.stripeSubscriptionId && (membership.subscriptionStatus === "active" || membership.subscriptionStatus === "trialing")) {
      try {
        const [plan, org] = await Promise.all([
          PlansService.getById(membership.planId),
          OrganizationsService.getById(organizationId),
        ]);

        if (plan && org) {
          const newDuesAmountCents = Math.round((plan.pricing[newFrequency] || 0) * 100);
          const platformFeeDollars = getPlatformFee(org.platformFees as PlatformFees | null, newFrequency);

          await updateSubscriptionPricing({
            subscriptionId: membership.stripeSubscriptionId,
            newDuesAmountCents,
            newBillingFrequency: newFrequency,
            passFeesToMember: org.passFeesToMember || false,
            platformFeeDollars,
            planName: plan.name,
            stripeConnectAccountId: org.stripeConnectId || undefined,
          });
          stripeUpdated = true;
        }
      } catch (error) {
        console.error("Failed to update Stripe subscription for frequency change:", error);
        // DB is already updated — log but don't fail the request
      }
    }

    // Invalidate any pending payment links (SetupIntents) that have stale frequency/amount
    let pendingLinkInvalidated = false;
    try {
      const pendingInvite = await OnboardingInvitesService.getPendingForMembership(membershipId);
      if (pendingInvite?.stripeSetupIntentId) {
        await cancelSetupIntent(pendingInvite.stripeSetupIntentId);
        await OnboardingInvitesService.markCanceled(pendingInvite.id);
        pendingLinkInvalidated = true;
        console.log(`[ChangeFrequency] Invalidated pending SetupIntent ${pendingInvite.stripeSetupIntentId} for membership ${membershipId}`);
      }
    } catch (error) {
      console.error("Failed to invalidate pending payment link:", error);
      // Don't fail the request — frequency is already updated
    }

    return NextResponse.json({
      success: true,
      previousFrequency,
      newFrequency,
      stripeUpdated,
      pendingLinkInvalidated,
    });
  } catch (error) {
    console.error("Error changing billing frequency:", error);
    const message = error instanceof Error ? error.message : "Failed to change billing frequency";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
