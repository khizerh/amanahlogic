import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { AgreementSigningLinksService } from "@/lib/database/agreement-links";
import { AgreementTemplatesService } from "@/lib/database/agreement-templates";
import { AgreementsService } from "@/lib/database/agreements";
import { sendAgreementEmail } from "@/lib/email/send-agreement";

/**
 * POST /api/reminders/unsigned-agreements
 *
 * Nudge members who have PAID (completed dues/enrollment) but have NOT signed
 * their membership agreement. Re-sends the localized agreement email with their
 * sign link. The existing onboarding reminder only chases people who haven't
 * paid — this closes the paid-but-unsigned gap.
 *
 * Body: { dryRun?: boolean } — defaults to TRUE (safe). Pass dryRun:false to send.
 *
 * Throttle: at most one nudge per member per THROTTLE_DAYS, capped at REMINDER_CAP
 * total, tracked on agreements.reminder_count / last_reminder_at. Safe to run daily.
 */
const REMINDER_CAP = 4;
const THROTTLE_DAYS = 5;
const FAR_FUTURE = "2099-12-31T23:59:59Z";

type Recipient = {
  name: string;
  email?: string;
  language?: "en" | "fa";
  reminderCount?: number;
  status: "would_send" | "sent" | "failed" | "skipped";
  reason?: string;
  signUrl?: string;
};

export async function POST(req: Request) {
  try {
    const organizationId = await getOrganizationId();
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun !== false; // default true

    const supabase = createServiceRoleClient();
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      "http://localhost:3000";

    // 1. membership_ids that have at least one completed dues/enrollment payment
    const { data: paidRows, error: paidErr } = await supabase
      .from("payments")
      .select("membership_id")
      .eq("organization_id", organizationId)
      .in("type", ["dues", "enrollment_fee"])
      .eq("status", "completed");
    if (paidErr) throw paidErr;
    const paidSet = new Set((paidRows || []).map((r) => r.membership_id as string));

    // 2. unsigned agreements with member + membership + signing links
    const { data: agreements, error: agErr } = await supabase
      .from("agreements")
      .select(
        `id, membership_id, member_id, template_version, reminder_count, last_reminder_at,
         member:members!agreements_member_id_fkey ( first_name, middle_name, last_name, email, preferred_language ),
         membership:memberships!agreements_membership_id_fkey ( payer_member_id, agreement_signed_at ),
         links:agreement_signing_links ( token, used_at )`
      )
      .eq("organization_id", organizationId)
      .is("signed_at", null);
    if (agErr) throw agErr;

    const now = Date.now();
    const throttleMs = THROTTLE_DAYS * 24 * 3600 * 1000;
    const recipients: Recipient[] = [];
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const ag of agreements || []) {
      const m = (Array.isArray(ag.member) ? ag.member[0] : ag.member) as
        | { first_name: string; middle_name: string | null; last_name: string; email: string | null; preferred_language: string | null }
        | undefined;
      const ms = (Array.isArray(ag.membership) ? ag.membership[0] : ag.membership) as
        | { payer_member_id: string | null; agreement_signed_at: string | null }
        | undefined;
      const name = m
        ? `${m.first_name} ${m.middle_name ? m.middle_name + " " : ""}${m.last_name}`.trim()
        : "Member";

      // Must be a PAID member, and not already signed.
      if (!paidSet.has(ag.membership_id as string)) continue;
      if (ms?.agreement_signed_at) continue;

      // Recipient email — member first, fall back to payer (family pays for them).
      let emailTo = m?.email || null;
      if (!emailTo && ms?.payer_member_id) {
        const { data: payer } = await supabase
          .from("members")
          .select("email")
          .eq("id", ms.payer_member_id)
          .maybeSingle();
        emailTo = (payer?.email as string) || null;
      }
      if (!emailTo) {
        skipped++;
        recipients.push({ name, status: "skipped", reason: "no email" });
        continue;
      }

      // Throttle + cap.
      const count = (ag.reminder_count as number) ?? 0;
      if (count >= REMINDER_CAP) {
        skipped++;
        recipients.push({ name, email: emailTo, status: "skipped", reason: `cap reached (${REMINDER_CAP})` });
        continue;
      }
      if (ag.last_reminder_at && now - new Date(ag.last_reminder_at as string).getTime() < throttleMs) {
        skipped++;
        recipients.push({ name, email: emailTo, status: "skipped", reason: `nudged <${THROTTLE_DAYS}d ago` });
        continue;
      }

      const language: "en" | "fa" = m?.preferred_language === "fa" ? "fa" : "en";

      // Make sure the agreement renders in the member's current language.
      try {
        const tmpl = await AgreementTemplatesService.getActiveByLanguage(organizationId, language, supabase);
        if (tmpl && tmpl.version !== ag.template_version && !dryRun) {
          await AgreementsService.updateTemplateVersion(ag.id as string, tmpl.version, supabase);
        }
      } catch {
        // non-fatal
      }

      // Reuse an unused signing link, else mint one.
      const links = (ag.links || []) as { token: string; used_at: string | null }[];
      let token = links.find((l) => !l.used_at)?.token || links[0]?.token || null;
      if (!token) {
        token = randomUUID();
        if (!dryRun) {
          await AgreementSigningLinksService.create(
            { agreementId: ag.id as string, token, expiresAt: FAR_FUTURE },
            supabase
          );
        }
      }
      const signUrl = `${baseUrl}/sign/${token}`;

      if (dryRun) {
        recipients.push({ name, email: emailTo, language, reminderCount: count, status: "would_send", signUrl });
        continue;
      }

      const res = await sendAgreementEmail({
        to: emailTo,
        memberName: name,
        memberId: ag.member_id as string,
        organizationId,
        signUrl,
        expiresAt: FAR_FUTURE,
        language,
      });

      if (res.success) {
        sent++;
        await supabase
          .from("agreements")
          .update({ reminder_count: count + 1, last_reminder_at: new Date().toISOString() })
          .eq("id", ag.id as string);
        recipients.push({ name, email: emailTo, language, status: "sent" });
      } else {
        failed++;
        recipients.push({ name, email: emailTo, status: "failed", reason: res.error });
      }
    }

    return NextResponse.json({
      dryRun,
      summary: {
        totalUnsigned: (agreements || []).length,
        wouldSend: recipients.filter((r) => r.status === "would_send").length,
        sent,
        failed,
        skipped,
      },
      recipients,
    });
  } catch (error) {
    console.error("unsigned-agreements reminder error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
