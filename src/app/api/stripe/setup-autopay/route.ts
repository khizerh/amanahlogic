import { NextResponse } from "next/server";

import { MembershipsService } from "@/lib/database/memberships";
import { MembersService } from "@/lib/database/members";
import { PlansService } from "@/lib/database/plans";
import { OrganizationsService } from "@/lib/database/organizations";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import {
  isStripeConfigured,
  getOrCreateStripeCustomer,
  createSubscriptionCheckoutSession,
  calculateFees,
} from "@/lib/stripe";

interface SetupAutopayBody {
  membershipId: string;
  memberId: string;
}

/**
 * POST /api/stripe/setup-autopay
 *
 * Create a Stripe Checkout Session for setting up autopay subscription.
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

    const { membershipId, memberId }: SetupAutopayBody = await req.json();

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

    // Check if already on autopay
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

    // Calculate fees - if passFeesToMember is true, gross up the price
    const fees = calculateFees(baseAmountCents, org.platformFee || 0, org.passFeesToMember);

    // Build URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3003";
    const successUrl = `${baseUrl}/members/${memberId}?autopay=success`;
    const cancelUrl = `${baseUrl}/members/${memberId}?autopay=cancelled`;

    // Build line item text showing fee breakdown if fees are passed to member
    const lineItemName = org.passFeesToMember
      ? `${plan.name} ($${priceAmount.toFixed(2)} + $${fees.breakdown.totalFees.toFixed(2)} fees)`
      : undefined;
    const lineItemDescription = org.passFeesToMember
      ? `Member pays $${(fees.chargeAmountCents / 100).toFixed(2)} so org receives $${priceAmount.toFixed(2)}`
      : undefined;

    // Create checkout session with correct billing frequency (with Connect if org is onboarded)
    // Use chargeAmountCents which includes fees if passFeesToMember is enabled
    const session = await createSubscriptionCheckoutSession({
      customerId,
      priceAmountCents: fees.chargeAmountCents,
      membershipId: membership.id,
      memberId: member.id,
      organizationId,
      successUrl,
      cancelUrl,
      billingAnchorDay: membership.billingAnniversaryDay,
      billingFrequency: billingFrequency as "monthly" | "biannual" | "annual",
      planName: plan.name,
      lineItemName,
      lineItemDescription,
    });

    // Update membership with customer ID (subscription ID will be set by webhook)
    await MembershipsService.update({
      id: membershipId,
      stripeCustomerId: customerId,
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.sessionId,
    });
  } catch (error) {
    console.error("Error creating autopay checkout:", error);
    const message = error instanceof Error ? error.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
