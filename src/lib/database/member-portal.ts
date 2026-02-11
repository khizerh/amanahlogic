import "server-only";

import { createClientForContext } from "@/lib/supabase/server";
import type {
  Member,
  Membership,
  Payment,
  Plan,
  Organization,
  BillingConfig,
} from "@/lib/types";

// =============================================================================
// Types
// =============================================================================

export interface MemberPortalData {
  member: Member;
  membership: Membership | null;
  plan: Plan | null;
  organization: Organization;
  billingConfig: BillingConfig;
}

export interface MemberDashboardData {
  member: Member;
  membership: Membership | null;
  plan: Plan | null;
  organization: {
    name: string;
    phone: string;
    email: string;
    timezone: string;
    platformFee: number;
    passFeesToMember: boolean;
  };
  stats: {
    paidMonths: number;
    eligibilityMonths: number;
    monthsRemaining: number;
    isEligible: boolean;
    nextPaymentDue: string | null;
    lastPaymentDate: string | null;
    memberSince: string | null;
  };
}

export interface MemberPaymentHistory {
  payments: Payment[];
  totalPaid: number;
  totalMonthsCredited: number;
}

// =============================================================================
// MemberPortalService
// =============================================================================

export class MemberPortalService {
  /**
   * Get member by user email (for auth lookup)
   */
  static async getMemberByEmail(email: string): Promise<{
    member: Member;
    organizationId: string;
  } | null> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("members")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !data) return null;

    return {
      member: transformMember(data),
      organizationId: data.organization_id,
    };
  }

  /**
   * Get member by ID with full membership details
   */
  static async getMemberById(
    memberId: string,
    organizationId: string
  ): Promise<MemberPortalData | null> {
    const supabase = await createClientForContext();

    // Fetch member with membership and plan
    const { data: memberData, error: memberError } = await supabase
      .from("members")
      .select(`
        *,
        membership:memberships(
          *,
          plan:plans(*)
        )
      `)
      .eq("id", memberId)
      .eq("organization_id", organizationId)
      .single();

    if (memberError || !memberData) return null;

    // Fetch organization
    const { data: orgData, error: orgError } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", organizationId)
      .single();

    if (orgError || !orgData) return null;

    // Fetch billing config
    const { data: settingsData } = await supabase
      .from("organization_settings")
      .select("billing_config")
      .eq("organization_id", organizationId)
      .single();

    const membership = Array.isArray(memberData.membership)
      ? memberData.membership[0]
      : memberData.membership;
    const plan = membership?.plan;
    const planData = Array.isArray(plan) ? plan[0] : plan;

    return {
      member: transformMember(memberData),
      membership: membership ? transformMembership(membership) : null,
      plan: planData ? transformPlan(planData) : null,
      organization: transformOrganization(orgData),
      billingConfig: settingsData?.billing_config || {
        lapseDays: 7,
        cancelMonths: 24,
        reminderSchedule: [3, 7, 14],
        maxReminders: 3,
        sendInvoiceReminders: true,
        eligibilityMonths: 60,
      },
    };
  }

  /**
   * Get dashboard data for member
   */
  static async getDashboardData(
    memberId: string,
    organizationId: string
  ): Promise<MemberDashboardData | null> {
    const portalData = await this.getMemberById(memberId, organizationId);
    if (!portalData) return null;

    const { member, membership, plan, organization, billingConfig } = portalData;
    const eligibilityMonths = billingConfig.eligibilityMonths || 60;
    const paidMonths = membership?.paidMonths || 0;
    const monthsRemaining = Math.max(0, eligibilityMonths - paidMonths);
    const isEligible = paidMonths >= eligibilityMonths && membership?.status !== "cancelled";

    return {
      member,
      membership,
      plan,
      organization: {
        name: organization.name,
        phone: organization.phone,
        email: organization.email,
        timezone: organization.timezone || "America/Los_Angeles",
        platformFee: organization.platformFee || 0,
        passFeesToMember: organization.passFeesToMember || false,
      },
      stats: {
        paidMonths,
        eligibilityMonths,
        monthsRemaining,
        isEligible,
        nextPaymentDue: membership?.nextPaymentDue || null,
        lastPaymentDate: membership?.lastPaymentDate || null,
        memberSince: membership?.joinDate || null,
      },
    };
  }

  /**
   * Get payment history for member
   */
  static async getPaymentHistory(
    memberId: string,
    organizationId: string
  ): Promise<MemberPaymentHistory> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("member_id", memberId)
      .eq("organization_id", organizationId)
      .eq("status", "completed")
      .order("paid_at", { ascending: false });

    if (error) throw error;

    const payments = transformPayments(data || []);
    const totalPaid = payments.reduce((sum, p) => sum + (p.totalCharged || p.amount), 0);
    const totalMonthsCredited = payments.reduce((sum, p) => sum + p.monthsCredited, 0);

    return {
      payments,
      totalPaid,
      totalMonthsCredited,
    };
  }

  /**
   * Update member profile (limited fields)
   */
  static async updateProfile(
    memberId: string,
    organizationId: string,
    updates: {
      phone?: string;
      address?: {
        street: string;
        city: string;
        state: string;
        zip: string;
      };
      emergencyContact?: {
        name: string;
        phone: string;
      };
      preferredLanguage?: "en" | "fa";
    }
  ): Promise<Member> {
    const supabase = await createClientForContext();

    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.address !== undefined) dbUpdates.address = updates.address;
    if (updates.emergencyContact !== undefined) dbUpdates.emergency_contact = updates.emergencyContact;
    if (updates.preferredLanguage !== undefined) dbUpdates.preferred_language = updates.preferredLanguage;

    const { data, error } = await supabase
      .from("members")
      .update(dbUpdates)
      .eq("id", memberId)
      .eq("organization_id", organizationId)
      .select()
      .single();

    if (error) throw error;
    return transformMember(data);
  }

  /**
   * Get Stripe customer ID for member (for portal access)
   */
  static async getStripeCustomerId(
    memberId: string,
    organizationId: string
  ): Promise<string | null> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("memberships")
      .select("stripe_customer_id")
      .eq("member_id", memberId)
      .eq("organization_id", organizationId)
      .single();

    if (error || !data) return null;
    return data.stripe_customer_id;
  }

  /**
   * Get member's signed agreement
   */
  static async getAgreement(
    memberId: string,
    organizationId: string
  ): Promise<{
    id: string;
    signedAt: string | null;
    signedName: string | null;
    pdfUrl: string | null;
    templateVersion: string;
  } | null> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("agreements")
      .select("id, signed_at, signed_name, pdf_url, template_version")
      .eq("member_id", memberId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      signedAt: data.signed_at,
      signedName: data.signed_name,
      pdfUrl: data.pdf_url,
      templateVersion: data.template_version,
    };
  }
}

