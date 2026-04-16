import { NextRequest, NextResponse } from "next/server";

import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { getPaymentIntent } from "@/lib/stripe/terminal";
import { isStripeConfigured } from "@/lib/stripe";

/**
 * GET /api/stripe/terminal/payment-status?paymentIntentId=pi_xxx
 *
 * Poll the status of a Terminal PaymentIntent.
 * Called by the frontend every ~2 seconds after "Charge Now" is pressed.
 */
export async function GET(req: NextRequest) {
  try {
    await getOrganizationId();

    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
    }

    const paymentIntentId = req.nextUrl.searchParams.get("paymentIntentId");
    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "paymentIntentId query param is required" },
        { status: 400 }
      );
    }

    const pi = await getPaymentIntent(paymentIntentId);

    // Extract card details if payment succeeded
    let cardDetails: { brand: string; last4: string } | null = null;
    if (pi.status === "succeeded" && pi.latest_charge) {
      const charge = typeof pi.latest_charge === "string" ? null : pi.latest_charge;
      const pmDetails = charge?.payment_method_details;
      if (pmDetails?.type === "card_present" && pmDetails.card_present) {
        cardDetails = {
          brand: pmDetails.card_present.brand || "unknown",
          last4: pmDetails.card_present.last4 || "****",
        };
      }
    }

    return NextResponse.json({
      status: pi.status,
      paymentIntentId: pi.id,
      amount: pi.amount,
      ...(cardDetails && { cardDetails }),
      // If failed, include the error
      ...(pi.last_payment_error && {
        error: pi.last_payment_error.message || "Payment failed",
        declineCode: pi.last_payment_error.decline_code,
      }),
    });
  } catch (error) {
    console.error("Error checking payment status:", error);
    const message = error instanceof Error ? error.message : "Failed to check status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
