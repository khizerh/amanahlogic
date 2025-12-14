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
 *
 * IMPORTANT: Customer lookup is scoped to organization to prevent cross-org issues.
 * We search by membership_id in metadata first, then fallback to email within same org.
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

  // First, search for existing customer by membership_id metadata (most reliable)
  const customersByMembership = await stripe.customers.search({
    query: `metadata["membership_id"]:"${membershipId}"`,
    limit: 1,
  });

  if (customersByMembership.data.length > 0) {
    const customer = customersByMembership.data[0];
    // Verify it's the same org (safety check)
    if (customer.metadata?.organization_id === organizationId) {
      return customer.id;
    }
    // Different org - don't reuse, fall through to create new
    console.warn(`[Stripe] Customer ${customer.id} has different org, creating new customer`);
  }

  // Second, search by organization_id + member_id (cross-membership same member)
  const customersByMember = await stripe.customers.search({
    query: `metadata["organization_id"]:"${organizationId}" AND metadata["member_id"]:"${memberId}"`,
    limit: 1,
  });

  if (customersByMember.data.length > 0) {
    const customer = customersByMember.data[0];
    // Update metadata to include current membership
    await stripe.customers.update(customer.id, {
      metadata: {
        member_id: memberId,
        membership_id: membershipId,
        organization_id: organizationId,
      },
    });
    return customer.id;
  }

  // No existing customer found - create new one
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

/**
 * Billing frequency type for Stripe subscriptions
 */
type StripeBillingFrequency = "monthly" | "biannual" | "annual";

/**
 * Create a Stripe Checkout Session for subscription setup
 *
 * IMPORTANT: Respects the membership's billing frequency.
 * - monthly: Bills every month
 * - biannual: Bills every 6 months
 * - annual: Bills every 12 months
 */
export async function createSubscriptionCheckoutSession(params: {
  customerId: string;
  priceAmountCents: number;
  membershipId: string;
  memberId: string;
  organizationId: string;
  successUrl: string;
  cancelUrl: string;
  billingAnchorDay?: number;
  billingFrequency?: StripeBillingFrequency;
  planName?: string;
}): Promise<{ url: string; sessionId: string }> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const {
    customerId,
    priceAmountCents,
    membershipId,
    memberId,
    organizationId,
    successUrl,
    cancelUrl,
    billingAnchorDay,
    billingFrequency = "monthly",
    planName = "Membership",
  } = params;

  // Determine Stripe interval based on billing frequency
  let interval: "month" | "year" = "month";
  let intervalCount = 1;
  let description = "Monthly membership dues";

  switch (billingFrequency) {
    case "monthly":
      interval = "month";
      intervalCount = 1;
      description = "Monthly membership dues";
      break;
    case "biannual":
      interval = "month";
      intervalCount = 6;
      description = "Biannual membership dues (every 6 months)";
      break;
    case "annual":
      interval = "year";
      intervalCount = 1;
      description = "Annual membership dues";
      break;
  }

  // Create an ad-hoc price for this subscription
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${planName} Dues`,
            description: description,
          },
          unit_amount: priceAmountCents,
          recurring: {
            interval: interval,
            interval_count: intervalCount,
          },
        },
        quantity: 1,
      },
    ],
    subscription_data: {
      metadata: {
        membership_id: membershipId,
        member_id: memberId,
        organization_id: organizationId,
        billing_frequency: billingFrequency,
      },
      // Set billing anchor if provided (1-28)
      ...(billingAnchorDay && {
        billing_cycle_anchor_config: {
          day_of_month: billingAnchorDay,
        },
      }),
    },
    metadata: {
      membership_id: membershipId,
      member_id: memberId,
      organization_id: organizationId,
      billing_frequency: billingFrequency,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    payment_method_types: ["card"],
  });

  if (!session.url) {
    throw new Error("Failed to create checkout session URL");
  }

  return { url: session.url, sessionId: session.id };
}

/**
 * Create a PaymentIntent for a one-time charge
 */
export async function createPaymentIntent(params: {
  customerId: string;
  amountCents: number;
  membershipId: string;
  memberId: string;
  organizationId: string;
  paymentId?: string;
  description?: string;
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const {
    customerId,
    amountCents,
    membershipId,
    memberId,
    organizationId,
    paymentId,
    description,
  } = params;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "usd",
    customer: customerId,
    description: description || "Membership payment",
    metadata: {
      membership_id: membershipId,
      member_id: memberId,
      organization_id: organizationId,
      ...(paymentId && { payment_id: paymentId }),
    },
    automatic_payment_methods: {
      enabled: true,
    },
  });

  if (!paymentIntent.client_secret) {
    throw new Error("Failed to create payment intent");
  }

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  };
}

/**
 * Confirm a PaymentIntent with the customer's default payment method
 */
export async function confirmPaymentIntent(params: {
  paymentIntentId: string;
  paymentMethodId?: string;
}): Promise<{ status: string; succeeded: boolean }> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const { paymentIntentId, paymentMethodId } = params;

  // Get the payment intent first to check its current state
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (intent.status === "succeeded") {
    return { status: "succeeded", succeeded: true };
  }

  // Confirm with payment method if provided, otherwise use default
  const confirmed = await stripe.paymentIntents.confirm(paymentIntentId, {
    ...(paymentMethodId && { payment_method: paymentMethodId }),
  });

  return {
    status: confirmed.status,
    succeeded: confirmed.status === "succeeded",
  };
}

/**
 * Pause a Stripe subscription
 */
export async function pauseSubscription(subscriptionId: string): Promise<void> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  await stripe.subscriptions.update(subscriptionId, {
    pause_collection: {
      behavior: "mark_uncollectible",
    },
  });
}

/**
 * Resume a paused Stripe subscription
 */
export async function resumeSubscription(subscriptionId: string): Promise<void> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  await stripe.subscriptions.update(subscriptionId, {
    pause_collection: null,
  });
}

/**
 * Cancel a Stripe subscription
 */
export async function cancelSubscription(subscriptionId: string): Promise<boolean> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    if (subscription.status === "canceled") {
      return true; // Already canceled
    }

    await stripe.subscriptions.cancel(subscriptionId);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // If subscription doesn't exist, treat as success
    if (errorMessage.includes("No such subscription")) {
      return true;
    }

    throw error;
  }
}

/**
 * Get a customer's default payment method
 */
export async function getCustomerDefaultPaymentMethod(
  customerId: string
): Promise<{ id: string; type: string; last4: string; brand?: string } | null> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const customer = await stripe.customers.retrieve(customerId);

  if (customer.deleted) {
    return null;
  }

  const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method;

  if (!defaultPaymentMethodId || typeof defaultPaymentMethodId !== "string") {
    // Try to get from payment methods list
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 1,
    });

    if (paymentMethods.data.length === 0) {
      return null;
    }

    const pm = paymentMethods.data[0];
    return {
      id: pm.id,
      type: pm.type,
      last4: pm.card?.last4 || "****",
      brand: pm.card?.brand,
    };
  }

  const paymentMethod = await stripe.paymentMethods.retrieve(defaultPaymentMethodId);

  return {
    id: paymentMethod.id,
    type: paymentMethod.type,
    last4: paymentMethod.card?.last4 || "****",
    brand: paymentMethod.card?.brand,
  };
}
