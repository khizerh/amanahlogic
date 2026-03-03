import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { MembersService } from "@/lib/database/members";
import { OrganizationsService } from "@/lib/database/organizations";
import { AgreementsService } from "@/lib/database/agreements";
import { AgreementSigningLinksService } from "@/lib/database/agreement-links";
import { AgreementTemplatesService } from "@/lib/database/agreement-templates";
import { OnboardingInvitesService } from "@/lib/database/onboarding-invites";
import { sendAgreementEmail } from "@/lib/email/send-agreement";
import { sendPaymentSetupEmail } from "@/lib/email/send-payment-setup";
import {
  stripe,
  isStripeConfigured,
  calculateFees,
  getPlatformFee,
} from "@/lib/stripe";
import type { BillingFrequency, MemberWithMembership } from "@/lib/types";

/**
 * POST /api/reminders/pending-members
 *
 * Sends bulk email reminders to pending members:
 * - Agreement email if agreement not signed
 * - Payment setup email if payment not set up
 */
export async function POST() {
  try {
    const organizationId = await getOrganizationId();

    // Fetch all members, filter to pending
    const allMembers = await MembersService.getAllWithMembership(organizationId);
    const pendingMembers = allMembers.filter(
      (m) => m.membership?.status === "pending"
    );

    const org = await OrganizationsService.getById(organizationId);
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
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
      type?: string;
    }[] = [];
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const member of pendingMembers) {
      const membership = member.membership;
      if (!membership) {
        skipped++;
        continue;
      }

      const memberName = `${member.firstName} ${member.middleName ? `${member.middleName} ` : ""}${member.lastName}`;

      // Determine email recipient
      let emailTo: string | null = member.email;
      let emailMemberName = member.firstName;
      let emailMemberId = member.id;
      let payingForName: string | undefined;

      if (membership.payerMemberId) {
        try {
          const payer = await MembersService.getById(membership.payerMemberId);
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
          memberId: member.id,
          memberName,
          success: false,
          error: "No email address",
        });
        continue;
      }

      const needsAgreement = !membership.agreementSignedAt;
      const needsPayment =
        !membership.autoPayEnabled && !membership.stripeSubscriptionId;

      if (!needsAgreement && !needsPayment) {
        skipped++;
        results.push({
          memberId: member.id,
          memberName,
          success: false,
          error: "Already completed",
        });
        continue;
      }

      let agreementSent = false;
      let paymentSent = false;

      // Send agreement email if needed
      if (needsAgreement) {
        try {
          const agreementResult = await sendAgreementReminder(
            member,
            organizationId,
            baseUrl
          );
          if (agreementResult.success) {
            agreementSent = true;
          } else {
            results.push({
              memberId: member.id,
              memberName,
              success: false,
              error: agreementResult.error || "Agreement email failed",
              type: "agreement",
            });
            failed++;
          }
        } catch (err) {
          results.push({
            memberId: member.id,
            memberName,
            success: false,
            error:
              err instanceof Error ? err.message : "Agreement email error",
            type: "agreement",
          });
          failed++;
        }
      }

      // Send payment setup email if needed
      if (needsPayment && isStripeConfigured() && stripe) {
        try {
          const paymentResult = await sendPaymentReminder(
            member,
            organizationId,
            org,
            baseUrl,
            emailTo,
            emailMemberName,
            emailMemberId,
            payingForName
          );
          if (paymentResult.success) {
            paymentSent = true;
          } else {
            if (paymentResult.error !== "skipped") {
              results.push({
                memberId: member.id,
                memberName,
                success: false,
                error: paymentResult.error || "Payment email failed",
                type: "payment",
              });
              failed++;
            } else {
              // No pending onboarding invite — nothing to resend
              if (!agreementSent) {
                skipped++;
                results.push({
                  memberId: member.id,
                  memberName,
                  success: false,
                  error: "No pending payment setup",
                  type: "payment",
                });
              }
            }
          }
        } catch (err) {
          results.push({
            memberId: member.id,
            memberName,
            success: false,
            error:
              err instanceof Error ? err.message : "Payment email error",
            type: "payment",
          });
          failed++;
        }
      }

      if (agreementSent || paymentSent) {
        sent++;
        const types = [
          agreementSent ? "agreement" : null,
          paymentSent ? "payment" : null,
        ]
          .filter(Boolean)
          .join(" + ");
        results.push({
          memberId: member.id,
          memberName,
          success: true,
          type: types,
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

/**
 * Send agreement reminder — reuses agreement creation logic from /api/agreements/send
 */
async function sendAgreementReminder(
  member: MemberWithMembership,
  organizationId: string,
  baseUrl: string
): Promise<{ success: boolean; error?: string }> {
  const membership = member.membership!;
  const memberLanguage = member.preferredLanguage || "en";
  const expiresAt = new Date("2099-12-31T23:59:59Z").toISOString();

  // Resolve template version
  let resolvedTemplateVersion: string;
  const activeTemplate = await AgreementTemplatesService.getActiveByLanguage(
    organizationId,
    memberLanguage
  );
  if (activeTemplate) {
    resolvedTemplateVersion = activeTemplate.version;
  } else {
    resolvedTemplateVersion = memberLanguage === "fa" ? "v1-fa" : "v1-en";
  }

  // Reuse existing unsigned agreement or create new
  let agreement = await AgreementsService.getUnsignedByMember(
    member.id,
    organizationId
  );

  if (!agreement) {
    agreement = await AgreementsService.create({
      organizationId,
      membershipId: membership.id,
      memberId: member.id,
      templateVersion: resolvedTemplateVersion,
      sentAt: new Date().toISOString(),
    });
  }

  // Invalidate existing links and create new one
  await AgreementSigningLinksService.invalidateByAgreementId(agreement.id);
  const token = randomUUID();
  await AgreementSigningLinksService.create({
    agreementId: agreement.id,
    token,
    expiresAt,
  });

  const signUrl = `${baseUrl}/sign/${token}`;
  const memberName = `${member.firstName} ${member.middleName ? `${member.middleName} ` : ""}${member.lastName}`;

  const emailResult = await sendAgreementEmail({
    to: member.email!,
    memberName,
    memberId: member.id,
    organizationId,
    signUrl,
    expiresAt,
    language: memberLanguage,
  });

  return {
    success: emailResult.success,
    error: emailResult.error,
  };
}

/**
 * Send payment setup reminder — retrieves existing SetupIntent and resends email
 */
async function sendPaymentReminder(
  member: MemberWithMembership,
  organizationId: string,
  org: { platformFees: any; passFeesToMember: boolean },
  baseUrl: string,
  emailTo: string,
  emailMemberName: string,
  emailMemberId: string,
  payingForName?: string
): Promise<{ success: boolean; error?: string }> {
  const membership = member.membership!;

  // Look up existing pending onboarding invite
  const invite = await OnboardingInvitesService.getPendingForMembership(
    membership.id
  );
  if (!invite || !invite.stripeSetupIntentId) {
    return { success: false, error: "skipped" };
  }

  // Retrieve existing SetupIntent
  const setupIntent = await stripe!.setupIntents.retrieve(
    invite.stripeSetupIntentId
  );

  if (
    setupIntent.status === "canceled" ||
    setupIntent.status === "succeeded"
  ) {
    return {
      success: false,
      error:
        setupIntent.status === "succeeded"
          ? "Setup already complete"
          : "Setup expired",
    };
  }

  const checkoutUrl = `${baseUrl}/payment/setup?setup_intent=${setupIntent.id}&setup_intent_client_secret=${setupIntent.client_secret}`;

  const billingFrequency = (membership.billingFrequency ||
    "monthly") as BillingFrequency;
  const platformFeeDollars = getPlatformFee(
    org.platformFees,
    billingFrequency
  );
  const fees = calculateFees(
    Math.round(invite.duesAmount * 100),
    platformFeeDollars,
    org.passFeesToMember || false
  );

  let enrollmentFeeForEmail: number | undefined;
  if (
    invite.includesEnrollmentFee &&
    invite.enrollmentFeeAmount > 0 &&
    !invite.enrollmentFeePaidAt
  ) {
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
    planName: member.plan?.name || "Membership",
    enrollmentFee: enrollmentFeeForEmail,
    duesAmount: fees.chargeAmountCents / 100,
    billingFrequency,
    language: member.preferredLanguage || "en",
    payingForName,
  });

  return {
    success: emailResult.success,
    error: emailResult.error,
  };
}
