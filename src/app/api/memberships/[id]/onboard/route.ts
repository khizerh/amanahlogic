import { NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { MembershipsService } from "@/lib/database/memberships";
import { MembersService } from "@/lib/database/members";
import { PlansService } from "@/lib/database/plans";
import { OnboardingInvitesService } from "@/lib/database/onboarding-invites";
import { orchestrateOnboarding } from "@/lib/onboarding/orchestrate-onboarding";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
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

    const { id } = await params;

    // Fetch membership
    const membership = await MembershipsService.getById(id);
    if (!membership) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }
    if (membership.organizationId !== organizationId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Idempotency guardrails
    if (membership.status !== "pending") {
      return NextResponse.json(
        { error: "Membership is not pending" },
        { status: 409 }
      );
    }

    if (membership.stripeCustomerId) {
      return NextResponse.json(
        { error: "Onboarding already started" },
        { status: 409 }
      );
    }

    const existingInvite = await OnboardingInvitesService.getActiveForMembership(id);
    if (existingInvite) {
      return NextResponse.json(
        { error: "Onboarding already in progress" },
        { status: 409 }
      );
    }

    // Fetch member and plan
    const member = await MembersService.getById(membership.memberId);
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const plan = await PlansService.getById(membership.planId);
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Orchestrate onboarding
    const result = await orchestrateOnboarding({
      organizationId,
      member,
      membership,
      plan,
      paymentMethod: "stripe",
      includeEnrollmentFee: membership.enrollmentFeeStatus === "unpaid",
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error triggering onboarding:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to trigger onboarding" },
      { status: 500 }
    );
  }
}
