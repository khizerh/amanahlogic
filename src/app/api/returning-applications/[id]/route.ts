import { NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { ReturningApplicationsService } from "@/lib/database/returning-applications";

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

    // Fetch application
    const app = await ReturningApplicationsService.getById(id);
    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }
    if (app.organizationId !== organizationId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    if (app.status !== "pending") {
      return NextResponse.json(
        { error: "Application is not pending" },
        { status: 409 }
      );
    }

    const body = await request.json();
    const { enrollmentFeeStatus, paidMonths, adminNotes } = body as {
      enrollmentFeeStatus?: string;
      paidMonths?: number;
      adminNotes?: string;
    };

    // Must provide at least one field
    if (enrollmentFeeStatus === undefined && paidMonths === undefined && adminNotes === undefined) {
      return NextResponse.json(
        { error: "At least one field (enrollmentFeeStatus, paidMonths, or adminNotes) is required" },
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
    const updateInput: Parameters<typeof ReturningApplicationsService.update>[0] = { id };
    if (enrollmentFeeStatus !== undefined) {
      updateInput.enrollmentFeeStatus = enrollmentFeeStatus as "unpaid" | "paid" | "waived";
    }
    if (paidMonths !== undefined) {
      updateInput.paidMonths = paidMonths;
    }
    if (adminNotes !== undefined) {
      updateInput.adminNotes = adminNotes;
    }

    const updated = await ReturningApplicationsService.update(updateInput);

    return NextResponse.json({ success: true, application: updated });
  } catch (error) {
    console.error("Error updating returning application:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update application" },
      { status: 500 }
    );
  }
}
