import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { MembersService } from "@/lib/database/members";
import { AgreementsService } from "@/lib/database/agreements";
import { AgreementSigningLinksService } from "@/lib/database/agreement-links";
import { AgreementTemplatesService } from "@/lib/database/agreement-templates";
import { sendAgreementEmail } from "@/lib/email/send-agreement";
import { sendMemberInviteEmail } from "@/lib/email/send-member-invite";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { MemberWithMembership } from "@/lib/types";

/**
 * POST /api/reminders/pending-members
 *
 * Sends bulk email reminders to pending members:
 * - Agreement email if agreement not signed
 * - Portal invite email if member hasn't linked their portal account
 *
 * Payment setup reminders are handled separately on the onboarding tab.
 */
export async function POST() {
  try {
    const organizationId = await getOrganizationId();

    // Fetch all members, filter to pending
    const allMembers = await MembersService.getAllWithMembership(organizationId);
    const pendingMembers = allMembers.filter(
      (m) => m.membership?.status === "pending"
    );

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      "http://localhost:3000";

    const results: {
      memberId: string;
      memberName: string;
      success: boolean;
      error?: string;
      type?: string;
    }[] = [];
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const member of pendingMembers) {
      const membership = member.membership;
      if (!membership) {
        skipped++;
        continue;
      }

      const memberName = `${member.firstName} ${member.middleName ? `${member.middleName} ` : ""}${member.lastName}`;

      if (!member.email) {
        skipped++;
        results.push({
          memberId: member.id,
          memberName,
          success: false,
          error: "No email address",
        });
        continue;
      }

      const needsAgreement = !membership.agreementSignedAt;
      const needsPortal = !member.userId;

      if (!needsAgreement && !needsPortal) {
        skipped++;
        results.push({
          memberId: member.id,
          memberName,
          success: false,
          error: "Already completed",
        });
        continue;
      }

      let agreementSent = false;
      let portalSent = false;

      // Send agreement email if needed
      if (needsAgreement) {
        try {
          const agreementResult = await sendAgreementReminder(
            member,
            organizationId,
            baseUrl
          );
          if (agreementResult.success) {
            agreementSent = true;
          } else {
            results.push({
              memberId: member.id,
              memberName,
              success: false,
              error: agreementResult.error || "Agreement email failed",
              type: "agreement",
            });
            failed++;
          }
        } catch (err) {
          results.push({
            memberId: member.id,
            memberName,
            success: false,
            error:
              err instanceof Error ? err.message : "Agreement email error",
            type: "agreement",
          });
          failed++;
        }
      }

      // Send portal invite email if needed
      if (needsPortal) {
        try {
          const portalResult = await sendPortalInviteReminder(
            member,
            organizationId,
            baseUrl
          );
          if (portalResult.success) {
            portalSent = true;
          } else {
            results.push({
              memberId: member.id,
              memberName,
              success: false,
              error: portalResult.error || "Portal invite failed",
              type: "portal",
            });
            failed++;
          }
        } catch (err) {
          results.push({
            memberId: member.id,
            memberName,
            success: false,
            error:
              err instanceof Error ? err.message : "Portal invite error",
            type: "portal",
          });
          failed++;
        }
      }

      if (agreementSent || portalSent) {
        sent++;
        const types = [
          agreementSent ? "agreement" : null,
          portalSent ? "portal" : null,
        ]
          .filter(Boolean)
          .join(" + ");
        results.push({
          memberId: member.id,
          memberName,
          success: true,
          type: types,
        });
      }
    }

    return NextResponse.json({ sent, failed, skipped, results });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send reminders";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Send agreement reminder — reuses agreement creation logic from /api/agreements/send
 */
async function sendAgreementReminder(
  member: MemberWithMembership,
  organizationId: string,
  baseUrl: string
): Promise<{ success: boolean; error?: string }> {
  const membership = member.membership!;
  const memberLanguage = member.preferredLanguage || "en";
  const expiresAt = new Date("2099-12-31T23:59:59Z").toISOString();

  // Resolve template version
  let resolvedTemplateVersion: string;
  const activeTemplate = await AgreementTemplatesService.getActiveByLanguage(
    organizationId,
    memberLanguage
  );
  if (activeTemplate) {
    resolvedTemplateVersion = activeTemplate.version;
  } else {
    resolvedTemplateVersion = memberLanguage === "fa" ? "v1-fa" : "v1-en";
  }

  // Reuse existing unsigned agreement or create new
  let agreement = await AgreementsService.getUnsignedByMember(
    member.id,
    organizationId
  );

  if (!agreement) {
    agreement = await AgreementsService.create({
      organizationId,
      membershipId: membership.id,
      memberId: member.id,
      templateVersion: resolvedTemplateVersion,
      sentAt: new Date().toISOString(),
    });
  }

  // Invalidate existing links and create new one
  await AgreementSigningLinksService.invalidateByAgreementId(agreement.id);
  const token = randomUUID();
  await AgreementSigningLinksService.create({
    agreementId: agreement.id,
    token,
    expiresAt,
  });

  const signUrl = `${baseUrl}/sign/${token}`;
  const memberName = `${member.firstName} ${member.middleName ? `${member.middleName} ` : ""}${member.lastName}`;

  const emailResult = await sendAgreementEmail({
    to: member.email!,
    memberName,
    memberId: member.id,
    organizationId,
    signUrl,
    expiresAt,
    language: memberLanguage,
  });

  return {
    success: emailResult.success,
    error: emailResult.error,
  };
}

/**
 * Send portal invite — creates a new member_invites record and sends invite email.
 * Reuses logic from /api/members/invite
 */
async function sendPortalInviteReminder(
  member: MemberWithMembership,
  organizationId: string,
  baseUrl: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleClient();
  const memberName = `${member.firstName} ${member.middleName ? `${member.middleName} ` : ""}${member.lastName}`;

  // Cancel any existing pending invites
  await supabase
    .from("member_invites")
    .update({ status: "expired" })
    .eq("member_id", member.id)
    .eq("status", "pending");

  // Create new invite
  const { data: invite, error: inviteError } = await supabase
    .from("member_invites")
    .insert({
      organization_id: organizationId,
      member_id: member.id,
      email: member.email,
    })
    .select()
    .single();

  if (inviteError) {
    return { success: false, error: inviteError.message };
  }

  const inviteUrl = `${baseUrl}/portal/accept-invite?token=${invite.token}`;

  const emailResult = await sendMemberInviteEmail({
    to: member.email!,
    memberName,
    memberId: member.id,
    organizationId,
    inviteUrl,
    expiresAt: invite.expires_at,
    language: member.preferredLanguage || "en",
  });

  return {
    success: emailResult.success,
    error: emailResult.error,
  };
}
