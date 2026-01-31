import "server-only";

import { randomUUID } from "crypto";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { OrganizationsService } from "@/lib/database/organizations";
import { OnboardingInvitesService } from "@/lib/database/onboarding-invites";
import { AgreementsService } from "@/lib/database/agreements";
import { AgreementSigningLinksService } from "@/lib/database/agreement-links";
import { AgreementTemplatesService } from "@/lib/database/agreement-templates";
import { MembershipsService } from "@/lib/database/memberships";
import { sendWelcomeEmail } from "@/lib/email/send-welcome";
import { sendAgreementEmail } from "@/lib/email/send-agreement";
import {
  isStripeConfigured,
  getOrCreateStripeCustomer,
  createSubscriptionCheckoutSession,
  calculateFees,
  type ConnectParams,
} from "@/lib/stripe";
import type { Member, Membership, Plan, Organization } from "@/lib/types";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// =============================================================================
// Types
// =============================================================================

interface OrchestrateOnboardingInput {
  organizationId: string;
  member: Member;
  membership: Membership;
  plan: Plan;
  paymentMethod: "stripe" | "manual";
  includeEnrollmentFee: boolean;
}

interface StepResult {
  success: boolean;
  error?: string;
}

export interface OrchestrateOnboardingResult {
  welcomeEmailSent: boolean;
  agreementEmailSent: boolean;
  inviteCreated: boolean;
  onboardingInviteCreated: boolean;
  stripeSessionCreated: boolean;
  agreementCreated: boolean;
  errors: string[];
}

// =============================================================================
// Orchestrator
// =============================================================================

/**
 * Orchestrate the full onboarding flow after member+membership creation.
 *
 * Best-effort continuation: each step that fails logs an error but doesn't
 * block subsequent steps. The member+membership are already persisted.
 */
