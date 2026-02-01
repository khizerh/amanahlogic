import { NextResponse } from "next/server";

import { MembershipsService } from "@/lib/database/memberships";
import { MembersService } from "@/lib/database/members";
import { PlansService } from "@/lib/database/plans";
import { OrganizationsService } from "@/lib/database/organizations";
import { OnboardingInvitesService } from "@/lib/database/onboarding-invites";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import {
  isStripeConfigured,
  getOrCreateStripeCustomer,
  createSetupIntent,
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

    // Determine if member is current (paid through a future date)
    const memberIsCurrent = membership.nextPaymentDue
      ? new Date(membership.nextPaymentDue) > new Date()
      : false;
    const nextPaymentDue = memberIsCurrent ? membership.nextPaymentDue : undefined;

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

    // Calculate fees for email display
    const fees = calculateFees(
      Math.round(priceAmount * 100),
      org.platformFee || 0,
      org.passFeesToMember || false
    );

    // Determine if enrollment fee should be included
    // Default: include if not paid, unless explicitly set to false
    const shouldIncludeEnrollmentFee =
      includeEnrollmentFee !== undefined
        ? includeEnrollmentFee
        : !membership.enrollmentFeePaid;

    // Calculate enrollment fee for email display
    let enrollmentFeeForEmail: number | undefined;

    if (shouldIncludeEnrollmentFee) {
      const enrollmentFeeBase = plan.enrollmentFee;
      const enrollmentFeeCents = Math.round(enrollmentFeeBase * 100);

      if (org.passFeesToMember) {
        const enrollmentFees = calculateFees(enrollmentFeeCents, org.platformFee || 0, true);
        enrollmentFeeForEmail = enrollmentFees.chargeAmountCents / 100;
      } else {
        enrollmentFeeForEmail = enrollmentFeeBase;
      }
    }

    // Create SetupIntent (no expiration, unlike Checkout Sessions)
    const setupResult = await createSetupIntent({
      customerId,
      membershipId: membership.id,
      memberId: member.id,
      organizationId,
      planName: plan.name,
      duesAmountCents: Math.round(priceAmount * 100),
      enrollmentFeeAmountCents: shouldIncludeEnrollmentFee ? Math.round(plan.enrollmentFee * 100) : 0,
      billingFrequency: billingFrequency as "monthly" | "biannual" | "annual",
      passFeesToMember: org.passFeesToMember || false,
      stripeConnectAccountId: org.stripeConnectId && org.stripeOnboarded ? org.stripeConnectId : undefined,
      memberIsCurrent,
      nextPaymentDue: nextPaymentDue || undefined,
    });

    // Update membership with customer ID
    await MembershipsService.update({
      id: membershipId,
      stripeCustomerId: customerId,
    });

    // Create onboarding invite record
    await OnboardingInvitesService.create({
      organizationId,
      membershipId: membership.id,
      memberId: member.id,
      paymentMethod: "stripe",
      stripeSetupIntentId: setupResult.setupIntentId,
      enrollmentFeeAmount: shouldIncludeEnrollmentFee ? plan.enrollmentFee : 0,
      includesEnrollmentFee: shouldIncludeEnrollmentFee,
      duesAmount: priceAmount,
      billingFrequency: billingFrequency as "monthly" | "biannual" | "annual",
      plannedAmount: priceAmount,
      sentAt: new Date().toISOString(),
    });

    // Send email to member with payment setup link
    const emailResult = await sendPaymentSetupEmail({
      to: member.email,
      memberName: member.firstName,
      memberId: member.id,
      organizationId,
      checkoutUrl: setupResult.url,
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
        warning: "SetupIntent created but email failed to send",
        emailError: emailResult.error,
        paymentUrl: setupResult.url,
        setupIntentId: setupResult.setupIntentId,
        includesEnrollmentFee: shouldIncludeEnrollmentFee,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Payment setup link sent to ${member.email}`,
      paymentUrl: setupResult.url,
      setupIntentId: setupResult.setupIntentId,
      includesEnrollmentFee: shouldIncludeEnrollmentFee,
      emailSent: true,
    });
  } catch (error) {
    console.error("Error sending payment setup:", error);
    const message = error instanceof Error ? error.message : "Failed to send payment setup";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
