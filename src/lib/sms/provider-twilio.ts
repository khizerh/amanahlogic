import "server-only";
import type { SmsProvider, SmsSendOptions, SmsSendResult } from "./types";

/**
 * Twilio provider — scaffolded for when 10DLC registration + credentials land.
 * Intentionally throws until env vars are populated and the implementation is
 * filled in. Keeps the swap to a single edit.
 *
 * When implementing: use messagingServiceSid (preferred) over a raw phone
 * number — it lets Twilio rotate numbers within the same A2P campaign.
 */
export class TwilioSmsProvider implements SmsProvider {
  readonly name = "twilio" as const;

  async send(_opts: SmsSendOptions): Promise<SmsSendResult> {
    throw new Error(
      "TwilioSmsProvider not implemented yet — set TWILIO_* env vars and fill in this file"
    );
  }
}
