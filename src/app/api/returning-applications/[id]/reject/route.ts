import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { ReturningApplicationsService } from "@/lib/database/returning-applications";

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

    // Get reviewer user ID
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const reviewedBy = user?.id;
    if (!reviewedBy) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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
        { error: "Application has already been processed" },
        { status: 409 }
      );
    }

    // Parse optional admin notes
    let adminNotes: string | undefined;
    try {
      const body = await request.json();
      adminNotes = body.adminNotes;
    } catch {
      // No body or invalid JSON — that's fine, adminNotes is optional
    }

    const rejected = await ReturningApplicationsService.reject(
      id,
      reviewedBy,
      adminNotes
    );

    if (!rejected) {
      return NextResponse.json(
        { error: "Application was already processed by another admin" },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, application: rejected });
  } catch (error) {
    console.error("Error rejecting returning application:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reject application" },
      { status: 500 }
    );
  }
}
