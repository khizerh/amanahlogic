import "server-only";

import { createClientForContext } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BillingFrequency,
  Member,
  MemberWithMembership,
  MemberFilters,
  MembershipStatus,
  PaymentMethodDetails,
  PlanPricing,
  SubscriptionStatus,
} from "@/lib/types";

// =============================================================================
// Input Types
// =============================================================================

export interface CreateMemberInput {
  organizationId: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email?: string | null;
  phone?: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  spouseName?: string | null;
  children?: { id: string; name: string; dateOfBirth: string }[];
  emergencyContact: {
    name: string;
    phone: string;
  };
  preferredLanguage?: "en" | "fa";
}

export interface UpdateMemberInput extends Partial<CreateMemberInput> {
  id: string;
}

// =============================================================================
// MembersService
// =============================================================================

export class MembersService {
  /**
   * Get all members for an organization
   */
  static async getAll(organizationId: string): Promise<Member[]> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("members")
      .select("*")
      .eq("organization_id", organizationId)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    if (error) throw error;
    return transformMembers(data || []);
  }

  /**
   * Get members with their membership and plan details
   */
  static async getAllWithMembership(
    organizationId: string,
    filters?: MemberFilters
  ): Promise<MemberWithMembership[]> {
    const supabase = await createClientForContext();

    let query = supabase
      .from("members")
      .select(
        `
        *,
        membership:memberships!memberships_member_id_fkey(
          *,
          plan:plans(*)
        )
      `
      )
      .eq("organization_id", organizationId);

    // Apply search filter
    if (filters?.search) {
      const search = `%${filters.search}%`;
      query = query.or(
        `first_name.ilike.${search},middle_name.ilike.${search},last_name.ilike.${search},email.ilike.${search},phone.ilike.${search}`
      );
    }

    const { data, error } = await query.order("last_name", { ascending: true });

    if (error) throw error;

    let results = transformMembersWithMembership(data || []);

    // Apply post-query filters (these need the joined data)
    if (filters?.status && filters.status !== "all") {
      results = results.filter((m) => m.membership?.status === filters.status);
    }

    if (filters?.planType && filters.planType !== "all") {
      results = results.filter((m) => m.plan?.type === filters.planType);
    }

    if (filters?.eligibility && filters.eligibility !== "all") {
      const eligibilityMonths = filters.eligibilityMonths ?? 60;
      const approachingWindow = 10; // Window before eligibility (e.g., 50-59 for 60-month threshold)
      const approachingStart = eligibilityMonths - approachingWindow;

      switch (filters.eligibility) {
        case "eligible":
          results = results.filter(
            (m) => m.membership && m.membership.paidMonths >= eligibilityMonths
          );
          break;
        case "approaching":
          results = results.filter(
            (m) =>
              m.membership &&
              m.membership.paidMonths >= approachingStart &&
              m.membership.paidMonths < eligibilityMonths
          );
          break;
        case "waiting":
          results = results.filter(
            (m) => m.membership && m.membership.paidMonths < approachingStart
          );
          break;
      }
    }

    return results;
  }

  /**
   * Get a single member by ID
   */
  static async getById(memberId: string, client?: SupabaseClient): Promise<Member | null> {
    const supabase = client ?? (await createClientForContext());

    const { data, error } = await supabase
      .from("members")
      .select("*")
      .eq("id", memberId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return transformMember(data);
  }

  /**
   * Get a member by ID with membership details
   * @param memberId - The member ID
   * @param organizationId - Optional org ID to enforce org scoping (recommended for security)
   */
  static async getByIdWithMembership(
    memberId: string,
    organizationId?: string
  ): Promise<MemberWithMembership | null> {
    const supabase = await createClientForContext();

    let query = supabase
      .from("members")
      .select(
        `
        *,
        membership:memberships!memberships_member_id_fkey(
          *,
          plan:plans(*)
        )
      `
      )
      .eq("id", memberId);

    // Enforce org scoping if organizationId is provided
    if (organizationId) {
      query = query.eq("organization_id", organizationId);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return transformMemberWithMembership(data);
  }

  /**
   * Get member by email for an organization
   */
  static async getByEmail(
    organizationId: string,
    email: string,
    supabase?: SupabaseClient
  ): Promise<Member | null> {
    if (!email) return null;
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("members")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("email", email)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return transformMember(data);
  }

  /**
   * Create a new member
   */
  static async create(
    input: CreateMemberInput,
    supabase?: SupabaseClient
  ): Promise<Member> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("members")
      .insert({
        organization_id: input.organizationId,
        first_name: input.firstName,
        middle_name: input.middleName || null,
        last_name: input.lastName,
        email: input.email || null,
        phone: input.phone || null,
        address: input.address,
        spouse_name: input.spouseName || null,
        children: input.children || [],
        emergency_contact: input.emergencyContact,
        preferred_language: input.preferredLanguage || "en",
      })
      .select()
      .single();

    if (error) throw error;
    return transformMember(data);
  }

  /**
   * Update a member
   */
  static async update(
    input: UpdateMemberInput,
    supabase?: SupabaseClient
  ): Promise<Member> {
    const client = supabase ?? (await createClientForContext());
    const { id, ...updates } = input;

    const dbUpdates: Record<string, unknown> = {};
    if (updates.organizationId !== undefined)
      dbUpdates.organization_id = updates.organizationId;
    if (updates.firstName !== undefined)
      dbUpdates.first_name = updates.firstName;
    if (updates.middleName !== undefined)
      dbUpdates.middle_name = updates.middleName;
    if (updates.lastName !== undefined) dbUpdates.last_name = updates.lastName;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.address !== undefined) dbUpdates.address = updates.address;
    if (updates.spouseName !== undefined)
      dbUpdates.spouse_name = updates.spouseName;
    if (updates.children !== undefined) dbUpdates.children = updates.children;
    if (updates.emergencyContact !== undefined)
      dbUpdates.emergency_contact = updates.emergencyContact;
    if (updates.preferredLanguage !== undefined)
      dbUpdates.preferred_language = updates.preferredLanguage;

    const { data, error } = await client
      .from("members")
      .update(dbUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return transformMember(data);
  }

  /**
   * Delete a member
   */
  static async delete(memberId: string, supabase?: SupabaseClient): Promise<void> {
    const client = supabase ?? (await createClientForContext());

    const { error } = await client
      .from("members")
      .delete()
      .eq("id", memberId);

    if (error) throw error;
  }

  /**
   * Get members count by status for an organization
   */
  static async getCountsByStatus(
    organizationId: string
  ): Promise<Record<MembershipStatus | "total", number>> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("memberships")
      .select("status")
      .eq("organization_id", organizationId);

    if (error) throw error;

    const counts: Record<MembershipStatus | "total", number> = {
      pending: 0,
      current: 0,
      lapsed: 0,
      cancelled: 0,
      total: 0,
    };

    (data || []).forEach((m) => {
      counts[m.status as MembershipStatus]++;
      counts.total++;
    });

    return counts;
  }

  /**
   * Search members
   */
  static async search(
    organizationId: string,
    query: string,
    limit: number = 10
  ): Promise<Member[]> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("members")
      .select("*")
      .eq("organization_id", organizationId)
      .or(
        `first_name.ilike.%${query}%,middle_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`
      )
      .limit(limit);

    if (error) throw error;
    return transformMembers(data || []);
  }
}

