import "server-only";

import { createClientForContext } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ReturningApplication,
  ReturningApplicationWithPlan,
  ReturningApplicationStatus,
  BillingFrequency,
  CommunicationLanguage,
  Address,
  Child,
  EmergencyContact,
  Plan,
  PlanPricing,
} from "@/lib/types";

// =============================================================================
// Input Types
// =============================================================================

export interface CreateReturningApplicationInput {
  organizationId: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email: string;
  phone: string;
  address: Address;
  spouseName?: string | null;
  children?: Child[];
  emergencyContact: EmergencyContact;
  preferredLanguage?: CommunicationLanguage;
  planId: string;
  billingFrequency?: BillingFrequency;
  paidMonths?: number;
  enrollmentFeeStatus?: "unpaid" | "paid" | "waived";
}

export interface UpdateReturningApplicationInput {
  id: string;
  paidMonths?: number;
  enrollmentFeeStatus?: "unpaid" | "paid" | "waived";
  adminNotes?: string | null;
}

// =============================================================================
// ReturningApplicationsService
// =============================================================================

export class ReturningApplicationsService {
  /**
   * Get all returning applications for an organization, optionally filtered by status.
   * Joins with plans table. Defaults to pending.
   */
  static async getAll(
    organizationId: string,
    status?: ReturningApplicationStatus
  ): Promise<ReturningApplicationWithPlan[]> {
    const supabase = await createClientForContext();

    let query = supabase
      .from("returning_applications")
      .select("*, plan:plans(*)")
      .eq("organization_id", organizationId);

    if (status) {
      query = query.eq("status", status);
    }

    query = query.order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) throw error;
    return (data || []).map(transformApplicationWithPlan);
  }

  /**
   * Get a single returning application by ID.
   */
  static async getById(
    id: string,
    client?: SupabaseClient
  ): Promise<ReturningApplication | null> {
    const supabase = client ?? (await createClientForContext());

    const { data, error } = await supabase
      .from("returning_applications")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return transformApplication(data);
  }

  /**
   * Get a single returning application by ID with plan details.
   */
  static async getByIdWithPlan(
    id: string,
    client?: SupabaseClient
  ): Promise<ReturningApplicationWithPlan | null> {
    const supabase = client ?? (await createClientForContext());

    const { data, error } = await supabase
      .from("returning_applications")
      .select("*, plan:plans(*)")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return transformApplicationWithPlan(data);
  }

  /**
   * Get pending application by email in an organization (for duplicate checking).
   */
  static async getByEmail(
    organizationId: string,
    email: string,
    client?: SupabaseClient
  ): Promise<ReturningApplication | null> {
    if (!email) return null;
    const supabase = client ?? (await createClientForContext());

    const { data, error } = await supabase
      .from("returning_applications")
      .select("*")
      .eq("organization_id", organizationId)
      .ilike("email", email.trim())
      .eq("status", "pending")
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return transformApplication(data);
  }

  /**
   * Create a new returning application.
   * Catches unique constraint violation from partial unique index and returns friendly error.
   */
  static async create(
    input: CreateReturningApplicationInput,
    client?: SupabaseClient
  ): Promise<ReturningApplication> {
    const supabase = client ?? (await createClientForContext());

    const { data, error } = await supabase
      .from("returning_applications")
      .insert({
        organization_id: input.organizationId,
        first_name: input.firstName,
        middle_name: input.middleName || null,
        last_name: input.lastName,
        email: input.email,
        phone: input.phone,
        address: input.address,
        spouse_name: input.spouseName || null,
        children: input.children || [],
        emergency_contact: input.emergencyContact,
        preferred_language: input.preferredLanguage || "en",
        plan_id: input.planId,
        billing_frequency: input.billingFrequency || "monthly",
        paid_months: input.paidMonths || 0,
        enrollment_fee_status: input.enrollmentFeeStatus || "unpaid",
      })
      .select()
      .single();

    if (error) {
      // Catch unique constraint violation (duplicate pending email)
      if (error.code === "23505") {
        throw new Error(
          "A pending application with this email already exists. Please wait for it to be reviewed."
        );
      }
      throw error;
    }

    return transformApplication(data);
  }

  /**
   * Update admin-adjustable fields on a returning application.
   */
  static async update(
    input: UpdateReturningApplicationInput,
    client?: SupabaseClient
  ): Promise<ReturningApplication> {
    const supabase = client ?? (await createClientForContext());
    const { id, ...updates } = input;

    const dbUpdates: Record<string, unknown> = {};
    if (updates.paidMonths !== undefined) dbUpdates.paid_months = updates.paidMonths;
    if (updates.enrollmentFeeStatus !== undefined)
      dbUpdates.enrollment_fee_status = updates.enrollmentFeeStatus;
    if (updates.adminNotes !== undefined) dbUpdates.admin_notes = updates.adminNotes;

    const { data, error } = await supabase
      .from("returning_applications")
      .update(dbUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return transformApplication(data);
  }

  /**
   * Mark an application as approved. Sets status, reviewer info, and links to created records.
   * Uses WHERE status='pending' for race safety. Returns null if 0 rows affected (already actioned).
   */
  static async approve(
    id: string,
    reviewedBy: string,
    memberId: string,
    membershipId: string,
    client?: SupabaseClient
  ): Promise<ReturningApplication | null> {
    const supabase = client ?? (await createClientForContext());

    const { data, error } = await supabase
      .from("returning_applications")
      .update({
        status: "approved",
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        member_id: memberId,
        membership_id: membershipId,
      })
      .eq("id", id)
      .eq("status", "pending")
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return null; // Row not found or already actioned
    return transformApplication(data);
  }

  /**
   * Mark an application as rejected. Uses WHERE status='pending' for race safety.
   * Returns null if already actioned.
   */
  static async reject(
    id: string,
    reviewedBy: string,
    adminNotes?: string | null,
    client?: SupabaseClient
  ): Promise<ReturningApplication | null> {
    const supabase = client ?? (await createClientForContext());

    const updateData: Record<string, unknown> = {
      status: "rejected",
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    };
    if (adminNotes !== undefined) updateData.admin_notes = adminNotes;

    const { data, error } = await supabase
      .from("returning_applications")
      .update(updateData)
      .eq("id", id)
      .eq("status", "pending")
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return transformApplication(data);
  }
}

