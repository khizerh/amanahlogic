import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resend, FROM_EMAIL, isEmailConfigured } from "./resend";

const DEBOUNCE_MIN = 5;

interface SendOpts {
  organizationId: string;
  memberId: string | null;
  memberName: string | null;
  fromNumber: string;
  body: string;
  smsMessageId: string;
  supabase: SupabaseClient;
}

/**
 * Email the admin when a member texts in. Lightweight notification — plain
 * HTML, no React template. Debounced 5 min per (org, member) so a chatty
 * texter doesn't spam the admin inbox.
 *
 * Recipient is the organization's contact email (`organizations.email`). For
 * unknown senders (no member_id), no debounce — every unknown text gets an
 * email since those are higher-priority (likely a wrong-number or new
 * member's first contact).
 */
export async function sendSmsInboundNotification(opts: SendOpts): Promise<void> {
  const { organizationId, memberId, memberName, fromNumber, body, smsMessageId, supabase } = opts;

  if (!isEmailConfigured() || !resend) return;

  // Look up admin email (org contact email)
  const { data: org } = await supabase
    .from("organizations")
    .select("email, name")
    .eq("id", organizationId)
    .single();
  if (!org?.email) return;

  // Debounce: skip if we sent an SMS-inbound notification for this member in
  // the last 5 min. Unknown senders bypass the debounce.
  if (memberId) {
    const cutoff = new Date(Date.now() - DEBOUNCE_MIN * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("email_logs")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("member_id", memberId)
      .eq("template_type", "sms_inbound_notification")
      .gte("sent_at", cutoff)
      .limit(1)
      .maybeSingle();
    if (recent) return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://amanahlogic.com";
  const threadLink = memberId
    ? `${appUrl}/messages?to=${memberId}`
    : `${appUrl}/messages`;
  const displayName = memberName || `Unknown sender (${fromNumber})`;

  const subject = `💬 New text from ${displayName}`;
  const preview = body.length > 200 ? body.slice(0, 200) + "…" : body;
  const html = `
<!DOCTYPE html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;color:#111;max-width:600px;margin:0 auto;padding:20px">
  <h2 style="margin:0 0 16px;font-size:18px">New SMS from ${escapeHtml(displayName)}</h2>
  <p style="margin:0 0 8px;color:#666;font-size:13px">${escapeHtml(fromNumber)}</p>
  <div style="background:#f5f5f5;border-radius:8px;padding:12px 16px;margin:16px 0;white-space:pre-wrap">${escapeHtml(preview)}</div>
  <p style="margin:24px 0 0">
    <a href="${threadLink}" style="background:#0d9488;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:500">Open conversation</a>
  </p>
  <p style="color:#888;font-size:12px;margin:24px 0 0">${escapeHtml(org.name || "")} · Admin notification — replies happen in the app, not by replying to this email.</p>
</body></html>
`.trim();

  const text = `New text from ${displayName} (${fromNumber}):\n\n${preview}\n\nOpen: ${threadLink}`;

  // Insert email_log first so the debounce window works on next send
  const { data: emailLog } = await supabase
    .from("email_logs")
    .insert({
      organization_id: organizationId,
      member_id: memberId,
      member_name: displayName,
      member_email: org.email,
      template_type: "sms_inbound_notification",
      to: org.email,
      subject,
      body_preview: preview.slice(0, 150),
      status: "queued",
    })
    .select("id")
    .single();

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: org.email,
      subject,
      html,
      text,
    });
    if (emailLog) {
      await supabase
        .from("email_logs")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          resend_id: result.data?.id ?? null,
        })
        .eq("id", emailLog.id);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (emailLog) {
      await supabase
        .from("email_logs")
        .update({ status: "failed", failure_reason: msg })
        .eq("id", emailLog.id);
    }
    console.error("[sms-inbound-email] send failed", { smsMessageId, error: msg });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
