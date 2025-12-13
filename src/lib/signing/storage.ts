import { createServiceRoleClient } from "@/lib/supabase/server";
import { randomUUID, createHash } from "crypto";

/**
 * Upload signed PDF to Supabase Storage and return URL + hash
 */
export async function uploadSignedPdf(
  organizationId: string,
  agreementId: string,
  pdfBytes: Uint8Array
): Promise<{ url: string; hash: string }> {
  const supabase = createServiceRoleClient();
  const bucket = process.env.SIGNED_AGREEMENTS_BUCKET || "signed-agreements";

  const key = `${organizationId}/${agreementId}/${randomUUID()}.pdf`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(key, pdfBytes, { contentType: "application/pdf", upsert: false });

  if (error) {
    throw new Error(`Failed to upload signed PDF: ${error.message}`);
  }

  // Generate a signed URL for access (adjust expiration as needed)
  const { data: signedUrlData, error: urlError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(key, 60 * 60 * 24 * 30); // 30 days

  if (urlError || !signedUrlData) {
    throw new Error(`Failed to create signed URL: ${urlError?.message}`);
  }

  // Hash for tamper detection
  const hash = createHash("sha256").update(pdfBytes).digest("hex");

  return { url: signedUrlData.signedUrl, hash };
}
