import { NextResponse } from "next/server";

import { MembershipsService } from "@/lib/database/memberships";
import { MembersService } from "@/lib/database/members";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import {
  stripe,
  isStripeConfigured,
  getOrCreateStripeCustomer,
  createCustomerPortalSession,
  isStripeConfigurationError,
  isStripeResourceMissingError,
} from "@/lib/stripe";
import { sendPortalLinkEmail } from "@/lib/email/send-portal-link";

interface SendPortalLinkBody {
  membershipId: string;
  memberId: string;
  sendEmail?: boolean; // Default true
}

/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session and optionally sends email to member.
 * Returns the portal URL.
 */
export async function POST(req: Request) {
  try {
    const organizationId = await getOrganizationId();

    // Check if Stripe is configured
    if (!isStripeConfigured() || !stripe) {
      return NextResponse.json(
        { error: "Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment." },
        { status: 503 }
      );
    }

    const { membershipId, memberId, sendEmail = true }: SendPortalLinkBody = await req.json();

    if (!membershipId || !memberId) {
      return NextResponse.json(
        { error: "membershipId and memberId are required" },
        { status: 400 }
      );
    }

    // Validate membership belongs to org
    const membership = await MembershipsService.getById(membershipId);
    if (!membership || membership.organizationId !== organizationId) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    // Get member for email
    const member = await MembersService.getById(memberId);
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Get or create Stripe customer
    let customerId = membership.stripeCustomerId;

    if (!customerId) {
      // Create new Stripe customer
      customerId = await getOrCreateStripeCustomer({
        memberId: member.id,
        membershipId: membership.id,
        email: member.email,
        name: `${member.firstName} ${member.lastName}`,
        organizationId,
      });

      // Update membership with customer ID
      await MembershipsService.update({
        id: membership.id,
        stripeCustomerId: customerId,
      });
    }

    // Build return URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3003";
    const returnUrl = `${baseUrl}/members/${memberId}`;

    // Create portal session
    let portalSession;
    try {
      portalSession = await createCustomerPortalSession({
        customerId,
        returnUrl,
      });
    } catch (error) {
      if (isStripeConfigurationError(error)) {
        return NextResponse.json(
          {
            error:
              "Stripe Customer Portal needs to be configured. Go to Stripe Dashboard → Settings → Billing → Customer Portal and create your configuration.",
          },
          { status: 503 }
        );
      }

      if (isStripeResourceMissingError(error)) {
        // Customer doesn't exist in Stripe - clear the stale ID and try again
        await MembershipsService.update({
          id: membership.id,
          stripeCustomerId: null,
        });

        return NextResponse.json(
          {
            error:
              "Stripe customer not found. Please try again - a new customer will be created.",
          },
          { status: 400 }
        );
      }

      throw error;
    }

    // Send email if requested
    let emailResult = null;
    if (sendEmail) {
      emailResult = await sendPortalLinkEmail({
        to: member.email,
        memberName: `${member.firstName} ${member.lastName}`,
        memberId: member.id,
        organizationId,
        portalUrl: portalSession.url,
        language: member.preferredLanguage || "en",
      });

      if (!emailResult.success) {
        console.warn("Failed to send portal link email:", emailResult.error);
        // Don't fail the request - portal URL was generated successfully
      }
    }

    return NextResponse.json({
      success: true,
      portalUrl: portalSession.url,
      emailSent: emailResult?.success ?? false,
      emailLogId: emailResult?.emailLogId,
    });
  } catch (error) {
    console.error("Error creating portal session:", error);
    const message = error instanceof Error ? error.message : "Failed to create portal session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
