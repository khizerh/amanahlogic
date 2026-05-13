import "server-only";
import { StubSmsProvider } from "./provider-stub";
import { TwilioSmsProvider } from "./provider-twilio";
import type { SmsProvider } from "./types";

/**
 * Pick the SMS provider at runtime. Defaults to the stub so dev/preview
 * environments work without Twilio creds. Flip to Twilio by setting all
 * five vars below AND implementing TwilioSmsProvider.send() (currently
 * throws). The TWILIO_PROVIDER_ENABLED flag is the final gate — we keep
 * it off until the real impl + the two webhook routes land, so the SMS
 * settings UI doesn't lie about being "Live" while sends would still
 * throw.
 *
 * Required when flipping live:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_API_KEY_SID
 *   TWILIO_API_KEY_SECRET
 *   TWILIO_MESSAGING_SERVICE_SID
 *   TWILIO_PROVIDER_ENABLED=true
 *
 * See [[reference-twilio-go-live-checklist]].
 */
let cached: SmsProvider | null = null;

export function getSmsProvider(): SmsProvider {
  if (cached) return cached;
  if (
    process.env.TWILIO_PROVIDER_ENABLED === "true" &&
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_API_KEY_SID &&
    process.env.TWILIO_API_KEY_SECRET &&
    process.env.TWILIO_MESSAGING_SERVICE_SID
  ) {
    cached = new TwilioSmsProvider();
  } else {
    cached = new StubSmsProvider();
  }
  return cached;
}

export function isSmsLive(): boolean {
  return getSmsProvider().name !== "stub";
}
