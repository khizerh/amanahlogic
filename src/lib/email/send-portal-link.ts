import { resend, FROM_EMAIL, isEmailConfigured, getOrgEmailConfig } from "./resend";
import { renderPortalLink } from "@emails/templates/PortalLink";
import { resolveEmailTemplate } from "./resolve-template";
import { EmailLogsService } from "@/lib/database/email-logs";
import { OrganizationsService } from "@/lib/database/organizations";
import { createServiceRoleClient } from "@/lib/supabase/server";

interface SendPortalLinkEmailParams {
  to: string;
  memberName: string;
  memberId: string;
  organizationId: string;
  portalUrl: string;
  language: "en" | "fa";
}

interface SendPortalLinkEmailResult {
  success: boolean;
  emailLogId?: string;
  resendId?: string;
  error?: string;
}

/**
 * Send Stripe Customer Portal link email to member
 */
export async function sendPortalLinkEmail(
  params: SendPortalLinkEmailParams
): Promise<SendPortalLinkEmailResult> {
  const { to, memberName, memberId, organizationId, portalUrl, language } = params;
  const serviceClient = createServiceRoleClient();

  // Fetch org early (needed for DB template + email config)
  const org = await OrganizationsService.getById(organizationId);
  const orgName = org?.name ?? "Our Organization";

  // Try DB template first
  const dbResult = await resolveEmailTemplate(
    organizationId,
    "portal_link",
    {
      member_name: memberName,
      organization_name: orgName,
      portal_url: portalUrl,
    },
    language,
    orgName
  );

  // Fall back to hardcoded template
  const { subject, html, text } = dbResult ?? await renderPortalLink({
    memberName,
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
      templateType: "portal_link",
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