export async function orchestrateOnboarding(
  input: OrchestrateOnboardingInput
): Promise<OrchestrateOnboardingResult> {
  const { organizationId, member, membership, plan, paymentMethod, includeEnrollmentFee } = input;

  const result: OrchestrateOnboardingResult = {
    welcomeEmailSent: false,
    agreementEmailSent: false,
    inviteCreated: false,
    onboardingInviteCreated: false,
    stripeSessionCreated: false,
    agreementCreated: false,
    errors: [],
  };

  const memberName = `${member.firstName} ${member.lastName}`;
  const language = member.preferredLanguage || "en";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  // -------------------------------------------------------------------------
  // Step 1: Fetch organization details
  // -------------------------------------------------------------------------
  let org: Organization | null = null;
  try {
    org = await OrganizationsService.getById(organizationId);
  } catch (err) {
    const msg = `Failed to fetch organization: ${err instanceof Error ? err.message : String(err)}`;
    console.error("[onboarding]", msg);
    result.errors.push(msg);
  }

  // -------------------------------------------------------------------------
  // Step 2: Create member_invites record (portal invite)
  // -------------------------------------------------------------------------
  let inviteUrl: string | undefined;
  let inviteExpiresAt: string | undefined;
  try {
    const supabase = createServiceRoleClient();

    // Cancel any existing pending invites
    await supabase
      .from("member_invites")
      .update({ status: "expired" })
      .eq("member_id", member.id)
      .eq("status", "pending");

    // Create new invite
    const { data: invite, error: inviteError } = await supabase
      .from("member_invites")
      .insert({
        organization_id: organizationId,
        member_id: member.id,
        email: member.email,
      })
      .select()
      .single();

    if (inviteError) throw inviteError;

    inviteUrl = `${baseUrl}/portal/accept-invite?token=${invite.token}`;
    inviteExpiresAt = invite.expires_at;
    result.inviteCreated = true;
  } catch (err) {
    const msg = `Failed to create portal invite: ${err instanceof Error ? err.message : String(err)}`;
    console.error("[onboarding]", msg);
    result.errors.push(msg);
  }

  // -------------------------------------------------------------------------
  // Step 3: Payment setup (Stripe or Manual onboarding invite)
  // -------------------------------------------------------------------------
  let checkoutUrl: string | undefined;
  let enrollmentFeeForEmail: number | undefined;
  let duesAmountForEmail: number | undefined;

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

  if (paymentMethod === "stripe") {
    try {
      if (!isStripeConfigured()) {
        throw new Error("Stripe is not configured");
      }

      // Get or create Stripe customer
      const customerId = await getOrCreateStripeCustomer({
        memberId: member.id,
        membershipId: membership.id,
        email: member.email,
        name: memberName,
        organizationId,
      });

      // Calculate fees
      const fees = calculateFees(
        Math.round(priceAmount * 100),
        org?.platformFee || 0,
        org?.passFeesToMember || false
      );

      // Build URLs
      const successUrl = `${baseUrl}/payment-complete?status=success&membership=${membership.id}`;
      const cancelUrl = `${baseUrl}/payment-complete?status=cancelled&membership=${membership.id}`;

      // Calculate enrollment fee config
      let enrollmentFeeConfig: { amountCents: number; description?: string } | undefined;

      if (includeEnrollmentFee) {
        const enrollmentFeeBase = plan.enrollmentFee;
        const enrollmentFeeCents = Math.round(enrollmentFeeBase * 100);

        if (org?.passFeesToMember) {
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

      // Prepare Connect params if org has a connected account
      let connectParams: ConnectParams | undefined;
      if (org?.stripeConnectId && org.stripeOnboarded) {
        connectParams = {
          stripeConnectId: org.stripeConnectId,
          applicationFeeCents: fees.applicationFeeCents,
        };
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
        connectParams,
      });

      checkoutUrl = session.url;
      duesAmountForEmail = fees.chargeAmountCents / 100;
      result.stripeSessionCreated = true;

      // Update membership with customer ID
      await MembershipsService.update({
        id: membership.id,
        stripeCustomerId: customerId,
      });

      // Create onboarding invite record (stripe)
      await OnboardingInvitesService.create({
        organizationId,
        membershipId: membership.id,
        memberId: member.id,
        paymentMethod: "stripe",
        stripeCheckoutSessionId: session.sessionId,
        enrollmentFeeAmount: includeEnrollmentFee ? plan.enrollmentFee : 0,
        includesEnrollmentFee: includeEnrollmentFee,
        duesAmount: priceAmount,
        billingFrequency: billingFrequency as "monthly" | "biannual" | "annual",
        plannedAmount: priceAmount,
        sentAt: new Date().toISOString(),
      });
      result.onboardingInviteCreated = true;
    } catch (err) {
      const msg = `Failed to set up Stripe payment: ${err instanceof Error ? err.message : String(err)}`;
      console.error("[onboarding]", msg);
      result.errors.push(msg);
    }
  } else {
    // Manual payment
    try {
      await OnboardingInvitesService.create({
        organizationId,
        membershipId: membership.id,
        memberId: member.id,
        paymentMethod: "manual",
        enrollmentFeeAmount: includeEnrollmentFee ? plan.enrollmentFee : 0,
        includesEnrollmentFee: includeEnrollmentFee,
        duesAmount: priceAmount,
        billingFrequency: billingFrequency as "monthly" | "biannual" | "annual",
        plannedAmount: priceAmount,
        sentAt: new Date().toISOString(),
      });
      result.onboardingInviteCreated = true;
    } catch (err) {
      const msg = `Failed to create manual onboarding invite: ${err instanceof Error ? err.message : String(err)}`;
      console.error("[onboarding]", msg);
      result.errors.push(msg);
    }
  }

  // -------------------------------------------------------------------------
  // Step 4: Create agreement + signing link
  // -------------------------------------------------------------------------
  let signUrl: string | undefined;
  let agreementExpiresAt: string | undefined;
  try {
    // Find active template for language
    let templateVersion: string;
    const activeTemplate = await AgreementTemplatesService.getActiveByLanguage(
      organizationId,
      language as "en" | "fa"
    );
    if (activeTemplate) {
      templateVersion = activeTemplate.version;
    } else {
      templateVersion = language === "fa" ? "v1-fa" : "v1-en";
    }

    const now = new Date();
    agreementExpiresAt = new Date(now.getTime() + ONE_WEEK_MS).toISOString();

    // Create agreement record
    const agreement = await AgreementsService.create({
      organizationId,
      membershipId: membership.id,
      memberId: member.id,
      templateVersion,
      sentAt: now.toISOString(),
    });

    // Create signing link
    const token = randomUUID();
    await AgreementSigningLinksService.create({
      agreementId: agreement.id,
      token,
      expiresAt: agreementExpiresAt,
    });

    signUrl = `${baseUrl}/sign/${token}`;
    result.agreementCreated = true;
  } catch (err) {
    const msg = `Failed to create agreement: ${err instanceof Error ? err.message : String(err)}`;
    console.error("[onboarding]", msg);
    result.errors.push(msg);
  }

  // -------------------------------------------------------------------------
  // Step 5: Send welcome email (Email 1)
  // -------------------------------------------------------------------------
  if (inviteUrl && inviteExpiresAt) {
    try {
      const emailResult = await sendWelcomeEmail({
        to: member.email,
        memberName: member.firstName,
        memberId: member.id,
        organizationId,
        inviteUrl,
        inviteExpiresAt,
        paymentMethod,
        language: language as "en" | "fa",
        checkoutUrl,
        planName: plan.name,
        enrollmentFee: enrollmentFeeForEmail,
        duesAmount: duesAmountForEmail,
        billingFrequency,
      });

      result.welcomeEmailSent = emailResult.success;
      if (!emailResult.success) {
        result.errors.push(`Welcome email failed: ${emailResult.error}`);
      }
    } catch (err) {
      const msg = `Failed to send welcome email: ${err instanceof Error ? err.message : String(err)}`;
      console.error("[onboarding]", msg);
      result.errors.push(msg);
    }
  } else {
    result.errors.push("Skipped welcome email: portal invite was not created");
  }

  // -------------------------------------------------------------------------
  // Step 6: Send agreement email (Email 2)
  // -------------------------------------------------------------------------
  if (signUrl && agreementExpiresAt) {
    try {
      const emailResult = await sendAgreementEmail({
        to: member.email,
        memberName,
        memberId: member.id,
        organizationId,
        signUrl,
        expiresAt: agreementExpiresAt,
        language: language as "en" | "fa",
      });

      result.agreementEmailSent = emailResult.success;
      if (!emailResult.success) {
        result.errors.push(`Agreement email failed: ${emailResult.error}`);
      }
    } catch (err) {
      const msg = `Failed to send agreement email: ${err instanceof Error ? err.message : String(err)}`;
      console.error("[onboarding]", msg);
      result.errors.push(msg);
    }
  } else {
    result.errors.push("Skipped agreement email: agreement was not created");
  }

  return result;
}
