/**
 * Receipt email logic
 * @module lib/payments/receipt
 */

import "server-only";

import { logger } from "@imarah/logger";
import { PaymentsService } from "@/lib/database/payments";
import { loadEnrollmentEmailContext, resolveRecipient } from "@/lib/email/context";
import { queueEmail } from "@/lib/email/queue";
import type { PaymentActionResult } from "./types";

export interface SendReceiptEmailParams {
  payment_id: string;
  organization_id: string;
}

export interface SendReceiptEmailResult {
  recipientEmail: string;
}

/**
 * Send a payment receipt email to the family/student
 * Can be used to resend receipts for succeeded payments
 */
export async function sendReceiptEmailLogic({
  payment_id,
  organization_id,
}: SendReceiptEmailParams): Promise<
  PaymentActionResult<SendReceiptEmailResult> & { message?: string }
> {
  // Get the payment details
  const payment = await PaymentsService.getById(payment_id);
  if (!payment) {
    return { success: false, error: "Payment not found" };
  }

  // Verify payment belongs to organization
  if (payment.organization_id !== organization_id) {
    return { success: false, error: "Payment not found" };
  }

  // Only send receipts for succeeded payments
  if (payment.status !== "succeeded") {
    return { success: false, error: "Can only send receipts for completed payments" };
  }

  // Need enrollment_id to load context
  if (!payment.enrollment_id) {
    return { success: false, error: "Payment is not linked to an enrollment" };
  }

  // Load enrollment context for recipient resolution
  const context = await loadEnrollmentEmailContext({
    enrollment_id: payment.enrollment_id,
    organization_id: payment.organization_id,
  });

  if (!context) {
    return { success: false, error: "Unable to load enrollment details" };
  }

  // Resolve the email recipient
  const recipient = resolveRecipient(context);
  if (!recipient) {
    return { success: false, error: "No valid email recipient found for this family" };
  }

  // Determine the template based on payment source
  const templateName =
    payment.payment_source === "stripe" ? "payment-receipt-stripe" : "payment-receipt-manual";

  // Queue the receipt email
  await queueEmail({
    organization_id: payment.organization_id,
    template_name: templateName,
    payload: {
      recipient_email: recipient.email,
      recipient_name: recipient.name,
      is_student_recipient: recipient.isStudent,
      student_name: context.student.name,
      program_name: context.enrollment.program_name,
      amount: payment.amount,
      paid_at: payment.paid_at,
      payment_method:
        payment.payment_method ?? (payment.payment_source === "stripe" ? "Card" : "cash"),
      invoice_number: payment.invoice_number,
      period_label: payment.period_label,
      organization_name: context.masjid.name,
      organization_slug: context.masjid.slug,
      organization_address: context.masjid.address,
      organization_phone: context.masjid.phone,
      organization_email: context.masjid.email,
      subject: recipient.isStudent
        ? `Receipt for your tuition payment`
        : `Receipt for ${context.student.name}'s tuition`,
      enrollment_id: context.enrollment.id,
      payment_id: payment.id,
      family_id: context.family.id,
    },
  });

  logger.info(
    "Receipt email queued successfully",
    {
      paymentId: payment.id,
      recipientEmail: recipient.email,
      templateName,
    },
    "payments"
  );

  return {
    success: true,
    message: `Receipt sent to ${recipient.email}`,
    data: { recipientEmail: recipient.email },
  };
}

/**
 * Queue payment receipt email after payment succeeds
 * Used internally by markPaymentSucceeded
 */
export async function queuePaymentReceiptEmail({
  payment,
  organization_id,
}: {
  payment: {
    id: string;
    enrollment_id: string;
    organization_id: string;
    amount: number;
    paid_at?: string | null;
    payment_method?: string | null;
    invoice_number?: string | null;
    period_label?: string | null;
    payment_source: string;
  };
  organization_id: string;
}): Promise<void> {
  try {
    const context = await loadEnrollmentEmailContext({
      enrollment_id: payment.enrollment_id,
      organization_id: payment.organization_id,
    });

    if (context) {
      const recipient = resolveRecipient(context);
      if (recipient) {
        await queueEmail({
          organization_id: payment.organization_id,
          template_name: "payment-receipt-manual",
          payload: {
            recipient_email: recipient.email,
            recipient_name: recipient.name,
            is_student_recipient: recipient.isStudent,
            student_name: context.student.name,
            program_name: context.enrollment.program_name,
            amount: payment.amount,
            paid_at: payment.paid_at,
            payment_method: payment.payment_method ?? "cash",
            invoice_number: payment.invoice_number,
            period_label: payment.period_label,
            masjid_name: context.masjid.name,
            organization_slug: context.masjid.slug,
            masjid_address: context.masjid.address,
            masjid_phone: context.masjid.phone,
            masjid_email: context.masjid.email,
            subject: `Receipt for ${context.student.name}'s tuition`,
            enrollment_id: context.enrollment.id,
            payment_id: payment.id,
            family_id: context.family.id,
            org_country: context.masjid.country,
            org_currency: context.masjid.currency,
            org_timezone: context.masjid.timezone,
          },
        });
      }
    }
  } catch (queueError) {
    logger.error(
      "Failed to queue manual payment receipt email",
      {
        error: queueError instanceof Error ? queueError.message : String(queueError),
        paymentId: payment.id,
      },
      "payments"
    );
    // Don't throw - caller can continue
  }
}

/**
 * Queue invoice email when a manual payment is created in pending state
 */
export async function queueInvoiceEmailForPayment({
  payment,
  organization_id,
}: {
  payment: {
    id: string;
    enrollment_id: string;
  };
  organization_id: string;
}): Promise<void> {
  const { queueInvoiceEmail } = await import("@/lib/billing/email-queue");
  const { createServiceRoleClient } = await import("@/lib/supabase/server");

  try {
    const context = await loadEnrollmentEmailContext({
      enrollment_id: payment.enrollment_id,
      organization_id,
    });

    if (context) {
      await queueInvoiceEmail(
        payment.id,
        {
          id: context.enrollment.id,
          organization_id,
          family_id: context.family.id,
          student: { name: context.student.name },
          program: { name: context.enrollment.program_name },
          family: {
            family_name: context.family.family_name,
            father_email: context.family.father_email,
            mother_email: context.family.mother_email,
            primary_contact_type: context.family.primary_contact_type,
          },
        },
        createServiceRoleClient()
      );
    }
  } catch (queueError) {
    logger.error(
      "Failed to queue manual invoice email",
      {
        error: queueError instanceof Error ? queueError.message : String(queueError),
        paymentId: payment.id,
      },
      "payments"
    );
    // Don't throw - caller can continue
  }
}
