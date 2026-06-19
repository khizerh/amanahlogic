import "server-only";

/**
 * Twilio account balance (prepaid funds remaining).
 *
 * Reads the Balance resource:
 *   GET /2010-04-01/Accounts/{AccountSid}/Balance.json  ->  { balance, currency }
 *
 * Auth: prefers the Standard API Key (consistent with the send path); falls
 * back to the master Auth Token. Returns null on any failure so callers can
 * render gracefully without the page hard-failing if Twilio is unreachable or
 * not configured.
 *
 * Note: this is the remaining prepaid balance, not a spend/usage figure. For
 * pay-as-you-go accounts it ticks down as messages are sent.
 */
export interface TwilioBalance {
  balance: string; // decimal string, e.g. "23.4567"
  currency: string; // e.g. "USD"
}

export async function fetchTwilioBalance(): Promise<TwilioBalance | null> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid) return null;

  let auth: string;
  if (apiKeySid && apiKeySecret) {
    auth = Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString("base64");
  } else if (authToken) {
    auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  } else {
    return null;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Balance.json`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { balance?: string; currency?: string };
    if (json.balance == null) return null;
    return { balance: json.balance, currency: json.currency || "USD" };
  } catch {
    return null;
  }
}
