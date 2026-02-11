import { NextResponse } from "next/server";
import { MembersService } from "@/lib/database/members";
import { MembershipsService } from "@/lib/database/memberships";
import { PlansService } from "@/lib/database/plans";
import { OrganizationsService } from "@/lib/database/organizations";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { getTodayInOrgTimezone } from "@/lib/billing/invoice-generator";
import { normalizePhoneNumber } from "@/lib/utils";
import { orchestrateOnboarding } from "@/lib/onboarding/orchestrate-onboarding";
import type { PlanType, BillingFrequency, CommunicationLanguage } from "@/lib/types";
import { DEFAULT_BILLING_CONFIG } from "@/lib/types";

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
      waiveEnrollmentFee,
      paymentMethod,
      paidMonths: rawPaidMonths,
    } = body as {
      firstName: string;
      lastName: string;
      email?: string;
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
      waiveEnrollmentFee?: boolean;
      paymentMethod?: "stripe" | "manual";
      paidMonths?: number;
    };

    // Sanitize paidMonths: must be a non-negative integer
    const paidMonths = Math.max(0, Math.floor(Number(rawPaidMonths) || 0));

    // Validate required fields
    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "First name and last name are required" },
        { status: 400 }
      );
    }

    // Check if member with this email already exists (only when email provided)
    if (email) {
      const existingMember = await MembersService.getByEmail(organizationId, email);
      if (existingMember) {
        return NextResponse.json(
          { error: "A member with this email already exists" },
          { status: 400 }
        );
      }
    }

    // Look up the plan by type
    const plan = await PlansService.getByType(organizationId, planType);
    if (!plan) {
      return NextResponse.json(
        { error: `No active plan found for type: ${planType}` },
        { status: 400 }
      );
    }

    // Normalize phone numbers to E.164 before storage
    const normalizedPhone = phone ? normalizePhoneNumber(phone) : undefined;
    const normalizedEmergencyPhone = emergencyPhone ? normalizePhoneNumber(emergencyPhone) : "";

    // Create the member
    const member = await MembersService.create({
      organizationId,
      firstName,
      lastName,
      email: email || null,
      phone: normalizedPhone || undefined,
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
        phone: normalizedEmergencyPhone,
      },
      preferredLanguage: preferredLanguage || "en",
    });

    // Create the membership with status "pending"
    // Billing anniversary day is set when the first payment settles (not at creation)
    // so it reflects when the member actually starts paying, not when admin clicks create.
    const org = await OrganizationsService.getById(organizationId);
    const orgTimezone = org?.timezone || "America/Los_Angeles";
    const todayInOrgTz = getTodayInOrgTimezone(orgTimezone); // Returns "YYYY-MM-DD"

    // If member already has enough paid months, mark eligible immediately
    const isAlreadyEligible = paidMonths >= DEFAULT_BILLING_CONFIG.eligibilityMonths;

    let membership;
    try {
      membership = await MembershipsService.create({
        organizationId,
        memberId: member.id,
        planId: plan.id,
        status: "pending",
        billingFrequency: billingFrequency || "monthly",
        paidMonths,
        enrollmentFeeStatus: waiveEnrollmentFee ? "waived" : "unpaid",
        // joinDate is set when BOTH agreement signed AND first payment completed
        joinDate: null,
        eligibleDate: isAlreadyEligible ? todayInOrgTz : null,
      });
    } catch (membershipError) {
      // Roll back: delete the orphaned member record
      try {
        await MembersService.delete(member.id);
      } catch {
        // Best effort cleanup
      }
      throw membershipError;
    }

    // Orchestrate onboarding (best-effort — failures don't roll back member creation)
    let onboarding = null;
    try {
      onboarding = await orchestrateOnboarding({
        organizationId,
        member,
        membership,
        plan,
        paymentMethod: paymentMethod || "manual",
        includeEnrollmentFee: !waiveEnrollmentFee,
      });
    } catch (err) {
      console.error("Onboarding orchestration failed:", err);
      onboarding = {
        welcomeEmailSent: false,
        agreementEmailSent: false,
        inviteCreated: false,
        onboardingInviteCreated: false,
        stripeSessionCreated: false,
        agreementCreated: false,
        errors: [err instanceof Error ? err.message : "Onboarding orchestration failed"],
        skipped: [],
      };
    }

    return NextResponse.json({
      success: true,
      member,
      membership,
      onboarding,
    });
  } catch (error) {
    console.error("Error creating member:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create member" },
      { status: 500 }
    );
  }
}
