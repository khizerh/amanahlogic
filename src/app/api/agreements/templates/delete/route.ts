import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getOrganizationId } from "@/lib/auth/get-organization-id";

/**
 * POST /api/agreements/templates/delete
 * Delete an agreement template (both DB record and storage file)
 */
export async function POST(req: NextRequest) {
  try {
    const organizationId = await getOrganizationId();
    const { templateId } = await req.json();

    if (!templateId) {
      return NextResponse.json({ error: "templateId is required" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // Get the template to verify ownership and get storage path
    const { data: template, error: fetchError } = await supabase
      .from("agreement_templates")
      .select("id, storage_path, organization_id, is_active")
      .eq("id", templateId)
      .single();

    if (fetchError || !template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Verify ownership
    if (template.organization_id !== organizationId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Delete from storage (if it exists)
    const bucket = process.env.AGREEMENT_TEMPLATES_BUCKET || "agreement-templates";
    if (template.storage_path && !template.storage_path.startsWith("http")) {
      const { error: storageError } = await supabase.storage
        .from(bucket)
        .remove([template.storage_path]);

      if (storageError) {
        console.warn("Failed to delete file from storage:", storageError);
        // Continue anyway - we still want to delete the DB record
      }
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from("agreement_templates")
      .delete()
      .eq("id", templateId);

    if (deleteError) {
      return NextResponse.json({ error: `Failed to delete: ${deleteError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete template" },
      { status: 500 }
    );
  }
}
