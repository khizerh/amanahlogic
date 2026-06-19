import { NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { fetchTwilioBalance } from "@/lib/sms/balance";

/**
 * GET /api/sms/balance
 *
 * Returns the Twilio account's remaining prepaid balance for display in
 * Settings → SMS. Auth-gated to a logged-in org admin. Returns
 * { balance: null } when Twilio isn't configured or is unreachable.
 */
export async function GET() {
  try {
    await getOrganizationId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const balance = await fetchTwilioBalance();
  if (!balance) {
    return NextResponse.json({ balance: null, currency: null });
  }
  return NextResponse.json(balance);
}
