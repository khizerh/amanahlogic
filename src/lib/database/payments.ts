import "server-only";

import { createClientForContext } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Payment,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  MembershipStatus,
} from "@/lib/types";

/**
 * Payment Database Service for Burial Benefits Membership System
 *
 * Adapted from imarah payments service for membership dues tracking.
 * Currently uses mock data pattern, but interfaces are database-ready.
 */

// =============================================================================
// Input Types
// =============================================================================

export interface CreatePaymentInput {
  organizationId: string;
  membershipId: string;
  memberId: string;
  type: PaymentType;
  method: PaymentMethod;
  status?: PaymentStatus;

  // Amounts (all in dollars, not cents)
  amount: number;
  stripeFee?: number;
  platformFee?: number;
  totalCharged: number;
  netAmount: number;

  // Credits
  monthsCredited: number;

  // Stripe integration
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  stripeInvoiceId?: string;

  // Manual payment tracking
  notes?: string;
  recordedBy?: string;
  paidAt?: string;

  // Dates
  createdAt?: string;
}

export interface UpdatePaymentInput extends Partial<CreatePaymentInput> {
  id: string;
}

// =============================================================================
// Response Types
// =============================================================================

/**
 * Payment with nested member and membership data
 */
export interface PaymentWithDetails {
  id: string;
  organizationId: string;
  membershipId: string;
  memberId: string;
  type: PaymentType;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  stripeFee: number;
  platformFee: number;
  totalCharged: number;
  netAmount: number;
  monthsCredited: number;

  // Invoice metadata
  invoiceNumber?: string | null;
  dueDate?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  periodLabel?: string | null;

  // Stripe
  stripePaymentIntentId: string | null;

  // Manual payment info
  checkNumber: string | null;
  zelleTransactionId: string | null;
  notes: string | null;
  recordedBy: string | null;

  // Reminder tracking
  reminderCount?: number;
  reminderSentAt?: string | null;
  remindersPaused?: boolean;
  requiresReview?: boolean;

  // Dates
  createdAt: string;
  paidAt: string | null;
  refundedAt: string | null;

  // Nested data
  member: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  membership: {
    id: string;
    status: MembershipStatus;
    paidMonths: number;
    billingFrequency: "monthly" | "biannual" | "annual";
    plan: {
      id: string;
      name: string;
      type: string;
    } | null;
  } | null;
}

/**
 * Payment statistics for dashboard
 */
export interface PaymentStats {
  totalCollected: number;
  totalNet: number;
  totalFees: number;
  succeededCount: number;
  pendingCount: number;
  failedCount: number;
  refundedCount: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
}

/**
 * Overdue payment info for reminders
 */
export interface OverduePaymentInfo {
  id: string;
  membershipId: string;
  memberId: string;
  status: PaymentStatus;
  amount: number;
  dueDate: string | null;
  daysPastDue: number;
  member: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  membership: {
    status: MembershipStatus;
    paidMonths: number;
    plan: {
      name: string;
    } | null;
  } | null;
}

/**
 * Outstanding payment info (combines overdue + failed Stripe payments)
 */
export interface OutstandingPaymentInfo {
  id: string;
  memberId: string;
  membershipId: string;
  memberName: string;
  memberEmail: string;
  planName: string;
  amountDue: number;
  dueDate: string;
  daysOverdue: number;
  type: "overdue" | "failed";
  reminderCount: number;
  remindersPaused: boolean;
  failureReason?: string;
  lastAttempt?: string;
  autoPayEnabled: boolean;
}

// =============================================================================
// PaymentsService
// =============================================================================

