import { resend, FROM_EMAIL, isEmailConfigured, getOrgEmailConfig } from "./resend";
import { renderMemberInvite } from "@emails/templates/MemberInvite";
import { resolveEmailTemplate } from "./resolve-template";
import { EmailLogsService } from "@/lib/database/email-logs";
import { OrganizationsService } from "@/lib/database/organizations";
import { createServiceRoleClient } from "@/lib/supabase/server";

interface SendMemberInviteEmailParams {
  to: string;
  memberName: string;
  memberId: string;
  organizationId: string;
  inviteUrl: string;
  expiresAt: string;
  language: "en" | "fa";
}

interface SendMemberInviteEmailResult {
  success: boolean;
  emailLogId?: string;
  resendId?: string;
  error?: string;
}

/**
 * Send portal invite email to member
 */
export async function sendMemberInviteEmail(
  params: SendMemberInviteEmailParams
): Promise<SendMemberInviteEmailResult> {
  const { to, memberName, memberId, organizationId, inviteUrl, expiresAt, language } = params;
  const serviceClient = createServiceRoleClient();

  // Fetch org early (needed for DB template + email config)
  const org = await OrganizationsService.getById(organizationId);
  const orgName = org?.name ?? "Our Organization";

  // Always use React email templates for now.
  // DB template resolution will be enabled when orgs can customize emails.
  const { subject, html, text } = await renderMemberInvite({
    memberName,
    inviteUrl,
    expiresAt,
    organizationName: orgName,
    language,
  });

  // Create email log entry (queued status)
  let emailLog;
  try {
    emailLog = await EmailLogsService.create({
      organizationId,
      memberId,
      memberName,
      memberEmail: to,
      templateType: "member_invite",
      to,
      subject,
      bodyPreview: text.substring(0, 200),
      language,
      status: "queued",
    }, serviceClient);
  } catch (err) {
    console.error("Failed to create email log:", err);
  }

  // Check if email is configured
  if (!isEmailConfigured() || !resend) {
    console.warn("Email not configured - RESEND_API_KEY not set");

    if (emailLog) {
      await EmailLogsService.markFailed(
        emailLog.id,
        "Email not configured - RESEND_API_KEY not set",
        serviceClient
      );
    }

    if (process.env.NODE_ENV === "development") {
      return {
        success: true,
        emailLogId: emailLog?.id,
        resendId: "dev-mode-skipped",
      };
    }

    return {
      success: false,
      emailLogId: emailLog?.id,
      error: "Email not configured",
    };
  }

  try {
    const emailConfig = org
      ? getOrgEmailConfig({ name: org.name, slug: org.slug, email: org.email })
      : { from: FROM_EMAIL, replyTo: undefined };

    const { data, error } = await resend.emails.send({
      from: emailConfig.from,
      replyTo: emailConfig.replyTo,
      to,
      subject,
      html,
      text,
    });

    if (error) {
      if (emailLog) {
        await EmailLogsService.markFailed(emailLog.id, error.message, serviceClient);
      }

      return {
        success: false,
        emailLogId: emailLog?.id,
        error: error.message,
      };
    }

    if (emailLog && data?.id) {
      await EmailLogsService.markSent(emailLog.id, data.id, serviceClient);
    }

    return {
      success: true,
      emailLogId: emailLog?.id,
      resendId: data?.id,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error sending email";

    if (emailLog) {
      await EmailLogsService.markFailed(emailLog.id, errorMessage, serviceClient);
    }

    return {
      success: false,
      emailLogId: emailLog?.id,
      error: errorMessage,
    };
  }
}
