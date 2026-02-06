import "server-only";

import { createClientForContext } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BillingFrequency,
  Member,
  Membership,
  MembershipStatus,
  OnboardingInvite,
  OnboardingInviteWithMember,
  OnboardingInviteStatus,
  OnboardingPaymentMethod,
  PaymentMethodDetails,
  Plan,
  PlanPricing,
  SubscriptionStatus,
} from "@/lib/types";

// =============================================================================
// Input Types
// =============================================================================

export interface CreateOnboardingInviteInput {
  organizationId: string;
  membershipId: string;
  memberId: string;
  paymentMethod: OnboardingPaymentMethod;
  stripeCheckoutSessionId?: string;
  stripeSetupIntentId?: string;
  enrollmentFeeAmount: number;
  includesEnrollmentFee: boolean;
  duesAmount: number;
  billingFrequency: BillingFrequency;
  plannedAmount?: number; // Legacy - monthly amount
  firstChargeDate?: string;
  sentAt: string;
}

export interface RecordManualPaymentInput {
  inviteId: string;
  enrollmentFeePaid?: boolean;
  duesPaid?: boolean;
}

// =============================================================================
// OnboardingInvitesService
// =============================================================================

export class OnboardingInvitesService {
  /**
   * Get all onboarding invites for an organization
   */
  static async getAll(organizationId: string): Promise<OnboardingInvite[]> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("onboarding_invites")
      .select("*")
      .eq("organization_id", organizationId)
      .order("sent_at", { ascending: false });

