"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { resend, isEmailConfigured, getOrgEmailConfig, FROM_EMAIL } from "@/lib/email/resend";
import { renderPasswordReset } from "@emails/templates/PasswordReset";

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

    // Admin resets come from platform support; portal resets come from the org
    let fromAddress = `"Amanah Logic" <${FROM_EMAIL}>`;
    let replyTo: string | undefined;
    let orgName = "Amanah Logic";

    if (variant === "portal") {
      const orgId = data.user?.app_metadata?.organization_id;
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
    }

    const rendered = await renderPasswordReset({
      resetUrl: actionLink,
      organizationName: orgName,
    });

    await resend!.emails.send({
      from: fromAddress,
      ...(replyTo ? { replyTo } : {}),
      to: email,
      subject: rendered.subject,
      html: rendered.html,
    });

    return { success: true };
  } catch (err) {
    console.error("Password reset error:", err);
    // Always return success to prevent user enumeration
    return { success: true };
  }
}
