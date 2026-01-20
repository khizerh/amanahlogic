import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  stripe,
  isStripeConfigured,
  createCustomerPortalSession,
  isStripeConfigurationError,
  isStripeResourceMissingError,
} from "@/lib/stripe";

/**
 * POST /api/portal/stripe-portal
 *
 * Creates a Stripe Customer Portal session for the authenticated member.
 * Member-facing endpoint (uses member auth, not admin auth).
 */
export async function POST() {
  try {
    // Check if Stripe is configured
    if (!isStripeConfigured() || !stripe) {
      return NextResponse.json(
        { error: "Payment system is not configured" },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get member and membership from user link
    const { data: member } = await supabase
      .from("members")
      .select("id, organization_id")
      .eq("user_id", user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Get membership with Stripe customer ID
    const { data: membership } = await supabase
      .from("memberships")
      .select("stripe_customer_id")
      .eq("member_id", member.id)
      .eq("organization_id", member.organization_id)
      .single();

    if (!membership?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No payment method on file. Contact your organization to set up payments." },
        { status: 400 }
      );
    }

    // Build return URL for member portal
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3003";
    const returnUrl = `${baseUrl}/portal/profile`;

    // Create portal session
    let portalSession;
    try {
      portalSession = await createCustomerPortalSession({
        customerId: membership.stripe_customer_id,
        returnUrl,
      });
    } catch (error) {
      if (isStripeConfigurationError(error)) {
        return NextResponse.json(
          { error: "Payment portal is not configured. Please contact support." },
          { status: 503 }
        );
      }

      if (isStripeResourceMissingError(error)) {
        return NextResponse.json(
          { error: "Payment account not found. Please contact your organization." },
          { status: 400 }
        );
      }

      throw error;
    }

    return NextResponse.json({
      success: true,
      url: portalSession.url,
    });
  } catch (error) {
    console.error("Error creating member portal session:", error);
    return NextResponse.json(
      { error: "Failed to access payment portal" },
      { status: 500 }
    );
  }
}
