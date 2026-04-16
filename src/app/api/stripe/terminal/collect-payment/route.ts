import { NextResponse } from "next/server";

import { MembershipsService } from "@/lib/database/memberships";
import { PlansService } from "@/lib/database/plans";
import { OrganizationsService } from "@/lib/database/organizations";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { calculateFees, getPlatformFee, isStripeConfigured } from "@/lib/stripe";
import { collectTerminalPayment } from "@/lib/stripe/terminal";
import type { BillingFrequency, PlatformFees } from "@/lib/types";

interface CollectPaymentBody {
  membershipId: string;
  memberId: string;
  readerId: string;
  includeEnrollmentFee: boolean;
}

/**
 * POST /api/stripe/terminal/collect-payment
 *
 * Creates a PaymentIntent for enrollment fee + first dues, then hands it to
 * the Terminal reader. The reader will prompt the customer to tap/insert card.
 */
export async function POST(req: Request) {
  try {
    const organizationId = await getOrganizationId();

    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
    }

    const { membershipId, memberId, readerId, includeEnrollmentFee }: CollectPaymentBody =
      await req.json();

    if (!membershipId || !memberId || !readerId) {
      return NextResponse.json(
        { error: "membershipId, memberId, and readerId are required" },
        { status: 400 }
      );
    }

    // Load membership, plan, and org
    const [membership, org] = await Promise.all([
      MembershipsService.getById(membershipId),
      OrganizationsService.getById(organizationId),
    ]);

    if (!membership || membership.organizationId !== organizationId) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const plan = await PlansService.getById(membership.planId);
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Calculate amounts
    const billingFrequency = (membership.billingFrequency || "monthly") as BillingFrequency;
    const duesAmount = plan.pricing[billingFrequency] || plan.pricing.monthly;
    const duesAmountCents = Math.round(duesAmount * 100);
    const platformFeeDollars = getPlatformFee(
      org.platformFees as PlatformFees | null,
      billingFrequency
    );
    const duesFees = calculateFees(duesAmountCents, platformFeeDollars, org.passFeesToMember);

    let enrollmentFeeCents = 0;
    let enrollmentFeeChargeCents = 0;
    if (includeEnrollmentFee && membership.enrollmentFeeStatus === "unpaid") {
      enrollmentFeeCents = Math.round(plan.enrollmentFee * 100);
      if (org.passFeesToMember) {
        const enrollmentFees = calculateFees(enrollmentFeeCents, platformFeeDollars, true);
        enrollmentFeeChargeCents = enrollmentFees.chargeAmountCents;
      } else {
        enrollmentFeeChargeCents = enrollmentFeeCents;
      }
    }

    const totalChargeCents = duesFees.chargeAmountCents + enrollmentFeeChargeCents;

    // Build line items for metadata
    const lineItems: { description: string; amountCents: number }[] = [];
    if (enrollmentFeeChargeCents > 0) {
      lineItems.push({ description: "Enrollment Fee", amountCents: enrollmentFeeChargeCents });
    }
    lineItems.push({
      description: `${plan.name} Dues (${billingFrequency})`,
      amountCents: duesFees.chargeAmountCents,
    });

    // Description for the charge
    const description = enrollmentFeeChargeCents > 0
      ? `${plan.name} - Enrollment Fee + First Dues`
      : `${plan.name} - Dues (${billingFrequency})`;

    // Calculate total application fee for Connect
    let applicationFeeCents = 0;
    if (org.stripeConnectId && org.stripeOnboarded) {
      applicationFeeCents = duesFees.applicationFeeCents;
      if (enrollmentFeeChargeCents > 0) {
        const enrollFees = calculateFees(enrollmentFeeCents, platformFeeDollars, org.passFeesToMember);
        applicationFeeCents += enrollFees.applicationFeeCents;
      }
    }

    // Send to reader
    const { paymentIntent, reader } = await collectTerminalPayment({
      readerId,
      amountCents: totalChargeCents,
      description,
      metadata: {
        membership_id: membershipId,
        member_id: memberId,
        organization_id: organizationId,
        plan_name: plan.name,
        billing_frequency: billingFrequency,
        dues_amount_cents: String(duesAmountCents),
        enrollment_fee_amount_cents: String(enrollmentFeeCents),
        include_enrollment_fee: String(includeEnrollmentFee && enrollmentFeeChargeCents > 0),
        type: "terminal_enrollment",
      },
      stripeConnectAccountId:
        org.stripeConnectId && org.stripeOnboarded ? org.stripeConnectId : undefined,
      applicationFeeCents: applicationFeeCents > 0 ? applicationFeeCents : undefined,
    });

    return NextResponse.json({
      success: true,
      paymentIntentId: paymentIntent.id,
      readerId: reader.id,
      status: paymentIntent.status,
      totalAmountCents: totalChargeCents,
      lineItems,
    });
  } catch (error) {
    console.error("Error collecting Terminal payment:", error);
    const message = error instanceof Error ? error.message : "Failed to initiate payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
