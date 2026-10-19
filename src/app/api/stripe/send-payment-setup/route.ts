import { NextResponse } from "next/server";

import { OnboardingInvitesService } from "@/lib/database/onboarding-invites";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { isStripeConfigured } from "@/lib/stripe";
import { sendPaymentSetupEmail } from "@/lib/email";
import { createAutopaySetupLink, SetupLinkError } from "@/lib/billing/setup-link";

interface SendPaymentSetupBody {
  membershipId: string;
  memberId: string;
  /** If true, include enrollment fee in checkout (default: true if not paid) */
  includeEnrollmentFee?: boolean;
  /** Optional: ID of the member who will pay (third-party payer) */
  payerMemberId?: string;
  /**
   * Past-dues months to collect when the card is saved. Omitted = everything
   * owed as of today. The server clamps it to what is owed, so an admin can
   * waive months but never add them.
   */
  arrearsMonths?: number | null;
}

/**
 * POST /api/stripe/send-payment-setup
 * Creates a SetupIntent and emails the hosted setup link to the member (or payer).
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
    const { membershipId, memberId, includeEnrollmentFee, payerMemberId, arrearsMonths } = body;

    if (!membershipId || !memberId) {
      return NextResponse.json(
        { error: "membershipId and memberId are required" },
        { status: 400 }
      );
    }

    const link = await createAutopaySetupLink({
      organizationId,
      membershipId,
      memberId,
      payerMemberId,
      includeEnrollmentFee,
      arrearsMonths,
    });
    const { member, payerMember, plan, arrears } = link;

    // For payer scenarios the payer gets the email; otherwise the member must have one.
    const emailRecipient = payerMember || member;
    if (!emailRecipient.email) {
      return NextResponse.json(
        { error: "Cannot send payment setup: member has no email address" },
        { status: 400 }
      );
    }

    // Create onboarding invite record
    await OnboardingInvitesService.create({
      organizationId,
      membershipId: link.membership.id,
      memberId: member.id,
      paymentMethod: "stripe",
      stripeSetupIntentId: link.setupIntentId,
      enrollmentFeeAmount: link.includesEnrollmentFee ? plan.enrollmentFee : 0,
      includesEnrollmentFee: link.includesEnrollmentFee,
      duesAmount: link.duesChargeCents / 100,
      billingFrequency: link.billingFrequency,
      plannedAmount: link.duesChargeCents / 100,
      sentAt: new Date().toISOString(),
    });

    // Format first charge date for the email
    let firstChargeDate: string | undefined;
    if (link.nextPaymentDue) {
      const lang = emailRecipient.preferredLanguage || "en";
      const date = new Date(link.nextPaymentDue);
      firstChargeDate = date.toLocaleDateString(lang === "fa" ? "fa-IR" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    const memberFullName = `${member.firstName} ${member.middleName ? `${member.middleName} ` : ""}${member.lastName}`;
    const emailResult = await sendPaymentSetupEmail({
      to: emailRecipient.email,
      memberName: emailRecipient.firstName,
      memberId: emailRecipient.id,
      organizationId,
      checkoutUrl: link.url,
      planName: plan.name,
      enrollmentFee: link.includesEnrollmentFee ? link.enrollmentFeeChargeCents / 100 : undefined,
      duesAmount: link.duesChargeCents / 100,
      billingFrequency: link.billingFrequency,
      language: emailRecipient.preferredLanguage || "en",
      firstChargeDate,
      payingForName: payerMember ? memberFullName : undefined,
      arrearsAmount: arrears.arrearsMonths > 0 ? arrears.chargeAmountCents / 100 : undefined,
      arrearsMonths: arrears.arrearsMonths > 0 ? arrears.arrearsMonths : undefined,
      arrearsPeriod: arrears.arrearsMonths > 0 ? arrears.periodLabel : undefined,
    });

    if (!emailResult.success) {
      console.error("Failed to send payment setup email:", emailResult.error);
      // Don't fail the whole request - return success with warning
      return NextResponse.json({
        success: true,
        warning: "SetupIntent created but email failed to send",
        emailError: emailResult.error,
        paymentUrl: link.url,
        setupIntentId: link.setupIntentId,
        includesEnrollmentFee: link.includesEnrollmentFee,
        arrears,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Payment setup link sent to ${emailRecipient.email}`,
      paymentUrl: link.url,
      setupIntentId: link.setupIntentId,
      includesEnrollmentFee: link.includesEnrollmentFee,
      emailSent: true,
      arrears,
    });
  } catch (error) {
    if (error instanceof SetupLinkError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error sending payment setup:", error);
    const message = error instanceof Error ? error.message : "Failed to send payment setup";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
