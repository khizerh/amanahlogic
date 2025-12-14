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
import { sendPaymentSetupEmail } from "@/lib/email";

interface SendPaymentSetupBody {
  membershipId: string;
  memberId: string;
  /** If true, include enrollment fee in checkout (default: true if not paid) */
  includeEnrollmentFee?: boolean;
}

/**
 * POST /api/stripe/send-payment-setup
 * Creates a Stripe Checkout session and sends the payment link to the member via email
 */
export async function POST(req: Request) {
  try {
    const organizationId = await getOrganizationId();

    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: "Stripe is not configured. Please set up Stripe integration." },
        { status: 503 }
      );
    }

    const body: SendPaymentSetupBody = await req.json();
    const { membershipId, memberId, includeEnrollmentFee } = body;

    if (!membershipId || !memberId) {
      return NextResponse.json(
        { error: "membershipId and memberId are required" },
        { status: 400 }
      );
    }

    // Get membership, member, plan, and org
    const [membership, member, org] = await Promise.all([
      MembershipsService.getById(membershipId),
      MembersService.getById(memberId),
      OrganizationsService.getById(organizationId),
    ]);

    if (!membership) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

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

    // Calculate dues amount based on billing frequency
    const billingFrequency = membership.billingFrequency || "monthly";
    let priceAmount: number;
    switch (billingFrequency) {
      case "biannual":
        priceAmount = plan.pricing.biannual;
        break;
      case "annual":
        priceAmount = plan.pricing.annual;
        break;
      default:
        priceAmount = plan.pricing.monthly;
    }

    // Calculate fees
    const fees = calculateFees(
      Math.round(priceAmount * 100),
      org.platformFee || 0,
      org.passFeesToMember || false
    );

    // Build URLs - member will be redirected back to a success/cancel page
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3003";
    // Redirect to a public thank-you page (member doesn't have dashboard access)
    const successUrl = `${baseUrl}/payment-complete?status=success&membership=${membershipId}`;
    const cancelUrl = `${baseUrl}/payment-complete?status=cancelled&membership=${membershipId}`;

    // Determine if enrollment fee should be included
    // Default: include if not paid, unless explicitly set to false
    const shouldIncludeEnrollmentFee =
      includeEnrollmentFee !== undefined
        ? includeEnrollmentFee
        : !membership.enrollmentFeePaid;

    // Calculate enrollment fee with fees if applicable
    let enrollmentFeeConfig: { amountCents: number; description?: string } | undefined;
    let enrollmentFeeForEmail: number | undefined;

    if (shouldIncludeEnrollmentFee) {
      const enrollmentFeeBase = plan.enrollmentFee;
      const enrollmentFeeCents = Math.round(enrollmentFeeBase * 100);

      if (org.passFeesToMember) {
        const enrollmentFees = calculateFees(enrollmentFeeCents, org.platformFee || 0, true);
        enrollmentFeeConfig = {
          amountCents: enrollmentFees.chargeAmountCents,
          description: `${plan.name} Enrollment Fee ($${enrollmentFeeBase.toFixed(2)} + $${enrollmentFees.breakdown.totalFees.toFixed(2)} fees)`,
        };
        enrollmentFeeForEmail = enrollmentFees.chargeAmountCents / 100;
      } else {
        enrollmentFeeConfig = {
          amountCents: enrollmentFeeCents,
          description: `${plan.name} Enrollment Fee`,
        };
        enrollmentFeeForEmail = enrollmentFeeBase;
      }
    }

    // Create checkout session
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
      enrollmentFee: enrollmentFeeConfig,
    });

    // Update membership with customer ID
    await MembershipsService.update({
      id: membershipId,
      stripeCustomerId: customerId,
    });

    // Send email to member with checkout link
    const emailResult = await sendPaymentSetupEmail({
      to: member.email,
      memberName: member.firstName,
      memberId: member.id,
      organizationId,
      checkoutUrl: session.url,
      planName: plan.name,
      enrollmentFee: enrollmentFeeForEmail,
      duesAmount: fees.chargeAmountCents / 100,
      billingFrequency,
      language: member.preferredLanguage || "en",
    });

    if (!emailResult.success) {
      console.error("Failed to send payment setup email:", emailResult.error);
      // Don't fail the whole request - return success with warning
      return NextResponse.json({
        success: true,
        warning: "Checkout session created but email failed to send",
        emailError: emailResult.error,
        checkoutUrl: session.url,
        sessionId: session.sessionId,
        includesEnrollmentFee: shouldIncludeEnrollmentFee,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Payment setup link sent to ${member.email}`,
      checkoutUrl: session.url,
      sessionId: session.sessionId,
      includesEnrollmentFee: shouldIncludeEnrollmentFee,
      emailSent: true,
    });
  } catch (error) {
    console.error("Error sending payment setup:", error);
    const message = error instanceof Error ? error.message : "Failed to send payment setup";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
