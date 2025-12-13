import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { AgreementTemplatesService } from "@/lib/database/agreement-templates";
import { getOrganizationId } from "@/lib/auth/get-organization-id";

/**
 * POST /api/agreements/templates/upload
 * Multipart/form-data:
 * - file: PDF file
 * - language: "en" | "fa"
 * - version: string
 * - notes: optional string
 */
export async function POST(req: Request) {
  try {
    const organizationId = await getOrganizationId();
    const formData = await req.formData();

    const file = formData.get("file");
    const language = formData.get("language") as "en" | "fa";
    const version = formData.get("version") as string;
    const notes = (formData.get("notes") as string) || "";

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }
    if (!["en", "fa"].includes(language)) {
      return NextResponse.json({ error: "Invalid language" }, { status: 400 });
    }
    if (!version) {
      return NextResponse.json({ error: "Version is required" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const bucket = process.env.AGREEMENT_TEMPLATES_BUCKET || "agreement-templates";
    const fileExt = ".pdf";
    const objectKey = `${organizationId}/${language}/${version}-${randomUUID()}${fileExt}`;

    // Upload to storage
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(objectKey, Buffer.from(arrayBuffer), {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    // Get a public (or signed) URL; we'll use a signed URL for security
    // Create template record (deactivates previous active of same language). Store object key.
    const template = await AgreementTemplatesService.create({
      organizationId,
      language,
      version,
      storagePath: objectKey,
      isActive: true,
      notes,
    });

    return NextResponse.json({ success: true, template });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
