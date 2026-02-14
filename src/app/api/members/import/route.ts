import { NextResponse } from "next/server";
import { MembersService } from "@/lib/database/members";
import { MembershipsService } from "@/lib/database/memberships";
import { PlansService } from "@/lib/database/plans";
import { OrganizationsService } from "@/lib/database/organizations";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { getTodayInOrgTimezone } from "@/lib/billing/invoice-generator";
import { normalizePhoneNumber } from "@/lib/utils";
import type { PlanType, BillingFrequency, CommunicationLanguage } from "@/lib/types";

interface ImportChild {
  name: string;
  dateOfBirth: string;
}

interface ImportMember {
  firstName: string;
  middleName?: string;
  lastName: string;
  email?: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  spouseName?: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  preferredLanguage: CommunicationLanguage;
  planType: PlanType;
  billingFrequency: BillingFrequency;
  waiveEnrollmentFee: boolean;
  children: ImportChild[];
}

/**
 * POST /api/members/import
 * Bulk import members from CSV data
 */
export async function POST(request: Request) {
  try {
    const organizationId = await getOrganizationId();
    const body = await request.json();

    const { members } = body as { members: ImportMember[] };

    if (!members || !Array.isArray(members) || members.length === 0) {
      return NextResponse.json(
        { error: "No members provided for import" },
        { status: 400 }
      );
    }

    // Limit bulk import size
    if (members.length > 500) {
      return NextResponse.json(
        { error: "Cannot import more than 500 members at once" },
        { status: 400 }
      );
    }

    // Pre-fetch all plans to avoid repeated lookups
    const plans = await PlansService.getAll(organizationId);
    const planMap = new Map(plans.map(p => [p.type, p]));

    // Get organization timezone for billing anniversary day calculation
    const org = await OrganizationsService.getById(organizationId);
    const orgTimezone = org?.timezone || "America/Los_Angeles";
    const todayInOrgTz = getTodayInOrgTimezone(orgTimezone); // Returns "YYYY-MM-DD"
    const billingAnniversaryDay = parseInt(todayInOrgTz.split("-")[2], 10);

    // Get existing emails to check for duplicates
    const existingMembers = await MembersService.getAllWithMembership(organizationId);
    const existingEmails = new Set(existingMembers.filter(m => m.email).map(m => m.email!.toLowerCase()));

    const results = {
      imported: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each member
    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      const rowNum = i + 2; // +2 because row 1 is header, and we're 0-indexed

      try {
        // Validate email uniqueness (only when email provided)
        if (member.email && existingEmails.has(member.email.toLowerCase())) {
          results.failed++;
          results.errors.push(`Row ${rowNum}: Email ${member.email} already exists`);
          continue;
        }

        // Validate plan exists
        const plan = planMap.get(member.planType);
        if (!plan) {
          results.failed++;
          results.errors.push(`Row ${rowNum}: Invalid plan type "${member.planType}"`);
          continue;
        }

        // Transform children with generated IDs
        const childrenWithIds = (member.children || []).map((child, idx) => ({
          id: `imported-${Date.now()}-${idx}`,
          name: child.name,
          dateOfBirth: child.dateOfBirth,
        }));

        // Normalize phone numbers to E.164 before storage
        const normalizedPhone = member.phone ? normalizePhoneNumber(member.phone) : undefined;
        const normalizedEmergencyPhone = member.emergencyContactPhone ? normalizePhoneNumber(member.emergencyContactPhone) : "";

        // Create the member
        const createdMember = await MembersService.create({
          organizationId,
          firstName: member.firstName,
          middleName: member.middleName || null,
          lastName: member.lastName,
          email: member.email || null,
          phone: normalizedPhone || undefined,
          address: {
            street: member.street || "",
            city: member.city || "",
            state: member.state || "",
            zip: member.zip || "",
          },
          spouseName: member.spouseName || null,
          children: childrenWithIds,
          emergencyContact: {
            name: member.emergencyContactName || "",
            phone: normalizedEmergencyPhone,
          },
          preferredLanguage: member.preferredLanguage || "en",
        });

        // Create the membership with status "pending"
        await MembershipsService.create({
          organizationId,
          memberId: createdMember.id,
          planId: plan.id,
          status: "pending",
          billingFrequency: member.billingFrequency,
          billingAnniversaryDay,
          paidMonths: 0,
          enrollmentFeeStatus: member.waiveEnrollmentFee ? "waived" : "unpaid",
          // joinDate is set when BOTH agreement signed AND first payment completed
          joinDate: null,
        });

        // Add to existing emails set to prevent duplicates within same batch
        if (member.email) {
          existingEmails.add(member.email.toLowerCase());
        }
        results.imported++;
      } catch (error) {
        results.failed++;
        results.errors.push(
          `Row ${rowNum}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error importing members:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import members" },
      { status: 500 }
    );
  }
}