// =============================================================================
// DB Row Interfaces (snake_case shapes returned by Supabase)
// =============================================================================

interface DbReturningApplicationRow {
  id: string;
  organization_id: string;
  status: ReturningApplicationStatus;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string;
  phone: string;
  address: Address;
  spouse_name: string | null;
  children: Child[] | null;
  emergency_contact: EmergencyContact;
  preferred_language: CommunicationLanguage;
  plan_id: string;
  billing_frequency: BillingFrequency;
  paid_months: number;
  enrollment_fee_status: "unpaid" | "paid" | "waived";
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  member_id: string | null;
  membership_id: string | null;
  created_at: string;
  updated_at: string;
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

interface DbReturningApplicationWithPlanRow extends DbReturningApplicationRow {
  plan: DbPlanJoinRow | DbPlanJoinRow[];
}

// =============================================================================
// Transform Functions (snake_case DB -> camelCase TypeScript)
// =============================================================================

function transformApplication(row: DbReturningApplicationRow): ReturningApplication {
  return {
    id: row.id,
    organizationId: row.organization_id,
    status: row.status,
    firstName: row.first_name,
    middleName: row.middle_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    spouseName: row.spouse_name,
    children: row.children || [],
    emergencyContact: row.emergency_contact,
    preferredLanguage: row.preferred_language,
    planId: row.plan_id,
    billingFrequency: row.billing_frequency,
    paidMonths: row.paid_months,
    enrollmentFeeStatus: row.enrollment_fee_status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    adminNotes: row.admin_notes,
    memberId: row.member_id,
    membershipId: row.membership_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function transformApplicationWithPlan(
  row: DbReturningApplicationWithPlanRow
): ReturningApplicationWithPlan {
  const planData = Array.isArray(row.plan) ? row.plan[0] : row.plan;

  return {
    ...transformApplication(row),
    plan: {
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
    },
  };
}
