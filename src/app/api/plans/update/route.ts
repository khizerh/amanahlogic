import { NextRequest, NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { PlansService } from "@/lib/database/plans";
import type { PlanPricing } from "@/lib/types";

/**
 * POST /api/plans/update
 * Update an existing membership plan
 * Type is auto-generated from name (lowercase, spaces to hyphens)
 */
export async function POST(req: NextRequest) {
  try {
    const organizationId = await getOrganizationId();
    const body = await req.json();

    const { id, name, description, pricing, enrollmentFee } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Verify the plan belongs to this organization
    const existingPlan = await PlansService.getById(id);
    if (!existingPlan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    if (existingPlan.organizationId !== organizationId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Build update object with only provided fields
    const updates: {
      id: string;
      name?: string;
      type?: string;
      description?: string;
      pricing?: PlanPricing;
      enrollmentFee?: number;
    } = { id };

    if (name !== undefined) {
      const planName = name.trim();
      updates.name = planName;
      // Auto-generate type from name: lowercase, spaces to hyphens
      updates.type = planName.toLowerCase().replace(/\s+/g, "-");
    }

    if (description !== undefined) {
      updates.description = description?.trim() || "";
    }

    if (pricing !== undefined) {
      updates.pricing = {
        monthly: Number(pricing.monthly) || 0,
        biannual: Number(pricing.biannual) || 0,
        annual: Number(pricing.annual) || 0,
      };
    }

    if (enrollmentFee !== undefined) {
      updates.enrollmentFee = Number(enrollmentFee) || 0;
    }

    const plan = await PlansService.update(updates);

    return NextResponse.json({ success: true, plan });
  } catch (error) {
    console.error("Error updating plan:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update plan" },
      { status: 500 }
    );
  }
}
