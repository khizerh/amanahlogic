import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { settlePayment } from "@/lib/billing/engine";
import {
  generateAdHocInvoiceMetadata,
  getTodayInOrgTimezone,
} from "@/lib/billing/invoice-generator";
import { OnboardingInvitesService } from "@/lib/database/onboarding-invites";
import type { PaymentMethod } from "@/lib/types";

/**
 * POST /api/payments/record-onboarding
 *
 * Record onboarding payment(s) for a new member.
 * Handles enrollment fee + first dues in a single transaction.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      organizationId,
      membershipId,
      memberId,
      inviteId,
      paymentOption, // 'both' | 'enrollment_only' | 'dues_only'
      enrollmentFeeAmount,
      duesAmount,
      method, // 'cash' | 'check' | 'zelle'
      checkNumber,
      zelleTransactionId,
      notes,
    } = body as {
      organizationId: string;
      membershipId: string;
      memberId: string;
      inviteId: string;
      paymentOption: "both" | "enrollment_only" | "dues_only";
      enrollmentFeeAmount: number;
      duesAmount: number;
      method: PaymentMethod;
      checkNumber?: string;
      zelleTransactionId?: string;
      notes?: string;
    };

    // Validate required fields
    if (!organizationId || !membershipId || !memberId || !inviteId || !paymentOption || !method) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const paidAt = new Date().toISOString();

    // Build notes
    let fullNotes = notes || "";
    if (method === "check" && checkNumber) {
      fullNotes = `Check #${checkNumber}${fullNotes ? ` - ${fullNotes}` : ""}`;
    } else if (method === "zelle" && zelleTransactionId) {
      fullNotes = `Zelle: ${zelleTransactionId}${fullNotes ? ` - ${fullNotes}` : ""}`;
    }

    // Get organization timezone
    const { data: org } = await supabase
      .from("organizations")
      .select("timezone")
      .eq("id", organizationId)
      .single();

    const orgTimezone = org?.timezone || "America/Los_Angeles";
    const today = getTodayInOrgTimezone(orgTimezone);

    const results = {
      enrollmentFeeRecorded: false,
      duesRecorded: false,
      enrollmentPaymentId: null as string | null,
      duesPaymentId: null as string | null,
      newPaidMonths: 0,
      becameEligible: false,
    };

    // Record enrollment fee if needed
    if (paymentOption === "both" || paymentOption === "enrollment_only") {
      if (enrollmentFeeAmount > 0) {
        // Create enrollment fee payment
        const { data: enrollmentPayment, error: enrollmentError } = await supabase
          .from("payments")
          .insert({
            organization_id: organizationId,
            membership_id: membershipId,
            member_id: memberId,
            type: "enrollment_fee",
            method,
            status: "pending",
            amount: enrollmentFeeAmount,
            stripe_fee: 0,
            platform_fee: 0,
            total_charged: enrollmentFeeAmount,
            net_amount: enrollmentFeeAmount,
            months_credited: 0,
            due_date: today,
            period_start: today,
            period_end: today,
            period_label: "Enrollment Fee",
            notes: fullNotes || null,
            check_number: checkNumber || null,
            zelle_transaction_id: zelleTransactionId || null,
          })
          .select()
          .single();

        if (enrollmentError) {
          return NextResponse.json(
            { error: `Failed to create enrollment fee payment: ${enrollmentError.message}` },
            { status: 500 }
          );
        }

        // Settle it
        const settleResult = await settlePayment({
          paymentId: enrollmentPayment.id,
          method,
          paidAt,
          notes: fullNotes || undefined,
          supabase,
        });

        if (settleResult.success) {
          results.enrollmentFeeRecorded = true;
          results.enrollmentPaymentId = enrollmentPayment.id;

          // Update membership enrollment_fee_paid flag
          await supabase
            .from("memberships")
            .update({
              enrollment_fee_paid: true,
              updated_at: new Date().toISOString(),
            })
            .eq("id", membershipId);
        }
      } else {
        // No enrollment fee to record
        results.enrollmentFeeRecorded = true;
      }
    }

    // Record dues if needed
    if (paymentOption === "both" || paymentOption === "dues_only") {
      if (duesAmount > 0) {
        // Generate invoice metadata for dues
        const invoiceMetadata = await generateAdHocInvoiceMetadata(
          organizationId,
          today,
          1, // First month
          orgTimezone,
          supabase
        );

        // Create dues payment
        const { data: duesPayment, error: duesError } = await supabase
          .from("payments")
          .insert({
            organization_id: organizationId,
            membership_id: membershipId,
            member_id: memberId,
            type: "dues",
            method,
            status: "pending",
            amount: duesAmount,
            stripe_fee: 0,
            platform_fee: 0,
            total_charged: duesAmount,
            net_amount: duesAmount,
            months_credited: 1,
            invoice_number: invoiceMetadata.invoiceNumber,
            due_date: invoiceMetadata.dueDate,
            period_start: invoiceMetadata.periodStart,
            period_end: invoiceMetadata.periodEnd,
            period_label: invoiceMetadata.periodLabel,
            notes: fullNotes || null,
            check_number: checkNumber || null,
            zelle_transaction_id: zelleTransactionId || null,
          })
          .select()
          .single();

        if (duesError) {
          return NextResponse.json(
            { error: `Failed to create dues payment: ${duesError.message}` },
            { status: 500 }
          );
        }

        // Settle it
        const settleResult = await settlePayment({
          paymentId: duesPayment.id,
          method,
          paidAt,
          notes: fullNotes || undefined,
          supabase,
        });

        if (settleResult.success) {
          results.duesRecorded = true;
          results.duesPaymentId = duesPayment.id;
          results.newPaidMonths = settleResult.newPaidMonths || 1;
          results.becameEligible = settleResult.becameEligible || false;
        }
      }
    }

    // Update onboarding invite based on what was paid
    try {
      if (paymentOption === "both") {
        await OnboardingInvitesService.recordFullPayment(inviteId, supabase);
      } else if (paymentOption === "enrollment_only") {
        await OnboardingInvitesService.recordEnrollmentFeePaid(inviteId, supabase);
      } else if (paymentOption === "dues_only") {
        await OnboardingInvitesService.recordDuesPaid(inviteId, supabase);
      }
    } catch (inviteError) {
      console.error("Failed to update onboarding invite:", inviteError);
      // Don't fail the request - payments were recorded
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("Error recording onboarding payment:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
