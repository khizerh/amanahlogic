import { resend, FROM_EMAIL, isEmailConfigured, getOrgEmailConfig } from "./resend";
import { getPaymentFailedEmail } from "./templates/payment-failed";
import { resolveEmailTemplate } from "./resolve-template";
import { EmailLogsService } from "@/lib/database/email-logs";
import { OrganizationsService } from "@/lib/database/organizations";

interface SendPaymentFailedEmailParams {
  to: string;
  memberName: string;
  memberId: string;
  organizationId: string;
  amount: string;
  failureReason: string;
  language: "en" | "fa";
}

interface SendPaymentFailedEmailResult {
  success: boolean;
  emailLogId?: string;
  resendId?: string;
  error?: string;
}

/**
 * Send payment failure notification email to member
 */
export async function sendPaymentFailedEmail(
  params: SendPaymentFailedEmailParams
): Promise<SendPaymentFailedEmailResult> {
  const { to, memberName, memberId, organizationId, amount, failureReason, language } = params;

  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/payments`;

  // Fetch org early (needed for DB template + email config)
  const org = await OrganizationsService.getById(organizationId);
  const orgName = org?.name ?? "Our Organization";

  // Try DB template first
  const dbResult = await resolveEmailTemplate(
    organizationId,
    "payment_failed",
    {
      member_name: memberName,
      organization_name: orgName,
      amount,
      failure_reason: failureReason,
      portal_url: portalUrl,
    },
    language,
    orgName
  );

  // Fall back to hardcoded template
  const { subject, html, text } = dbResult ?? getPaymentFailedEmail({
    memberName,
    amount,
    failureReason,
    portalUrl,
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
      templateType: "payment_failed",
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
