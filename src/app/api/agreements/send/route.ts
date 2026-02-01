import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { AgreementsService } from "@/lib/database/agreements";
import { AgreementSigningLinksService } from "@/lib/database/agreement-links";
import { MembershipsService } from "@/lib/database/memberships";
import { MembersService } from "@/lib/database/members";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { sendAgreementEmail } from "@/lib/email/send-agreement";
import { AgreementTemplatesService } from "@/lib/database/agreement-templates";

interface SendAgreementBody {
  membershipId: string;
  memberId: string;
  templateVersion?: string;
  language?: "en" | "fa";
  sendEmail?: boolean; // Default true - set to false to skip email
}

/**
 * POST /api/agreements/send
 *
 * Creates an agreement record, a single-use signing link, and sends email to member.
 * Returns a signing URL.
 */
export async function POST(req: Request) {
  try {
    const organizationId = await getOrganizationId();

    const { membershipId, memberId, templateVersion, language, sendEmail = true }: SendAgreementBody =
      await req.json();

    if (!membershipId || !memberId) {
      return NextResponse.json({ error: "membershipId and memberId are required" }, { status: 400 });
    }

    // Validate membership belongs to org
    const membership = await MembershipsService.getById(membershipId);
    if (!membership || membership.organizationId !== organizationId) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    // Get member for email
    const member = await MembersService.getById(memberId);
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const memberLanguage = language || member.preferredLanguage || "en";
    const now = new Date();
    // No expiry — links remain valid until used
    const expiresAt = new Date("2099-12-31T23:59:59Z").toISOString();

    // Find active template for language (or fallback to provided version)
    let resolvedTemplateVersion = templateVersion;
    const activeTemplate = await AgreementTemplatesService.getActiveByLanguage(
      organizationId,
      memberLanguage as "en" | "fa"
    );
    if (activeTemplate) {
      resolvedTemplateVersion = activeTemplate.version;
    } else if (!resolvedTemplateVersion) {
      resolvedTemplateVersion = memberLanguage === "fa" ? "v1-fa" : "v1-en";
    }

    // Reuse existing unsigned agreement if one exists, otherwise create new
    let agreement = await AgreementsService.getUnsignedByMember(memberId, organizationId);

    if (!agreement) {
      agreement = await AgreementsService.create({
        organizationId,
        membershipId,
        memberId,
        templateVersion: resolvedTemplateVersion!,
        sentAt: now.toISOString(),
      });
    }

    // Invalidate any existing active links for this agreement, then create a new one
    await AgreementSigningLinksService.invalidateByAgreementId(agreement.id);
    const token = randomUUID();
    await AgreementSigningLinksService.create({
      agreementId: agreement.id,
      token,
      expiresAt,
    });

    // Build signing URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const signUrl = `${baseUrl}/sign/${token}`;

    // Send email to member
    let emailResult = null;
    if (sendEmail) {
      emailResult = await sendAgreementEmail({
        to: member.email,
        memberName: `${member.firstName} ${member.lastName}`,
        memberId: member.id,
        organizationId,
        signUrl,
        expiresAt,
        language: memberLanguage as "en" | "fa",
      });

      if (!emailResult.success) {
        console.warn("Failed to send agreement email:", emailResult.error);
        // Don't fail the request - agreement was created, email just didn't send
      }
    }

    return NextResponse.json({
      success: true,
      agreementId: agreement.id,
      signUrl,
      expiresAt,
      emailSent: emailResult?.success ?? false,
      emailLogId: emailResult?.emailLogId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create agreement";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
