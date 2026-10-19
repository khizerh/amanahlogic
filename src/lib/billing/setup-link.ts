/**
 * Card-setup link builder shared by:
 *   - POST /api/stripe/setup-autopay        (admin: Copy Setup Link / Set Up Auto-Pay)
 *   - POST /api/stripe/send-payment-setup   (admin: Resend Payment Link, emails it)
 *   - portal getAutopaySetupUrl() action    (member: self-serve restart after Stripe
 *                                            cancelled their subscription)
 *
 * One place decides what the member will be charged when the card is saved:
 * enrollment fee (if unpaid), first dues (unless current → trial), and past
 * dues (see ./arrears.ts). The webhook re-derives the same numbers from the
 * database at charge time, so the SetupIntent metadata is a cap, not a trusted
 * amount.
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MembershipsService } from "@/lib/database/memberships";
import { MembersService } from "@/lib/database/members";
import { PlansService } from "@/lib/database/plans";
import { OrganizationsService } from "@/lib/database/organizations";
import {
  getOrCreateStripeCustomer,
  createSetupIntent,
  calculateFees,
  calculateArrearsCharge,
  getPlatformFee,
} from "@/lib/stripe";
import { getTodayInOrgTimezone } from "@/lib/billing/invoice-generator";
import { monthsOwed, clampArrearsMonths, arrearsPeriodLabel } from "@/lib/billing/arrears";
import type { BillingFrequency, Member, Membership, Organization, Plan } from "@/lib/types";

export interface ArrearsQuote {
  /** Whole months owed before the current period, as of today in the org's timezone. */
  owedMonths: number;
  /** Months that will actually be collected (admin may have waived some). */
  arrearsMonths: number;
  waivedMonths: number;
  /** e.g. "Sep 2026" or "Feb – Aug 2026" for the collected months. */
  periodLabel: string;
  /** What the member pays for the collected months, fees included. */
  chargeAmountCents: number;
  /** One month of dues as the member would be charged, fees included. */
  monthlyChargeCents: number;
}

export function quoteArrears(params: {
  membership: Pick<Membership, "nextPaymentDue">;
  plan: Pick<Plan, "pricing">;
  org: Pick<Organization, "platformFees" | "passFeesToMember" | "timezone">;
  requestedMonths?: number | null;
  today?: string;
}): ArrearsQuote {
  const { membership, plan, org, requestedMonths } = params;
  const today = params.today ?? getTodayInOrgTimezone(org.timezone || "America/Los_Angeles");
  const owedMonths = monthsOwed(membership.nextPaymentDue, today);
  const arrearsMonths = clampArrearsMonths(requestedMonths, owedMonths);

  const monthlyDuesCents = Math.round((plan.pricing?.monthly || 0) * 100);
  const platformFeeMonthlyDollars = getPlatformFee(org.platformFees, "monthly");
  const passFeesToMember = org.passFeesToMember || false;

  const charge = calculateArrearsCharge({
    months: arrearsMonths,
    monthlyDuesCents,
    platformFeeMonthlyDollars,
    passFeesToMember,
  });
  const monthly = calculateFees(monthlyDuesCents, platformFeeMonthlyDollars, passFeesToMember);

  return {
    owedMonths,
    arrearsMonths,
    waivedMonths: owedMonths - arrearsMonths,
    periodLabel: arrearsPeriodLabel(membership.nextPaymentDue, arrearsMonths),
    chargeAmountCents: arrearsMonths > 0 ? charge.chargeAmountCents : 0,
    monthlyChargeCents: monthly.chargeAmountCents,
  };
}

export interface CreateAutopaySetupLinkParams {
  organizationId: string;
  membershipId: string;
  memberId: string;
  /** Third-party payer who will own the Stripe customer and card. */
  payerMemberId?: string;
  /**
   * Enrollment fee handling. Default: include it when the membership's fee is
   * unpaid. `false` skips it even when unpaid.
   */
  includeEnrollmentFee?: boolean;
  /** Admin-approved past-dues months. Omitted = everything owed. Clamped to owed. */
  arrearsMonths?: number | null;
  /** Supabase client to read with. Defaults to the request's auth context. */
  client?: SupabaseClient;
}

export interface AutopaySetupLink {
  url: string;
  setupIntentId: string;
  customerId: string;
  membership: Membership;
  member: Member;
  payerMember: Member | null;
  plan: Plan;
  org: Organization;
  billingFrequency: BillingFrequency;
  memberIsCurrent: boolean;
  /** Set only when the member is current: the date auto-pay will begin. */
  nextPaymentDue?: string;
  includesEnrollmentFee: boolean;
  /** Fees included, as the member will be charged. */
  enrollmentFeeChargeCents: number;
  duesChargeCents: number;
  arrears: ArrearsQuote;
}

export class SetupLinkError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "SetupLinkError";
  }
}

