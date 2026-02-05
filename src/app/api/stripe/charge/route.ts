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
import {
  generateAdHocInvoiceMetadata,
  getTodayInOrgTimezone,
  parseDateInOrgTimezone,
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

    // Get organization (for timezone and Connect config)
    const org = await OrganizationsService.getById(organizationId);
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const orgTimezone = org.timezone || "America/Los_Angeles";
    const today = getTodayInOrgTimezone(orgTimezone);

    // Calculate fees based on org's platform fee and pass-through setting
    // "amount" is the base amount (e.g., $50 dues)
    // If passFeesToMember is true, we gross-up so org receives full base amount
    const baseAmountCents = Math.round(amount * 100);
    const fees = calculateFees(baseAmountCents, org.platformFee || 0, org.passFeesToMember);

    // Prepare Connect params if org has a connected account
    let connectParams: ConnectParams | undefined;
    if (org.stripeConnectId && org.stripeOnboarded) {
      connectParams = {
        stripeConnectId: org.stripeConnectId,
        applicationFeeCents: fees.applicationFeeCents,
      };
    }

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
      let billingAnchor: string;
      if (
        membership.nextPaymentDue &&
        /^\d{4}-\d{2}-\d{2}$/.test(membership.nextPaymentDue)
      ) {
        billingAnchor = membership.nextPaymentDue;
      } else if (membership.billingAnniversaryDay) {
        const todayDate = parseDateInOrgTimezone(today, orgTimezone);
        const anniversaryDay = membership.billingAnniversaryDay;
        const lastDayOfMonth = new Date(
          todayDate.getFullYear(),
          todayDate.getMonth() + 1,
          0
        ).getDate();
        const day = Math.min(anniversaryDay, lastDayOfMonth);
        billingAnchor = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      } else {
        billingAnchor = today;
      }

      invoiceMetadata = await generateAdHocInvoiceMetadata(
        organizationId,
        billingAnchor,
        monthsCredited,
        orgTimezone,
        supabase
      );
    }

    // Payment record amounts
    // - amount: base amount (what the org conceptually charges, e.g., dues)
    // - total_charged: what the member actually pays (includes fees if passed through)
    // - net_amount: what the org receives after all fees
    const chargeAmount = fees.breakdown.chargeAmount;
    const stripeFee = fees.breakdown.stripeFee;
    const platformFee = fees.breakdown.platformFee;
    const netAmount = fees.netAmountCents / 100;

    // Build notes with fee breakdown if fees are passed to member
    let notes = `Charged ${paymentMethod.brand?.toUpperCase() || "Card"} •••• ${paymentMethod.last4}`;
    if (org.passFeesToMember) {
      notes += ` | Base: $${amount.toFixed(2)} + Fees: $${fees.breakdown.totalFees.toFixed(2)}`;
    }
    if (connectParams) {
      notes += " (via Connect)";
    }

    const { data: newPayment, error: createError } = await supabase
      .from("payments")
      .insert({
        organization_id: organizationId,
        membership_id: membershipId,
        member_id: memberId,
        type,
        method: "stripe",
        status: "pending",
        amount: amount, // Base amount (dues)
        stripe_fee: stripeFee,
        platform_fee: platformFee,
        total_charged: chargeAmount, // What member actually pays
        net_amount: netAmount, // What org receives
        months_credited: type === "enrollment_fee" ? 0 : monthsCredited,
        invoice_number: invoiceMetadata.invoiceNumber,
        due_date: invoiceMetadata.dueDate,
        period_start: invoiceMetadata.periodStart,
        period_end: invoiceMetadata.periodEnd,
        period_label: invoiceMetadata.periodLabel,
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

    // Create and confirm payment intent (with Connect if org is onboarded)
    // Use chargeAmountCents which includes fees if passFeesToMember is enabled
    const { paymentIntentId } = await createPaymentIntent({
      customerId,
      amountCents: fees.chargeAmountCents,
      membershipId,
      memberId,
      organizationId,
      paymentId: newPayment.id,
      description: org.passFeesToMember
        ? `${invoiceMetadata.periodLabel} ($${amount.toFixed(2)} + $${fees.breakdown.totalFees.toFixed(2)} fees)`
        : invoiceMetadata.periodLabel,
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
          enrollment_fee_status: "paid",
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
