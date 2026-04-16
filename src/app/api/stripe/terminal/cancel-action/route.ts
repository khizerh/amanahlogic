import { NextResponse } from "next/server";

import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { cancelReaderAction } from "@/lib/stripe/terminal";
import { isStripeConfigured } from "@/lib/stripe";

/**
 * POST /api/stripe/terminal/cancel-action
 *
 * Cancel the current action on a reader (e.g. abort a payment in progress).
 */
export async function POST(req: Request) {
  try {
    await getOrganizationId();

    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
    }

    const { readerId } = await req.json();
    if (!readerId) {
      return NextResponse.json({ error: "readerId is required" }, { status: 400 });
    }

    await cancelReaderAction(readerId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling reader action:", error);
    const message = error instanceof Error ? error.message : "Failed to cancel action";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
