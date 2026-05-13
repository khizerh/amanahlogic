import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { mapTwilioStatus } from "@/lib/sms/provider-twilio";
import {
  getWebhookUrl,
  parseTwilioFormBody,
  verifyTwilioSignature,
} from "@/lib/sms/twilio-signature";

/**
 * POST /api/webhooks/twilio/status
 *
 * Receives delivery status callbacks from Twilio. Twilio fires multiple
 * callbacks per message as it progresses: queued → sending → sent → delivered
 * (or → undelivered / failed). We update the matching sms_messages row by
 * provider_message_id.
 *
 * Webhook is signed with the master Auth Token (NOT the API Key Secret).
 * Set TWILIO_AUTH_TOKEN env var for signature verification — without it the
 * route rejects all requests (fail-closed).
 *
 * Wire this up in Twilio Console:
 *   Messaging → Services → [our service] → Integration → status callback URL
 *   → https://amanahlogic.com/api/webhooks/twilio/status
 */
export async function POST(req: Request) {
  const params = await parseTwilioFormBody(req);
  const signature = req.headers.get("x-twilio-signature");
  const url = getWebhookUrl(req);

  if (!verifyTwilioSignature({ signature, url, params })) {
    console.warn("[twilio/status] invalid signature", { url });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const messageSid = params.MessageSid || params.SmsSid;
  const status = params.MessageStatus || params.SmsStatus;
  if (!messageSid || !status) {
    return NextResponse.json({ error: "Missing MessageSid or MessageStatus" }, { status: 400 });
  }

  const mapped = mapTwilioStatus(status);
  const supabase = createServiceRoleClient();

  const update: Record<string, unknown> = {
    status: mapped,
    updated_at: new Date().toISOString(),
  };

  if (mapped === "delivered") update.delivered_at = new Date().toISOString();
  if (params.ErrorCode) update.error_code = params.ErrorCode;
  if (params.ErrorMessage) update.error_message = params.ErrorMessage;

  const { error, count } = await supabase
    .from("sms_messages")
    .update(update, { count: "exact" })
    .eq("provider_message_id", messageSid);

  if (error) {
    console.error("[twilio/status] update failed", { messageSid, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!count) {
    // Status callback for a message we don't have a row for — could be a
    // legitimate race (status webhook beat our insert), or a stray webhook
    // from a deleted/reissued account. Return 200 so Twilio doesn't retry.
    console.warn("[twilio/status] no matching sms_messages row", { messageSid, status: mapped });
  }

  return NextResponse.json({ ok: true });
}
