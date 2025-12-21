import { resend, FROM_EMAIL, isEmailConfigured, getOrgEmailConfig } from "./resend";
import { getPaymentSetupEmail } from "./templates/payment-setup";
import { EmailLogsService } from "@/lib/database/email-logs";
import { OrganizationsService } from "@/lib/database/organizations";

interface SendPaymentSetupEmailParams {
  to: string;
  memberName: string;
  memberId: string;
  organizationId: string;
  checkoutUrl: string;
  planName: string;
  enrollmentFee?: number;
  duesAmount: number;
  billingFrequency: string;
  language: "en" | "fa";
}

interface SendPaymentSetupEmailResult {
  success: boolean;
  emailLogId?: string;
  resendId?: string;
  error?: string;
}

/**
 * Send Payment Setup link email to member
 */
export async function sendPaymentSetupEmail(
  params: SendPaymentSetupEmailParams
): Promise<SendPaymentSetupEmailResult> {
  const {
    to,
    memberName,
    memberId,
    organizationId,
    checkoutUrl,
    planName,
    enrollmentFee,
    duesAmount,
    billingFrequency,
    language,
  } = params;

  // Get email content based on language
  const { subject, html, text } = getPaymentSetupEmail({
    memberName,
    checkoutUrl,
    planName,
    enrollmentFee,
    duesAmount,
    billingFrequency,
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
      templateType: "payment_setup",
      to,
      subject,
      bodyPreview: text.substring(0, 200),
      language,
      status: "queued",
    });
  } catch (err) {
    console.error("Failed to create email log:", err);
    // Continue anyway - email sending is more important than logging
  }

  // Check if email is configured
  if (!isEmailConfigured() || !resend) {
    console.warn("Email not configured - RESEND_API_KEY not set");

    // Update log to failed if we created one
    if (emailLog) {
      await EmailLogsService.markFailed(
        emailLog.id,
        "Email not configured - RESEND_API_KEY not set"
      );
    }

    // In development, skip email and return success so the flow continues
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
    // Get organization info for email config
    const org = await OrganizationsService.getById(organizationId);
    const emailConfig = org
      ? getOrgEmailConfig({ name: org.name, slug: org.slug, email: org.email })
      : { from: FROM_EMAIL, replyTo: undefined };

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: emailConfig.from,
      replyTo: emailConfig.replyTo,
      to,
      subject,
      html,
      text,
    });

    if (error) {
      // Update log to failed
      if (emailLog) {
        await EmailLogsService.markFailed(emailLog.id, error.message);
      }

      return {
        success: false,
        emailLogId: emailLog?.id,
        error: error.message,
      };
    }

    // Update log to sent
    if (emailLog && data?.id) {
      await EmailLogsService.markSent(emailLog.id, data.id);
    }

    return {
      success: true,
      emailLogId: emailLog?.id,
      resendId: data?.id,
    };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error sending email";

    // Update log to failed
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
