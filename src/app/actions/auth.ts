"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { resend, isEmailConfigured, getOrgEmailConfig, FROM_EMAIL } from "@/lib/email/resend";

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

    // Look up the user's org for branded sender config
    const orgId = data.user?.app_metadata?.organization_id;
    let fromAddress = `"Amanah Logic" <${FROM_EMAIL}>`;
    let replyTo: string | undefined;
    let orgName = "Amanah Logic";

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

    await resend!.emails.send({
      from: fromAddress,
      ...(replyTo ? { replyTo } : {}),
      to: email,
      subject: "Reset Your Password",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h2 style="color: #111827; margin: 0;">${orgName}</h2>
          </div>
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            We received a request to reset your password. Click the button below to set a new password:
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${actionLink}" style="display: inline-block; background-color: #0d9488; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 500; font-size: 16px;">
              Reset Password
            </a>
          </div>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
            If you didn't request this, you can safely ignore this email. This link will expire in 24 hours.
          </p>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
            If the button doesn't work, copy and paste this link into your browser:
          </p>
          <p style="color: #6b7280; font-size: 12px; word-break: break-all;">
            ${actionLink}
          </p>
        </div>
      `,
    });

    return { success: true };
  } catch (err) {
    console.error("Password reset error:", err);
    // Always return success to prevent user enumeration
    return { success: true };
  }
}
