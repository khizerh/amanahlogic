import { NextResponse } from "next/server";
import { PlansService } from "@/lib/database/plans";
import { getOrganizationId } from "@/lib/auth/get-organization-id";

/**
 * GET /api/plans
 * Fetch all active plans for the organization
 */
export async function GET() {
  try {
    const organizationId = await getOrganizationId();
    const plans = await PlansService.getActive(organizationId);

    return NextResponse.json({ plans });
  } catch (error) {
    console.error("Error fetching plans:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch plans" },
      { status: 500 }
    );
  }
}
