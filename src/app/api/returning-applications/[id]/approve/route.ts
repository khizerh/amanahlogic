import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { ReturningApplicationsService } from "@/lib/database/returning-applications";
import { MembersService } from "@/lib/database/members";
import { MembershipsService } from "@/lib/database/memberships";
import { PlansService } from "@/lib/database/plans";
import { OrganizationsService } from "@/lib/database/organizations";
import { getTodayInOrgTimezone } from "@/lib/billing/invoice-generator";
import { orchestrateOnboarding } from "@/lib/onboarding/orchestrate-onboarding";
import { DEFAULT_BILLING_CONFIG } from "@/lib/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    // Auth
    let organizationId: string;
    try {
      organizationId = await getOrganizationId();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("not authenticated") || message.includes("Authentication error")) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }
      if (message.includes("not linked to an organization")) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
    }

    // Get reviewer user ID
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const reviewedBy = user?.id;
    if (!reviewedBy) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    // Fetch application with plan
    const app = await ReturningApplicationsService.getByIdWithPlan(id);
    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }
    if (app.organizationId !== organizationId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    if (app.status !== "pending") {
      return NextResponse.json(
        { error: "Application has already been processed" },
        { status: 409 }
      );
    }

    // Guard against email already existing in members table (manual add race)
    const existingMember = await MembersService.getByEmail(organizationId, app.email);
    if (existingMember) {
      return NextResponse.json(
        { error: "A member with this email already exists" },
        { status: 409 }
      );
    }

    // Fetch plan (for onboarding)
    const plan = await PlansService.getById(app.planId);
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Compute eligibleDate
    const org = await OrganizationsService.getById(organizationId);
    const orgTimezone = org?.timezone || "America/Los_Angeles";
    const todayInOrgTz = getTodayInOrgTimezone(orgTimezone);
    const isAlreadyEligible = app.paidMonths >= DEFAULT_BILLING_CONFIG.eligibilityMonths;

    // Create member
    const member = await MembersService.create({
      organizationId,
      firstName: app.firstName,
      middleName: app.middleName,
      lastName: app.lastName,
      email: app.email,
      phone: app.phone,
      address: app.address,
      spouseName: app.spouseName,
      children: app.children,
      emergencyContact: app.emergencyContact,
      preferredLanguage: app.preferredLanguage,
    });

    // Create membership with admin-adjusted values
    let membership;
    try {
      membership = await MembershipsService.create({
        organizationId,
        memberId: member.id,
        planId: plan.id,
        status: "pending",
        billingFrequency: app.billingFrequency,
        paidMonths: app.paidMonths,
        enrollmentFeeStatus: app.enrollmentFeeStatus,
        joinDate: null,
        eligibleDate: isAlreadyEligible ? todayInOrgTz : null,
      });
    } catch (membershipError) {
      // Roll back member
      try {
        await MembersService.delete(member.id);
      } catch {
        // Best effort cleanup
      }
      throw membershipError;
    }

    // Mark approved (race-safe: WHERE status='pending')
    const approvedApp = await ReturningApplicationsService.approve(
      id,
      reviewedBy,
      member.id,
      membership.id
    );

    if (!approvedApp) {
      // Lost the race — another admin already approved/rejected. Roll back.
      try {
        await MembershipsService.delete(membership.id);
        await MembersService.delete(member.id);
      } catch {
        // Best effort cleanup
      }
      return NextResponse.json(
        { error: "Application was already processed by another admin" },
        { status: 409 }
      );
    }

    // Orchestrate onboarding (best-effort — failures don't roll back)
    let onboarding = null;
    try {
      onboarding = await orchestrateOnboarding({
        organizationId,
        member,
        membership,
        plan,
        paymentMethod: "stripe",
        includeEnrollmentFee: app.enrollmentFeeStatus === "unpaid",
      });
    } catch (err) {
      console.error("Onboarding orchestration failed for returning member:", err);
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
    console.error("Error approving returning application:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to approve application" },
      { status: 500 }
    );
  }
}
