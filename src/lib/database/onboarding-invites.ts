import "server-only";

import { createClientForContext } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  OnboardingInvite,
  OnboardingInviteWithMember,
  OnboardingInviteStatus,
  OnboardingPaymentMethod,
  BillingFrequency,
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
    membershipId: string
  ): Promise<OnboardingInvite | null> {
    const supabase = await createClientForContext();

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
// Transform Functions
// =============================================================================

function transformInvite(dbInvite: any): OnboardingInvite {
  return {
    id: dbInvite.id,
    organizationId: dbInvite.organization_id,
    membershipId: dbInvite.membership_id,
    memberId: dbInvite.member_id,
    paymentMethod: dbInvite.payment_method || "stripe",
    stripeCheckoutSessionId: dbInvite.stripe_checkout_session_id,
    stripeSetupIntentId: dbInvite.stripe_setup_intent_id || null,
    enrollmentFeeAmount: parseFloat(dbInvite.enrollment_fee_amount) || 0,
    includesEnrollmentFee: dbInvite.includes_enrollment_fee || false,
    enrollmentFeePaidAt: dbInvite.enrollment_fee_paid_at,
    duesAmount: parseFloat(dbInvite.dues_amount) || 0,
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

function transformInvites(dbInvites: any[]): OnboardingInvite[] {
  return dbInvites.map(transformInvite);
}

function transformInvitesWithDetails(
  dbInvites: any[]
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
            createdAt: member.created_at,
            updatedAt: member.updated_at,
          }
        : ({} as any),
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
            enrollmentFeePaid: membership.enrollment_fee_paid,
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
        : ({} as any),
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
        : ({} as any),
    };
  });
}

// =============================================================================
// Legacy Exports (for backward compatibility during migration)
// =============================================================================

export const AutoPayInvitesService = OnboardingInvitesService;
export type CreateAutoPayInviteInput = CreateOnboardingInviteInput;
