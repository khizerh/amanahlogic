import type Stripe from "stripe";
import type { HandlerContext } from "./types";
import { logger } from "@/lib/logger";

// Import all handlers
import {
  handleCheckoutSessionCompleted,
  handleCheckoutSessionExpired,
  handlePaymentIntentSucceeded,
  handlePaymentIntentFailed,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
} from "./handlers";

/**
 * Verify currency matches organization's expected currency
 * TODO: Implement actual currency verification when we have org.currency configured
 */
function verifyCurrency(currency: string | null | undefined, org: { currency?: string | null }, context: string): void {
  // For now, skip verification but log for visibility
  if (currency && org.currency && currency.toUpperCase() !== org.currency.toUpperCase()) {
    logger.warn("Currency mismatch detected", {
      expected: org.currency,
      actual: currency,
      context,
    });
    // TODO: Uncomment when we want to enforce currency validation
    // throw new CurrencyMismatchError(org.currency, currency.toUpperCase(), context);
  }
}

/**
 * Dispatch a Stripe event to the appropriate handler.
 *
 * Currency verification is performed here for events that involve money.
 * CurrencyMismatchError is NOT caught here - it bubbles up to route.ts
 * which handles it by marking the event as "held" for manual review.
 */
export async function handleStripeEvent(ctx: HandlerContext): Promise<void> {
  const { event, org } = ctx;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      verifyCurrency(session.currency, org, "checkout.session.completed");
      await handleCheckoutSessionCompleted(session, ctx);
      break;
    }

    case "checkout.session.expired":
      await handleCheckoutSessionExpired(event.data.object as Stripe.Checkout.Session, ctx);
      break;

    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      verifyCurrency(paymentIntent.currency, org, "payment_intent.succeeded");
      await handlePaymentIntentSucceeded(paymentIntent, ctx);
      break;
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      verifyCurrency(paymentIntent.currency, org, "payment_intent.payment_failed");
      await handlePaymentIntentFailed(paymentIntent, ctx);
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      verifyCurrency(invoice.currency, org, "invoice.paid");
      await handleInvoicePaid(invoice, ctx);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      verifyCurrency(invoice.currency, org, "invoice.payment_failed");
      await handleInvoicePaymentFailed(invoice, ctx);
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, ctx);
      break;

    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, ctx);
      break;

    default:
      logger.info("Unhandled event type", { eventType: event.type });
  }
}
