import "server-only";
import { randomUUID } from "crypto";
import { calculateSegments } from "./segments";
import type { SmsProvider, SmsSendOptions, SmsSendResult } from "./types";

/**
 * Stub provider. Doesn't hit any network — pretends the send succeeded
 * instantly. Used until Twilio is provisioned + env vars set.
 *
 * The DB-side wiring (insert sms_messages row, fire UI updates) is identical
 * to the real provider path, so the demo is faithful.
 */
export class StubSmsProvider implements SmsProvider {
  readonly name = "stub" as const;

  async send(opts: SmsSendOptions): Promise<SmsSendResult> {
    const { segments } = calculateSegments(opts.body);
    return {
      providerMessageId: `STUB_${randomUUID()}`,
      status: "sent",
      segments,
      fromNumber: opts.metadata?.fromNumber as string | undefined ?? "+15555550000",
    };
  }
}
