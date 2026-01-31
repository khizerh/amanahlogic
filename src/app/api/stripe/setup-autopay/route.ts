import { NextResponse } from "next/server";

import { MembershipsService } from "@/lib/database/memberships";
import { MembersService } from "@/lib/database/members";
import { PlansService } from "@/lib/database/plans";
import { OrganizationsService } from "@/lib/database/organizations";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import {
  isStripeConfigured,
  getOrCreateStripeCustomer,
  createSetupIntent,
  calculateFees,
} from "@/lib/stripe";

interface SetupAutopayBody {
  membershipId: string;
  memberId: string;
  /** If true, skip enrollment fee even if not paid (for special cases) */
  skipEnrollmentFee?: boolean;
}

/**
 * POST /api/stripe/setup-autopay
 *
 * Create a Stripe Checkout Session for setting up recurring payment subscription.
 * Returns a URL that the member should be redirected to.
 */
export async function POST(req: Request) {
  try {
    const organizationId = await getOrganizationId();

    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: "Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment." },
        { status: 503 }
      );
    }

    const { membershipId, memberId, skipEnrollmentFee }: SetupAutopayBody = await req.json();

    if (!membershipId || !memberId) {
      return NextResponse.json(
        { error: "membershipId and memberId are required" },
        { status: 400 }
      );
    }

    // Get membership
    const membership = await MembershipsService.getById(membershipId);
    if (!membership || membership.organizationId !== organizationId) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    // Check if already on recurring payments
    if (membership.autoPayEnabled && membership.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "Member already has autopay enabled" },
        { status: 400 }
      );
    }

    // Get member
    const member = await MembersService.getById(memberId);
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Get plan for pricing
    const plan = await PlansService.getById(membership.planId);
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer({
      memberId: member.id,
      membershipId: membership.id,
      email: member.email,
      name: `${member.firstName} ${member.lastName}`,
      organizationId,
    });

    // Calculate price based on membership's billing frequency
    const billingFrequency = membership.billingFrequency || "monthly";
    let priceAmount: number;

    switch (billingFrequency) {
      case "monthly":
        priceAmount = plan.pricing.monthly;
        break;
      case "biannual":
        priceAmount = plan.pricing.biannual;
        break;
      case "annual":
        priceAmount = plan.pricing.annual;
        break;
      default:
        priceAmount = plan.pricing.monthly;
    }

    const baseAmountCents = Math.round(priceAmount * 100);

    // Get organization for Connect config and fee settings
    const org = await OrganizationsService.getById(organizationId);
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Check if enrollment fee should be included
    // Include if: not paid AND not explicitly skipped
    const includeEnrollmentFee = !membership.enrollmentFeePaid && !skipEnrollmentFee;

    // Create SetupIntent (no expiration, unlike Checkout Sessions)
    const setupResult = await createSetupIntent({
      customerId,
      membershipId: membership.id,
      memberId: member.id,
      organizationId,
      planName: plan.name,
      duesAmountCents: baseAmountCents,
      enrollmentFeeAmountCents: includeEnrollmentFee ? Math.round(plan.enrollmentFee * 100) : 0,
      billingFrequency: billingFrequency as "monthly" | "biannual" | "annual",
      passFeesToMember: org.passFeesToMember || false,
      stripeConnectAccountId: org.stripeConnectId && org.stripeOnboarded ? org.stripeConnectId : undefined,
    });

    // Update membership with customer ID (subscription ID will be set by webhook)
    await MembershipsService.update({
      id: membershipId,
      stripeCustomerId: customerId,
    });

    // Calculate enrollment fee for response
    let enrollmentFeeAmount: number | undefined;
    if (includeEnrollmentFee) {
      const enrollmentFeeCents = Math.round(plan.enrollmentFee * 100);
      if (org.passFeesToMember) {
        const enrollmentFees = calculateFees(enrollmentFeeCents, org.platformFee || 0, true);
        enrollmentFeeAmount = enrollmentFees.chargeAmountCents;
      } else {
        enrollmentFeeAmount = enrollmentFeeCents;
      }
    }

    return NextResponse.json({
      success: true,
      paymentUrl: setupResult.url,
      setupIntentId: setupResult.setupIntentId,
      includesEnrollmentFee: includeEnrollmentFee,
      enrollmentFeeAmount,
    });
  } catch (error) {
    console.error("Error creating autopay checkout:", error);
    const message = error instanceof Error ? error.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
