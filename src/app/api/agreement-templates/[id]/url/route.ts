import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getOrganizationId } from "@/lib/auth/get-organization-id";

/**
 * GET /api/agreement-templates/[id]/url
 * Returns a signed URL for viewing an agreement template PDF
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const organizationId = await getOrganizationId();
    const { id: templateId } = await params;
    const supabase = await createClient();

    // Get the template to verify ownership and get storage path
    const { data: template, error: fetchError } = await supabase
      .from("agreement_templates")
      .select("storage_path, organization_id, version")
      .eq("id", templateId)
      .single();

    if (fetchError || !template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Verify the template belongs to the user's organization
    if (template.organization_id !== organizationId) {
      return NextResponse.json(
        { error: "Not authorized" },
        { status: 403 }
      );
    }

    const storagePath = template.storage_path;

    // If it's already a URL, return it
    if (storagePath.startsWith("http")) {
      return NextResponse.json({ url: storagePath });
    }

    // Use service role client for storage operations (bypasses RLS)
    const serviceClient = createServiceRoleClient();
    const bucket = process.env.AGREEMENT_TEMPLATES_BUCKET || "agreement-templates";

    // First check if the file exists
    const { data: files, error: listError } = await serviceClient.storage
      .from(bucket)
      .list(storagePath.split("/").slice(0, -1).join("/"), {
        search: storagePath.split("/").pop(),
      });

    if (listError) {
      console.error("Failed to list storage:", listError);
      return NextResponse.json(
        { error: `Storage error: ${listError.message}. Make sure the '${bucket}' bucket exists in Supabase.` },
        { status: 500 }
      );
    }

    if (!files || files.length === 0) {
      console.error("File not found in storage:", storagePath);
      return NextResponse.json(
        { error: `File not found in storage. The template "${template.version}" may need to be re-uploaded.` },
        { status: 404 }
      );
    }

    // Create a signed URL
    const { data, error } = await serviceClient.storage
      .from(bucket)
      .createSignedUrl(storagePath, 60 * 60); // 1 hour expiry

    if (error || !data) {
      console.error("Failed to create signed URL:", error);
      return NextResponse.json(
        { error: `Failed to generate view URL: ${error?.message || "Unknown error"}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (error) {
    console.error("Error getting template URL:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get template URL" },
      { status: 500 }
    );
  }
}
