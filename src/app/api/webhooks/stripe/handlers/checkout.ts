import type Stripe from "stripe";
import type { HandlerContext } from "../types";
import { logger } from "@/lib/logger";

/**
 * Handle checkout.session.completed event.
 * Processes subscription checkouts and one-time payments.
 */
export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  ctx: HandlerContext
): Promise<void> {
  const { supabase } = ctx;
  const metadata = session.metadata;

  if (!metadata?.organization_id || !metadata?.membership_id) {
    logger.error("Missing required metadata in checkout session", {
      sessionId: session.id,
      hasOrgId: !!metadata?.organization_id,
      hasMembershipId: !!metadata?.membership_id,
    });
    return;
  }

  if (session.mode === "subscription") {
    logger.info("Subscription checkout completed", {
      sessionId: session.id,
      membershipId: metadata.membership_id,
      subscriptionId: session.subscription,
    });

    // The subscription.created/updated event will handle the actual subscription setup
    // Here we just log and potentially update any checkout tracking records

    // TODO: Mark any pending checkout invites as completed
    // const { data: pendingInvites } = await supabase
    //   .from("stripe_checkout_invites")
    //   .select("id, notes")
    //   .eq("membership_id", metadata.membership_id)
    //   .eq("status", "pending");
    //
    // if (pendingInvites && pendingInvites.length > 0) {
    //   const completionNote = `Auto-pay setup completed via Stripe on ${new Date().toISOString().split("T")[0]}`;
    //   const completedAt = new Date().toISOString();
    //
    //   for (const invite of pendingInvites) {
    //     const updatedNotes = invite.notes
    //       ? `${invite.notes}\n${completionNote}`
    //       : completionNote;
    //     await supabase
    //       .from("stripe_checkout_invites")
    //       .update({
    //         status: "completed",
    //         completed_at: completedAt,
    //         notes: updatedNotes,
    //       })
    //       .eq("id", invite.id);
    //   }
    // }

    return;
  }

  if (session.mode === "payment" && session.payment_intent) {
    const intentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent.id;

    logger.info("One-time payment checkout completed", {
      sessionId: session.id,
      membershipId: metadata.membership_id,
      paymentIntentId: intentId,
    });

    // For one-time payments, link the payment intent ID to any pending payment record
    // The payment_intent.succeeded webhook will handle the actual payment creation
    // This prevents race condition duplicates

    // TODO: Link payment intent to pending payment record
    // const { data: pendingPayments } = await supabase
    //   .from("payments")
    //   .select("id")
    //   .eq("stripe_checkout_session_id", session.id)
    //   .eq("status", "pending")
    //   .limit(1);
    //
    // const pendingPayment = pendingPayments?.[0];
    //
    // if (pendingPayment) {
    //   await supabase
    //     .from("payments")
    //     .update({
    //       stripe_payment_intent_id: intentId,
    //     })
    //     .eq("id", pendingPayment.id);
    //
    //   logger.info("Linked payment intent to pending payment", {
    //     paymentId: pendingPayment.id,
    //     intentId,
    //   });
    // }

    logger.info("Checkout session completed (payment creation delegated to payment_intent.succeeded)", {
      sessionId: session.id,
      intentId,
    });
  }
}

/**
 * Handle checkout.session.expired event.
 * Marks checkout invites as expired and updates pending payment notes.
 */
export async function handleCheckoutSessionExpired(
  session: Stripe.Checkout.Session,
  ctx: HandlerContext
): Promise<void> {
  const { supabase } = ctx;
  const metadata = session.metadata;

  logger.info("Checkout session expired", {
    sessionId: session.id,
    membershipId: metadata?.membership_id,
  });

  // TODO: Mark checkout invite as expired
  // const { data: invite } = await supabase
  //   .from("stripe_checkout_invites")
  //   .select("id, status")
  //   .eq("stripe_checkout_session_id", session.id)
  //   .maybeSingle();
  //
  // if (invite && invite.status === "pending") {
  //   await supabase
  //     .from("stripe_checkout_invites")
  //     .update({
  //       status: "expired",
  //       notes: `Checkout session expired on ${new Date().toISOString().split("T")[0]}`,
  //     })
  //     .eq("id", invite.id);
  //
  //   logger.info("Marked checkout invite as expired", { sessionId: session.id });
  //   return;
  // }

  // Fallback for one-time payments tracked in payments table
  // TODO: Update pending payment with expiration note
  // const { data: pendingPayments } = await supabase
  //   .from("payments")
  //   .select("id, notes")
  //   .eq("stripe_checkout_session_id", session.id)
  //   .eq("status", "pending")
  //   .limit(1);
  //
  // const pendingPayment = pendingPayments?.[0];
  //
  // if (pendingPayment) {
  //   const expiredDate = new Date().toISOString().split("T")[0];
  //   const existingNotes = pendingPayment.notes || "";
  //   const updatedNotes = existingNotes
  //     ? `${existingNotes}\nCheckout session expired on ${expiredDate}. Use "Resend Payment Link" to generate a new link.`
  //     : `Checkout session expired on ${expiredDate}. Use "Resend Payment Link" to generate a new link.`;
  //
  //   await supabase
  //     .from("payments")
  //     .update({
  //       notes: updatedNotes,
  //     })
  //     .eq("id", pendingPayment.id);
  //
  //   logger.info("Marked checkout session as expired", { sessionId: session.id });
  // }

  logger.info("Checkout session expiration handled", { sessionId: session.id });
}
