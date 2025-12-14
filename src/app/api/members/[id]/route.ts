import { NextRequest, NextResponse } from "next/server";
import { MembersService } from "@/lib/database/members";
import { PlansService } from "@/lib/database/plans";
import { getOrganizationId } from "@/lib/auth/get-organization-id";

/**
 * GET /api/members/[id]
 * Fetch a single member with their membership and plan data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const organizationId = await getOrganizationId();
    const { id: memberId } = await params;

    // Get member with membership
    const member = await MembersService.getByIdWithMembership(memberId, organizationId);

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Get plan if member has a membership
    let plan = null;
    if (member.membership?.planId) {
      plan = await PlansService.getById(member.membership.planId);
    }

    return NextResponse.json({
      member,
      plan,
    });
  } catch (error) {
    console.error("Error fetching member:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch member" },
      { status: 500 }
    );
  }
}
