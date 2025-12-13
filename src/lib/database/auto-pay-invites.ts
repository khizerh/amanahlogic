import "server-only";

import { createClientForContext } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AutoPayInvite,
  AutoPayInviteWithMember,
  AutoPayInviteStatus,
} from "@/lib/types";

// =============================================================================
// Input Types
// =============================================================================

export interface CreateAutoPayInviteInput {
  organizationId: string;
  membershipId: string;
  memberId: string;
  stripeCheckoutSessionId?: string;
  plannedAmount: number;
  firstChargeDate?: string;
  sentAt: string;
}

// =============================================================================
// AutoPayInvitesService
// =============================================================================

export class AutoPayInvitesService {
  /**
   * Get all auto-pay invites for an organization
   */
  static async getAll(organizationId: string): Promise<AutoPayInvite[]> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("auto_pay_invites")
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
    status?: AutoPayInviteStatus
  ): Promise<AutoPayInviteWithMember[]> {
    const supabase = await createClientForContext();

    let query = supabase
      .from("auto_pay_invites")
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

    const { data, error } = await query;

    if (error) throw error;
    return transformInvitesWithDetails(data || []);
  }

  /**
   * Get a single invite by ID
   */
  static async getById(inviteId: string): Promise<AutoPayInvite | null> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("auto_pay_invites")
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
  ): Promise<AutoPayInvite | null> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("auto_pay_invites")
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
   * Get pending invite for a membership
   */
  static async getPendingForMembership(
    membershipId: string
  ): Promise<AutoPayInvite | null> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("auto_pay_invites")
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
   * Create a new auto-pay invite
   */
  static async create(
    input: CreateAutoPayInviteInput,
    supabase?: SupabaseClient
  ): Promise<AutoPayInvite> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("auto_pay_invites")
      .insert({
        organization_id: input.organizationId,
        membership_id: input.membershipId,
        member_id: input.memberId,
        stripe_checkout_session_id: input.stripeCheckoutSessionId || null,
        planned_amount: input.plannedAmount,
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
  ): Promise<AutoPayInvite> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("auto_pay_invites")
      .update({
        stripe_checkout_session_id: sessionId,
      })
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
  ): Promise<AutoPayInvite> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("auto_pay_invites")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
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
  ): Promise<AutoPayInvite> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("auto_pay_invites")
      .update({
        status: "expired",
        expired_at: new Date().toISOString(),
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
  ): Promise<AutoPayInvite> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("auto_pay_invites")
      .update({
        status: "canceled",
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
  static async getPendingCount(organizationId: string): Promise<number> {
    const supabase = await createClientForContext();

    const { count, error } = await supabase
      .from("auto_pay_invites")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "pending");

    if (error) throw error;
    return count || 0;
  }

  /**
   * Delete an invite
   */
  static async delete(inviteId: string): Promise<void> {
    const supabase = await createClientForContext();

    const { error } = await supabase
      .from("auto_pay_invites")
      .delete()
      .eq("id", inviteId);

    if (error) throw error;
  }
}

// =============================================================================
// Transform Functions
// =============================================================================

function transformInvite(dbInvite: any): AutoPayInvite {
  return {
    id: dbInvite.id,
    organizationId: dbInvite.organization_id,
    membershipId: dbInvite.membership_id,
    memberId: dbInvite.member_id,
    stripeCheckoutSessionId: dbInvite.stripe_checkout_session_id,
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

function transformInvites(dbInvites: any[]): AutoPayInvite[] {
  return dbInvites.map(transformInvite);
}

function transformInvitesWithDetails(
  dbInvites: any[]
): AutoPayInviteWithMember[] {
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
