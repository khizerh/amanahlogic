import { NextResponse } from "next/server";

import { MembershipsService } from "@/lib/database/memberships";
import { MembersService } from "@/lib/database/members";
import { PlansService } from "@/lib/database/plans";
import { OrganizationsService } from "@/lib/database/organizations";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import {
  isStripeConfigured,
  getOrCreateStripeCustomer,
  createMembershipSubscription,
  calculateFees,
  getPlatformFee,
  stripe,
} from "@/lib/stripe";
import { getReusablePaymentMethod } from "@/lib/stripe/terminal";
import { settlePayment } from "@/lib/billing/engine";
import {
  generateAdHocInvoiceMetadata,
  getTodayInOrgTimezone,
} from "@/lib/billing/invoice-generator";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { BillingFrequency, PlatformFees } from "@/lib/types";

interface CompleteEnrollmentBody {
  paymentIntentId: string;
  membershipId: string;
  memberId: string;
}

/**
 * POST /api/stripe/terminal/complete-enrollment
 *
 * Called after Terminal payment succeeds. This route:
 * 1. Clones the card_present payment method to a reusable card
 * 2. Creates/gets a Stripe customer
 * 3. Attaches the reusable payment method
 * 4. Creates a subscription with trial_end (first period already paid)
 * 5. Records the payment and credits months
 * 6. Activates the membership
 */
