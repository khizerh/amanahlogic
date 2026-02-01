import "server-only";

import { createClientForContext } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Membership,
  MembershipStatus,
  MembershipWithDetails,
  BillingFrequency,
  PaymentMethodDetails,
  SubscriptionStatus,
} from "@/lib/types";

// =============================================================================
// Input Types
// =============================================================================

export interface CreateMembershipInput {
  organizationId: string;
  memberId: string;
  planId: string;
  status?: MembershipStatus;
  billingFrequency?: BillingFrequency;
  billingAnniversaryDay?: number;
  paidMonths?: number;
  enrollmentFeePaid?: boolean;
  joinDate?: string | null;
  nextPaymentDue?: string | null;
}

export interface UpdateMembershipInput extends Partial<CreateMembershipInput> {
  id: string;
  lastPaymentDate?: string | null;
  eligibleDate?: string | null;
  cancelledDate?: string | null;
  agreementSignedAt?: string | null;
  agreementId?: string | null;
  autoPayEnabled?: boolean;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  subscriptionStatus?: SubscriptionStatus | null;
  paymentMethod?: PaymentMethodDetails | null;
}

// =============================================================================
// MembershipsService
// =============================================================================

export class MembershipsService {
  /**
   * Get all memberships for an organization
   */
  static async getAll(organizationId: string): Promise<Membership[]> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("memberships")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return transformMemberships(data || []);
  }

  /**
   * Get memberships with member and plan details
   */
  static async getAllWithDetails(
    organizationId: string,
    statusFilter?: MembershipStatus | "all"
  ): Promise<MembershipWithDetails[]> {
    const supabase = await createClientForContext();

    let query = supabase
      .from("memberships")
      .select(
        `
        *,
        member:members(*),
        plan:plans(*),
        recentPayments:payments(*)
      `
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (statusFilter && statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (error) throw error;
    return transformMembershipsWithDetails(data || []);
  }

  /**
   * Get a single membership by ID
   */
  static async getById(membershipId: string, client?: SupabaseClient): Promise<Membership | null> {
    const supabase = client ?? (await createClientForContext());

    const { data, error } = await supabase
      .from("memberships")
      .select("*")
      .eq("id", membershipId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return transformMembership(data);
  }

  /**
   * Get a membership with full details
   */
  static async getByIdWithDetails(
    membershipId: string
  ): Promise<MembershipWithDetails | null> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("memberships")
      .select(
        `
        *,
        member:members(*),
        plan:plans(*),
        recentPayments:payments(*)
      `
      )
      .eq("id", membershipId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return transformMembershipWithDetails(data);
  }

  /**
   * Get membership by member ID
   */
  static async getByMemberId(memberId: string): Promise<Membership | null> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("memberships")
      .select("*")
      .eq("member_id", memberId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return transformMembership(data);
  }

  /**
   * Get membership by Stripe subscription ID
   */
  static async getByStripeSubscriptionId(
    stripeSubscriptionId: string,
    supabase?: SupabaseClient
  ): Promise<Membership | null> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("memberships")
      .select("*")
      .eq("stripe_subscription_id", stripeSubscriptionId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return transformMembership(data);
  }

  /**
   * Get membership by Stripe customer ID
   */
  static async getByStripeCustomerId(
    stripeCustomerId: string,
    supabase?: SupabaseClient
  ): Promise<Membership | null> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("memberships")
      .select("*")
      .eq("stripe_customer_id", stripeCustomerId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return transformMembership(data);
  }

  /**
   * Create a new membership
   */
  static async create(
    input: CreateMembershipInput,
    supabase?: SupabaseClient
  ): Promise<Membership> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("memberships")
      .insert({
        organization_id: input.organizationId,
        member_id: input.memberId,
        plan_id: input.planId,
        status: input.status || "pending",
        billing_frequency: input.billingFrequency || "monthly",
        billing_anniversary_day: input.billingAnniversaryDay,
        paid_months: input.paidMonths || 0,
        enrollment_fee_paid: input.enrollmentFeePaid || false,
        join_date: input.joinDate || null,
        next_payment_due: input.nextPaymentDue || null,
      })
      .select()
      .single();

    if (error) throw error;
    return transformMembership(data);
  }

  /**
   * Update a membership
   */
  static async update(
    input: UpdateMembershipInput,
    supabase?: SupabaseClient
  ): Promise<Membership> {
    const client = supabase ?? (await createClientForContext());
    const { id, ...updates } = input;

    const dbUpdates: Record<string, unknown> = {};
    if (updates.organizationId !== undefined)
      dbUpdates.organization_id = updates.organizationId;
    if (updates.memberId !== undefined) dbUpdates.member_id = updates.memberId;
    if (updates.planId !== undefined) dbUpdates.plan_id = updates.planId;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.billingFrequency !== undefined)
      dbUpdates.billing_frequency = updates.billingFrequency;
    if (updates.billingAnniversaryDay !== undefined)
      dbUpdates.billing_anniversary_day = updates.billingAnniversaryDay;
    if (updates.paidMonths !== undefined)
      dbUpdates.paid_months = updates.paidMonths;
    if (updates.enrollmentFeePaid !== undefined)
      dbUpdates.enrollment_fee_paid = updates.enrollmentFeePaid;
    if (updates.joinDate !== undefined) dbUpdates.join_date = updates.joinDate;
    if (updates.lastPaymentDate !== undefined)
      dbUpdates.last_payment_date = updates.lastPaymentDate;
    if (updates.nextPaymentDue !== undefined)
      dbUpdates.next_payment_due = updates.nextPaymentDue;
    if (updates.eligibleDate !== undefined)
      dbUpdates.eligible_date = updates.eligibleDate;
    if (updates.cancelledDate !== undefined)
      dbUpdates.cancelled_date = updates.cancelledDate;
    if (updates.agreementSignedAt !== undefined)
      dbUpdates.agreement_signed_at = updates.agreementSignedAt;
    if (updates.agreementId !== undefined)
      dbUpdates.agreement_id = updates.agreementId;
    if (updates.autoPayEnabled !== undefined)
      dbUpdates.auto_pay_enabled = updates.autoPayEnabled;
    if (updates.stripeSubscriptionId !== undefined)
      dbUpdates.stripe_subscription_id = updates.stripeSubscriptionId;
    if (updates.stripeCustomerId !== undefined)
      dbUpdates.stripe_customer_id = updates.stripeCustomerId;
    if (updates.subscriptionStatus !== undefined)
      dbUpdates.subscription_status = updates.subscriptionStatus;
    if (updates.paymentMethod !== undefined)
      dbUpdates.payment_method = updates.paymentMethod;

    const { data, error } = await client
      .from("memberships")
      .update(dbUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return transformMembership(data);
  }

  /**
   * Delete a membership
   */
  static async delete(membershipId: string): Promise<void> {
    const supabase = await createClientForContext();

    const { error } = await supabase
      .from("memberships")
      .delete()
      .eq("id", membershipId);

    if (error) throw error;
  }

  /**
   * Get memberships approaching eligibility
   * @param eligibilityMonths - Total months required for eligibility (default 60)
   * @param windowMonths - How many months before eligibility to include (default 5, so 55-59 for 60-month eligibility)
   */
  static async getApproachingEligibility(
    organizationId: string,
    options: {
      eligibilityMonths?: number;
      windowMonths?: number;
      limit?: number;
    } = {}
  ): Promise<MembershipWithDetails[]> {
    const { eligibilityMonths = 60, windowMonths = 5, limit = 10 } = options;
    const minMonths = eligibilityMonths - windowMonths;

    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("memberships")
      .select(
        `
        *,
        member:members(*),
        plan:plans(*),
        recentPayments:payments(*)
      `
      )
      .eq("organization_id", organizationId)
      .gte("paid_months", minMonths)
      .lt("paid_months", eligibilityMonths)
      .order("paid_months", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return transformMembershipsWithDetails(data || []);
  }

  /**
   * Get memberships with overdue payments
   */
  static async getOverdue(
    organizationId: string,
    gracePeriodDays: number = 7
  ): Promise<MembershipWithDetails[]> {
    const supabase = await createClientForContext();

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - gracePeriodDays);
    const threshold = thresholdDate.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("memberships")
      .select(
        `
        *,
        member:members(*),
        plan:plans(*),
        recentPayments:payments(*)
      `
      )
      .eq("organization_id", organizationId)
      .in("status", ["waiting_period", "active", "lapsed"])
      .not("next_payment_due", "is", null)
      .lt("next_payment_due", threshold);

    if (error) throw error;
    return transformMembershipsWithDetails(data || []);
  }

  /**
   * Get memberships with recurring payments enabled
   */
  static async getWithAutoPay(
    organizationId: string
  ): Promise<MembershipWithDetails[]> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("memberships")
      .select(
        `
        *,
        member:members(*),
        plan:plans(*),
        recentPayments:payments(*)
      `
      )
      .eq("organization_id", organizationId)
      .eq("auto_pay_enabled", true);

    if (error) throw error;
    return transformMembershipsWithDetails(data || []);
  }

  /**
   * Get memberships without recurring payments (and no pending invite)
   */
  static async getWithoutAutoPay(
    organizationId: string
  ): Promise<MembershipWithDetails[]> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("memberships")
      .select(
        `
        *,
        member:members(*),
        plan:plans(*),
        recentPayments:payments(*)
      `
      )
      .eq("organization_id", organizationId)
      .eq("auto_pay_enabled", false)
      .in("status", ["waiting_period", "active"]);

    if (error) throw error;
    return transformMembershipsWithDetails(data || []);
  }
}

