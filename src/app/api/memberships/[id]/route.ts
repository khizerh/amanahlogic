import { NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { MembershipsService } from "@/lib/database/memberships";

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
    const { enrollmentFeeStatus, paidMonths } = body as {
      enrollmentFeeStatus?: string;
      paidMonths?: number;
    };

    // Must provide at least one field
    if (enrollmentFeeStatus === undefined && paidMonths === undefined) {
      return NextResponse.json(
        { error: "At least one field (enrollmentFeeStatus or paidMonths) is required" },
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

    // Build update
    const updateInput: Parameters<typeof MembershipsService.update>[0] = { id };
    if (enrollmentFeeStatus !== undefined) {
      updateInput.enrollmentFeeStatus = enrollmentFeeStatus as "unpaid" | "paid" | "waived";
    }
    if (paidMonths !== undefined) {
      updateInput.paidMonths = paidMonths;
    }

    const updated = await MembershipsService.update(updateInput);

    return NextResponse.json({ success: true, membership: updated });
  } catch (error) {
    console.error("Error updating membership:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update membership" },
      { status: 500 }
    );
  }
}
