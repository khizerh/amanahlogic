import { resend, FROM_EMAIL, isEmailConfigured, getOrgEmailConfig } from "./resend";
import { renderPaymentReceipt } from "@emails/templates/PaymentReceipt";
import { resolveEmailTemplate } from "./resolve-template";
import { EmailLogsService } from "@/lib/database/email-logs";
import { createServiceRoleClient } from "@/lib/supabase/server";

interface SendPaymentReceiptEmailParams {
  to: string;
  memberName: string;
  memberId: string;
  organizationId: string;
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  invoiceNumber?: string;
  periodLabel?: string;
  language: "en" | "fa";
}

interface SendPaymentReceiptEmailResult {
  success: boolean;
  emailLogId?: string;
  resendId?: string;
  error?: string;
}

/**
 * Send payment receipt email to member
 */
export async function sendPaymentReceiptEmail(
  params: SendPaymentReceiptEmailParams
): Promise<SendPaymentReceiptEmailResult> {
  const {
    to,
    memberName,
    memberId,
    organizationId,
    amount,
    paymentDate,
    paymentMethod,
    invoiceNumber,
    periodLabel,
    language,
  } = params;

  // Fetch org using service role (this may be called from webhooks with no auth context)
  const supabase = createServiceRoleClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("name, slug, email")
    .eq("id", organizationId)
    .single();
  const orgName = org?.name ?? "Our Organization";

  // Try DB template first
  const dbResult = await resolveEmailTemplate(
    organizationId,
    "payment_receipt",
    {
      member_name: memberName,
      organization_name: orgName,
      amount,
      payment_date: paymentDate,
      payment_method: paymentMethod,
      invoice_number: invoiceNumber || "",
      period_label: periodLabel || "",
    },
    language,
    orgName
  );

  // Fall back to hardcoded template
  const { subject, html, text } = dbResult ?? await renderPaymentReceipt({
    memberName,
    organizationName: orgName,
    amount,
    paymentDate,
    paymentMethod,
    invoiceNumber,
    periodLabel,
    language,
  });

  // Create email log entry
  let emailLog;
  try {
    emailLog = await EmailLogsService.create({
      organizationId,
      memberId,
      memberName,
      memberEmail: to,
      templateType: "payment_receipt",
      to,
      subject,
      bodyPreview: text.substring(0, 200),
      language,
      status: "queued",
    }, supabase);
  } catch (err) {
    console.error("Failed to create email log:", err);
  }

  if (!isEmailConfigured() || !resend) {
    console.warn("Email not configured - RESEND_API_KEY not set");

    if (emailLog) {
      await EmailLogsService.markFailed(
        emailLog.id,
        "Email not configured - RESEND_API_KEY not set",
        supabase
      );
    }

    if (process.env.NODE_ENV === "development") {
      return { success: true, emailLogId: emailLog?.id, resendId: "dev-mode-skipped" };
    }

    return { success: false, emailLogId: emailLog?.id, error: "Email not configured" };
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
        await EmailLogsService.markFailed(emailLog.id, error.message, supabase);
      }
      return { success: false, emailLogId: emailLog?.id, error: error.message };
    }

    if (emailLog && data?.id) {
      await EmailLogsService.markSent(emailLog.id, data.id, supabase);
    }

    return { success: true, emailLogId: emailLog?.id, resendId: data?.id };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error sending email";
    if (emailLog) {
      await EmailLogsService.markFailed(emailLog.id, errorMessage, supabase);
    }
    return { success: false, emailLogId: emailLog?.id, error: errorMessage };
  }
}
