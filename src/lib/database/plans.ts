import "server-only";

import { createClientForContext } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Plan, PlanType, PlanPricing } from "@/lib/types";

// =============================================================================
// Input Types
// =============================================================================

export interface CreatePlanInput {
  organizationId: string;
  type: PlanType;
  name: string;
  description?: string;
  pricing: PlanPricing;
  enrollmentFee: number;
  isActive?: boolean;
}

export interface UpdatePlanInput extends Partial<CreatePlanInput> {
  id: string;
}

// =============================================================================
// PlansService
// =============================================================================

export class PlansService {
  /**
   * Get all plans for an organization
   */
  static async getAll(organizationId: string): Promise<Plan[]> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .eq("organization_id", organizationId)
      .order("type", { ascending: true });

    if (error) throw error;
    return transformPlans(data || []);
  }

  /**
   * Get active plans only
   */
  static async getActive(organizationId: string): Promise<Plan[]> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("type", { ascending: true });

    if (error) throw error;
    return transformPlans(data || []);
  }

  /**
   * Get a single plan by ID
   */
  static async getById(planId: string, client?: SupabaseClient): Promise<Plan | null> {
    const supabase = client ?? (await createClientForContext());

    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return transformPlan(data);
  }

  /**
   * Get plan by type for an organization
   */
  static async getByType(
    organizationId: string,
    type: PlanType
  ): Promise<Plan | null> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("type", type)
      .eq("is_active", true)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return transformPlan(data);
  }

  /**
   * Create a new plan
   */
  static async create(
    input: CreatePlanInput,
    supabase?: SupabaseClient
  ): Promise<Plan> {
    const client = supabase ?? (await createClientForContext());

    const { data, error } = await client
      .from("plans")
      .insert({
        organization_id: input.organizationId,
        type: input.type,
        name: input.name,
        description: input.description || null,
        pricing: input.pricing,
        enrollment_fee: input.enrollmentFee,
        is_active: input.isActive ?? true,
      })
      .select()
      .single();

    if (error) throw error;
    return transformPlan(data);
  }

  /**
   * Update a plan
   */
  static async update(
    input: UpdatePlanInput,
    supabase?: SupabaseClient
  ): Promise<Plan> {
    const client = supabase ?? (await createClientForContext());
    const { id, ...updates } = input;

    const dbUpdates: Record<string, unknown> = {};
    if (updates.organizationId !== undefined)
      dbUpdates.organization_id = updates.organizationId;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined)
      dbUpdates.description = updates.description;
    if (updates.pricing !== undefined) dbUpdates.pricing = updates.pricing;
    if (updates.enrollmentFee !== undefined)
      dbUpdates.enrollment_fee = updates.enrollmentFee;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

    const { data, error } = await client
      .from("plans")
      .update(dbUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return transformPlan(data);
  }

  /**
   * Deactivate a plan (soft delete)
   */
  static async deactivate(planId: string): Promise<Plan> {
    const supabase = await createClientForContext();

    const { data, error } = await supabase
      .from("plans")
      .update({ is_active: false })
      .eq("id", planId)
      .select()
      .single();

    if (error) throw error;
    return transformPlan(data);
  }

  /**
   * Delete a plan (hard delete - use with caution)
   */
  static async delete(planId: string): Promise<void> {
    const supabase = await createClientForContext();

    const { error } = await supabase.from("plans").delete().eq("id", planId);

    if (error) throw error;
  }
}

// =============================================================================
// Transform Functions
// =============================================================================

interface DbPlanRow {
  id: string;
  organization_id: string;
  type: string;
  name: string;
  description: string | null;
  pricing: PlanPricing;
  enrollment_fee: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function transformPlan(dbPlan: DbPlanRow): Plan {
  return {
    id: dbPlan.id,
    organizationId: dbPlan.organization_id,
    type: dbPlan.type,
    name: dbPlan.name,
    description: dbPlan.description || "",
    pricing: dbPlan.pricing,
    enrollmentFee: dbPlan.enrollment_fee,
    isActive: dbPlan.is_active,
    createdAt: dbPlan.created_at,
    updatedAt: dbPlan.updated_at,
  };
}

function transformPlans(dbPlans: DbPlanRow[]): Plan[] {
  return dbPlans.map(transformPlan);
}
