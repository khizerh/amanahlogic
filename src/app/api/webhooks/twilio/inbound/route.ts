import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { calculateSegments } from "@/lib/sms/segments";
import { classifyInbound } from "@/lib/sms/keywords";
import { sendSms } from "@/lib/sms";
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
 *   5. STOP: set members.sms_opted_out_at + queue confirmation auto-reply.
 *      HELP: queue help auto-reply.
 *      START: clear members.sms_opted_out_at + queue opt-in confirmation.
 *      Regular: fire admin email notification.
 *   6. Respond with empty TwiML (Twilio's Advanced Opt-Out also auto-replies
 *      at the carrier level; we use our outbound send for the audit trail).
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

  // Keyword handling
  const kind = classifyInbound({ body, twilioOptOutType: params.OptOutType });

  if (kind === "stop" && member) {
    await supabase
      .from("members")
      .update({ sms_opted_out_at: new Date().toISOString(), sms_opt_out_reason: "Replied STOP" })
      .eq("id", member.id);
    // Fire a confirmation reply through our own send path so it's logged in
    // sms_messages too. Twilio's Advanced Opt-Out also sends one at the
    // carrier level — duplicate is acceptable + audit trail.
    await sendSms({
      organizationId: org.id,
      memberId: member.id,
      toNumber: fromNumber,
      body:
        "Masjid Muhajireen: You're unsubscribed and will receive no further texts. Reply START to resubscribe.",
      overrideReason: "STOP keyword confirmation (required by carrier rules)",
      supabase,
    });
  } else if (kind === "start" && member) {
    await supabase
      .from("members")
      .update({ sms_opted_out_at: null, sms_opt_out_reason: null })
      .eq("id", member.id);
    await sendSms({
      organizationId: org.id,
      memberId: member.id,
      toNumber: fromNumber,
      body:
        "Masjid Muhajireen: You're now opted in to receive membership account notifications. Reply HELP for help, STOP to opt out. Msg & data rates may apply.",
      supabase,
    });
  } else if (kind === "help") {
    await sendSms({
      organizationId: org.id,
      memberId: member?.id ?? null,
      toNumber: fromNumber,
      body:
        "Masjid Muhajireen: For help with your membership, reply to this message or visit amanahlogic.com/portal. Reply STOP to opt out.",
      supabase,
    });
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