export async function createAutopaySetupLink(
  params: CreateAutopaySetupLinkParams
): Promise<AutopaySetupLink> {
  const { organizationId, membershipId, memberId, payerMemberId, client } = params;

  const membership = await MembershipsService.getById(membershipId, client);
  if (!membership || membership.organizationId !== organizationId) {
    throw new SetupLinkError("Membership not found", 404);
  }
  if (membership.autoPayEnabled && membership.stripeSubscriptionId) {
    throw new SetupLinkError("Member already has autopay enabled", 400);
  }

  const [member, org, plan] = await Promise.all([
    MembersService.getById(memberId, client),
    OrganizationsService.getById(organizationId, client),
    PlansService.getById(membership.planId, client),
  ]);
  if (!member) throw new SetupLinkError("Member not found", 404);
  if (!org) throw new SetupLinkError("Organization not found", 404);
  if (!plan) throw new SetupLinkError("Plan not found", 404);

  let payerMember: Member | null = null;
  let payerForMemberName: string | undefined;
  if (payerMemberId) {
    payerMember = await MembersService.getById(payerMemberId, client);
    if (!payerMember) throw new SetupLinkError("Payer member not found", 404);
    if (!payerMember.email) throw new SetupLinkError("Payer has no email address", 400);
    payerForMemberName = fullName(member);
  }

  // Current = paid through a future date → card saved now, first charge deferred.
  const memberIsCurrent = membership.nextPaymentDue
    ? new Date(membership.nextPaymentDue) > new Date()
    : false;
  const nextPaymentDue = memberIsCurrent ? membership.nextPaymentDue ?? undefined : undefined;

  // The Stripe customer belongs to whoever holds the card. For a payer, that is
  // the payer's own membership record, so their card is found again later.
  const customerMember = payerMember || member;
  const customerMembershipId = payerMember
    ? (await MembershipsService.getByMemberId(payerMember.id))?.id || membership.id
    : membership.id;
  const customerId = await getOrCreateStripeCustomer({
    memberId: customerMember.id,
    membershipId: customerMembershipId,
    email: customerMember.email || undefined,
    name: fullName(customerMember),
    organizationId,
  });

  const billingFrequency = (membership.billingFrequency || "monthly") as BillingFrequency;
  const priceAmount =
    billingFrequency === "biannual"
      ? plan.pricing.biannual
      : billingFrequency === "annual"
        ? plan.pricing.annual
        : plan.pricing.monthly;
  const duesAmountCents = Math.round(priceAmount * 100);
  const platformFeeDollars = getPlatformFee(org.platformFees, billingFrequency);
  const passFeesToMember = org.passFeesToMember || false;
  const duesFees = calculateFees(duesAmountCents, platformFeeDollars, passFeesToMember);

  const includesEnrollmentFee =
    params.includeEnrollmentFee !== undefined
      ? params.includeEnrollmentFee && membership.enrollmentFeeStatus === "unpaid"
      : membership.enrollmentFeeStatus === "unpaid";
  const enrollmentFeeCents = includesEnrollmentFee ? Math.round(plan.enrollmentFee * 100) : 0;
  // Platform fee applies to dues only — never to the enrollment fee
  const enrollmentFeeChargeCents =
    enrollmentFeeCents > 0 ? calculateFees(enrollmentFeeCents, 0, passFeesToMember).chargeAmountCents : 0;

  const arrears = quoteArrears({
    membership,
    plan,
    org,
    requestedMonths: params.arrearsMonths,
  });

  const setupResult = await createSetupIntent({
    customerId,
    membershipId: membership.id,
    memberId: member.id,
    organizationId,
    planName: plan.name,
    duesAmountCents,
    enrollmentFeeAmountCents: enrollmentFeeCents,
    billingFrequency,
    passFeesToMember,
    stripeConnectAccountId: org.stripeConnectId && org.stripeOnboarded ? org.stripeConnectId : undefined,
    memberIsCurrent,
    nextPaymentDue,
    payerMemberId,
    payerForMemberName,
    arrearsMonths: arrears.arrearsMonths,
  });

  // Subscription ID is set by the webhook once the card is saved.
  await MembershipsService.update(
    {
      id: membership.id,
      stripeCustomerId: customerId,
      ...(payerMemberId && { payerMemberId }),
    },
    client
  );

  return {
    url: setupResult.url,
    setupIntentId: setupResult.setupIntentId,
    customerId,
    membership,
    member,
    payerMember,
    plan,
    org,
    billingFrequency,
    memberIsCurrent,
    nextPaymentDue,
    includesEnrollmentFee,
    enrollmentFeeChargeCents,
    duesChargeCents: duesFees.chargeAmountCents,
    arrears,
  };
}

function fullName(m: Pick<Member, "firstName" | "middleName" | "lastName">): string {
  return `${m.firstName} ${m.middleName ? `${m.middleName} ` : ""}${m.lastName}`;
}
