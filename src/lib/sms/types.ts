export type SmsDirection = "inbound" | "outbound";

// Matches Twilio's status vocabulary so the eventual provider swap is a no-op.
export type SmsStatus =
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "failed"
  | "undelivered"
  | "received";

export type SmsProviderName = "stub" | "twilio";

export interface SmsMessage {
  id: string;
  organizationId: string;
  memberId: string | null;
  direction: SmsDirection;
  fromNumber: string;
  toNumber: string;
  body: string;
  status: SmsStatus;
  provider: SmsProviderName;
  providerMessageId: string | null;
  segments: number;
  errorCode: string | null;
  errorMessage: string | null;
  readAt: string | null;
  overrideReason: string | null;
  sentByUserId: string | null;
  metadata: Record<string, unknown>;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SmsSendOptions {
  organizationId: string;
  toNumber: string;        // E.164
  body: string;
  metadata?: Record<string, unknown>;
}

export interface SmsSendResult {
  providerMessageId: string;
  status: SmsStatus;
  segments: number;
  // E.164 — the actual from-number the provider used.
  fromNumber: string;
}

export interface SmsProvider {
  readonly name: SmsProviderName;
  send(opts: SmsSendOptions): Promise<SmsSendResult>;
}
