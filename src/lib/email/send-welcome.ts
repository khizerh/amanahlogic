import { resend, FROM_EMAIL, isEmailConfigured, getOrgEmailConfig } from "./resend";
import { getWelcomeEmail } from "./templates/welcome";
import { resolveEmailTemplate } from "./resolve-template";
import { EmailLogsService } from "@/lib/database/email-logs";
import { OrganizationsService } from "@/lib/database/organizations";

interface SendWelcomeEmailParams {
  to: string;
  memberName: string;
  memberId: string;
  organizationId: string;
  inviteUrl: string;
  inviteExpiresAt: string;
  paymentMethod: "stripe" | "manual";
  language: "en" | "fa";
  // Stripe-only:
  checkoutUrl?: string;
  planName?: string;
  enrollmentFee?: number;
  duesAmount?: number;
  billingFrequency?: string;
}

interface SendWelcomeEmailResult {
  success: boolean;
  emailLogId?: string;
  resendId?: string;
  error?: string;
}

/**
 * Send combined welcome email to member (portal invite + payment context)
 */
export async function sendWelcomeEmail(
  params: SendWelcomeEmailParams
): Promise<SendWelcomeEmailResult> {
  const {
    to,
    memberName,
    memberId,
    organizationId,
    inviteUrl,
    inviteExpiresAt,
    paymentMethod,
    language,
    checkoutUrl,
    planName,
    enrollmentFee,
    duesAmount,
    billingFrequency,
  } = params;

  // Fetch org early (needed for DB template + email config)
  const org = await OrganizationsService.getById(organizationId);
  const orgName = org?.name ?? "Our Organization";

  const frequencyText =
    billingFrequency === "monthly"
      ? language === "fa" ? "ماهانه" : "monthly"
      : billingFrequency === "biannual"
      ? language === "fa" ? "هر ۶ ماه" : "every 6 months"
      : language === "fa" ? "سالانه" : "annually";

  // Try DB template first
  const dbResult = await resolveEmailTemplate(
    organizationId,
    "welcome",
    {
      member_name: memberName,
      organization_name: orgName,
      invite_url: inviteUrl,
      invite_expires_at: inviteExpiresAt,
      checkout_url: checkoutUrl ?? "",
      plan_name: planName ?? "",
      enrollment_fee: enrollmentFee != null ? `$${enrollmentFee.toFixed(2)}` : "",
      dues_amount: duesAmount != null ? `$${duesAmount.toFixed(2)}` : "",
      billing_frequency: frequencyText,
    },
    language,
    orgName
  );

  // Fall back to hardcoded template
  const { subject, html, text } = dbResult ?? getWelcomeEmail({
    memberName,
    organizationName: orgName,
    inviteUrl,
    inviteExpiresAt,
    paymentMethod,
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
      templateType: "welcome",
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
