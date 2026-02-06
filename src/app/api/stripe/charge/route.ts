import { NextResponse } from "next/server";

import { MembershipsService } from "@/lib/database/memberships";
import { MembersService } from "@/lib/database/members";
import { OrganizationsService } from "@/lib/database/organizations";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { createClient } from "@/lib/supabase/server";
import {
  isStripeConfigured,
  getOrCreateStripeCustomer,
  createPaymentIntent,
  confirmPaymentIntent,
  getCustomerDefaultPaymentMethod,
  calculateFees,
  type ConnectParams,
} from "@/lib/stripe";
import { getTodayInOrgTimezone } from "@/lib/billing/invoice-generator";
import { sendPaymentReceiptEmail } from "@/lib/email/send-payment-receipt";

interface ChargeCardBody {
  membershipId: string;
  memberId: string;
  amount: number;
  description: string;
}

/**
 * POST /api/stripe/charge
 *
 * Charge a member's saved card for a one-time ad-hoc payment.
 * Creates a payment record and charges the card immediately.
 * Does NOT credit months or advance billing dates - this is purely
 * a money collection tool for things like catch-up dues, enrollment fees, etc.
 */
export async function POST(req: Request) {
  try {
    const organizationId = await getOrganizationId();

    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 503 }
      );
    }

    const { membershipId, memberId, amount, description }: ChargeCardBody =
      await req.json();

    if (!membershipId || !memberId || !amount || !description) {
      return NextResponse.json(
        { error: "membershipId, memberId, amount, and description are required" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than zero" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get membership
    const membership = await MembershipsService.getById(membershipId);
    if (!membership || membership.organizationId !== organizationId) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    // Get member
    const member = await MembersService.getById(memberId);
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Get or create customer
    let customerId = membership.stripeCustomerId;
    if (!customerId) {
      customerId = await getOrCreateStripeCustomer({
        memberId: member.id,
        membershipId: membership.id,
        email: member.email,
        name: `${member.firstName} ${member.lastName}`,
        organizationId,
      });

      await MembershipsService.update({
        id: membershipId,
        stripeCustomerId: customerId,
      });
    }

    // Check for payment method
    const paymentMethod = await getCustomerDefaultPaymentMethod(customerId);
    if (!paymentMethod) {
      return NextResponse.json(
        { error: "No payment method on file. Member needs to add a card first." },
        { status: 400 }
      );
    }

    // Get organization (for Connect config)
    const org = await OrganizationsService.getById(organizationId);
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const orgTimezone = org.timezone || "America/Los_Angeles";
    const today = getTodayInOrgTimezone(orgTimezone);

    // Calculate fees - no platform fee on ad-hoc charges
    const baseAmountCents = Math.round(amount * 100);
    const fees = calculateFees(baseAmountCents, 0, org.passFeesToMember);

    // Prepare Connect params if org has a connected account
    let connectParams: ConnectParams | undefined;
    if (org.stripeConnectId && org.stripeOnboarded) {
      connectParams = {
        stripeConnectId: org.stripeConnectId,
        applicationFeeCents: fees.applicationFeeCents,
      };
    }

    const chargeAmount = fees.breakdown.chargeAmount;
    const stripeFee = fees.breakdown.stripeFee;
    const platformFee = fees.breakdown.platformFee;
    const netAmount = fees.netAmountCents / 100;

    // Build notes
    let notes = `${description} | Charged ${paymentMethod.brand?.toUpperCase() || "Card"} •••• ${paymentMethod.last4}`;
    if (org.passFeesToMember) {
      notes += ` | Base: $${amount.toFixed(2)} + Fees: $${fees.breakdown.totalFees.toFixed(2)}`;
    }

    // Create payment record (completed immediately, no month crediting)
    const { data: newPayment, error: createError } = await supabase
      .from("payments")
      .insert({
        organization_id: organizationId,
        membership_id: membershipId,
        member_id: memberId,
        type: "back_dues",
        method: "stripe",
        status: "pending",
        amount: amount,
        stripe_fee: stripeFee,
        platform_fee: platformFee,
        total_charged: chargeAmount,
        net_amount: netAmount,
        months_credited: 0,
        due_date: today,
        period_start: today,
        period_end: today,
        period_label: description,
        notes,
      })
      .select()
      .single();

    if (createError || !newPayment) {
      return NextResponse.json(
        { error: `Failed to create payment: ${createError?.message}` },
        { status: 500 }
      );
    }

    // Create and confirm payment intent
    const { paymentIntentId } = await createPaymentIntent({
      customerId,
      amountCents: fees.chargeAmountCents,
      membershipId,
      memberId,
      organizationId,
      paymentId: newPayment.id,
      description,
      connectParams,
    });

    // Confirm with saved payment method
    const confirmation = await confirmPaymentIntent({
      paymentIntentId,
      paymentMethodId: paymentMethod.id,
    });

    if (!confirmation.succeeded) {
      // Mark payment as failed
      await supabase
        .from("payments")
        .update({
          status: "failed",
          stripe_payment_intent_id: paymentIntentId,
          notes: `${notes} - Payment failed: ${confirmation.status}`,
        })
        .eq("id", newPayment.id);

      return NextResponse.json(
        {
          error: "Payment failed",
          paymentStatus: confirmation.status,
          paymentId: newPayment.id,
        },
        { status: 400 }
      );
    }

    // Mark payment as completed
    const paidAt = new Date().toISOString();
    await supabase
      .from("payments")
      .update({
        status: "completed",
        stripe_payment_intent_id: paymentIntentId,
        paid_at: paidAt,
      })
      .eq("id", newPayment.id);

    // Send payment receipt email (best-effort)
    try {
      await sendPaymentReceiptEmail({
        to: member.email,
        memberName: `${member.firstName} ${member.lastName}`,
        memberId: member.id,
        organizationId,
        amount: `$${chargeAmount.toFixed(2)}`,
        paymentDate: paidAt,
        paymentMethod: `${paymentMethod.brand?.toUpperCase() || "Card"} •••• ${paymentMethod.last4}`,
        periodLabel: description,
        language: member.preferredLanguage || "en",
      });
    } catch (emailError) {
      console.warn("Failed to send payment receipt email:", emailError);
    }

    return NextResponse.json({
      success: true,
      paymentId: newPayment.id,
      paymentIntentId,
      amount,
    });
  } catch (error) {
    console.error("Error charging card:", error);
    const message = error instanceof Error ? error.message : "Failed to charge card";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
