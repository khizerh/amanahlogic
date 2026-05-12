import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { calculateSegments } from "./segments";
import { getSmsProvider } from "./provider";
import type { SmsMessage, SmsStatus } from "./types";

export { calculateSegments, detectEncoding } from "./segments";
export { getSmsProvider, isSmsLive } from "./provider";
export type {
  SmsMessage,
  SmsDirection,
  SmsStatus,
  SmsProvider,
  SmsSendOptions,
  SmsSendResult,
} from "./types";

interface SendMessageInput {
  organizationId: string;
  memberId: string | null;
  toNumber: string;
  body: string;
  /** Allow sending to opted-out members. Required + audit-logged. */
  overrideReason?: string;
  /** Auth user who initiated the send (admin). Null for automated flows. */
  sentByUserId?: string | null;
  metadata?: Record<string, unknown>;
  supabase?: SupabaseClient;
}

interface SendMessageResult {
  success: boolean;
  message?: SmsMessage;
  error?: string;
}

/**
 * Main outbound send path. Used by both the admin "Text member" route and
 * automated flows (payment-failed alerts etc.). Single source of truth for:
 *  - opt-out gating
 *  - org config lookup (from-number, brand)
 *  - DB row insert
 *  - provider call
 *  - status updates
 */
export async function sendSms(input: SendMessageInput): Promise<SendMessageResult> {
  const supabase = input.supabase || createServiceRoleClient();

  // 1. Org config
  const { data: org } = await supabase
    .from("organizations")
    .select("id, twilio_phone_number, twilio_messaging_service_sid")
    .eq("id", input.organizationId)
    .single();

  if (!org) return { success: false, error: "Organization not found" };

  // 2. Opt-out gate (member-side only; unknown sender / no member skips this)
  if (input.memberId) {
    const { data: member } = await supabase
      .from("members")
      .select("id, sms_opted_out_at")
      .eq("id", input.memberId)
      .single();

    if (member?.sms_opted_out_at && !input.overrideReason) {
      return {
        success: false,
        error: "Member has opted out of SMS. Provide overrideReason to send anyway.",
      };
    }
  }

  // 3. Pre-compute segments + insert pending row so the UI can render optimistically.
  const { segments } = calculateSegments(input.body);
  const provider = getSmsProvider();
  const fromNumber = org.twilio_phone_number || "+15555550000"; // stub fallback

  const { data: pending, error: insertErr } = await supabase
    .from("sms_messages")
    .insert({
      organization_id: input.organizationId,
      member_id: input.memberId,
      direction: "outbound",
      from_number: fromNumber,
      to_number: input.toNumber,
      body: input.body,
      status: "queued",
      provider: provider.name,
      segments,
      override_reason: input.overrideReason ?? null,
      sent_by_user_id: input.sentByUserId ?? null,
      metadata: input.metadata || {},
    })
    .select()
    .single();

  if (insertErr || !pending) {
    return { success: false, error: insertErr?.message || "Failed to insert message row" };
  }

  // 4. Hand off to provider.
  try {
    const result = await provider.send({
      organizationId: input.organizationId,
      toNumber: input.toNumber,
      body: input.body,
      metadata: { fromNumber, ...input.metadata },
    });

    const { data: updated } = await supabase
      .from("sms_messages")
      .update({
        status: result.status,
        provider_message_id: result.providerMessageId,
        segments: result.segments,
        from_number: result.fromNumber,
        sent_at: new Date().toISOString(),
      })
      .eq("id", pending.id)
      .select()
      .single();

    return { success: true, message: rowToMessage(updated || pending) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("sms_messages")
      .update({
        status: "failed",
        error_message: message,
      })
      .eq("id", pending.id);
    return { success: false, error: message };
  }
}

/** Insert a simulated inbound message — used by the dev-only simulator. */
export async function recordInboundSms(opts: {
  organizationId: string;
  fromNumber: string;
  toNumber: string;
  body: string;
  providerMessageId?: string;
  provider?: "stub" | "twilio";
  supabase?: SupabaseClient;
}): Promise<SmsMessage> {
  const supabase = opts.supabase || createServiceRoleClient();

  // Match a member by phone
  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("organization_id", opts.organizationId)
    .eq("phone", opts.fromNumber)
    .maybeSingle();

  const { data: row } = await supabase
    .from("sms_messages")
    .insert({
      organization_id: opts.organizationId,
      member_id: member?.id ?? null,
      direction: "inbound",
      from_number: opts.fromNumber,
      to_number: opts.toNumber,
      body: opts.body,
      status: "received" as SmsStatus,
      provider: opts.provider ?? "stub",
      provider_message_id: opts.providerMessageId ?? null,
      segments: calculateSegments(opts.body).segments,
    })
    .select()
    .single();

  if (!row) throw new Error("Failed to record inbound message");
  return rowToMessage(row);
}

interface SmsRow {
  id: string;
  organization_id: string;
  member_id: string | null;
  direction: string;
  from_number: string;
  to_number: string;
  body: string;
  status: string;
  provider: string;
  provider_message_id: string | null;
  segments: number | null;
  error_code: string | null;
  error_message: string | null;
  read_at: string | null;
  override_reason: string | null;
  sent_by_user_id: string | null;
  metadata: Record<string, unknown> | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export function rowToMessage(row: SmsRow): SmsMessage {
  return {
    id: row.id,
    organizationId: row.organization_id,
    memberId: row.member_id,
    direction: row.direction as SmsMessage["direction"],
    fromNumber: row.from_number,
    toNumber: row.to_number,
    body: row.body,
    status: row.status as SmsStatus,
    provider: row.provider as SmsMessage["provider"],
    providerMessageId: row.provider_message_id,
    segments: row.segments ?? 1,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    readAt: row.read_at,
    overrideReason: row.override_reason,
    sentByUserId: row.sent_by_user_id,
    metadata: (row.metadata as Record<string, unknown>) || {},
    sentAt: row.sent_at,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
