import { NextResponse } from "next/server";
import { MembersService } from "@/lib/database/members";
import { getOrganizationId } from "@/lib/auth/get-organization-id";

/**
 * GET /api/members
 * Fetch all members for an organization (for dropdowns/selectors)
 */
export async function GET() {
  try {
    const organizationId = await getOrganizationId();

    // Get all members with their memberships
    const members = await MembersService.getAllWithMembership(organizationId);

    return NextResponse.json({ members });
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch members" },
      { status: 500 }
    );
  }
}
