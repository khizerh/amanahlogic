import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { processOverdueFollowUp } from "@/lib/billing/overdue";
import { sendOverdueDigest } from "@/lib/email/send-overdue-digest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily overdue follow-up (Vercel Cron — see vercel.json).
 *
 * Per active organization: send overdue reminder emails, lapse members when the
 * org has autoLapse on, and email the admin digest on Mondays (or any day a
 * member was lapsed).
 *
 * Query params (manual runs): ?dryRun=1 sends/changes nothing, ?digest=1 forces the digest.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Cron/billing] CRON_SECRET not configured");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const forceDigest = request.nextUrl.searchParams.get("digest") === "1";
  const supabase = createServiceRoleClient();

  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("id, name");
  if (error) {
    console.error("[Cron/billing] Failed to query organizations:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Record<string, unknown> = {};

  for (const org of organizations || []) {
    try {
      const run = await processOverdueFollowUp(org.id, supabase, { dryRun });

      const isMonday = new Date(`${run.today}T12:00:00Z`).getUTCDay() === 1;
      let digest: { sent: boolean; reason?: string } = { sent: false, reason: "not_scheduled" };
      if (!dryRun && (forceDigest || isMonday || run.lapsed.length > 0)) {
        digest = await sendOverdueDigest(run, supabase);
      }

      results[org.id] = {
        name: org.name,
        today: run.today,
        overdue: run.overdue.length,
        remindersSent: run.remindersSent.map((r) => ({
          name: r.member.name,
          reminderNumber: r.reminderNumber,
          daysOverdue: r.member.daysOverdue,
        })),
        reminderErrors: run.reminderErrors,
        autoLapse: run.autoLapse,
        lapsed: run.lapsed.map((m) => m.name),
        wouldLapse: run.wouldLapse.map((m) => m.name),
        digest,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Cron/billing] Organization ${org.id} failed:`, err);
      results[org.id] = { name: org.name, error: message };
    }
  }

  return NextResponse.json({ success: true, dryRun, results });
}
