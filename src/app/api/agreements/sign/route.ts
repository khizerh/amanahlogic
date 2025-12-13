import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { AgreementSigningLinksService } from "@/lib/database/agreement-links";
import { AgreementsService } from "@/lib/database/agreements";
import { MembershipsService } from "@/lib/database/memberships";
import { uploadSignedPdf } from "@/lib/signing/storage";
import { stampAgreementPdf } from "@/lib/signing/stamp-pdf";
import { validateSignaturePayload } from "@/lib/signing/validation";
import type { SignAgreementPayload } from "@/lib/signing/validation";

/**
 * POST /api/agreements/sign
 *
 * Public endpoint called by the signer page after signature is captured.
 * Validates token, stamps PDF, uploads it, updates agreement + membership.
 */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const payload = (await req.json()) as SignAgreementPayload;

    // Capture IP from headers (Vercel/Cloudflare/nginx set these)
    const clientIp =
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headersList.get("x-real-ip") ||
      headersList.get("cf-connecting-ip") ||
      "unknown";

    // Use server-captured IP, fallback to client-provided (if any)
    payload.ipAddress = clientIp;

    const validationError = validateSignaturePayload(payload);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Validate signing link
    const link = await AgreementSigningLinksService.getActiveByToken(payload.token);
    if (!link) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
    }

    const agreement = await AgreementsService.getById(link.agreementId);
    if (!agreement) {
      return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
    }

    // Get membership for org/membership context
    const membership = await MembershipsService.getById(agreement.membershipId);
    if (!membership) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    // Stamp PDF with signature + audit data
    const stampedPdf = await stampAgreementPdf({
      agreement,
      member: {
        id: agreement.memberId,
        name: payload.signedName,
      },
      signatureImageDataUrl: payload.signatureDataUrl,
      ipAddress: payload.ipAddress,
      userAgent: payload.userAgent,
      consentChecked: payload.consentChecked,
      signedAt: new Date().toISOString(),
      language: payload.language || "en",
    });

    // Upload stamped PDF
    const { url: pdfUrl, hash: pdfHash } = await uploadSignedPdf(
      agreement.organizationId,
      agreement.id,
      stampedPdf
    );

    // Update agreement record
    await AgreementsService.sign({
      agreementId: agreement.id,
      signedName: payload.signedName,
      signatureImageUrl: payload.signatureDataUrl,
      pdfUrl,
      ipAddress: payload.ipAddress,
      userAgent: payload.userAgent,
      consentChecked: payload.consentChecked,
    });

    // Update membership: set agreementSignedAt and transition status
    // awaiting_signature → waiting_period (if enrollment fee paid)
    if (membership.enrollmentFeePaid && membership.status === "awaiting_signature") {
      await MembershipsService.update({
        id: membership.id,
        agreementSignedAt: new Date().toISOString(),
        status: "waiting_period",
      });
    } else {
      await MembershipsService.update({
        id: membership.id,
        agreementSignedAt: new Date().toISOString(),
      });
    }

    // Mark link as used
    await AgreementSigningLinksService.markUsed(link.id);

    return NextResponse.json({
      success: true,
      pdfUrl,
      pdfHash,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sign agreement";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