// =============================================================================
// Transform Functions
// =============================================================================

interface DbMemberRow {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: { street: string; city: string; state: string; zip: string };
  spouse_name: string | null;
  children: { id: string; name: string; dateOfBirth: string }[] | null;
  emergency_contact: { name: string; phone: string };
  preferred_language: "en" | "fa";
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

interface DbMembershipRow {
  id: string;
  organization_id: string;
  member_id: string;
  plan_id: string;
  status: string;
  billing_frequency: string;
  billing_anniversary_day: number;
  paid_months: number;
  enrollment_fee_status: string | null;
  join_date: string | null;
  last_payment_date: string | null;
  next_payment_due: string | null;
  eligible_date: string | null;
  cancelled_date: string | null;
  agreement_signed_at: string | null;
  agreement_id: string | null;
  auto_pay_enabled: boolean;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  subscription_status: string | null;
  payment_method: { type: string; last4: string; brand?: string; bankName?: string; expiryMonth?: number; expiryYear?: number } | null;
  created_at: string;
  updated_at: string;
}

interface DbPlanRow {
  id: string;
  organization_id: string;
  type: string;
  name: string;
  description: string;
  pricing: { monthly: number; biannual: number; annual: number };
  enrollment_fee: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DbOrganizationRow {
  id: string;
  name: string;
  slug: string;
  address: { street: string; city: string; state: string; zip: string };
  phone: string;
  email: string;
  timezone: string;
  stripe_connect_id: string | null;
  stripe_onboarded: boolean;
  platform_fee: number;
  pass_fees_to_member: boolean;
  created_at: string;
  updated_at: string;
}

interface DbPaymentRow {
  id: string;
  organization_id: string;
  membership_id: string;
  member_id: string;
  type: string;
  method: string;
  status: string;
  amount: number;
  stripe_fee: number;
  platform_fee: number;
  total_charged: number;
  net_amount: number;
  months_credited: number;
  invoice_number: string | null;
  due_date: string | null;
  period_start: string | null;
  period_end: string | null;
  period_label: string | null;
  stripe_payment_intent_id: string | null;
  check_number: string | null;
  zelle_transaction_id: string | null;
  notes: string | null;
  recorded_by: string | null;
  reminder_count: number;
  reminder_sent_at: string | null;
  reminders_paused: boolean;
  requires_review: boolean;
  created_at: string;
  paid_at: string | null;
  refunded_at: string | null;
}

function transformMember(db: DbMemberRow): Member {
  return {
    id: db.id,
    organizationId: db.organization_id,
    firstName: db.first_name,
    lastName: db.last_name,
    email: db.email,
    phone: db.phone || "",
    address: db.address,
    spouseName: db.spouse_name,
    children: db.children || [],
    emergencyContact: db.emergency_contact,
    preferredLanguage: db.preferred_language,
    userId: db.user_id || null,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

function transformMembership(db: DbMembershipRow): Membership {
  return {
    id: db.id,
    organizationId: db.organization_id,
    memberId: db.member_id,
    planId: db.plan_id,
    status: db.status as Membership["status"],
    billingFrequency: db.billing_frequency as Membership["billingFrequency"],
    billingAnniversaryDay: db.billing_anniversary_day,
    paidMonths: db.paid_months,
    enrollmentFeeStatus: (db.enrollment_fee_status || "unpaid") as Membership["enrollmentFeeStatus"],
    joinDate: db.join_date,
    lastPaymentDate: db.last_payment_date,
    nextPaymentDue: db.next_payment_due,
    eligibleDate: db.eligible_date,
    cancelledDate: db.cancelled_date,
    agreementSignedAt: db.agreement_signed_at,
    agreementId: db.agreement_id,
    autoPayEnabled: db.auto_pay_enabled,
    stripeSubscriptionId: db.stripe_subscription_id,
    stripeCustomerId: db.stripe_customer_id,
    subscriptionStatus: db.subscription_status as Membership["subscriptionStatus"],
    paymentMethod: db.payment_method as Membership["paymentMethod"],
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

function transformPlan(db: DbPlanRow): Plan {
  return {
    id: db.id,
    organizationId: db.organization_id,
    type: db.type,
    name: db.name,
    description: db.description,
    pricing: db.pricing,
    enrollmentFee: db.enrollment_fee,
    isActive: db.is_active,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

function transformOrganization(db: DbOrganizationRow): Organization {
  return {
    id: db.id,
    name: db.name,
    slug: db.slug,
    address: db.address,
    phone: db.phone,
    email: db.email,
    timezone: db.timezone,
    stripeConnectId: db.stripe_connect_id,
    stripeOnboarded: db.stripe_onboarded,
    platformFee: db.platform_fee,
    passFeesToMember: db.pass_fees_to_member,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

function transformPayment(db: DbPaymentRow): Payment {
  return {
    id: db.id,
    organizationId: db.organization_id,
    membershipId: db.membership_id,
    memberId: db.member_id,
    type: db.type as Payment["type"],
    method: db.method as Payment["method"],
    status: db.status as Payment["status"],
    amount: db.amount,
    stripeFee: db.stripe_fee,
    platformFee: db.platform_fee,
    totalCharged: db.total_charged,
    netAmount: db.net_amount,
    monthsCredited: db.months_credited,
    invoiceNumber: db.invoice_number,
    dueDate: db.due_date,
    periodStart: db.period_start,
    periodEnd: db.period_end,
    periodLabel: db.period_label,
    stripePaymentIntentId: db.stripe_payment_intent_id,
    checkNumber: db.check_number,
    zelleTransactionId: db.zelle_transaction_id,
    notes: db.notes,
    recordedBy: db.recorded_by,
    reminderCount: db.reminder_count,
    reminderSentAt: db.reminder_sent_at,
    remindersPaused: db.reminders_paused,
    requiresReview: db.requires_review,
    createdAt: db.created_at,
    paidAt: db.paid_at,
    refundedAt: db.refunded_at,
  };
}

function transformPayments(dbPayments: DbPaymentRow[]): Payment[] {
  return dbPayments.map(transformPayment);
}
