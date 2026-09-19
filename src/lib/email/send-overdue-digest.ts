import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resend, FROM_EMAIL, isEmailConfigured } from "./resend";
import type { OverdueMember, OverdueRunResult } from "@/lib/billing/overdue";

/**
 * Email the admin a digest of overdue members. Plain HTML like the SMS-inbound
 * notification — this is an internal worklist, not a member-facing email.
 *
 * Recipient is the organization's contact email (`organizations.email`).
 */
export async function sendOverdueDigest(
  run: OverdueRunResult,
  supabase: SupabaseClient
): Promise<{ sent: boolean; reason?: string }> {
  if (!isEmailConfigured() || !resend) return { sent: false, reason: "email_not_configured" };

  const { data: org } = await supabase
    .from("organizations")
    .select("email, name")
    .eq("id", run.organizationId)
    .single();
  if (!org?.email) return { sent: false, reason: "no_org_email" };

  const needsFollowUp = run.overdue.filter((m) => !m.onAutoPay);
  const behindOnAutoPay = run.overdue.filter((m) => m.onAutoPay && m.daysOverdue > run.lapseDays);

  if (needsFollowUp.length === 0 && behindOnAutoPay.length === 0 && run.lapsed.length === 0) {
    return { sent: false, reason: "nothing_to_report" };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://amanahlogic.com";
  const subject = `Overdue members: ${needsFollowUp.length} need follow-up — ${org.name || ""}`.trim();

  const sections: string[] = [];

  if (run.lapsed.length > 0) {
    sections.push(
      section(
        `Moved to Lapsed today (${run.lapsed.length})`,
        `More than ${run.lapseDays} days overdue. They return to Current as soon as a payment is recorded.`,
        run.lapsed,
        appUrl
      )
    );
  }

  if (needsFollowUp.length > 0) {
    sections.push(
      section(
        `Not on auto-pay and overdue (${needsFollowUp.length})`,
        "Nothing will charge these members automatically. Send a payment setup link from their member page, or collect in person and record the payment.",
        needsFollowUp,
        appUrl
      )
    );
  }

  if (behindOnAutoPay.length > 0) {
    sections.push(
      section(
        `On auto-pay but behind (${behindOnAutoPay.length})`,
        "These members are being charged on schedule but still owe for an earlier missed period.",
        behindOnAutoPay,
        appUrl
      )
    );
  }

  if (!run.autoLapse && run.wouldLapse.length > 0) {
    sections.push(
      `<p style="margin:24px 0 0;color:#666;font-size:13px">Automatic lapsing is off. ${run.wouldLapse.length} of the members above are more than ${run.lapseDays} days overdue and would be marked Lapsed if it were on.</p>`
    );
  }

  const html = `
<!DOCTYPE html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;color:#111;max-width:680px;margin:0 auto;padding:20px">
  <h2 style="margin:0 0 4px;font-size:18px">Overdue members</h2>
  <p style="margin:0 0 8px;color:#666;font-size:13px">${escapeHtml(org.name || "")} · ${escapeHtml(run.today)}</p>
  ${sections.join("\n")}
  <p style="color:#888;font-size:12px;margin:32px 0 0">Admin notification — reminder emails go out automatically to members 3–60 days overdue who are not on auto-pay.</p>
</body></html>
`.trim();

  const text = [
    `Overdue members — ${org.name || ""} — ${run.today}`,
    "",
    ...needsFollowUp.map(
      (m) => `${m.name} — due ${m.nextPaymentDue} (${m.daysOverdue} days) — $${m.amountDue.toFixed(2)} ${m.billingFrequency}${m.phone ? ` — ${m.phone}` : ""}`
    ),
  ].join("\n");

  const { data: emailLog } = await supabase
    .from("email_logs")
    .insert({
      organization_id: run.organizationId,
      member_id: null,
      member_name: "Admin",
      member_email: org.email,
      template_type: "overdue_digest",
      to: org.email,
      subject,
      body_preview: text.slice(0, 150),
      status: "queued",
    })
    .select("id")
    .single();

  try {
    const result = await resend.emails.send({ from: FROM_EMAIL, to: org.email, subject, html, text });
    if (result.error) throw new Error(result.error.message);
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
    return { sent: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (emailLog) {
      await supabase
        .from("email_logs")
        .update({ status: "failed", failure_reason: msg })
        .eq("id", emailLog.id);
    }
    console.error("[overdue-digest] send failed", { organizationId: run.organizationId, error: msg });
    return { sent: false, reason: msg };
  }
}

function section(title: string, blurb: string, members: OverdueMember[], appUrl: string): string {
  const rows = members
    .map(
      (m) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee"><a href="${appUrl}/members/${m.memberId}" style="color:#0d9488;text-decoration:none;font-weight:500">${escapeHtml(m.name)}</a>${m.subscriptionDied ? ' <span style="color:#991b1b;font-size:12px">· auto-pay cancelled</span>' : ""}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;white-space:nowrap">${escapeHtml(m.nextPaymentDue)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${m.daysOverdue}d</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">$${m.amountDue.toFixed(2)} / ${escapeHtml(m.billingFrequency)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;white-space:nowrap">${escapeHtml(m.phone || "")}</td>
      </tr>`
    )
    .join("");

  return `
  <h3 style="margin:28px 0 4px;font-size:15px">${escapeHtml(title)}</h3>
  <p style="margin:0 0 10px;color:#666;font-size:13px">${escapeHtml(blurb)}</p>
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="text-align:left;color:#666">
      <th style="padding:6px 8px;border-bottom:2px solid #ddd">Member</th>
      <th style="padding:6px 8px;border-bottom:2px solid #ddd">Due</th>
      <th style="padding:6px 8px;border-bottom:2px solid #ddd;text-align:right">Overdue</th>
      <th style="padding:6px 8px;border-bottom:2px solid #ddd;text-align:right">Dues</th>
      <th style="padding:6px 8px;border-bottom:2px solid #ddd">Phone</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