export async function POST(req: Request) {
  try {
    const organizationId = await getOrganizationId();

    if (!isStripeConfigured() || !stripe) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
    }

    const { paymentIntentId, membershipId, memberId }: CompleteEnrollmentBody =
      await req.json();

    if (!paymentIntentId || !membershipId || !memberId) {
      return NextResponse.json(
        { error: "paymentIntentId, membershipId, and memberId are required" },
        { status: 400 }
      );
    }

    // Load all needed data
    const [membership, member, org] = await Promise.all([
      MembershipsService.getById(membershipId),
      MembersService.getById(memberId),
      OrganizationsService.getById(organizationId),
    ]);

    if (!membership || membership.organizationId !== organizationId) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const plan = await PlansService.getById(membership.planId);
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const billingFrequency = (membership.billingFrequency || "monthly") as BillingFrequency;
    const duesAmount = plan.pricing[billingFrequency] || plan.pricing.monthly;
    const duesAmountCents = Math.round(duesAmount * 100);
    const platformFeeDollars = getPlatformFee(
      org.platformFees as PlatformFees | null,
      billingFrequency
    );

    // Retrieve the PaymentIntent to verify it succeeded
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== "succeeded") {
      return NextResponse.json(
        { error: `Payment not complete (status: ${pi.status})` },
        { status: 400 }
      );
    }

    // Parse metadata to determine if enrollment fee was included
    const includeEnrollmentFee = pi.metadata.include_enrollment_fee === "true";
    const enrollmentFeeCents = parseInt(pi.metadata.enrollment_fee_amount_cents || "0", 10);

    // Step 1: Get reusable payment method from the Terminal charge
    const { paymentMethodId, last4, brand } = await getReusablePaymentMethod(paymentIntentId);

    // Step 2: Get or create Stripe customer
    const memberName = `${member.firstName} ${member.middleName ? `${member.middleName} ` : ""}${member.lastName}`;
    const customerId = await getOrCreateStripeCustomer({
      memberId: member.id,
      membershipId: membership.id,
      email: member.email || undefined,
      name: memberName,
      organizationId,
    });

    // Step 3: Attach the reusable payment method and set as default
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // Step 4: Calculate when subscription should start (first period already paid)
    const orgTimezone = org.timezone || "America/Los_Angeles";
    const today = getTodayInOrgTimezone(orgTimezone);
    let monthsCredited: number;
    switch (billingFrequency) {
      case "monthly": monthsCredited = 1; break;
      case "biannual": monthsCredited = 6; break;
      case "annual": monthsCredited = 12; break;
      default: monthsCredited = 1;
    }

    // trial_end = today + months credited (first charge already paid at Terminal)
    const trialEndDate = new Date(today + "T00:00:00Z");
    trialEndDate.setMonth(trialEndDate.getMonth() + monthsCredited);
    const trialEnd = Math.floor(trialEndDate.getTime() / 1000);

    // Ensure trial_end is at least 48 hours in the future (Stripe requirement)
    const minTrialEnd = Math.floor(Date.now() / 1000) + 48 * 3600;
    const effectiveTrialEnd = Math.max(trialEnd, minTrialEnd);

    // Step 5: Create subscription for recurring billing
    const connectId = org.stripeConnectId && org.stripeOnboarded ? org.stripeConnectId : undefined;
    const { subscription } = await createMembershipSubscription({
      customerId,
      paymentMethodId,
      membershipId: membership.id,
      memberId: member.id,
      organizationId,
      planName: plan.name,
      duesAmountCents,
      billingFrequency,
      passFeesToMember: org.passFeesToMember,
      platformFeeDollars,
      stripeConnectAccountId: connectId,
      stripeConnectOnboarded: org.stripeOnboarded,
      trialEnd: effectiveTrialEnd,
    });

    // Step 6: Record payment records and credit membership
    const supabase = createServiceRoleClient();
    const duesFees = calculateFees(duesAmountCents, platformFeeDollars, org.passFeesToMember);

    // Determine billing anniversary day from today
    const todayDate = new Date(today + "T00:00:00Z");
    const billingAnniversaryDay = Math.min(todayDate.getDate(), 28);

    // Generate invoice metadata for the dues payment
    const invoiceMetadata = await generateAdHocInvoiceMetadata(
      organizationId,
      today,
      monthsCredited,
      orgTimezone,
      supabase
    );

    // Create dues payment record
    const { data: duesPayment, error: duesPaymentErr } = await supabase
      .from("payments")
      .insert({
        organization_id: organizationId,
        membership_id: membershipId,
        member_id: memberId,
        type: "dues",
        method: "stripe",
        status: "pending",
        amount: duesAmount,
        stripe_fee: duesFees.breakdown.stripeFee,
        platform_fee: duesFees.breakdown.platformFee,
        total_charged: duesFees.breakdown.chargeAmount,
        net_amount: duesFees.netAmountCents / 100,
        months_credited: monthsCredited,
        invoice_number: invoiceMetadata.invoiceNumber,
        due_date: invoiceMetadata.dueDate,
        period_start: invoiceMetadata.periodStart,
        period_end: invoiceMetadata.periodEnd,
        period_label: invoiceMetadata.periodLabel,
        stripe_payment_intent_id: paymentIntentId,
        stripe_payment_method_type: "card_present",
        notes: "In-person payment via Terminal",
      })
      .select()
      .single();

    if (duesPaymentErr || !duesPayment) {
      console.error("Failed to create dues payment record:", duesPaymentErr);
      // Don't fail — subscription is already created
    }

    // Settle the dues payment (credits months, updates next_payment_due)
    let settleResult = null;
    if (duesPayment) {
      settleResult = await settlePayment({
        paymentId: duesPayment.id,
        method: "stripe",
        paidAt: new Date().toISOString(),
        notes: "In-person payment via Terminal",
        supabase,
      });
    }

    // Handle enrollment fee payment record if applicable
    if (includeEnrollmentFee && enrollmentFeeCents > 0) {
      const enrollFees = calculateFees(enrollmentFeeCents, platformFeeDollars, org.passFeesToMember);

      await supabase.from("payments").insert({
        organization_id: organizationId,
        membership_id: membershipId,
        member_id: memberId,
        type: "enrollment_fee",
        method: "stripe",
        status: "completed",
        amount: enrollmentFeeCents / 100,
        stripe_fee: enrollFees.breakdown.stripeFee,
        platform_fee: enrollFees.breakdown.platformFee,
        total_charged: enrollFees.breakdown.chargeAmount,
        net_amount: enrollFees.netAmountCents / 100,
        months_credited: 0,
        stripe_payment_intent_id: paymentIntentId,
        stripe_payment_method_type: "card_present",
        notes: "Enrollment fee collected in-person via Terminal",
        paid_at: new Date().toISOString(),
      });
    }

    // Step 7: Update membership with subscription + payment details
    const subscriptionDay = Math.min(todayDate.getDate(), 28);
    await MembershipsService.update({
      id: membershipId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status === "trialing" ? "trialing" : "active",
      autoPayEnabled: true,
      billingAnniversaryDay: subscriptionDay,
      paymentMethod: {
        type: "card",
        last4,
        brand,
      },
      ...(includeEnrollmentFee && { enrollmentFeeStatus: "paid" as const }),
    });

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      paymentMethodLast4: last4,
      paymentMethodBrand: brand,
      monthsCredited,
      membershipStatus: settleResult?.newStatus || "current",
      paidMonths: settleResult?.newPaidMonths,
      becameEligible: settleResult?.becameEligible || false,
    });
  } catch (error) {
    console.error("Error completing Terminal enrollment:", error);
    const message = error instanceof Error ? error.message : "Failed to complete enrollment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
