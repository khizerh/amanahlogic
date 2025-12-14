import { NextRequest, NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { PlansService } from "@/lib/database/plans";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/plans/delete
 * Delete a membership plan (only if no active memberships use it)
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

    // Check if any memberships are using this plan
    const supabase = await createClient();
    const { count, error: countError } = await supabase
      .from("memberships")
      .select("*", { count: "exact", head: true })
      .eq("plan_id", id);

    if (countError) {
      throw countError;
    }

    if (count && count > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete plan: ${count} membership(s) are using it. Deactivate the plan instead.`
        },
        { status: 400 }
      );
    }

    await PlansService.delete(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting plan:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete plan" },
      { status: 500 }
    );
  }
}
