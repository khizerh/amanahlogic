import { NextRequest, NextResponse } from "next/server";
import { MembersService } from "@/lib/database/members";
import { PlansService } from "@/lib/database/plans";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { normalizePhoneNumber } from "@/lib/utils";

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

/**
 * PUT /api/members/[id]
 * Update a member's contact and household information
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const organizationId = await getOrganizationId();
    const { id: memberId } = await params;

    // Verify member exists and belongs to this organization
    const existing = await MembersService.getByIdWithMembership(memberId, organizationId);
    if (!existing) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      email,
      phone,
      address,
      preferredLanguage,
      emergencyContact,
      spouseName,
      children,
    } = body;

    // Block clearing email when member has portal access
    if (!email && email !== undefined && existing.userId) {
      return NextResponse.json(
        { error: "Cannot remove email from a member with portal access. Revoke portal access first." },
        { status: 400 }
      );
    }

    // Normalize phone numbers to E.164 before storage
    const normalizedPhone = phone ? normalizePhoneNumber(phone) : undefined;
    const normalizedEmergencyContact = emergencyContact
      ? {
          ...emergencyContact,
          phone: emergencyContact.phone
            ? normalizePhoneNumber(emergencyContact.phone)
            : "",
        }
      : undefined;

    const updatedMember = await MembersService.update({
      id: memberId,
      ...(email !== undefined && { email: email || null }),
      ...(normalizedPhone !== undefined && { phone: normalizedPhone }),
      ...(address !== undefined && { address }),
      ...(preferredLanguage !== undefined && { preferredLanguage }),
      ...(normalizedEmergencyContact !== undefined && {
        emergencyContact: normalizedEmergencyContact,
      }),
      ...(spouseName !== undefined && { spouseName }),
      ...(children !== undefined && { children }),
    });

    return NextResponse.json({ success: true, member: updatedMember });
  } catch (error) {
    console.error("Error updating member:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update member" },
      { status: 500 }
    );
  }
}
