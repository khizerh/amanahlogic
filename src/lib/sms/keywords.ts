/**
 * SMS keyword detection for STOP / HELP / START families.
 *
 * Twilio's Messaging Service Advanced Opt-Out (on by default for A2P-registered
 * services) ALSO handles these — auto-replies are sent by Twilio and recipient
 * opt-out state is tracked carrier-side. Our handler still gets the inbound
 * webhook with `OptOutType` flagged, so we can mirror the state into our
 * `members.sms_opted_out_at` column and log the event in `sms_messages`.
 *
 * Keywords are matched against trimmed, lowercase, punctuation-stripped body.
 */

export type SmsKeywordKind = "stop" | "help" | "start" | null;

const STOP_WORDS = new Set([
  "stop",
  "stopall",
  "unsubscribe",
  "cancel",
  "end",
  "quit",
  "stop please",
]);

const HELP_WORDS = new Set([
  "help",
  "info",
]);

const START_WORDS = new Set([
  "start",
  "yes",
  "unstop",
]);

/**
 * Classify a message body. Strict — only exact-match (after normalization)
 * keywords trigger a classification. "stop calling me" returns null.
 */
export function classifyKeyword(body: string): SmsKeywordKind {
  const normalized = body
    .trim()
    .toLowerCase()
    .replace(/[!.?,;:'"]/g, "")
    .replace(/\s+/g, " ");
  if (!normalized) return null;
  if (STOP_WORDS.has(normalized)) return "stop";
  if (HELP_WORDS.has(normalized)) return "help";
  if (START_WORDS.has(normalized)) return "start";
  return null;
}

/**
 * Trust Twilio's classification first when present on the webhook payload,
 * fall back to our local matcher otherwise.
 */
export function classifyInbound(opts: {
  body: string;
  twilioOptOutType?: string | null;
}): SmsKeywordKind {
  const t = opts.twilioOptOutType?.toLowerCase();
  if (t === "stop") return "stop";
  if (t === "help") return "help";
  if (t === "start") return "start";
  return classifyKeyword(opts.body);
}
