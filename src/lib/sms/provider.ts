import "server-only";
import { StubSmsProvider } from "./provider-stub";
import { TwilioSmsProvider } from "./provider-twilio";
import type { SmsProvider } from "./types";

/**
 * Pick the SMS provider at runtime. Defaults to the stub so dev/preview
 * environments work without Twilio creds. Flip to Twilio by setting
 * TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_MESSAGING_SERVICE_SID.
 */
let cached: SmsProvider | null = null;

export function getSmsProvider(): SmsProvider {
  if (cached) return cached;
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    cached = new TwilioSmsProvider();
  } else {
    cached = new StubSmsProvider();
  }
  return cached;
}

export function isSmsLive(): boolean {
  return getSmsProvider().name !== "stub";
}