export class PaymentsService {
  /**
   * Get all payments for an organization
   */
  static async getAll(organizationId: string): Promise<Payment[]> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return transformPayments(data || []);
  }

  /**
   * Get all payments with detailed member/membership info
   */
  static async getAllDetailed(organizationId: string): Promise<PaymentWithDetails[]> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("payments")
      .select(
        `
        *,
        member:members(id, first_name, last_name, email),
        membership:memberships(
          id,
          status,
          paid_months,
          billing_frequency,
          plan:plans(id, name, type)
        )
      `
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return transformPaymentsWithDetails(data || []);
  }

  /**
   * Get a single payment by ID
   */
  static async getById(paymentId: string): Promise<Payment | null> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // Not found
      throw error;
    }

    return transformPayment(data);
  }

  /**
   * Get payment by Stripe payment intent ID
   */
  static async getByStripeId(
    stripePaymentIntentId: string,
    supabase?: SupabaseClient
  ): Promise<{ success: boolean; data: Payment | null }> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("payments")
      .select("*")
      .eq("stripe_payment_intent_id", stripePaymentIntentId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return { success: true, data: null };
      }
      throw error;
    }

    return { success: true, data: transformPayment(data) };
  }

  /**
   * Get payments by membership
   */
  static async getByMembership(
    membershipId: string,
    organizationId: string
  ): Promise<Payment[]> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("membership_id", membershipId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return transformPayments(data || []);
  }

  /**
   * Get payments by member (across all memberships)
   */
  static async getByMember(
    memberId: string,
    organizationId?: string
  ): Promise<Payment[]> {
    const supabase = await createClientForContext();

    let query = supabase
      .from("payments")
      .select("*")
      .eq("member_id", memberId);

    if (organizationId) {
      query = query.eq("organization_id", organizationId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;
    return transformPayments(data || []);
  }

  /**
   * Get payments by member with membership details
   */
  static async getByMemberDetailed(
    memberId: string,
    organizationId: string
  ): Promise<PaymentWithDetails[]> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("payments")
      .select(
        `
        *,
        member:members(id, first_name, last_name, email),
        membership:memberships(
          id,
          status,
          paid_months,
          billing_frequency,
          plan:plans(id, name, type)
        )
      `
      )
      .eq("member_id", memberId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return transformPaymentsWithDetails(data || []);
  }

  /**
   * Get payments by status
   */
  static async getByStatus(
    organizationId: string,
    status: PaymentStatus
  ): Promise<Payment[]> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return transformPayments(data || []);
  }

  /**
   * Create a new payment record
   */
  static async create(
    input: CreatePaymentInput,
    supabase?: SupabaseClient
  ): Promise<Payment> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("payments")
      .insert({
        organization_id: input.organizationId,
        membership_id: input.membershipId,
        member_id: input.memberId,
        type: input.type,
        method: input.method,
        status: input.status || "pending",
        amount: input.amount,
        stripe_fee: input.stripeFee || 0,
        platform_fee: input.platformFee || 0,
        total_charged: input.totalCharged,
        net_amount: input.netAmount,
        months_credited: input.monthsCredited,
        stripe_payment_intent_id: input.stripePaymentIntentId || null,
        stripe_charge_id: input.stripeChargeId || null,
        stripe_invoice_id: input.stripeInvoiceId || null,
        notes: input.notes || null,
        recorded_by: input.recordedBy || null,
        paid_at: input.paidAt || null,
        created_at: input.createdAt || new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return transformPayment(data);
  }

  /**
   * Update a payment
   */
  static async update(input: UpdatePaymentInput): Promise<Payment> {
    const supabase = await createClientForContext();
    const { id, ...updates } = input;

    // Transform camelCase input to snake_case for DB
    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.organizationId !== undefined) dbUpdates.organization_id = updates.organizationId;
    if (updates.membershipId !== undefined) dbUpdates.membership_id = updates.membershipId;
    if (updates.memberId !== undefined) dbUpdates.member_id = updates.memberId;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.method !== undefined) dbUpdates.method = updates.method;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
    if (updates.stripeFee !== undefined) dbUpdates.stripe_fee = updates.stripeFee;
    if (updates.platformFee !== undefined) dbUpdates.platform_fee = updates.platformFee;
    if (updates.totalCharged !== undefined) dbUpdates.total_charged = updates.totalCharged;
    if (updates.netAmount !== undefined) dbUpdates.net_amount = updates.netAmount;
    if (updates.monthsCredited !== undefined) dbUpdates.months_credited = updates.monthsCredited;
    if (updates.stripePaymentIntentId !== undefined) dbUpdates.stripe_payment_intent_id = updates.stripePaymentIntentId;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.recordedBy !== undefined) dbUpdates.recorded_by = updates.recordedBy;
    if (updates.paidAt !== undefined) dbUpdates.paid_at = updates.paidAt;

    const { data, error } = await supabase
      .from("payments")
      .update(dbUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return transformPayment(data);
  }

  /**
   * Mark payment as succeeded
   */
  static async markSucceeded(
    paymentId: string,
    paidAt?: string
  ): Promise<Payment> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("payments")
      .update({
        status: "completed",
        paid_at: paidAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId)
      .select()
      .single();

    if (error) throw error;
    return transformPayment(data);
  }

  /**
   * Mark payment as failed
   */
  static async markFailed(paymentId: string): Promise<Payment> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("payments")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId)
      .select()
      .single();

    if (error) throw error;
    return transformPayment(data);
  }

  /**
   * Refund a payment
   */
  static async refund(paymentId: string): Promise<Payment> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("payments")
      .update({
        status: "refunded",
        refunded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId)
      .select()
      .single();

    if (error) throw error;
    return transformPayment(data);
  }

  /**
   * Get overdue payments (for dashboard and reminders)
   * Returns payments that are past due based on organization timezone
   */
  static async getOverdue(
    organizationId: string,
    gracePeriodDays: number = 7
  ): Promise<OverduePaymentInfo[]> {
    const supabase = await createClientForContext();

    // Calculate threshold date (today minus grace period)
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - gracePeriodDays);
    const threshold = thresholdDate.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("memberships")
      .select(
        `
        id,
        member_id,
        status,
        paid_months,
        billing_frequency,
        next_payment_due,
        member:members(id, first_name, last_name, email),
        plan:plans(id, name, pricing)
      `
      )
      .eq("organization_id", organizationId)
      .in("status", ["waiting_period", "active", "lapsed"])
      .not("next_payment_due", "is", null)
      .lt("next_payment_due", threshold);

    if (error) throw error;

    // Transform to overdue payment info
    return (data || []).map((membership: DbOverdueMembershipRow) => {
      const dueDate = new Date(membership.next_payment_due);
      const now = new Date();
      const daysPastDue = Math.floor(
        (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const member = Array.isArray(membership.member) ? membership.member[0] : membership.member;
      const plan = Array.isArray(membership.plan) ? membership.plan[0] : membership.plan;

      // Calculate amount based on billing frequency and plan pricing
      let amount = 0;
      if (plan?.pricing) {
        const pricing = plan.pricing;
        switch (membership.billing_frequency) {
          case "monthly":
            amount = pricing.monthly || 0;
            break;
          case "biannual":
            amount = pricing.biannual || 0;
            break;
          case "annual":
            amount = pricing.annual || 0;
            break;
          default:
            amount = pricing.monthly || 0;
        }
      }

      return {
        id: `overdue_${membership.id}`,
        membershipId: membership.id,
        memberId: membership.member_id,
        status: "pending" as PaymentStatus,
        amount,
        dueDate: membership.next_payment_due,
        daysPastDue,
        member: member
          ? {
              firstName: member.first_name,
              lastName: member.last_name,
              email: member.email,
            }
          : null,
        membership: {
          status: membership.status,
          paidMonths: membership.paid_months,
          plan: plan ? { name: plan.name } : null,
        },
      };
    });
  }

  /**
   * Get all outstanding payments (overdue + failed Stripe charges)
   * This is used for the Outstanding tab DataTable
   */
  static async getOutstanding(
    organizationId: string,
    gracePeriodDays: number = 7
  ): Promise<OutstandingPaymentInfo[]> {
    const supabase = await createClientForContext();
    const results: OutstandingPaymentInfo[] = [];
    const now = new Date();

    // Calculate threshold date (today minus grace period)
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - gracePeriodDays);
    const threshold = thresholdDate.toISOString().split("T")[0];

    // 1. Get overdue memberships (past due date)
    const { data: overdueMemberships, error: overdueError } = await supabase
      .from("memberships")
      .select(
        `
        id,
        member_id,
        status,
        paid_months,
        billing_frequency,
        next_payment_due,
        auto_pay_enabled,
        member:members(id, first_name, last_name, email),
        plan:plans(id, name, pricing)
      `
      )
      .eq("organization_id", organizationId)
      .in("status", ["waiting_period", "active", "lapsed"])
      .not("next_payment_due", "is", null)
      .lt("next_payment_due", threshold);

    if (overdueError) throw overdueError;

    // Transform overdue memberships
    for (const membership of overdueMemberships || []) {
      const dueDate = new Date(membership.next_payment_due);
      const daysPastDue = Math.floor(
        (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const member = Array.isArray(membership.member) ? membership.member[0] : membership.member;
      const plan = Array.isArray(membership.plan) ? membership.plan[0] : membership.plan;

      // Calculate amount based on billing frequency and plan pricing
      let amount = 0;
      if (plan?.pricing) {
        const pricing = plan.pricing as { monthly?: number; biannual?: number; annual?: number };
        switch (membership.billing_frequency) {
          case "monthly":
            amount = pricing.monthly || 0;
            break;
          case "biannual":
            amount = pricing.biannual || 0;
            break;
          case "annual":
            amount = pricing.annual || 0;
            break;
          default:
            amount = pricing.monthly || 0;
        }
      }

      if (member) {
        results.push({
          id: `overdue_${membership.id}`,
          memberId: membership.member_id,
          membershipId: membership.id,
          memberName: `${member.first_name} ${member.last_name}`,
          memberEmail: member.email,
          planName: plan?.name || "Unknown Plan",
          amountDue: amount,
          dueDate: membership.next_payment_due,
          daysOverdue: daysPastDue,
          type: "overdue",
          reminderCount: 0,
          remindersPaused: false,
          autoPayEnabled: membership.auto_pay_enabled || false,
        });
      }
    }

    // 2. Get failed Stripe payments
    const { data: failedPayments, error: failedError } = await supabase
      .from("payments")
      .select(
        `
        id,
        member_id,
        membership_id,
        amount,
        created_at,
        due_date,
        reminder_count,
        reminders_paused,
        notes,
        member:members(id, first_name, last_name, email),
        membership:memberships(
          id,
          plan:plans(id, name)
        )
      `
      )
      .eq("organization_id", organizationId)
      .eq("status", "failed")
      .not("stripe_payment_intent_id", "is", null); // Only Stripe failures

    if (failedError) throw failedError;

    // Transform failed payments
    for (const payment of failedPayments || []) {
      const member = Array.isArray(payment.member) ? payment.member[0] : payment.member;
      const membership = Array.isArray(payment.membership) ? payment.membership[0] : payment.membership;
      const plan = membership?.plan;
      const planData = Array.isArray(plan) ? plan[0] : plan;

      const failedDate = new Date(payment.due_date || payment.created_at);
      const daysSinceFailed = Math.floor(
        (now.getTime() - failedDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (member) {
        results.push({
          id: payment.id,
          memberId: payment.member_id,
          membershipId: payment.membership_id,
          memberName: `${member.first_name} ${member.last_name}`,
          memberEmail: member.email,
          planName: planData?.name || "Unknown Plan",
          amountDue: payment.amount,
          dueDate: payment.due_date || payment.created_at,
          daysOverdue: daysSinceFailed,
          type: "failed",
          reminderCount: payment.reminder_count || 0,
          remindersPaused: payment.reminders_paused || false,
          failureReason: payment.notes || undefined,
          lastAttempt: payment.created_at,
          autoPayEnabled: true, // Failed Stripe charges = recurring payments were enabled
        });
      }
    }

    // Sort by days overdue (most overdue first)
    results.sort((a, b) => b.daysOverdue - a.daysOverdue);

    return results;
  }

  /**
   * Get payment statistics for an organization
   */
  static async getStats(
    organizationId: string,
    dateRange?: { start: string; end: string }
  ): Promise<PaymentStats> {
    const supabase = await createClientForContext();

    let query = supabase
      .from("payments")
      .select("amount, net_amount, stripe_fee, platform_fee, status, months_credited")
      .eq("organization_id", organizationId);

    if (dateRange) {
      query = query
        .gte("created_at", dateRange.start)
        .lte("created_at", dateRange.end);
    }

    const { data: payments, error } = await query;

    if (error) throw error;

    const stats: PaymentStats = {
      totalCollected: 0,
      totalNet: 0,
      totalFees: 0,
      succeededCount: 0,
      pendingCount: 0,
      failedCount: 0,
      refundedCount: 0,
      monthlyRecurringRevenue: 0,
      annualRecurringRevenue: 0,
    };

    payments?.forEach((payment) => {
      if (payment.status === "completed") {
        stats.totalCollected += payment.amount;
        stats.totalNet += payment.net_amount;
        stats.totalFees += (payment.stripe_fee || 0) + (payment.platform_fee || 0);
        stats.succeededCount++;
      } else if (payment.status === "pending") {
        stats.pendingCount++;
      } else if (payment.status === "failed") {
        stats.failedCount++;
      } else if (payment.status === "refunded") {
        stats.refundedCount++;
      }
    });

    stats.monthlyRecurringRevenue = 0;
    stats.annualRecurringRevenue = stats.monthlyRecurringRevenue * 12;

    return stats;
  }

  /**
   * Get recent payments (for activity feeds)
   */
  static async getRecent(
    organizationId: string,
    limit: number = 10
  ): Promise<PaymentWithDetails[]> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("payments")
      .select(
        `
        *,
        member:members(id, first_name, last_name, email),
        membership:memberships(
          id,
          status,
          paid_months,
          billing_frequency,
          plan:plans(id, name, type)
        )
      `
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return transformPaymentsWithDetails(data || []);
  }

  /**
   * Get payment count for a membership
   */
  static async getCountByMembership(
    membershipId: string,
    organizationId: string
  ): Promise<number> {
    const supabase = await createClientForContext();

    const { count, error } = await supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("membership_id", membershipId)
      .eq("organization_id", organizationId)
      .eq("status", "completed");

    if (error) throw error;
    return count || 0;
  }

  /**
   * Delete a payment (admin only, for corrections)
   */
  static async delete(paymentId: string): Promise<void> {
    const supabase = await createClientForContext();

    const { error } = await supabase
      .from("payments")
      .delete()
      .eq("id", paymentId);

    if (error) throw error;
  }
}

// =============================================================================
// DB Row Interfaces (snake_case shapes returned by Supabase)
// =============================================================================

interface DbPaymentRow {
  id: string;
  organization_id: string;
  membership_id: string;
  member_id: string;
  type: PaymentType;
  method: PaymentMethod;
  status: PaymentStatus;
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

interface DbPaymentMemberJoinRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface DbPaymentPlanJoinRow {
  id: string;
  name: string;
  type: string;
}

interface DbPaymentMembershipJoinRow {
  id: string;
  status: MembershipStatus;
  paid_months: number;
  billing_frequency: "monthly" | "biannual" | "annual";
  plan: DbPaymentPlanJoinRow | DbPaymentPlanJoinRow[] | null;
}

interface DbPaymentWithDetailsRow extends DbPaymentRow {
  member: DbPaymentMemberJoinRow | DbPaymentMemberJoinRow[] | null;
  membership: DbPaymentMembershipJoinRow | DbPaymentMembershipJoinRow[] | null;
}

interface DbOverdueMemberJoinRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface DbOverduePlanJoinRow {
  id: string;
  name: string;
  pricing: { monthly?: number; biannual?: number; annual?: number };
}

interface DbOverdueMembershipRow {
  id: string;
  member_id: string;
  status: MembershipStatus;
  paid_months: number;
  billing_frequency: string;
  next_payment_due: string;
  member: DbOverdueMemberJoinRow | DbOverdueMemberJoinRow[] | null;
  plan: DbOverduePlanJoinRow | DbOverduePlanJoinRow[] | null;
}

// =============================================================================
// Transform Functions (snake_case DB → camelCase TypeScript)
// =============================================================================

/**
 * Transform a single payment from DB format to TypeScript format
 */
function transformPayment(dbPayment: DbPaymentRow): Payment {
  return {
    id: dbPayment.id,
    organizationId: dbPayment.organization_id,
    membershipId: dbPayment.membership_id,
    memberId: dbPayment.member_id,
    type: dbPayment.type,
    method: dbPayment.method,
    status: dbPayment.status,
    amount: dbPayment.amount,
    stripeFee: dbPayment.stripe_fee,
    platformFee: dbPayment.platform_fee,
    totalCharged: dbPayment.total_charged,
    netAmount: dbPayment.net_amount,
    monthsCredited: dbPayment.months_credited,
    // Invoice metadata
    invoiceNumber: dbPayment.invoice_number,
    dueDate: dbPayment.due_date,
    periodStart: dbPayment.period_start,
    periodEnd: dbPayment.period_end,
    periodLabel: dbPayment.period_label,
    // Stripe
    stripePaymentIntentId: dbPayment.stripe_payment_intent_id,
    // Manual payment info
    checkNumber: dbPayment.check_number,
    zelleTransactionId: dbPayment.zelle_transaction_id,
    notes: dbPayment.notes,
    recordedBy: dbPayment.recorded_by,
    // Reminder tracking
    reminderCount: dbPayment.reminder_count,
    reminderSentAt: dbPayment.reminder_sent_at,
    remindersPaused: dbPayment.reminders_paused,
    requiresReview: dbPayment.requires_review,
    // Dates
    createdAt: dbPayment.created_at,
    paidAt: dbPayment.paid_at,
    refundedAt: dbPayment.refunded_at,
  };
}

/**
 * Transform multiple payments from DB format to TypeScript format
 */
function transformPayments(dbPayments: DbPaymentRow[]): Payment[] {
  return dbPayments.map(transformPayment);
}

/**
 * Transform a payment with details from DB format to TypeScript format
 */
function transformPaymentsWithDetails(dbPayments: DbPaymentWithDetailsRow[]): PaymentWithDetails[] {
  return dbPayments.map((dbPayment) => {
    const member = Array.isArray(dbPayment.member) ? dbPayment.member[0] : dbPayment.member;
    const membership = Array.isArray(dbPayment.membership) ? dbPayment.membership[0] : dbPayment.membership;
    const plan = membership?.plan;
    const planData = Array.isArray(plan) ? plan[0] : plan;

    return {
      id: dbPayment.id,
      organizationId: dbPayment.organization_id,
      membershipId: dbPayment.membership_id,
      memberId: dbPayment.member_id,
      type: dbPayment.type,
      method: dbPayment.method,
      status: dbPayment.status,
      amount: dbPayment.amount,
      stripeFee: dbPayment.stripe_fee,
      platformFee: dbPayment.platform_fee,
      totalCharged: dbPayment.total_charged,
      netAmount: dbPayment.net_amount,
      monthsCredited: dbPayment.months_credited,
      // Invoice metadata
      invoiceNumber: dbPayment.invoice_number,
      dueDate: dbPayment.due_date,
      periodStart: dbPayment.period_start,
      periodEnd: dbPayment.period_end,
      periodLabel: dbPayment.period_label,
      // Stripe
      stripePaymentIntentId: dbPayment.stripe_payment_intent_id,
      // Manual payment info
      checkNumber: dbPayment.check_number,
      zelleTransactionId: dbPayment.zelle_transaction_id,
      notes: dbPayment.notes,
      recordedBy: dbPayment.recorded_by,
      // Reminder tracking
      reminderCount: dbPayment.reminder_count,
      reminderSentAt: dbPayment.reminder_sent_at,
      remindersPaused: dbPayment.reminders_paused,
      requiresReview: dbPayment.requires_review,
      // Dates
      createdAt: dbPayment.created_at,
      paidAt: dbPayment.paid_at,
      refundedAt: dbPayment.refunded_at,
      member: member
        ? {
            id: member.id,
            firstName: member.first_name,
            lastName: member.last_name,
            email: member.email,
          }
        : null,
      membership: membership
        ? {
            id: membership.id,
            status: membership.status,
            paidMonths: membership.paid_months,
            billingFrequency: membership.billing_frequency,
            plan: planData
              ? {
                  id: planData.id,
                  name: planData.name,
                  type: planData.type,
                }
              : null,
          }
        : null,
    };
  });
}
