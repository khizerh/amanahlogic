"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { resend, isEmailConfigured, getOrgEmailConfig, FROM_EMAIL } from "@/lib/email/resend";
import { renderPasswordReset } from "@emails/templates/PasswordReset";
import { EmailLogsService } from "@/lib/database/email-logs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.amanahlogic.com";

export async function requestPasswordReset(
  email: string,
  variant: "admin" | "portal"
) {
  const redirectTo =
    variant === "admin"
      ? `${APP_URL}/reset-password`
      : `${APP_URL}/portal/reset-password`;

  try {
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

    if (error) {
      // Don't expose whether the user exists
      console.error("Password reset link generation error:", error.message);
      return { success: true };
    }

    const actionLink = data?.properties?.action_link;
    if (!actionLink) {
      console.error("No action_link returned from generateLink");
      return { success: true };
    }

    if (!isEmailConfigured()) {
      console.error("Resend is not configured — cannot send reset email");
      return { success: true };
    }

    // Resolve the user's organization for branding
    let fromAddress = `"Amanah Logic" <${FROM_EMAIL}>`;
    let replyTo: string | undefined;
    let orgName = "Amanah Logic";

    // Try app_metadata first, then fall back to members table lookup
    let orgId = data.user?.app_metadata?.organization_id;
    let memberId: string | null = null;
    let memberName = email;

    {
      const { data: member } = await supabase
        .from("members")
        .select("id, organization_id, first_name, last_name")
        .eq("email", email)
        .limit(1)
        .maybeSingle();
      if (member) {
        if (!orgId) orgId = member.organization_id;
        memberId = member.id;
        memberName = [member.first_name, member.last_name].filter(Boolean).join(" ") || email;
      }
    }

    if (orgId) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name, slug, email")
        .eq("id", orgId)
        .single();

      if (org) {
        const emailConfig = getOrgEmailConfig({
          name: org.name,
          slug: org.slug,
          email: org.email,
        });
        fromAddress = emailConfig.from;
        replyTo = emailConfig.replyTo;
        orgName = org.name;
      }
    }

    const rendered = await renderPasswordReset({
      resetUrl: actionLink,
      organizationName: orgName,
    });

    // Create email log entry
    let emailLogId: string | undefined;
    if (orgId && memberId) {
      try {
        const log = await EmailLogsService.create({
          organizationId: orgId,
          memberId,
          memberName,
          memberEmail: email,
          templateType: "password_reset",
          to: email,
          subject: rendered.subject,
          bodyPreview: "Password reset link requested",
          language: "en",
          status: "queued",
        });
        emailLogId = log.id;
      } catch (logErr) {
        console.error("Failed to create email log for password reset:", logErr);
      }
    }

    const { data: sendResult, error: sendError } = await resend!.emails.send({
      from: fromAddress,
      ...(replyTo ? { replyTo } : {}),
      to: email,
      subject: rendered.subject,
      html: rendered.html,
    });

    if (emailLogId) {
      if (sendError) {
        await EmailLogsService.markFailed(emailLogId, sendError.message).catch(() => {});
      } else {
        await EmailLogsService.markSent(emailLogId, sendResult?.id || "").catch(() => {});
      }
    }

    return { success: true };
  } catch (err) {
    console.error("Password reset error:", err);
    // Always return success to prevent user enumeration
    return { success: true };
  }
}