// =============================================================================
// Transform Functions
// =============================================================================

function transformMembership(dbMembership: any): Membership {
  return {
    id: dbMembership.id,
    organizationId: dbMembership.organization_id,
    memberId: dbMembership.member_id,
    planId: dbMembership.plan_id,
    status: dbMembership.status,
    billingFrequency: dbMembership.billing_frequency,
    billingAnniversaryDay: dbMembership.billing_anniversary_day,
    paidMonths: dbMembership.paid_months,
    enrollmentFeePaid: dbMembership.enrollment_fee_paid,
    joinDate: dbMembership.join_date,
    lastPaymentDate: dbMembership.last_payment_date,
    nextPaymentDue: dbMembership.next_payment_due,
    eligibleDate: dbMembership.eligible_date,
    cancelledDate: dbMembership.cancelled_date,
    agreementSignedAt: dbMembership.agreement_signed_at,
    agreementId: dbMembership.agreement_id,
    autoPayEnabled: dbMembership.auto_pay_enabled,
    stripeSubscriptionId: dbMembership.stripe_subscription_id,
    stripeCustomerId: dbMembership.stripe_customer_id,
    subscriptionStatus: dbMembership.subscription_status,
    paymentMethod: dbMembership.payment_method,
    createdAt: dbMembership.created_at,
    updatedAt: dbMembership.updated_at,
  };
}

