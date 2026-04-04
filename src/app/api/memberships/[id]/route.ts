import { NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { MembershipsService } from "@/lib/database/memberships";
import { PlansService } from "@/lib/database/plans";
import { OrganizationsService } from "@/lib/database/organizations";
import { updateSubscriptionPricing, getPlatformFee } from "@/lib/stripe";
import type { BillingFrequency, PlatformFees } from "@/lib/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_ENROLLMENT_FEE_STATUSES = ["unpaid", "paid", "waived"] as const;
const MAX_PAID_MONTHS = 720; // 60 years

export async function PUT(request: Request, { params }: RouteParams) {
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

    const body = await request.json();
    const { enrollmentFeeStatus, paidMonths, planId } = body as {
      enrollmentFeeStatus?: string;
      paidMonths?: number;
      planId?: string;
    };

    // Must provide at least one field
    if (enrollmentFeeStatus === undefined && paidMonths === undefined && planId === undefined) {
      return NextResponse.json(
        { error: "At least one field (enrollmentFeeStatus, paidMonths, or planId) is required" },
        { status: 400 }
      );
    }

    // Validate enrollmentFeeStatus
    if (enrollmentFeeStatus !== undefined) {
      if (!VALID_ENROLLMENT_FEE_STATUSES.includes(enrollmentFeeStatus as typeof VALID_ENROLLMENT_FEE_STATUSES[number])) {
        return NextResponse.json(
          { error: `enrollmentFeeStatus must be one of: ${VALID_ENROLLMENT_FEE_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
    }

    // Validate paidMonths
    if (paidMonths !== undefined) {
      if (!Number.isInteger(paidMonths) || paidMonths < 0 || paidMonths > MAX_PAID_MONTHS) {
        return NextResponse.json(
          { error: `paidMonths must be an integer between 0 and ${MAX_PAID_MONTHS}` },
          { status: 400 }
        );
      }
    }

    // Validate planId if provided
    let newPlan: Awaited<ReturnType<typeof PlansService.getById>> | null = null;
    if (planId !== undefined) {
      newPlan = await PlansService.getById(planId);
      if (!newPlan || newPlan.organizationId !== organizationId) {
        return NextResponse.json({ error: "Plan not found" }, { status: 404 });
      }
    }

    // Build update
    const updateInput: Parameters<typeof MembershipsService.update>[0] = { id };
    if (enrollmentFeeStatus !== undefined) {
      updateInput.enrollmentFeeStatus = enrollmentFeeStatus as "unpaid" | "paid" | "waived";
    }
    if (paidMonths !== undefined) {
      updateInput.paidMonths = paidMonths;
    }
    if (planId !== undefined) {
      updateInput.planId = planId;
    }

    const updated = await MembershipsService.update(updateInput);

    // Sync Stripe subscription if plan changed and subscription exists
    let stripeUpdated = false;
    if (planId !== undefined && newPlan && membership.stripeSubscriptionId && (membership.subscriptionStatus === "active" || membership.subscriptionStatus === "trialing")) {
      try {
        const org = await OrganizationsService.getById(organizationId);
        if (org) {
          const billingFrequency = (membership.billingFrequency || "monthly") as BillingFrequency;
          const newDuesAmountCents = Math.round((newPlan.pricing[billingFrequency] || 0) * 100);
          const platformFeeDollars = getPlatformFee(org.platformFees as PlatformFees | null, billingFrequency);

          await updateSubscriptionPricing({
            subscriptionId: membership.stripeSubscriptionId,
            newDuesAmountCents,
            newBillingFrequency: billingFrequency,
            passFeesToMember: org.passFeesToMember || false,
            platformFeeDollars,
            planName: newPlan.name,
            stripeConnectAccountId: org.stripeConnectId || undefined,
          });
          stripeUpdated = true;
        }
      } catch (error) {
        console.error("Failed to update Stripe subscription for plan change:", error);
      }
    }

    return NextResponse.json({ success: true, membership: updated, stripeUpdated });
  } catch (error) {
    console.error("Error updating membership:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update membership" },
      { status: 500 }
    );
  }
}
