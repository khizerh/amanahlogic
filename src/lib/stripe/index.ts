import "server-only";

import Stripe from "stripe";

// Initialize Stripe client
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

// PINNED API VERSION - DO NOT CHANGE
// See: https://docs.stripe.com/changelog#2025-11-17.clover
export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2025-11-17.clover",
    })
  : null;

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured(): boolean {
  return stripe !== null;
}

/**
 * Get or create a Stripe customer for a member
 */
export async function getOrCreateStripeCustomer(params: {
  memberId: string;
  membershipId: string;
  email: string;
  name: string;
  organizationId: string;
}): Promise<string> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const { memberId, membershipId, email, name, organizationId } = params;

  // Search for existing customer by metadata
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    const customer = existingCustomers.data[0];
    // Update metadata if needed
    if (customer.metadata?.membership_id !== membershipId) {
      await stripe.customers.update(customer.id, {
        metadata: {
          member_id: memberId,
          membership_id: membershipId,
          organization_id: organizationId,
        },
      });
    }
    return customer.id;
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      member_id: memberId,
      membership_id: membershipId,
      organization_id: organizationId,
    },
  });

  return customer.id;
}

/**
 * Create a Stripe Customer Portal session
 */
export async function createCustomerPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const { customerId, returnUrl } = params;

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return { url: session.url };
}

/**
 * Check if a Stripe error is a configuration error (portal not set up)
 */
export function isStripeConfigurationError(error: unknown): boolean {
  if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    return error.message.includes("configuration") || error.message.includes("portal");
  }
  return false;
}

/**
 * Check if a Stripe error is a resource missing error (customer not found)
 */
export function isStripeResourceMissingError(error: unknown): boolean {
  if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    return error.message.includes("No such customer") || error.code === "resource_missing";
  }
  return false;
}
