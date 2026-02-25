import { NextResponse } from "next/server";

import { MembershipsService } from "@/lib/database/memberships";
import { MembersService } from "@/lib/database/members";
import { PlansService } from "@/lib/database/plans";
import { OrganizationsService } from "@/lib/database/organizations";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import {
  isStripeConfigured,
  stripe,
  getOrCreateStripeCustomer,
  getCustomerDefaultPaymentMethod,
  createMembershipSubscription,
  createSetupIntent,
  calculateFees,
  getPlatformFee,
  cancelSubscription,
} from "@/lib/stripe";
import { sendPaymentSetupEmail } from "@/lib/email";
import type { BillingFrequency } from "@/lib/types";

interface AssignPayerBody {
  membershipId: string;
  payerMemberId: string;
}

interface RemovePayerBody {
  membershipId: string;
}

/**
 * POST /api/memberships/payer — Assign a payer to a membership and set up auto-pay
 */
export async function POST(req: Request) {
  try {
    const organizationId = await getOrganizationId();

    if (!isStripeConfigured() || !stripe) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 503 }
      );
    }

    const { membershipId, payerMemberId }: AssignPayerBody = await req.json();

    if (!membershipId || !payerMemberId) {
      return NextResponse.json(
        { error: "membershipId and payerMemberId are required" },
        { status: 400 }
      );
    }

    // Get beneficiary's membership
    const membership = await MembershipsService.getById(membershipId);
    if (!membership || membership.organizationId !== organizationId) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    // Get beneficiary member
    const beneficiary = await MembersService.getById(membership.memberId);
    if (!beneficiary) {
      return NextResponse.json({ error: "Beneficiary member not found" }, { status: 404 });
    }

    // Get payer member
    const payer = await MembersService.getById(payerMemberId);
    if (!payer || payer.organizationId !== organizationId) {
      return NextResponse.json({ error: "Payer member not found in this organization" }, { status: 404 });
    }

    // Validation: payer ≠ beneficiary
    if (payerMemberId === membership.memberId) {
      return NextResponse.json(
        { error: "A member cannot be their own payer" },
        { status: 400 }
      );
    }

    // Validation: beneficiary doesn't already have auto-pay enabled
    if (membership.autoPayEnabled && membership.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "Member already has auto-pay enabled. Switch to manual first." },
        { status: 400 }
      );
    }

    // Validation: beneficiary doesn't already have a payer
    if (membership.payerMemberId) {
      return NextResponse.json(
        { error: "Member already has a payer assigned. Remove existing payer first." },
        { status: 400 }
      );
    }

    // Validation: payer is not paid-for by someone else (no chain-paying)
    const payerMembership = await MembershipsService.getByMemberId(payerMemberId);
    if (payerMembership?.payerMemberId) {
      return NextResponse.json(
        { error: "Cannot assign a payer who is paid for by another member" },
        { status: 400 }
      );
    }

    // Validation: beneficiary is not already a payer for others (Risk #8)
    const beneficiaryPayingFor = await MembershipsService.getByPayerMemberId(
      membership.memberId,
      organizationId
    );
    if (beneficiaryPayingFor.length > 0) {
      return NextResponse.json(
        { error: "Cannot assign a payer to a member who is paying for others. Remove their payer relationships first." },
        { status: 400 }
      );
    }

    // Get plan for pricing
    const plan = await PlansService.getById(membership.planId);
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Get org for fee settings
    const org = await OrganizationsService.getById(organizationId);
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Calculate dues amount
    const billingFrequency = membership.billingFrequency || "monthly";
    let priceAmount: number;
    switch (billingFrequency) {
      case "biannual": priceAmount = plan.pricing.biannual; break;
      case "annual": priceAmount = plan.pricing.annual; break;
      default: priceAmount = plan.pricing.monthly;
    }
    const duesAmountCents = Math.round(priceAmount * 100);

    const beneficiaryName = `${beneficiary.firstName} ${beneficiary.middleName ? `${beneficiary.middleName} ` : ''}${beneficiary.lastName}`;
    const payerName = `${payer.firstName} ${payer.middleName ? `${payer.middleName} ` : ''}${payer.lastName}`;

    // Check if payer has a card on file
    const payerHasCard = payerMembership?.autoPayEnabled && payerMembership?.paymentMethod && payerMembership?.stripeCustomerId;

    if (payerHasCard && payerMembership?.stripeCustomerId) {
      // =============================================
      // PATH A: Payer has card → create subscription immediately (atomic)
      // =============================================

      // Get payer's default payment method from Stripe
      const payerPm = await getCustomerDefaultPaymentMethod(payerMembership.stripeCustomerId);
      if (!payerPm) {
        return NextResponse.json(
          { error: "Payer's card could not be found in Stripe. Please have them set up payment again." },
          { status: 400 }
        );
      }

      // Determine trial_end if beneficiary is current
      let trialEnd: number | undefined;
      if (membership.nextPaymentDue) {
        const nextDueDate = new Date(membership.nextPaymentDue);
        if (nextDueDate > new Date()) {
          trialEnd = Math.floor(nextDueDate.getTime() / 1000);
        }
      }

      // Step 1: Create Stripe subscription FIRST (atomic — no DB state until this succeeds)
      let subscription;
      try {
        const result = await createMembershipSubscription({
          customerId: payerMembership.stripeCustomerId,
          paymentMethodId: payerPm.id,
          membershipId: membership.id,
          memberId: membership.memberId,
          organizationId,
          planName: plan.name,
          duesAmountCents,
          billingFrequency: billingFrequency as "monthly" | "biannual" | "annual",
          passFeesToMember: org.passFeesToMember || false,
          platformFeeDollars: getPlatformFee(org.platformFees, billingFrequency as BillingFrequency),
          stripeConnectAccountId: org.stripeConnectId && org.stripeOnboarded ? org.stripeConnectId : undefined,
          stripeConnectOnboarded: org.stripeOnboarded,
          trialEnd,
          payerMemberId,
          payerForMemberName: beneficiaryName,
        });
        subscription = result.subscription;
      } catch (stripeError) {
        const msg = stripeError instanceof Error ? stripeError.message : "Failed to create subscription";
        return NextResponse.json(
          { error: `Stripe subscription creation failed: ${msg}` },
          { status: 400 }
        );
      }

      // Step 2: Persist all DB fields in a single update
      try {
        const isTrialing = subscription.status === "trialing";
        await MembershipsService.update({
          id: membershipId,
          payerMemberId,
          stripeCustomerId: payerMembership.stripeCustomerId,
          stripeSubscriptionId: subscription.id,
          autoPayEnabled: true,
          subscriptionStatus: isTrialing ? "trialing" : "active",
          paymentMethod: payerMembership.paymentMethod,
        });
      } catch (dbError) {
        // Compensate: cancel the just-created subscription
        console.error("[Payer] DB update failed after subscription created, cancelling subscription:", dbError);
        try {
          await stripe.subscriptions.cancel(subscription.id);
        } catch (cancelError) {
          console.error("[Payer] Failed to cancel orphaned subscription:", cancelError);
        }
        return NextResponse.json(
          { error: "Failed to save payer assignment. Subscription was rolled back." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        subscriptionCreated: true,
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
      });
    } else {
      // =============================================
      // PATH B: Payer has no card → send payment setup link
      // =============================================

      if (!payer.email) {
        return NextResponse.json(
          { error: "Payer has no email address. Cannot send payment setup link." },
          { status: 400 }
        );
      }

      // Get or create Stripe customer using PAYER's details (Risk #1)
      const payerCustomerId = await getOrCreateStripeCustomer({
        memberId: payer.id,
        membershipId: payerMembership?.id || membership.id, // Use payer's membership if they have one
        email: payer.email,
        name: payerName,
        organizationId,
      });

      // Save payer_member_id on beneficiary's membership (intentional "awaiting setup" state)
      await MembershipsService.update({
        id: membershipId,
        payerMemberId,
        stripeCustomerId: payerCustomerId,
      });

      // Determine if beneficiary is current
      const memberIsCurrent = membership.nextPaymentDue
        ? new Date(membership.nextPaymentDue) > new Date()
        : false;
      const nextPaymentDue = memberIsCurrent ? membership.nextPaymentDue : undefined;

      // Check if enrollment fee should be included
      const includeEnrollmentFee = membership.enrollmentFeeStatus === "unpaid";

      // Create SetupIntent with beneficiary's membership_id + payer metadata
      const setupResult = await createSetupIntent({
        customerId: payerCustomerId,
        membershipId: membership.id,
        memberId: membership.memberId,
        organizationId,
        planName: plan.name,
        duesAmountCents,
        enrollmentFeeAmountCents: includeEnrollmentFee ? Math.round(plan.enrollmentFee * 100) : 0,
        billingFrequency: billingFrequency as "monthly" | "biannual" | "annual",
        passFeesToMember: org.passFeesToMember || false,
        stripeConnectAccountId: org.stripeConnectId && org.stripeOnboarded ? org.stripeConnectId : undefined,
        memberIsCurrent,
        nextPaymentDue: nextPaymentDue || undefined,
        payerMemberId,
        payerForMemberName: beneficiaryName,
      });

      // Send payment setup email to PAYER
      const fees = calculateFees(
        duesAmountCents,
        getPlatformFee(org.platformFees, billingFrequency as BillingFrequency),
        org.passFeesToMember || false
      );

      await sendPaymentSetupEmail({
        to: payer.email,
        memberName: payer.firstName, // Payer's name for greeting
        memberId: payer.id,
        organizationId,
        checkoutUrl: setupResult.url,
        planName: plan.name,
        duesAmount: fees.chargeAmountCents / 100,
        billingFrequency,
        language: payer.preferredLanguage || "en",
        payingForName: beneficiaryName,
      });

      return NextResponse.json({
        success: true,
        paymentLinkSent: true,
        paymentUrl: setupResult.url,
        payerEmail: payer.email,
      });
    }
  } catch (error) {
    console.error("Error assigning payer:", error);
    const message = error instanceof Error ? error.message : "Failed to assign payer";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/memberships/payer — Remove payer from a membership
 */
export async function DELETE(req: Request) {
  try {
    const organizationId = await getOrganizationId();

    const { membershipId }: RemovePayerBody = await req.json();

    if (!membershipId) {
      return NextResponse.json(
        { error: "membershipId is required" },
        { status: 400 }
      );
    }

    const membership = await MembershipsService.getById(membershipId);
    if (!membership || membership.organizationId !== organizationId) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    if (!membership.payerMemberId) {
      return NextResponse.json(
        { error: "This membership does not have a payer assigned" },
        { status: 400 }
      );
    }

    // Cancel Stripe subscription if it exists
    if (membership.stripeSubscriptionId) {
      try {
        await cancelSubscription(membership.stripeSubscriptionId);
      } catch (error) {
        console.warn("Failed to cancel payer subscription:", error);
        // Continue — subscription may already be cancelled or not exist
      }
    }

    // Clear all payer and Stripe fields
    await MembershipsService.update({
      id: membershipId,
      payerMemberId: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      autoPayEnabled: false,
      subscriptionStatus: null,
      paymentMethod: null,
    });

    return NextResponse.json({
      success: true,
      message: "Payer removed and subscription cancelled",
    });
  } catch (error) {
    console.error("Error removing payer:", error);
    const message = error instanceof Error ? error.message : "Failed to remove payer";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
