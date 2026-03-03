import { NextResponse } from "next/server";

import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { OnboardingInvitesService } from "@/lib/database/onboarding-invites";
import { OrganizationsService } from "@/lib/database/organizations";
import { MembersService } from "@/lib/database/members";
import { sendPaymentSetupEmail } from "@/lib/email/send-payment-setup";
import { stripe, isStripeConfigured, calculateFees, getPlatformFee } from "@/lib/stripe";
import type { BillingFrequency } from "@/lib/types";

/**
 * POST /api/reminders/onboarding
 *
 * Sends bulk email reminders to pending Stripe onboarding invites.
 * Retrieves existing SetupIntents and resends the payment setup email.
 */
export async function POST() {
  try {
    const organizationId = await getOrganizationId();

    if (!isStripeConfigured() || !stripe) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 503 }
      );
    }

    // Fetch pending Stripe onboarding invites
    const invites = await OnboardingInvitesService.getAllWithDetails(
      organizationId,
      "pending",
      "stripe"
    );

    // Fetch organization for fee calculation
    const org = await OrganizationsService.getById(organizationId);
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      "http://localhost:3000";

    const results: {
      memberId: string;
      memberName: string;
      success: boolean;
      error?: string;
    }[] = [];
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const invite of invites) {
      const memberName = `${invite.member.firstName} ${invite.member.middleName ? `${invite.member.middleName} ` : ""}${invite.member.lastName}`;

      // Determine email recipient — use payer if set
      let emailTo: string | null = invite.member.email;
      let emailMemberName = invite.member.firstName;
      let emailMemberId = invite.member.id;
      let payingForName: string | undefined;

      if (invite.membership.payerMemberId) {
        try {
          const payer = await MembersService.getById(invite.membership.payerMemberId);
          if (payer?.email) {
            emailTo = payer.email;
            emailMemberName = payer.firstName;
            emailMemberId = payer.id;
            payingForName = memberName;
          }
        } catch {
          // Fall back to member email
        }
      }

      if (!emailTo) {
        skipped++;
        results.push({
          memberId: invite.memberId,
          memberName,
          success: false,
          error: "No email address",
        });
        continue;
      }

      if (!invite.stripeSetupIntentId) {
        skipped++;
        results.push({
          memberId: invite.memberId,
          memberName,
          success: false,
          error: "No SetupIntent found",
        });
        continue;
      }

      try {
        // Retrieve existing SetupIntent from Stripe
        const setupIntent = await stripe.setupIntents.retrieve(
          invite.stripeSetupIntentId
        );

        // Skip if already completed or canceled
        if (
          setupIntent.status === "canceled" ||
          setupIntent.status === "succeeded"
        ) {
          skipped++;
          results.push({
            memberId: invite.memberId,
            memberName,
            success: false,
            error:
              setupIntent.status === "succeeded"
                ? "Setup already complete"
                : "Setup expired",
          });
          continue;
        }

        // Reconstruct payment URL
        const checkoutUrl = `${baseUrl}/payment/setup?setup_intent=${setupIntent.id}&setup_intent_client_secret=${setupIntent.client_secret}`;

        // Calculate fees for email display
        const billingFrequency = (invite.billingFrequency || "monthly") as BillingFrequency;
        const platformFeeDollars = getPlatformFee(org.platformFees, billingFrequency);
        const fees = calculateFees(
          Math.round(invite.duesAmount * 100),
          platformFeeDollars,
          org.passFeesToMember || false
        );

        // Calculate enrollment fee for email if applicable
        let enrollmentFeeForEmail: number | undefined;
        if (invite.includesEnrollmentFee && invite.enrollmentFeeAmount > 0 && !invite.enrollmentFeePaidAt) {
          if (org.passFeesToMember) {
            const enrollmentFees = calculateFees(
              Math.round(invite.enrollmentFeeAmount * 100),
              platformFeeDollars,
              true
            );
            enrollmentFeeForEmail = enrollmentFees.chargeAmountCents / 100;
          } else {
            enrollmentFeeForEmail = invite.enrollmentFeeAmount;
          }
        }

        const emailResult = await sendPaymentSetupEmail({
          to: emailTo,
          memberName: emailMemberName,
          memberId: emailMemberId,
          organizationId,
          checkoutUrl,
          planName: invite.plan.name,
          enrollmentFee: enrollmentFeeForEmail,
          duesAmount: fees.chargeAmountCents / 100,
          billingFrequency,
          language: invite.member.preferredLanguage || "en",
          payingForName,
        });

        if (emailResult.success) {
          sent++;
          results.push({ memberId: invite.memberId, memberName, success: true });
        } else {
          failed++;
          results.push({
            memberId: invite.memberId,
            memberName,
            success: false,
            error: emailResult.error || "Email failed",
          });
        }
      } catch (err) {
        failed++;
        results.push({
          memberId: invite.memberId,
          memberName,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({ sent, failed, skipped, results });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send reminders";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
