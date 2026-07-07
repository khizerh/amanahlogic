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

/**
 * Upload a captured signature image to Supabase Storage and return a signed URL.
 *
 * Signatures are captured client-side as a base64 `data:image/png;base64,...` URI.
 * Storing that inline bloats the `agreements` table (~43KB/row), so we upload the
 * decoded bytes to the same private bucket as the signed PDF and persist the URL.
 *
 * If the input is not a base64 data URI (e.g. already a URL), it is returned
 * unchanged so callers can pass through legacy/edge values safely.
 */
export async function uploadSignatureImage(
  organizationId: string,
  agreementId: string,
  signatureDataUrl: string
): Promise<string> {
  const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(signatureDataUrl);
  if (!match) {
    // Not an inline data URI — nothing to migrate, pass through unchanged.
    return signatureDataUrl;
  }

  const ext = match[1].toLowerCase().startsWith("jp") ? "jpg" : "png";
  const contentType = ext === "jpg" ? "image/jpeg" : "image/png";
  const bytes = Buffer.from(match[2], "base64");

  const supabase = createServiceRoleClient();
  const bucket = process.env.SIGNED_AGREEMENTS_BUCKET || "signed-agreements";
  const key = `${organizationId}/${agreementId}/signature-${randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(key, bytes, { contentType, upsert: false });

  if (error) {
    throw new Error(`Failed to upload signature image: ${error.message}`);
  }

  const { data: signedUrlData, error: urlError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(key, 60 * 60 * 24 * 30); // 30 days, mirrors uploadSignedPdf

  if (urlError || !signedUrlData) {
    throw new Error(`Failed to create signature signed URL: ${urlError?.message}`);
  }

  return signedUrlData.signedUrl;
}
