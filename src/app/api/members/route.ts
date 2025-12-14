import { NextResponse } from "next/server";
import { MembersService } from "@/lib/database/members";
import { MembershipsService } from "@/lib/database/memberships";
import { PlansService } from "@/lib/database/plans";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import type { PlanType, BillingFrequency, CommunicationLanguage } from "@/lib/types";

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

/**
 * POST /api/members
 * Create a new member with their membership
 */
export async function POST(request: Request) {
  try {
    const organizationId = await getOrganizationId();
    const body = await request.json();

    const {
      firstName,
      lastName,
      email,
      phone,
      street,
      city,
      state,
      zip,
      spouseName,
      emergencyName,
      emergencyPhone,
      planType,
      billingFrequency,
      preferredLanguage,
      children,
    } = body as {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      street: string;
      city: string;
      state: string;
      zip: string;
      spouseName?: string;
      emergencyName: string;
      emergencyPhone: string;
      planType: PlanType;
      billingFrequency: BillingFrequency;
      preferredLanguage: CommunicationLanguage;
      children?: { id: string; name: string; dateOfBirth: string }[];
    };

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: "First name, last name, and email are required" },
        { status: 400 }
      );
    }

    // Check if member with this email already exists
    const existingMember = await MembersService.getByEmail(organizationId, email);
    if (existingMember) {
      return NextResponse.json(
        { error: "A member with this email already exists" },
        { status: 400 }
      );
    }

    // Look up the plan by type
    const plan = await PlansService.getByType(organizationId, planType);
    if (!plan) {
      return NextResponse.json(
        { error: `No active plan found for type: ${planType}` },
        { status: 400 }
      );
    }

    // Create the member
    const member = await MembersService.create({
      organizationId,
      firstName,
      lastName,
      email,
      phone: phone || undefined,
      address: {
        street: street || "",
        city: city || "",
        state: state || "",
        zip: zip || "",
      },
      spouseName: spouseName || null,
      children: children || [],
      emergencyContact: {
        name: emergencyName || "",
        phone: emergencyPhone || "",
      },
      preferredLanguage: preferredLanguage || "en",
    });

    // Create the membership with status "pending"
    // Use today's date as billing anniversary day
    const today = new Date();
    const billingAnniversaryDay = today.getDate();

    const membership = await MembershipsService.create({
      organizationId,
      memberId: member.id,
      planId: plan.id,
      status: "pending",
      billingFrequency: billingFrequency || "monthly",
      billingAnniversaryDay,
      paidMonths: 0,
      enrollmentFeePaid: false,
      joinDate: today.toISOString().split("T")[0],
    });

    return NextResponse.json({
      success: true,
      member,
      membership,
    });
  } catch (error) {
    console.error("Error creating member:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create member" },
      { status: 500 }
    );
  }
}
