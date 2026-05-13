import "server-only";
import crypto from "crypto";

/**
 * Validate a Twilio webhook request signature.
 *
 * Twilio signs `{URL}{concatenated sorted params}` with the account's master
 * Auth Token (NOT the API Key Secret) using HMAC-SHA1, base64-encoded. We
 * reject requests where the signature doesn't match — that's the only auth
 * the webhook endpoints have.
 *
 * Auth Token comes from the Twilio Console home page (Account dropdown →
 * API keys & auth tokens → Auth tokens tab). Stored as TWILIO_AUTH_TOKEN.
 *
 * Reference: https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
export function verifyTwilioSignature(opts: {
  signature: string | null | undefined;
  url: string;
  params: Record<string, string>;
}): boolean {
  const { signature, url, params } = opts;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!authToken) {
    // No way to verify — refuse to authenticate. Better to drop a request
    // than to accept a forged one. Set TWILIO_AUTH_TOKEN to enable.
    return false;
  }
  if (!signature) return false;

  // Twilio's signature algorithm:
  // 1. Take the full URL of the request (including https://)
  // 2. Append each POST parameter, sorted alphabetically by key, as `${key}${value}` concatenated
  // 3. HMAC-SHA1 with auth token as the secret
  // 4. Base64 encode
  const sortedKeys = Object.keys(params).sort();
  let payload = url;
  for (const k of sortedKeys) {
    payload += k + params[k];
  }

  const expected = crypto.createHmac("sha1", authToken).update(payload).digest("base64");

  // Constant-time compare
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/** Parse a Twilio form-encoded webhook body into a plain object. */
export async function parseTwilioFormBody(req: Request): Promise<Record<string, string>> {
  const text = await req.text();
  const params = new URLSearchParams(text);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

/** Reconstruct the full URL Twilio used to compute the signature. */
export function getWebhookUrl(req: Request): string {
  // Vercel sets x-forwarded-proto. Local dev uses http.
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("host");
  const url = new URL(req.url);
  return `${proto}://${host}${url.pathname}${url.search}`;
}
