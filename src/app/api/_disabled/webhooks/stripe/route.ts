import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { CurrencyMismatchError } from "./types";
import { handleStripeEvent } from "./dispatcher";
import type { Organization } from "./types";

export const runtime = "nodejs";

/**
 * Stripe webhook events that don't require processing.
 * We acknowledge these immediately without handling.
 */
const IGNORED_EVENT_TYPES = [
  "billing_portal.configuration.created",
  "billing_portal.configuration.updated",
  "billing_portal.session.created",
  "invoice.payment_succeeded", // We use invoice.paid instead
  "invoice_payment.failed", // Deprecated event type
  "invoice_payment.paid", // Deprecated event type
];

/**
 * Resolve organization_id from Stripe event metadata or customer lookup
 */
async function resolveOrganizationId(
  event: Stripe.Event,
  supabase: ReturnType<typeof createServiceRoleClient>
): Promise<string | null> {
  // Try to get organization_id from metadata
  const eventData = event.data.object as unknown as Record<string, unknown>;
  const metadata = (eventData.metadata || {}) as Record<string, string>;

  if (metadata.organization_id) {
    return metadata.organization_id;
  }

  // Fallback: try to resolve from customer if available
  let customerId: string | null = null;

  if (eventData.customer && typeof eventData.customer === "string") {
    customerId = eventData.customer;
  }

  if (!customerId) {
    return null;
  }

  // TODO: Implement customer lookup in database
  // For now, return null - this will need to be implemented when we have real customer records
  logger.warn("Customer lookup not yet implemented", { customerId });
  return null;
}

/**
 * Load organization by ID
 * TODO: Replace with real database query
 */
async function getOrganizationById(
  organizationId: string,
  supabase: ReturnType<typeof createServiceRoleClient>
): Promise<Organization | null> {
  // TODO: Replace with real database query
  // For now, return mock data for development
  logger.warn("Using mock organization data - replace with real database query", {
    organizationId,
  });

  // Mock organization for development
  return {
    id: organizationId,
    name: "Development Organization",
    slug: "dev-org",
    stripe_secret_key: process.env.STRIPE_SECRET_KEY || null,
    stripe_webhook_secret: process.env.STRIPE_WEBHOOK_SECRET || null,
    currency: "USD",
    timezone: "America/New_York",
  };
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  // Parse the raw event first to get metadata for org lookup
  let rawEvent: Stripe.Event;
  try {
    rawEvent = JSON.parse(body) as Stripe.Event;
  } catch (error) {
    logger.error("Invalid Stripe payload JSON", { error });
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // Early return for non-actionable events
  if (IGNORED_EVENT_TYPES.includes(rawEvent.type)) {
    logger.info("Ignoring non-actionable Stripe event", { eventType: rawEvent.type });
    return NextResponse.json({ acknowledged: true }, { status: 200 });
  }

  // Resolve organization from event metadata or customer lookup
  const organization_id = await resolveOrganizationId(rawEvent, supabase);
  if (!organization_id) {
    logger.error("No organization_id in event metadata or customer lookup", {
      eventType: rawEvent.type,
    });
    return NextResponse.json({ error: "Invalid event - no organization_id" }, { status: 400 });
  }

  // Load organization and verify Stripe credentials
  const org = await getOrganizationById(organization_id, supabase);
  if (!org || !org.stripe_secret_key || !org.stripe_webhook_secret) {
    logger.warn(
      "Webhook received for organization without Stripe credentials (likely offboarded)",
      { organization_id }
    );
    return NextResponse.json({ acknowledged: true }, { status: 200 });
  }

  // Verify webhook signature with organization's Stripe credentials
  const stripe = new Stripe(org.stripe_secret_key, {
    apiVersion: "2025-11-17.clover",
    typescript: true,
  });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, org.stripe_webhook_secret);
  } catch (err) {
    logger.error("Webhook signature verification failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // TODO: Implement idempotency check
  // Check if event was already processed by looking up event.id in stripe_events table
  // For now, we skip this check during development

  // TODO: Store event as pending in stripe_events table
  // This helps with debugging and replay functionality

  // Process the event
  try {
    await handleStripeEvent({
      event,
      organization_id,
      org,
      supabase,
    });

    // TODO: Mark event as processed in stripe_events table
    return NextResponse.json({ received: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    // Currency mismatch: store event as "held" and return 200 to stop Stripe retries.
    // The event can be replayed once the org's currency configuration is fixed.
    if (err instanceof CurrencyMismatchError) {
      logger.error("Currency mismatch - event held for manual review", {
        eventId: event.id,
        eventType: event.type,
        organizationId: organization_id,
        expected: err.expectedCurrency,
        actual: err.actualCurrency,
        context: err.context,
      });

      // TODO: Mark event as held in stripe_events table
      return NextResponse.json({
        received: true,
        held: true,
        reason: "currency_mismatch",
        message: "Event stored for manual review - currency mismatch detected",
      });
    }

    // Other errors: return 500 so Stripe retries
    logger.error("Error handling webhook", { error: err });

    // TODO: Mark event as failed in stripe_events table
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
