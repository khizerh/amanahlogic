import "server-only";

import { createClient } from "@/lib/supabase/server";
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
  stripePaymentIntentId: string | null;
  notes: string | null;
  recordedBy: string | null;
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
      type: "single" | "married" | "widow";
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

// =============================================================================
// PaymentsService
// =============================================================================

export class PaymentsService {
  /**
   * Get all payments for an organization
   */
  static async getAll(organizationId: string): Promise<Payment[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("organizationId", organizationId)
      .order("createdAt", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get all payments with detailed member/membership info
   */
  static async getAllDetailed(organizationId: string): Promise<PaymentWithDetails[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("payments")
      .select(
        `
        *,
        member:members(id, firstName, lastName, email),
        membership:memberships(
          id,
          status,
          paidMonths,
          billingFrequency,
          plan:plans(id, name, type)
        )
      `
      )
      .eq("organizationId", organizationId)
      .order("createdAt", { ascending: false });

    if (error) {
      console.error("Error loading payments:", error);
      throw error;
    }

    return (data || []) as unknown as PaymentWithDetails[];
  }

  /**
   * Get a single payment by ID
   */
  static async getById(paymentId: string): Promise<Payment | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // Not found
      throw error;
    }

    return data;
  }

  /**
   * Get payment by Stripe payment intent ID
   */
  static async getByStripeId(
    stripePaymentIntentId: string,
    supabase?: SupabaseClient
  ): Promise<{ success: boolean; data: Payment | null }> {
    const client = supabase ?? (await createClient());

    const { data, error } = await client
      .from("payments")
      .select("*")
      .eq("stripePaymentIntentId", stripePaymentIntentId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return { success: true, data: null };
      }
      throw error;
    }

