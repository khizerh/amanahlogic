import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { resend, FROM_EMAIL } from "@/lib/email/resend";
import { MEMBERSHIP_SIZES } from "@/lib/demo-request";

// Where demo requests are emailed. Comma-separated to notify several people.
const DEMO_REQUEST_TO = (process.env.DEMO_REQUEST_TO || "support@amanahlogic.com")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// =============================================================================
// Rate limiter (best-effort, in-memory): same approach as /api/join register
// =============================================================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  for (const [k, v] of rateLimitMap) {
    if (now > v.resetAt) rateLimitMap.delete(k);
  }
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * POST /api/request-demo
 *
 * Saves the request to demo_requests first (so a lead is never lost to an
 * email hiccup), then emails it to DEMO_REQUEST_TO. Succeeds if either the
 * row or the email landed; errors only when both failed.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Honeypot: real visitors never fill this hidden field. Pretend it worked.
  if (clean(body.website, 200)) {
    return NextResponse.json({ success: true });
  }

  const organizationName = clean(body.organizationName, 200);
  const contactName = clean(body.contactName, 200);
  const role = clean(body.role, 200);
  const email = clean(body.email, 320).toLowerCase();
  const phone = clean(body.phone, 50);
  const membershipSize = clean(body.membershipSize, 50);
  const notes = clean(body.notes, 5000);

  if (!organizationName || !contactName || !role || !email || !phone || !membershipSize) {
    return NextResponse.json({ error: "Please fill in all required fields." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (!MEMBERSHIP_SIZES.includes(membershipSize)) {
    return NextResponse.json({ error: "Please select a membership size." }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  // 1. Save the lead
  const supabase = createServiceRoleClient();
  const { data: row, error: insertError } = await supabase
    .from("demo_requests")
    .insert({
      organization_name: organizationName,
      contact_name: contactName,
      role,
      email,
      phone,
      membership_size: membershipSize,
      notes: notes || null,
      ip_address: ip,
      user_agent: request.headers.get("user-agent")?.slice(0, 500) || null,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[request-demo] insert failed", insertError);
  }

  // 2. Email it
  let emailSent = false;
  if (resend) {
    const rows: [string, string][] = [
      ["Organization", organizationName],
      ["Name", contactName],
      ["Role", role],
      ["Email", email],
      ["Phone", phone],
      ["Membership size", membershipSize],
      ["Notes", notes || "(none)"],
    ];
    const html = `
<!DOCTYPE html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;color:#111;max-width:600px;margin:0 auto;padding:20px">
  <h2 style="margin:0 0 16px;font-size:18px">New demo request: ${escapeHtml(organizationName)}</h2>
  <table style="border-collapse:collapse;width:100%">
    ${rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding:8px 12px 8px 0;color:#666;font-size:13px;vertical-align:top;white-space:nowrap">${label}</td><td style="padding:8px 0;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`
      )
      .join("\n    ")}
  </table>
  <p style="color:#888;font-size:12px;margin:24px 0 0">Sent from the Request a Demo form on amanahlogic.com. Reply to this email to answer ${escapeHtml(contactName)} directly.</p>
</body></html>`.trim();
    const text = rows.map(([label, value]) => `${label}: ${value}`).join("\n");

    try {
      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to: DEMO_REQUEST_TO,
        replyTo: email,
        subject: `Demo request: ${organizationName}`,
        html,
        text,
      });
      if (result.error) {
        console.error("[request-demo] email failed", result.error);
      } else {
        emailSent = true;
      }
    } catch (err) {
      console.error("[request-demo] email threw", err);
    }
  } else {
    console.warn("[request-demo] RESEND_API_KEY not set, email skipped");
  }

  if (row && emailSent) {
    await supabase.from("demo_requests").update({ email_sent: true }).eq("id", row.id);
  }

  // Both failed: tell the visitor the truth instead of faking success.
  if (!row && !emailSent) {
    return NextResponse.json(
      { error: "We couldn't submit your request. Please try again in a moment." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
