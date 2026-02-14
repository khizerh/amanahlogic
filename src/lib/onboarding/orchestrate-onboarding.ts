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
  createSetupIntent,
  calculateFees,
} from "@/lib/stripe";
import type { Member, Membership, Plan, Organization } from "@/lib/types";

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

export interface OrchestrateOnboardingResult {
  welcomeEmailSent: boolean;
  agreementEmailSent: boolean;
  inviteCreated: boolean;
  onboardingInviteCreated: boolean;
  stripeSessionCreated: boolean;
  agreementCreated: boolean;
  paymentUrl?: string;
  errors: string[];
  skipped: string[];
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
    skipped: [],
  };

  const supabase = createServiceRoleClient();
  const memberName = `${member.firstName} ${member.middleName ? `${member.middleName} ` : ''}${member.lastName}`;
  const language = member.preferredLanguage || "en";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  // -------------------------------------------------------------------------
  // Step 1: Fetch organization details
  // -------------------------------------------------------------------------
  let org: Organization | null = null;
  try {
    org = await OrganizationsService.getById(organizationId, supabase);
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
  if (member.email) {
    try {
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
  } else {
    result.skipped.push("Portal invite: no email address");
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
        email: member.email || undefined,
        name: memberName,
        organizationId,
      });

      // Calculate fees for email display
      const fees = calculateFees(
        Math.round(priceAmount * 100),
        org?.platformFee || 0,
        org?.passFeesToMember || false
      );

      // Calculate enrollment fee for email
      if (includeEnrollmentFee) {
        const enrollmentFeeBase = plan.enrollmentFee;
        const enrollmentFeeCents = Math.round(enrollmentFeeBase * 100);

        if (org?.passFeesToMember) {
          const enrollmentFees = calculateFees(enrollmentFeeCents, org.platformFee || 0, true);
          enrollmentFeeForEmail = enrollmentFees.chargeAmountCents / 100;
        } else {
          enrollmentFeeForEmail = enrollmentFeeBase;
        }
      }

      // Set dues amount for email
      duesAmountForEmail = fees.chargeAmountCents / 100;

      // Create SetupIntent (no expiration, unlike Checkout Sessions)
      const setupResult = await createSetupIntent({
        customerId,
        membershipId: membership.id,
        memberId: member.id,
        organizationId,
        planName: plan.name,
        duesAmountCents: Math.round(priceAmount * 100),
        enrollmentFeeAmountCents: includeEnrollmentFee ? Math.round(plan.enrollmentFee * 100) : 0,
        billingFrequency: billingFrequency as "monthly" | "biannual" | "annual",
        passFeesToMember: org?.passFeesToMember || false,
        stripeConnectAccountId: org?.stripeConnectId && org.stripeOnboarded ? org.stripeConnectId : undefined,
      });

      checkoutUrl = setupResult.url;
      result.stripeSessionCreated = true;
      result.paymentUrl = checkoutUrl;

      // Update membership with customer ID
      await MembershipsService.update({
        id: membership.id,
        stripeCustomerId: customerId,
      }, supabase);

      // Create onboarding invite record (stripe)
      await OnboardingInvitesService.create({
        organizationId,
        membershipId: membership.id,
        memberId: member.id,
        paymentMethod: "stripe",
        stripeSetupIntentId: setupResult.setupIntentId,
        enrollmentFeeAmount: includeEnrollmentFee ? plan.enrollmentFee : 0,
        includesEnrollmentFee: includeEnrollmentFee,
        duesAmount: priceAmount,
        billingFrequency: billingFrequency as "monthly" | "biannual" | "annual",
        plannedAmount: priceAmount,
        sentAt: new Date().toISOString(),
      }, supabase);
      result.onboardingInviteCreated = true;
    } catch (err) {
      const msg = `Failed to set up Stripe payment: ${err instanceof Error ? err.message : String(err)}`;
      console.error("[onboarding]", msg);
      result.errors.push(msg);
    }
  } else {
    // Manual payment — set amounts for email (no fee gross-up)
    duesAmountForEmail = priceAmount;
    if (includeEnrollmentFee && plan.enrollmentFee > 0) {
      enrollmentFeeForEmail = plan.enrollmentFee;
    }

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
      }, supabase);
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
      language as "en" | "fa",
      supabase
    );
    if (activeTemplate) {
      templateVersion = activeTemplate.version;
    } else {
      templateVersion = language === "fa" ? "v1-fa" : "v1-en";
    }

    const now = new Date();
    // No expiry — links remain valid until used
    agreementExpiresAt = new Date("2099-12-31T23:59:59Z").toISOString();

    // Create agreement record
    const agreement = await AgreementsService.create({
      organizationId,
      membershipId: membership.id,
      memberId: member.id,
      templateVersion,
      sentAt: now.toISOString(),
    }, supabase);

    // Create signing link
    const token = randomUUID();
    await AgreementSigningLinksService.create({
      agreementId: agreement.id,
      token,
      expiresAt: agreementExpiresAt,
    }, supabase);

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
  if (!member.email) {
    result.skipped.push("Welcome email: no email address");
  } else if (inviteUrl && inviteExpiresAt) {
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
  if (!member.email) {
    result.skipped.push("Agreement email: no email address");
  } else if (signUrl && agreementExpiresAt) {
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
