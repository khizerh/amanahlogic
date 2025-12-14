import { NextResponse } from "next/server";

import { MembershipsService } from "@/lib/database/memberships";
import { MembersService } from "@/lib/database/members";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { createClient } from "@/lib/supabase/server";
import {
  isStripeConfigured,
  getOrCreateStripeCustomer,
  createPaymentIntent,
  confirmPaymentIntent,
  getCustomerDefaultPaymentMethod,
} from "@/lib/stripe";
import {
  generateAdHocInvoiceMetadata,
  getTodayInOrgTimezone,
} from "@/lib/billing/invoice-generator";
import { settlePayment } from "@/lib/billing/engine";
import type { PaymentType } from "@/lib/types";

interface ChargeCardBody {
  membershipId: string;
  memberId: string;
  type: PaymentType;
  amount: number;
  monthsCredited: number;
}

/**
 * POST /api/stripe/charge
 *
 * Charge a member's saved card for a one-time payment.
 * Creates a payment record and charges the card immediately.
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

    const { membershipId, memberId, type, amount, monthsCredited }: ChargeCardBody =
      await req.json();

    if (!membershipId || !memberId || !type || !amount) {
      return NextResponse.json(
        { error: "membershipId, memberId, type, and amount are required" },
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

    // Get organization timezone
    const { data: org } = await supabase
      .from("organizations")
      .select("timezone")
      .eq("id", organizationId)
      .single();

    const orgTimezone = org?.timezone || "America/Los_Angeles";
    const today = getTodayInOrgTimezone(orgTimezone);

    // Generate invoice metadata
    let invoiceMetadata;
    if (type === "enrollment_fee") {
      invoiceMetadata = {
        invoiceNumber: null,
        dueDate: today,
        periodStart: today,
        periodEnd: today,
        periodLabel: "Enrollment Fee",
        monthsCredited: 0,
      };
    } else {
      const billingAnchor =
        membership.nextPaymentDue && /^\d{4}-\d{2}-\d{2}$/.test(membership.nextPaymentDue)
          ? membership.nextPaymentDue
          : today;

      invoiceMetadata = await generateAdHocInvoiceMetadata(
        organizationId,
        billingAnchor,
        monthsCredited,
        orgTimezone,
        supabase
      );
    }

    // Create payment record (pending)
    const { data: newPayment, error: createError } = await supabase
      .from("payments")
      .insert({
        organization_id: organizationId,
        membership_id: membershipId,
        member_id: memberId,
        type,
        method: "stripe",
        status: "pending",
        amount,
        stripe_fee: parseFloat((amount * 0.029 + 0.3).toFixed(2)),
        platform_fee: 1.0,
        total_charged: amount + parseFloat((amount * 0.029 + 0.3).toFixed(2)),
        net_amount: amount - 1.0,
        months_credited: type === "enrollment_fee" ? 0 : monthsCredited,
        invoice_number: invoiceMetadata.invoiceNumber,
        due_date: invoiceMetadata.dueDate,
        period_start: invoiceMetadata.periodStart,
        period_end: invoiceMetadata.periodEnd,
        period_label: invoiceMetadata.periodLabel,
        notes: `Charged ${paymentMethod.brand?.toUpperCase() || "Card"} •••• ${paymentMethod.last4}`,
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
    const amountCents = Math.round(amount * 100);
    const { paymentIntentId } = await createPaymentIntent({
      customerId,
      amountCents,
      membershipId,
      memberId,
      organizationId,
      paymentId: newPayment.id,
      description: invoiceMetadata.periodLabel,
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
          notes: `${newPayment.notes} - Payment failed: ${confirmation.status}`,
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

    // Update payment with intent ID
    await supabase
      .from("payments")
      .update({
        stripe_payment_intent_id: paymentIntentId,
      })
      .eq("id", newPayment.id);

    // Settle the payment
    const result = await settlePayment({
      paymentId: newPayment.id,
      method: "stripe",
      paidAt: new Date().toISOString(),
      stripePaymentIntentId: paymentIntentId,
      supabase,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || "Payment charged but settlement failed",
          paymentId: newPayment.id,
          partialSuccess: true,
        },
        { status: 500 }
      );
    }

    // Handle enrollment fee
    if (type === "enrollment_fee") {
      await supabase
        .from("memberships")
        .update({
          enrollment_fee_paid: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", membershipId);
    }

    return NextResponse.json({
      success: true,
      paymentId: newPayment.id,
      paymentIntentId,
      amount,
      newPaidMonths: result.newPaidMonths,
      newStatus: result.newStatus,
      becameEligible: result.becameEligible,
    });
  } catch (error) {
    console.error("Error charging card:", error);
    const message = error instanceof Error ? error.message : "Failed to charge card";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