function transformMemberships(dbMemberships: any[]): Membership[] {
  return dbMemberships.map(transformMembership);
}

function transformMembershipWithDetails(
  dbMembership: any
): MembershipWithDetails {
  const member = Array.isArray(dbMembership.member)
    ? dbMembership.member[0]
    : dbMembership.member;
  const plan = Array.isArray(dbMembership.plan)
    ? dbMembership.plan[0]
    : dbMembership.plan;
  const payments = dbMembership.recentPayments || [];

  return {
    ...transformMembership(dbMembership),
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
    plan: plan
      ? {
          id: plan.id,
          organizationId: plan.organization_id,
          type: plan.type,
          name: plan.name,
          description: plan.description,
          pricing: plan.pricing,
          enrollmentFee: plan.enrollment_fee,
          isActive: plan.is_active,
          createdAt: plan.created_at,
          updatedAt: plan.updated_at,
        }
      : ({} as any),
    recentPayments: payments.slice(0, 5).map((p: any) => ({
      id: p.id,
      organizationId: p.organization_id,
      membershipId: p.membership_id,
      memberId: p.member_id,
      type: p.type,
      method: p.method,
      status: p.status,
      amount: p.amount,
      stripeFee: p.stripe_fee,
      platformFee: p.platform_fee,
      totalCharged: p.total_charged,
      netAmount: p.net_amount,
      monthsCredited: p.months_credited,
      invoiceNumber: p.invoice_number,
      dueDate: p.due_date,
      periodStart: p.period_start,
      periodEnd: p.period_end,
      periodLabel: p.period_label,
      stripePaymentIntentId: p.stripe_payment_intent_id,
      checkNumber: p.check_number,
      zelleTransactionId: p.zelle_transaction_id,
      notes: p.notes,
      recordedBy: p.recorded_by,
      reminderCount: p.reminder_count,
      reminderSentAt: p.reminder_sent_at,
      remindersPaused: p.reminders_paused,
      requiresReview: p.requires_review,
      createdAt: p.created_at,
      paidAt: p.paid_at,
      refundedAt: p.refunded_at,
    })),
  };
}

function transformMembershipsWithDetails(
  dbMemberships: any[]
): MembershipWithDetails[] {
  return dbMemberships.map(transformMembershipWithDetails);
}
