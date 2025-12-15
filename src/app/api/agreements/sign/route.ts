import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { AgreementSigningLinksService } from "@/lib/database/agreement-links";
import { AgreementsService } from "@/lib/database/agreements";
import { MembershipsService } from "@/lib/database/memberships";
import { PlansService } from "@/lib/database/plans";
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
    });

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

    await MembershipsService.update(updateData);

    // Mark link as used
    await AgreementSigningLinksService.markUsed(link.id);

    // Create pending payments for enrollment fee + first dues
    // This shows in Outstanding tab so admin knows what to collect
    try {
      const plan = await PlansService.getById(membership.planId);
      if (plan) {
        const supabase = createServiceRoleClient();
        const now = new Date();
        // Due date is 7 days from signing
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + 7);
        const dueDateStr = dueDate.toISOString().split("T")[0];

        // Get dues amount based on billing frequency
        const pricing = plan.pricing as { monthly?: number; biannual?: number; annual?: number };
        let duesAmount = 0;
        let monthsCredited = 1;
        switch (membership.billingFrequency) {
          case "monthly":
            duesAmount = pricing.monthly || 0;
            monthsCredited = 1;
            break;
          case "biannual":
            duesAmount = pricing.biannual || 0;
            monthsCredited = 6;
            break;
          case "annual":
            duesAmount = pricing.annual || 0;
            monthsCredited = 12;
            break;
          default:
            duesAmount = pricing.monthly || 0;
            monthsCredited = 1;
        }

        // Create enrollment fee payment if not already paid
        if (!membership.enrollmentFeePaid && plan.enrollmentFee > 0) {
          await supabase.from("payments").insert({
            organization_id: agreement.organizationId,
            membership_id: membership.id,
            member_id: agreement.memberId,
            type: "enrollment_fee",
            status: "pending",
            amount: plan.enrollmentFee,
            months_credited: 0,
            due_date: dueDateStr,
            period_label: "Enrollment Fee",
            notes: "Auto-created after agreement signed",
          });
        }

        // Create first dues payment if no months paid yet
        if (membership.paidMonths === 0 && duesAmount > 0) {
          await supabase.from("payments").insert({
            organization_id: agreement.organizationId,
            membership_id: membership.id,
            member_id: agreement.memberId,
            type: "dues",
            status: "pending",
            amount: duesAmount,
            months_credited: monthsCredited,
            due_date: dueDateStr,
            period_label: `First ${monthsCredited === 1 ? "Month" : monthsCredited + " Months"} Dues`,
            notes: "Auto-created after agreement signed",
          });
        }
      }
    } catch (paymentError) {
      // Log but don't fail the signing - payments can be created manually
      console.error("Failed to create pending payments:", paymentError);
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
