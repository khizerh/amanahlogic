import { NextRequest, NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { PlansService } from "@/lib/database/plans";

/**
 * POST /api/plans/toggle
 * Toggle a plan's active status
 */
export async function POST(req: NextRequest) {
  try {
    const organizationId = await getOrganizationId();
    const { id } = await req.json();

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

    // Toggle the active status
    const plan = await PlansService.update({
      id,
      isActive: !existingPlan.isActive,
    });

    return NextResponse.json({ success: true, plan });
  } catch (error) {
    console.error("Error toggling plan:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to toggle plan" },
      { status: 500 }
    );
  }
}
