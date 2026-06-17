import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { calculateSegments } from "@/lib/sms/segments";
import { classifyInbound } from "@/lib/sms/keywords";
import { sendSmsInboundNotification } from "@/lib/email/send-sms-inbound-notification";
import {
  getWebhookUrl,
  parseTwilioFormBody,
  verifyTwilioSignature,
} from "@/lib/sms/twilio-signature";

/**
 * POST /api/webhooks/twilio/inbound
 *
 * Receives inbound SMS from members. Flow:
 *   1. Verify signature (fail-closed without TWILIO_AUTH_TOKEN).
 *   2. Look up member by `From` phone within the org that owns the `To` number.
 *   3. Insert sms_messages row (member_id=null for unknown senders).
 *   4. Detect STOP / HELP / START keyword (trust Twilio's OptOutType when present).
 *   5. STOP: set members.sms_opted_out_at.
 *      START: clear members.sms_opted_out_at + record sms_opted_in_at.
 *      HELP: no-op (Twilio answers HELP at the carrier level, doesn't forward).
 *      Regular: fire admin email notification.
 *      We do NOT send our own keyword replies — Twilio's Advanced Opt-Out owns
 *      the member-facing STOP/HELP/START responses at the carrier level.
 *   6. Respond with empty TwiML.
 *
 * Wire this up in Twilio Console:
 *   Messaging → Services → [our service] → Integration → inbound URL
 *   → https://amanahlogic.com/api/webhooks/twilio/inbound
 */
export async function POST(req: Request) {
  const params = await parseTwilioFormBody(req);
  const signature = req.headers.get("x-twilio-signature");
  const url = getWebhookUrl(req);

  if (!verifyTwilioSignature({ signature, url, params })) {
    console.warn("[twilio/inbound] invalid signature", { url });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const fromNumber = params.From;
  const toNumber = params.To;
  const body = params.Body ?? "";
  const messageSid = params.MessageSid || params.SmsSid;

  if (!fromNumber || !toNumber || !messageSid) {
    return NextResponse.json({ error: "Missing required Twilio fields" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // Find org by the destination phone (our number)
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("twilio_phone_number", toNumber)
    .maybeSingle();

  if (!org) {
    // Inbound for a number we don't own — log + drop silently.
    console.warn("[twilio/inbound] unknown destination number", { toNumber });
    return twimlEmpty();
  }

  // Idempotency: if we've already recorded this exact Twilio message, skip.
  const { data: existing } = await supabase
    .from("sms_messages")
    .select("id")
    .eq("provider_message_id", messageSid)
    .maybeSingle();
  if (existing) {
    return twimlEmpty();
  }

  // Match member by phone within this org. Multiple matches → pick the first
  // active membership. None → leave member_id null (unknown sender bucket).
  const { data: candidates } = await supabase
    .from("members")
    .select("id, first_name, last_name, sms_opted_out_at")
    .eq("organization_id", org.id)
    .eq("phone", fromNumber);

  const member = candidates && candidates.length > 0 ? candidates[0] : null;

  const segments = calculateSegments(body).segments;
  const { data: inserted } = await supabase
    .from("sms_messages")
    .insert({
      organization_id: org.id,
      member_id: member?.id ?? null,
      direction: "inbound",
      from_number: fromNumber,
      to_number: toNumber,
      body,
      status: "received",
      provider: "twilio",
      provider_message_id: messageSid,
      segments,
    })
    .select("id")
    .single();

  // Keyword handling.
  //
  // Twilio's Advanced Opt-Out (enabled on the Messaging Service) owns the
  // member-facing replies for STOP/HELP/START at the carrier level. It
  // forwards STOP/START to this webhook so we can sync our own state, but
  // answers HELP itself without forwarding. We therefore ONLY sync DB state
  // here and never send our own keyword reply — that would either double-text
  // the member (START) or fail with 21610 against a number Twilio just opted
  // out (STOP). Customize the carrier replies in Twilio Console → Messaging →
  // Services → Opt-Out.
  const kind = classifyInbound({ body, twilioOptOutType: params.OptOutType });

  if (kind === "stop" && member) {
    await supabase
      .from("members")
      .update({ sms_opted_out_at: new Date().toISOString(), sms_opt_out_reason: "Replied STOP" })
      .eq("id", member.id);
  } else if (kind === "start" && member) {
    // Replying START is affirmative consent: clear any opt-out AND record opt-in
    // so future messages pass the consent gate.
    await supabase
      .from("members")
      .update({
        sms_opted_out_at: null,
        sms_opt_out_reason: null,
        sms_opted_in_at: new Date().toISOString(),
      })
      .eq("id", member.id);
  } else if (kind === "help") {
    // No-op: Twilio answers HELP at the carrier level and doesn't forward it.
    // Branch kept for clarity / in case Advanced Opt-Out is ever disabled.
  } else {
    // Regular inbound — notify the admin via email.
    await sendSmsInboundNotification({
      organizationId: org.id,
      memberId: member?.id ?? null,
      memberName: member ? `${member.first_name} ${member.last_name}`.trim() : null,
      fromNumber,
      body,
      smsMessageId: inserted?.id ?? "",
      supabase,
    });
  }

  return twimlEmpty();
}

function twimlEmpty(): Response {
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
