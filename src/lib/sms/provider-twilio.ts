import "server-only";
import { calculateSegments } from "./segments";
import type { SmsProvider, SmsSendOptions, SmsSendResult, SmsStatus } from "./types";

/**
 * Twilio provider — uses the REST API directly via fetch (no SDK dependency)
 * with Standard API Key authentication.
 *
 * Auth: HTTP Basic with `{API_KEY_SID}:{API_KEY_SECRET}`. The path still
 * references the Account SID for the namespace. This is Twilio's documented
 * pattern for API-key-scoped clients (preferred over the master Auth Token
 * for outbound calls).
 *
 * Activated by:
 *   TWILIO_PROVIDER_ENABLED=true
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_API_KEY_SID
 *   TWILIO_API_KEY_SECRET
 *   TWILIO_MESSAGING_SERVICE_SID (preferred — lets Twilio rotate numbers
 *     within the same A2P campaign)
 * Optional:
 *   TWILIO_PHONE_NUMBER (fallback if Messaging Service SID not set)
 *   NEXT_PUBLIC_APP_URL (used to compute the status callback URL — required
 *     for delivery status updates to flow back into sms_messages)
 */
export class TwilioSmsProvider implements SmsProvider {
  readonly name = "twilio" as const;

  async send(opts: SmsSendOptions): Promise<SmsSendResult> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const fallbackFrom = process.env.TWILIO_PHONE_NUMBER;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!accountSid || !apiKeySid || !apiKeySecret) {
      throw new Error(
        "Twilio not configured: missing TWILIO_ACCOUNT_SID / TWILIO_API_KEY_SID / TWILIO_API_KEY_SECRET"
      );
    }

    const form = new URLSearchParams();
    form.set("To", opts.toNumber);
    form.set("Body", opts.body);

    if (messagingServiceSid) {
      form.set("MessagingServiceSid", messagingServiceSid);
    } else if (fallbackFrom) {
      form.set("From", fallbackFrom);
    } else {
      throw new Error(
        "Twilio sender not configured: set TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER"
      );
    }

    // Wire status callbacks so delivery confirmations flow back into our DB.
    // Skipped when running locally — Twilio can't reach localhost.
    if (appUrl && !/localhost|127\.0\.0\.1/.test(appUrl)) {
      form.set("StatusCallback", `${appUrl}/api/webhooks/twilio/status`);
    }

    const auth = Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString("base64");
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const json = (await res.json()) as TwilioMessageResponse;

    if (!res.ok) {
      const msg = json.message || `Twilio API ${res.status}`;
      const err: Error & { code?: string; status?: number } = new Error(msg);
      err.code = json.code ? String(json.code) : undefined;
      err.status = res.status;
      throw err;
    }

    return {
      providerMessageId: json.sid,
      status: mapTwilioStatus(json.status),
      segments: json.num_segments ? parseInt(json.num_segments, 10) : calculateSegments(opts.body).segments,
      fromNumber: json.from || (messagingServiceSid ? messagingServiceSid : fallbackFrom || ""),
    };
  }
}

interface TwilioMessageResponse {
  sid: string;
  status: string;
  num_segments?: string;
  from?: string;
  to?: string;
  // Present on error
  code?: number;
  message?: string;
  more_info?: string;
}

/** Map Twilio's status enum to ours. */
export function mapTwilioStatus(s: string): SmsStatus {
  switch (s) {
    case "accepted":
    case "scheduled":
    case "queued":
      return "queued";
    case "sending":
      return "sending";
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "undelivered":
      return "undelivered";
    case "failed":
    case "canceled":
      return "failed";
    case "received":
    case "receiving":
      return "received";
    default:
      return "queued";
  }
}
