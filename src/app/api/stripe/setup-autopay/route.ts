import { NextResponse } from "next/server";

import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { isStripeConfigured } from "@/lib/stripe";
import { OnboardingInvitesService } from "@/lib/database/onboarding-invites";
import { createAutopaySetupLink, SetupLinkError } from "@/lib/billing/setup-link";

interface SetupAutopayBody {
  membershipId: string;
  memberId: string;
  /** If true, skip enrollment fee even if not paid (for special cases) */
  skipEnrollmentFee?: boolean;
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
 * POST /api/stripe/setup-autopay
 *
 * Create a SetupIntent for setting up recurring payments and return the hosted
 * setup URL. Nothing is emailed: the admin opens the link themselves (elders
 * who hand over a card but have no email) or shares it however they like.
 * Emailing lives in /api/stripe/send-payment-setup.
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

    const { membershipId, memberId, skipEnrollmentFee, payerMemberId, arrearsMonths }: SetupAutopayBody =
      await req.json();

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
      includeEnrollmentFee: skipEnrollmentFee ? false : undefined,
      arrearsMonths,
    });

    // Cancel any pending onboarding invite (e.g. manual payment invite being replaced by Stripe)
    try {
      const pendingInvite = await OnboardingInvitesService.getPendingForMembership(membershipId);
      if (pendingInvite) {
        await OnboardingInvitesService.markCanceled(pendingInvite.id);
      }
    } catch {
      // Non-critical — don't block autopay setup if invite cleanup fails
    }

    return NextResponse.json({
      success: true,
      paymentUrl: link.url,
      setupIntentId: link.setupIntentId,
      includesEnrollmentFee: link.includesEnrollmentFee,
      enrollmentFeeAmount: link.includesEnrollmentFee ? link.enrollmentFeeChargeCents : undefined,
      arrears: link.arrears,
    });
  } catch (error) {
    if (error instanceof SetupLinkError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error creating autopay checkout:", error);
    const message = error instanceof Error ? error.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
