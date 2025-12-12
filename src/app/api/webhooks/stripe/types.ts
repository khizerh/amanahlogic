import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Organization data needed for webhook processing
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  stripe_secret_key: string | null;
  stripe_webhook_secret: string | null;
  currency?: string | null;
  timezone?: string | null;
}

/**
 * Shared context passed to all Stripe webhook handlers.
 * Contains everything a handler needs to process an event.
 */
export interface HandlerContext {
  event: Stripe.Event;
  organization_id: string;
  org: Organization;
  supabase: SupabaseClient;
}

/**
 * Currency mismatch error - thrown when Stripe event currency doesn't match org's expected currency.
 * This halts processing so the event can be investigated.
 *
 * NOTE: This error is caught and handled centrally in route.ts.
 * Handlers should throw this error but not catch it.
 */
export class CurrencyMismatchError extends Error {
  constructor(
    public readonly expectedCurrency: string,
    public readonly actualCurrency: string,
    public readonly context: string
  ) {
    super(`Currency mismatch in ${context}: expected ${expectedCurrency}, got ${actualCurrency}`);
    this.name = "CurrencyMismatchError";
  }
}