    return { success: true, data };
  }

  /**
   * Get payments by membership
   */
  static async getByMembership(
    membershipId: string,
    organizationId: string
  ): Promise<Payment[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("membershipId", membershipId)
      .eq("organizationId", organizationId)
      .order("createdAt", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get payments by member (across all memberships)
   */
  static async getByMember(
    memberId: string,
    organizationId: string
  ): Promise<Payment[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("memberId", memberId)
      .eq("organizationId", organizationId)
      .order("createdAt", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get payments by member with membership details
   */
  static async getByMemberDetailed(
    memberId: string,
    organizationId: string
  ): Promise<PaymentWithDetails[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("payments")
      .select(
        `
        *,
        member:members(id, firstName, lastName, email),
        membership:memberships(
          id,
          status,
          paidMonths,
          billingFrequency,
          plan:plans(id, name, type)
        )
      `
      )
      .eq("memberId", memberId)
      .eq("organizationId", organizationId)
      .order("createdAt", { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as PaymentWithDetails[];
  }

  /**
   * Get payments by status
   */
  static async getByStatus(
    organizationId: string,
    status: PaymentStatus
  ): Promise<Payment[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("organizationId", organizationId)
      .eq("status", status)
      .order("createdAt", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Create a new payment record
   */
  static async create(
    input: CreatePaymentInput,
    supabase?: SupabaseClient
  ): Promise<Payment> {
    const client = supabase ?? (await createClient());

    const { data, error } = await client
      .from("payments")
      .insert({
        organizationId: input.organizationId,
        membershipId: input.membershipId,
        memberId: input.memberId,
        type: input.type,
        method: input.method,
        status: input.status || "pending",
        amount: input.amount,
        stripeFee: input.stripeFee || 0,
        platformFee: input.platformFee || 0,
        totalCharged: input.totalCharged,
        netAmount: input.netAmount,
        monthsCredited: input.monthsCredited,
        stripePaymentIntentId: input.stripePaymentIntentId || null,
        stripeChargeId: input.stripeChargeId || null,
        stripeInvoiceId: input.stripeInvoiceId || null,
        notes: input.notes || null,
        recordedBy: input.recordedBy || null,
        paidAt: input.paidAt || null,
        createdAt: input.createdAt || new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data as Payment;
  }

  /**
   * Update a payment
   */
  static async update(input: UpdatePaymentInput): Promise<Payment> {
    const supabase = await createClient();
    const { id, ...updates } = input;

    const { data, error } = await supabase
      .from("payments")
      .update({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as Payment;
  }

  /**
   * Mark payment as succeeded
   */
  static async markSucceeded(
    paymentId: string,
    paidAt?: string
  ): Promise<Payment> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("payments")
      .update({
        status: "completed",
        paidAt: paidAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .eq("id", paymentId)
      .select()
      .single();

    if (error) throw error;
    return data as Payment;
  }

  /**
   * Mark payment as failed
   */
  static async markFailed(paymentId: string): Promise<Payment> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("payments")
      .update({
        status: "failed",
        updatedAt: new Date().toISOString(),
      })
      .eq("id", paymentId)
      .select()
      .single();

    if (error) throw error;
    return data as Payment;
  }

  /**
   * Refund a payment
   */
  static async refund(paymentId: string): Promise<Payment> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("payments")
      .update({
        status: "refunded",
        refundedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .eq("id", paymentId)
      .select()
      .single();

    if (error) throw error;
    return data as Payment;
  }

  /**
   * Get overdue payments (for dashboard and reminders)
   * Returns payments that are past due based on organization timezone
   */
  static async getOverdue(
    organizationId: string,
    gracePeriodDays: number = 7
  ): Promise<OverduePaymentInfo[]> {
    const supabase = await createClient();

    // Calculate threshold date (today minus grace period)
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - gracePeriodDays);
    const threshold = thresholdDate.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("memberships")
      .select(
        `
        id,
        memberId,
        status,
        paidMonths,
        nextPaymentDue,
        member:members(id, firstName, lastName, email),
        plan:plans(id, name)
      `
      )
      .eq("organizationId", organizationId)
      .in("status", ["waiting_period", "active", "lapsed"])
      .not("nextPaymentDue", "is", null)
      .lt("nextPaymentDue", threshold);

    if (error) throw error;

    // Transform to overdue payment info
    return (data || []).map((membership: any) => {
      const dueDate = new Date(membership.nextPaymentDue);
      const now = new Date();
      const daysPastDue = Math.floor(
        (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        id: `overdue_${membership.id}`,
        membershipId: membership.id,
        memberId: membership.memberId,
        status: "pending" as PaymentStatus,
        amount: 0, // Would calculate from plan pricing
        dueDate: membership.nextPaymentDue,
        daysPastDue,
        member: membership.member
          ? {
              firstName: membership.member.firstName,
              lastName: membership.member.lastName,
              email: membership.member.email,
            }
          : null,
        membership: {
          status: membership.status,
          paidMonths: membership.paidMonths,
          plan: membership.plan ? { name: membership.plan.name } : null,
        },
      };
    });
  }

  /**
   * Get payment statistics for an organization
   */
  static async getStats(
    organizationId: string,
    dateRange?: { start: string; end: string }
  ): Promise<PaymentStats> {
    const supabase = await createClient();

    let query = supabase
      .from("payments")
      .select("amount, netAmount, stripeFee, platformFee, status, monthsCredited")
      .eq("organizationId", organizationId);

    if (dateRange) {
      query = query
        .gte("createdAt", dateRange.start)
        .lte("createdAt", dateRange.end);
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
        stats.totalNet += payment.netAmount;
        stats.totalFees += (payment.stripeFee || 0) + (payment.platformFee || 0);
        stats.succeededCount++;
      } else if (payment.status === "pending") {
        stats.pendingCount++;
      } else if (payment.status === "failed") {
        stats.failedCount++;
      } else if (payment.status === "refunded") {
        stats.refundedCount++;
      }
    });

    // Calculate MRR and ARR (would need active memberships data)
    // This is a simplified version - in production, query memberships table
    stats.monthlyRecurringRevenue = 0; // TODO: Calculate from active memberships
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
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("payments")
      .select(
        `
        *,
        member:members(id, firstName, lastName, email),
        membership:memberships(
          id,
          status,
          paidMonths,
          billingFrequency,
          plan:plans(id, name, type)
        )
      `
      )
      .eq("organizationId", organizationId)
      .order("createdAt", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as unknown as PaymentWithDetails[];
  }

  /**
   * Get payment count for a membership
   */
  static async getCountByMembership(
    membershipId: string,
    organizationId: string
  ): Promise<number> {
    const supabase = await createClient();

    const { count, error } = await supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("membershipId", membershipId)
      .eq("organizationId", organizationId)
      .eq("status", "completed");

    if (error) throw error;
    return count || 0;
  }

  /**
   * Delete a payment (admin only, for corrections)
   */
  static async delete(paymentId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from("payments")
      .delete()
      .eq("id", paymentId);

    if (error) throw error;
  }
}
