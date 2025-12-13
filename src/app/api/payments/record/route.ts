import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { settlePayment } from "@/lib/billing/engine";
import {
  generateAdHocInvoiceMetadata,
  getTodayInOrgTimezone,
} from "@/lib/billing/invoice-generator";
import type { PaymentType, PaymentMethod } from "@/lib/types";

/**
 * POST /api/payments/record
 *
 * Record a manual payment (cash, check, zelle) for a membership.
 *
 * Two scenarios:
 * 1. Settling an existing pending payment (created by billing engine)
 * 2. Creating a new ad-hoc payment (enrollment fee, back dues, etc.)
 *
 * For scenario 1, we find the pending payment and settle it.
 * For scenario 2, we create a new payment record and immediately settle it.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      membershipId,
      memberId,
      organizationId,
      type, // 'enrollment_fee' | 'dues' | 'back_dues'
      method, // 'cash' | 'check' | 'zelle'
      amount,
      monthsCredited,
      checkNumber,
      zelleTransactionId,
      notes,
      recordedBy,
      // Optional: settle a specific existing pending payment
      pendingPaymentId,
    } = body as {
      membershipId: string;
      memberId: string;
      organizationId: string;
      type: PaymentType;
      method: PaymentMethod;
      amount: number;
      monthsCredited: number;
      checkNumber?: string;
      zelleTransactionId?: string;
      notes?: string;
      recordedBy?: string;
      pendingPaymentId?: string;
    };

    // Validate required fields
    if (!membershipId || !memberId || !organizationId || !type || !method || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const paidAt = new Date().toISOString();

    // Load membership with plan + billing data (used for validation + invoice anchor)
    const { data: membershipWithPlan } = await supabase
      .from("memberships")
      .select(`
        billing_frequency,
        next_payment_due,
        plan:plans(pricing)
      `)
      .eq("id", membershipId)
      .single();

    // Validate amount matches expected plan pricing (for dues payments)
    let amountWarning: string | null = null;
    if (type !== "enrollment_fee" && monthsCredited > 0) {
      if (membershipWithPlan?.plan) {
        const plan = Array.isArray(membershipWithPlan.plan)
          ? membershipWithPlan.plan[0]
          : membershipWithPlan.plan;
        const pricing = plan?.pricing as { monthly: number; biannual: number; annual: number } | undefined;

        if (pricing) {
          // Calculate expected amount based on months
          const monthlyRate = pricing.monthly;
          const expectedAmount = monthlyRate * monthsCredited;

          // Check for standard pricing shortcuts (biannual/annual)
          const biannualRate = pricing.biannual;
          const annualRate = pricing.annual;

          let bestExpectedAmount = expectedAmount;
          if (monthsCredited === 6 && biannualRate) {
            bestExpectedAmount = biannualRate;
          } else if (monthsCredited === 12 && annualRate) {
            bestExpectedAmount = annualRate;
          }

          // Warn if amount differs by more than 1% (to account for rounding)
          const variance = Math.abs(amount - bestExpectedAmount) / bestExpectedAmount;
          if (variance > 0.01) {
            amountWarning = `Amount ${amount} differs from expected ${bestExpectedAmount} for ${monthsCredited} months`;
            console.warn("Payment amount mismatch:", {
              membershipId,
              amount,
              expectedAmount: bestExpectedAmount,
              monthsCredited,
            });
          }
        }
      }
    }

    // Build notes from payment details
    let fullNotes = notes || "";
    if (method === "check" && checkNumber) {
      fullNotes = `Check #${checkNumber}${fullNotes ? ` - ${fullNotes}` : ""}`;
    } else if (method === "zelle" && zelleTransactionId) {
      fullNotes = `Zelle: ${zelleTransactionId}${fullNotes ? ` - ${fullNotes}` : ""}`;
    }

    // Scenario 1: If pendingPaymentId is provided, settle that specific payment
    if (pendingPaymentId) {
      const result = await settlePayment({
        paymentId: pendingPaymentId,
        method,
        paidAt,
        notes: fullNotes || undefined,
        recordedBy,
        supabase,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Failed to settle payment" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        paymentId: pendingPaymentId,
        membershipUpdated: result.membershipUpdated,
        newPaidMonths: result.newPaidMonths,
        newStatus: result.newStatus,
        becameEligible: result.becameEligible,
      });
    }

    // Scenario 2: Look for existing pending payment for this period, or create new one
    // First, check if there's an existing pending payment we should settle
    const { data: existingPending } = await supabase
      .from("payments")
      .select("id, amount, due_date, months_credited")
      .eq("membership_id", membershipId)
      .eq("status", "pending")
      .eq("type", type === "enrollment_fee" ? "enrollment_fee" : "dues")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPending && type === "dues") {
      // Settle the existing pending payment
      const result = await settlePayment({
        paymentId: existingPending.id,
        method,
        paidAt,
        notes: fullNotes || undefined,
        recordedBy,
        supabase,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Failed to settle existing payment" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        paymentId: existingPending.id,
        settledExisting: true,
        membershipUpdated: result.membershipUpdated,
        newPaidMonths: result.newPaidMonths,
        newStatus: result.newStatus,
        becameEligible: result.becameEligible,
        ...(amountWarning && { warning: amountWarning }),
      });
    }

    // Scenario 2b: No existing pending payment - create new one and settle immediately
    // This is used for enrollment fees, back dues, or ad-hoc payments

    // Get organization timezone for invoice metadata
    const { data: org } = await supabase
      .from("organizations")
      .select("timezone")
      .eq("id", organizationId)
      .single();

    const orgTimezone = org?.timezone || "America/Los_Angeles";
    const today = getTodayInOrgTimezone(orgTimezone);
    const billingAnchor =
      membershipWithPlan?.next_payment_due &&
      /^\d{4}-\d{2}-\d{2}$/.test(membershipWithPlan.next_payment_due)
        ? membershipWithPlan.next_payment_due
        : today;

    // Generate invoice metadata for proper tracking
    // For enrollment fees, we don't credit months so use a simple label
    let invoiceMetadata;
    if (type === "enrollment_fee") {
      invoiceMetadata = {
        invoiceNumber: null, // Enrollment fees don't get invoice numbers
        dueDate: today,
        periodStart: today,
        periodEnd: today,
        periodLabel: "Enrollment Fee",
        monthsCredited: 0,
      };
    } else {
      // For dues/back_dues, generate proper invoice metadata
      invoiceMetadata = await generateAdHocInvoiceMetadata(
        organizationId,
        billingAnchor,
        monthsCredited,
        orgTimezone,
        supabase
      );
    }

    // Create payment record with full invoice metadata
    const { data: newPayment, error: createError } = await supabase
      .from("payments")
      .insert({
        organization_id: organizationId,
        membership_id: membershipId,
        member_id: memberId,
        type,
        method, // Set method immediately since we're settling
        status: "pending", // Will be settled immediately
        amount,
        stripe_fee: 0,
        platform_fee: 0,
        total_charged: amount,
        net_amount: amount,
        months_credited: type === "enrollment_fee" ? 0 : monthsCredited,
        // Invoice metadata
        invoice_number: invoiceMetadata.invoiceNumber,
        due_date: invoiceMetadata.dueDate,
        period_start: invoiceMetadata.periodStart,
        period_end: invoiceMetadata.periodEnd,
        period_label: invoiceMetadata.periodLabel,
        // Other fields
        notes: fullNotes || null,
        recorded_by: recordedBy || null,
        paid_at: null, // Will be set by settlePayment
        check_number: checkNumber || null,
        zelle_transaction_id: zelleTransactionId || null,
      })
      .select()
      .single();

    if (createError || !newPayment) {
      return NextResponse.json(
        { error: `Failed to create payment: ${createError?.message}` },
        { status: 500 }
      );
    }

    // Now settle it immediately
    const result = await settlePayment({
      paymentId: newPayment.id,
      method,
      paidAt,
      notes: fullNotes || undefined,
      recordedBy,
      supabase,
    });

    if (!result.success) {
      // Payment was created but settlement failed - this is a partial failure
      // The payment exists but membership wasn't updated
      return NextResponse.json(
        {
          error: result.error || "Payment created but settlement failed",
          paymentId: newPayment.id,
          partialSuccess: true,
        },
        { status: 500 }
      );
    }

    // Handle enrollment fee special case - update membership.enrollment_fee_paid
    if (type === "enrollment_fee") {
      const { error: updateError } = await supabase
        .from("memberships")
        .update({
          enrollment_fee_paid: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", membershipId);

      if (updateError) {
        // Log but don't fail - the payment is recorded
        console.error("Failed to update enrollment_fee_paid:", updateError);
      }
    }

    return NextResponse.json({
      success: true,
      paymentId: newPayment.id,
      createdNew: true,
      membershipUpdated: result.membershipUpdated,
      newPaidMonths: result.newPaidMonths,
      newStatus: result.newStatus,
      becameEligible: result.becameEligible,
      ...(amountWarning && { warning: amountWarning }),
    });
  } catch (error) {
    console.error("Error recording payment:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