// =============================================================================
// DB Row Interfaces (snake_case shapes returned by Supabase)
// =============================================================================

interface DbMemberRow {
  id: string;
  organization_id: string;
  first_name: string;
  middle_name: string | null;
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
  payer_member_id: string | null;
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

interface DbMemberWithMembershipRow extends DbMemberRow {
  membership: DbMembershipJoinRow | DbMembershipJoinRow[] | null;
}

// =============================================================================
// Transform Functions (snake_case DB → camelCase TypeScript)
// =============================================================================

function transformMember(dbMember: DbMemberRow): Member {
  return {
    id: dbMember.id,
    organizationId: dbMember.organization_id,
    firstName: dbMember.first_name,
    middleName: dbMember.middle_name,
    lastName: dbMember.last_name,
    email: dbMember.email,
    phone: dbMember.phone || "",
    address: dbMember.address,
    spouseName: dbMember.spouse_name,
    children: dbMember.children || [],
    emergencyContact: dbMember.emergency_contact,
    preferredLanguage: dbMember.preferred_language,
    userId: dbMember.user_id || null,
    createdAt: dbMember.created_at,
    updatedAt: dbMember.updated_at,
  };
}

function transformMembers(dbMembers: DbMemberRow[]): Member[] {
  return dbMembers.map(transformMember);
}

function transformMemberWithMembership(dbMember: DbMemberWithMembershipRow): MemberWithMembership {
  const membership = Array.isArray(dbMember.membership)
    ? dbMember.membership[0]
    : dbMember.membership;
  const plan = membership?.plan;
  const planData = Array.isArray(plan) ? plan[0] : plan;

  return {
    ...transformMember(dbMember),
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
          payerMemberId: membership.payer_member_id || null,
          createdAt: membership.created_at,
          updatedAt: membership.updated_at,
        }
      : null,
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
      : null,
  };
}

function transformMembersWithMembership(
  dbMembers: DbMemberWithMembershipRow[]
): MemberWithMembership[] {
  return dbMembers.map(transformMemberWithMembership);
}
