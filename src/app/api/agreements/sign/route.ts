import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { AgreementSigningLinksService } from "@/lib/database/agreement-links";
import { AgreementsService } from "@/lib/database/agreements";
import { MembershipsService } from "@/lib/database/memberships";
import { PlansService } from "@/lib/database/plans";
import { OnboardingInvitesService } from "@/lib/database/onboarding-invites";
import { createServiceRoleClient } from "@/lib/supabase/server";
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

    // Use service role — this is a public endpoint called by unauthenticated signers
    const serviceClient = createServiceRoleClient();

    // Validate signing link
    const link = await AgreementSigningLinksService.getActiveByToken(payload.token);
    if (!link) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
    }

    const agreement = await AgreementsService.getById(link.agreementId, serviceClient);
    if (!agreement) {
      return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
    }

    // Get membership for org/membership context
    const membership = await MembershipsService.getById(agreement.membershipId, serviceClient);
    if (!membership) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    // Stamp PDF with signature + audit data
    let stampedPdf: Uint8Array;
    try {
      stampedPdf = await stampAgreementPdf({
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
    } catch (stampError) {
      console.error("PDF stamping error:", stampError);
      throw new Error(`Failed to stamp PDF: ${stampError instanceof Error ? stampError.message : "Unknown error"}`);
    }

    // Upload stamped PDF
    let pdfUrl: string;
    let pdfHash: string;
    try {
      const uploadResult = await uploadSignedPdf(
        agreement.organizationId,
        agreement.id,
        stampedPdf
      );
      pdfUrl = uploadResult.url;
      pdfHash = uploadResult.hash;
    } catch (uploadError) {
      console.error("PDF upload error:", uploadError);
      throw new Error(`Failed to upload PDF: ${uploadError instanceof Error ? uploadError.message : "Unknown error"}`);
    }

    // Update agreement record
    await AgreementsService.sign({
      agreementId: agreement.id,
      signedName: payload.signedName,
      signatureImageUrl: payload.signatureDataUrl,
      pdfUrl,
      ipAddress: payload.ipAddress,
      userAgent: payload.userAgent,
      consentChecked: payload.consentChecked,
    }, serviceClient);

    // Update membership: set agreementSignedAt and transition status
    // pending → current (if enrollment fee is also paid, onboarding complete)
    // pending stays pending if enrollment fee not yet paid
    const updateData: {
      id: string;
      agreementSignedAt: string;
      status?: "current";
      joinDate?: string;
    } = {
      id: membership.id,
      agreementSignedAt: new Date().toISOString(),
    };

    // If enrollment fee is paid AND paidMonths > 0, member is fully onboarded
    // This is the official "join" moment: both agreement signed AND first payment completed
    if (membership.enrollmentFeePaid && membership.paidMonths > 0 && membership.status === "pending") {
      updateData.status = "current";
      updateData.joinDate = new Date().toISOString().split("T")[0];
    }

    await MembershipsService.update(updateData, serviceClient);

    // Mark link as used
    await AgreementSigningLinksService.markUsed(link.id, serviceClient);

    // Create onboarding invite so it shows in Onboarding tab
    // Admin can then record payment using "Mark as Paid"
    try {
      // Check if onboarding invite already exists for this membership
      const existingInvite = await OnboardingInvitesService.getPendingForMembership(membership.id, serviceClient);

      if (!existingInvite) {
        const plan = await PlansService.getById(membership.planId, serviceClient);
        if (plan) {
          // Get dues amount based on billing frequency
          const pricing = plan.pricing as { monthly?: number; biannual?: number; annual?: number };
          let duesAmount = 0;
          switch (membership.billingFrequency) {
            case "monthly":
              duesAmount = pricing.monthly || 0;
              break;
            case "biannual":
              duesAmount = pricing.biannual || 0;
              break;
            case "annual":
              duesAmount = pricing.annual || 0;
              break;
            default:
              duesAmount = pricing.monthly || 0;
          }

          // Create onboarding invite (manual payment method since they'll pay offline)
          await OnboardingInvitesService.create({
            organizationId: agreement.organizationId,
            membershipId: membership.id,
            memberId: agreement.memberId,
            paymentMethod: "manual",
            enrollmentFeeAmount: membership.enrollmentFeePaid ? 0 : (plan.enrollmentFee || 0),
            includesEnrollmentFee: !membership.enrollmentFeePaid && (plan.enrollmentFee || 0) > 0,
            duesAmount,
            billingFrequency: membership.billingFrequency,
            sentAt: new Date().toISOString(),
          }, serviceClient);
        }
      }
    } catch (inviteError) {
      // Log but don't fail the signing - invite can be created manually
      console.error("Failed to create onboarding invite:", inviteError);
    }

    return NextResponse.json({
      success: true,
      pdfUrl,
      pdfHash,
    });
  } catch (error) {
    console.error("Agreement signing error:", error);
    const message = error instanceof Error ? error.message : "Failed to sign agreement";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