    if (error) throw error;
    return transformInvites(data || []);
  }

  /**
   * Get invites with member details
   */
  static async getAllWithDetails(
    organizationId: string,
    status?: OnboardingInviteStatus,
    paymentMethod?: OnboardingPaymentMethod
  ): Promise<OnboardingInviteWithMember[]> {
    const supabase = await createClientForContext();

    let query = supabase
      .from("onboarding_invites")
      .select(
        `
        *,
        member:members(*),
        membership:memberships(
          *,
          plan:plans(*)
        )
      `
      )
      .eq("organization_id", organizationId)
      .order("sent_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    if (paymentMethod) {
      query = query.eq("payment_method", paymentMethod);
    }

    const { data, error } = await query;

    if (error) throw error;
    return transformInvitesWithDetails(data || []);
  }

  /**
   * Get a single invite by ID
   */
  static async getById(inviteId: string): Promise<OnboardingInvite | null> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("onboarding_invites")
      .select("*")
      .eq("id", inviteId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return transformInvite(data);
  }

  /**
   * Get invite by Stripe checkout session ID
   */
  static async getByCheckoutSessionId(
    sessionId: string,
    supabase?: SupabaseClient
  ): Promise<OnboardingInvite | null> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("onboarding_invites")
      .select("*")
      .eq("stripe_checkout_session_id", sessionId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return transformInvite(data);
  }

  /**
   * Get invite by Stripe SetupIntent ID
   */
  static async getBySetupIntentId(
    setupIntentId: string,
    supabase?: SupabaseClient
  ): Promise<OnboardingInvite | null> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("onboarding_invites")
      .select("*")
      .eq("stripe_setup_intent_id", setupIntentId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return transformInvite(data);
  }

  /**
   * Get pending invite for a membership
   */
  static async getPendingForMembership(
    membershipId: string,
    client?: SupabaseClient
  ): Promise<OnboardingInvite | null> {
    const supabase = client ?? (await createClientForContext());

    const { data, error } = await supabase
      .from("onboarding_invites")
      .select("*")
      .eq("membership_id", membershipId)
      .eq("status", "pending")
      .order("sent_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return transformInvite(data);
  }

  /**
   * Create a new onboarding invite
   */
  static async create(
    input: CreateOnboardingInviteInput,
    supabase?: SupabaseClient
  ): Promise<OnboardingInvite> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("onboarding_invites")
      .insert({
        organization_id: input.organizationId,
        membership_id: input.membershipId,
        member_id: input.memberId,
        payment_method: input.paymentMethod,
        stripe_checkout_session_id: input.stripeCheckoutSessionId || null,
        stripe_setup_intent_id: input.stripeSetupIntentId || null,
        enrollment_fee_amount: input.enrollmentFeeAmount,
        includes_enrollment_fee: input.includesEnrollmentFee,
        dues_amount: input.duesAmount,
        billing_frequency: input.billingFrequency,
        planned_amount: input.plannedAmount || input.duesAmount,
        first_charge_date: input.firstChargeDate || null,
        sent_at: input.sentAt,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;
    return transformInvite(data);
  }

  /**
   * Update Stripe checkout session ID
   */
  static async setCheckoutSessionId(
    inviteId: string,
    sessionId: string,
    supabase?: SupabaseClient
  ): Promise<OnboardingInvite> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("onboarding_invites")
      .update({
        stripe_checkout_session_id: sessionId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", inviteId)
      .select()
      .single();

    if (error) throw error;
    return transformInvite(data);
  }

  /**
   * Record enrollment fee payment (for manual payments)
   */
  static async recordEnrollmentFeePaid(
    inviteId: string,
    supabase?: SupabaseClient
  ): Promise<OnboardingInvite> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("onboarding_invites")
      .update({
        enrollment_fee_paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", inviteId)
      .select()
      .single();

    if (error) throw error;

    // Check if invite is now complete
    const invite = transformInvite(data);
    if (isInviteComplete(invite)) {
      return this.markCompleted(inviteId, client);
    }

    return invite;
  }

  /**
   * Record dues payment (for manual payments)
   */
  static async recordDuesPaid(
    inviteId: string,
    supabase?: SupabaseClient
  ): Promise<OnboardingInvite> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("onboarding_invites")
      .update({
        dues_paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", inviteId)
      .select()
      .single();

    if (error) throw error;

    // Check if invite is now complete
    const invite = transformInvite(data);
    if (isInviteComplete(invite)) {
      return this.markCompleted(inviteId, client);
    }

    return invite;
  }

  /**
   * Record both enrollment fee and dues paid at once
   */
  static async recordFullPayment(
    inviteId: string,
    supabase?: SupabaseClient
  ): Promise<OnboardingInvite> {
    const client = supabase ?? (await createClientForContext());
    const now = new Date().toISOString();

    // Get the invite to check if it includes enrollment fee
    const { data: existing } = await client
      .from("onboarding_invites")
      .select("includes_enrollment_fee")
      .eq("id", inviteId)
      .single();

    const updateData: Record<string, unknown> = {
      dues_paid_at: now,
      updated_at: now,
      status: "completed",
      completed_at: now,
    };

    if (existing?.includes_enrollment_fee) {
      updateData.enrollment_fee_paid_at = now;
    }

    const { data, error } = await client
      .from("onboarding_invites")
      .update(updateData)
      .eq("id", inviteId)
      .select()
      .single();

    if (error) throw error;
    return transformInvite(data);
  }

  /**
   * Mark invite as completed
   */
  static async markCompleted(
    inviteId: string,
    supabase?: SupabaseClient
  ): Promise<OnboardingInvite> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("onboarding_invites")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", inviteId)
      .select()
      .single();

    if (error) throw error;
    return transformInvite(data);
  }

  /**
   * Mark invite as expired
   */
  static async markExpired(
    inviteId: string,
    supabase?: SupabaseClient
  ): Promise<OnboardingInvite> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("onboarding_invites")
      .update({
        status: "expired",
        expired_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", inviteId)
      .select()
      .single();

    if (error) throw error;
    return transformInvite(data);
  }

  /**
   * Mark invite as canceled
   */
  static async markCanceled(
    inviteId: string,
    supabase?: SupabaseClient
  ): Promise<OnboardingInvite> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("onboarding_invites")
      .update({
        status: "canceled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", inviteId)
      .select()
      .single();

    if (error) throw error;
    return transformInvite(data);
  }

  /**
   * Get count of pending invites
   */
  static async getPendingCount(
    organizationId: string,
    paymentMethod?: OnboardingPaymentMethod
  ): Promise<number> {
    const supabase = await createClientForContext();

    let query = supabase
      .from("onboarding_invites")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "pending");

    if (paymentMethod) {
      query = query.eq("payment_method", paymentMethod);
    }

    const { count, error } = await query;

    if (error) throw error;
    return count || 0;
  }

  /**
   * Delete an invite
   */
  static async delete(inviteId: string): Promise<void> {
    const supabase = await createClientForContext();

    const { error } = await supabase
      .from("onboarding_invites")
      .delete()
      .eq("id", inviteId);

    if (error) throw error;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if an invite is complete (all required payments made)
 */
function isInviteComplete(invite: OnboardingInvite): boolean {
  // Dues must always be paid
  if (!invite.duesPaidAt) return false;

  // If enrollment fee is included, it must also be paid
  if (invite.includesEnrollmentFee && !invite.enrollmentFeePaidAt) {
    return false;
  }

  return true;
}

// =============================================================================
// DB Row Interfaces (snake_case shapes returned by Supabase)
// =============================================================================

interface DbOnboardingInviteRow {
  id: string;
  organization_id: string;
  membership_id: string;
  member_id: string;
  payment_method: OnboardingPaymentMethod;
  stripe_checkout_session_id: string | null;
  stripe_setup_intent_id: string | null;
  enrollment_fee_amount: number | string;
  includes_enrollment_fee: boolean;
  enrollment_fee_paid_at: string | null;
  dues_amount: number | string;
  billing_frequency: BillingFrequency | null;
  dues_paid_at: string | null;
  planned_amount: number;
  first_charge_date: string | null;
  status: OnboardingInviteStatus;
  sent_at: string;
  completed_at: string | null;
  expired_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DbMemberJoinRow {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  email: string;
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

interface DbMembershipJoinRow {
  id: string;
  organization_id: string;
  member_id: string;
  plan_id: string;
  status: MembershipStatus;
  billing_frequency: BillingFrequency;
  billing_anniversary_day: number;
  paid_months: number;
  enrollment_fee_status: "unpaid" | "paid" | "waived" | null;
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
  subscription_status: SubscriptionStatus | null;
  payment_method: PaymentMethodDetails | null;
  created_at: string;
  updated_at: string;
  plan?: DbPlanJoinRow | DbPlanJoinRow[];
}

interface DbPlanJoinRow {
  id: string;
  organization_id: string;
  type: string;
  name: string;
  description: string;
  pricing: PlanPricing;
  enrollment_fee: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DbOnboardingInviteWithDetailsRow extends DbOnboardingInviteRow {
  member: DbMemberJoinRow | DbMemberJoinRow[] | null;
  membership: DbMembershipJoinRow | DbMembershipJoinRow[] | null;
}

// =============================================================================
// Transform Functions
// =============================================================================

function transformInvite(dbInvite: DbOnboardingInviteRow): OnboardingInvite {
  return {
    id: dbInvite.id,
    organizationId: dbInvite.organization_id,
    membershipId: dbInvite.membership_id,
    memberId: dbInvite.member_id,
    paymentMethod: dbInvite.payment_method || "stripe",
    stripeCheckoutSessionId: dbInvite.stripe_checkout_session_id,
    stripeSetupIntentId: dbInvite.stripe_setup_intent_id || null,
    enrollmentFeeAmount: Number(dbInvite.enrollment_fee_amount) || 0,
    includesEnrollmentFee: dbInvite.includes_enrollment_fee || false,
    enrollmentFeePaidAt: dbInvite.enrollment_fee_paid_at,
    duesAmount: Number(dbInvite.dues_amount) || 0,
    billingFrequency: dbInvite.billing_frequency,
    duesPaidAt: dbInvite.dues_paid_at,
    plannedAmount: dbInvite.planned_amount,
    firstChargeDate: dbInvite.first_charge_date,
    status: dbInvite.status,
    sentAt: dbInvite.sent_at,
    completedAt: dbInvite.completed_at,
    expiredAt: dbInvite.expired_at,
    createdAt: dbInvite.created_at,
    updatedAt: dbInvite.updated_at,
  };
}

function transformInvites(dbInvites: DbOnboardingInviteRow[]): OnboardingInvite[] {
  return dbInvites.map(transformInvite);
}

function transformInvitesWithDetails(
  dbInvites: DbOnboardingInviteWithDetailsRow[]
): OnboardingInviteWithMember[] {
  return dbInvites.map((dbInvite) => {
    const member = Array.isArray(dbInvite.member)
      ? dbInvite.member[0]
      : dbInvite.member;
    const membership = Array.isArray(dbInvite.membership)
      ? dbInvite.membership[0]
      : dbInvite.membership;
    const plan = membership?.plan;
    const planData = Array.isArray(plan) ? plan[0] : plan;

    return {
      ...transformInvite(dbInvite),
      member: member
        ? {
            id: member.id,
            organizationId: member.organization_id,
            firstName: member.first_name,
            lastName: member.last_name,
            email: member.email,
            phone: member.phone || "",
            address: member.address,
            spouseName: member.spouse_name,
            children: member.children || [],
            emergencyContact: member.emergency_contact,
            preferredLanguage: member.preferred_language,
            userId: member.user_id,
            createdAt: member.created_at,
            updatedAt: member.updated_at,
          }
        : ({} as Member),
      membership: membership
        ? {
            id: membership.id,
            organizationId: membership.organization_id,
            memberId: membership.member_id,
            planId: membership.plan_id,
            status: membership.status,
            billingFrequency: membership.billing_frequency,
            billingAnniversaryDay: membership.billing_anniversary_day,
            paidMonths: membership.paid_months,
            enrollmentFeeStatus: membership.enrollment_fee_status || "unpaid",
            joinDate: membership.join_date,
            lastPaymentDate: membership.last_payment_date,
            nextPaymentDue: membership.next_payment_due,
            eligibleDate: membership.eligible_date,
            cancelledDate: membership.cancelled_date,
            agreementSignedAt: membership.agreement_signed_at,
            agreementId: membership.agreement_id,
            autoPayEnabled: membership.auto_pay_enabled,
            stripeSubscriptionId: membership.stripe_subscription_id,
            stripeCustomerId: membership.stripe_customer_id,
            subscriptionStatus: membership.subscription_status,
            paymentMethod: membership.payment_method,
            createdAt: membership.created_at,
            updatedAt: membership.updated_at,
          }
        : ({} as Membership),
      plan: planData
        ? {
            id: planData.id,
            organizationId: planData.organization_id,
            type: planData.type,
            name: planData.name,
            description: planData.description,
            pricing: planData.pricing,
            enrollmentFee: planData.enrollment_fee,
            isActive: planData.is_active,
            createdAt: planData.created_at,
            updatedAt: planData.updated_at,
          }
        : ({} as Plan),
    };
  });
}

// =============================================================================
// Legacy Exports (for backward compatibility during migration)
// =============================================================================

export const AutoPayInvitesService = OnboardingInvitesService;
export type CreateAutoPayInviteInput = CreateOnboardingInviteInput;
