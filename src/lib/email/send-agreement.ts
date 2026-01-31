import { resend, FROM_EMAIL, isEmailConfigured, getOrgEmailConfig } from "./resend";
import { getAgreementSentEmail } from "./templates/agreement-sent";
import { resolveEmailTemplate } from "./resolve-template";
import { EmailLogsService } from "@/lib/database/email-logs";
import { OrganizationsService } from "@/lib/database/organizations";

interface SendAgreementEmailParams {
  to: string;
  memberName: string;
  memberId: string;
  organizationId: string;
  signUrl: string;
  expiresAt: string;
  language: "en" | "fa";
}

interface SendAgreementEmailResult {
  success: boolean;
  emailLogId?: string;
  resendId?: string;
  error?: string;
}

/**
 * Send agreement signing email to member
 */
export async function sendAgreementEmail(
  params: SendAgreementEmailParams
): Promise<SendAgreementEmailResult> {
  const { to, memberName, memberId, organizationId, signUrl, expiresAt, language } = params;

  // Fetch org early (needed for DB template + email config)
  const org = await OrganizationsService.getById(organizationId);
  const orgName = org?.name ?? "Our Organization";

  // Try DB template first
  const dbResult = await resolveEmailTemplate(
    organizationId,
    "agreement_sent",
    {
      member_name: memberName,
      organization_name: orgName,
      sign_url: signUrl,
      expires_at: expiresAt,
    },
    language,
    orgName
  );

  // Fall back to hardcoded template
  const { subject, html, text } = dbResult ?? getAgreementSentEmail({
    memberName,
    signUrl,
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
      templateType: "agreement_sent",
      to,
      subject,
      bodyPreview: text.substring(0, 200),
      language,
      status: "queued",
    });
  } catch (err) {
    console.error("Failed to create email log:", err);
  }

  // Check if email is configured
  if (!isEmailConfigured() || !resend) {
    console.warn("Email not configured - RESEND_API_KEY not set");

    if (emailLog) {
      await EmailLogsService.markFailed(
        emailLog.id,
        "Email not configured - RESEND_API_KEY not set"
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
        await EmailLogsService.markFailed(emailLog.id, error.message);
      }

      return {
        success: false,
        emailLogId: emailLog?.id,
        error: error.message,
      };
    }

    if (emailLog && data?.id) {
      await EmailLogsService.markSent(emailLog.id, data.id);
    }

    return {
      success: true,
      emailLogId: emailLog?.id,
      resendId: data?.id,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error sending email";

    if (emailLog) {
      await EmailLogsService.markFailed(emailLog.id, errorMessage);
    }

    return {
      success: false,
      emailLogId: emailLog?.id,
      error: errorMessage,
    };
  }
}
