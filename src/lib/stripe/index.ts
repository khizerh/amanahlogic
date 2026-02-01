import "server-only";

import Stripe from "stripe";

// Initialize Stripe client
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

// PINNED API VERSION - DO NOT CHANGE
// See: https://docs.stripe.com/changelog#2025-12-15.clover
export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2025-12-15.clover",
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
 * Create a Stripe SetupIntent for collecting a payment method.
 *
 * Unlike Checkout Sessions, SetupIntents have NO expiration. The returned proxy
 * URL points to our self-hosted /payment/setup page which loads Stripe Elements
 * using the client secret.
 */
export async function createSetupIntent(params: {
  customerId: string;
  membershipId: string;
  memberId: string;
  organizationId: string;
  planName: string;
  duesAmountCents: number;
  enrollmentFeeAmountCents: number;
  billingFrequency: StripeBillingFrequency;
  passFeesToMember: boolean;
  stripeConnectAccountId?: string;
  memberIsCurrent?: boolean;
  nextPaymentDue?: string;
}): Promise<{ setupIntentId: string; clientSecret: string; url: string }> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const {
    customerId,
    membershipId,
    memberId,
    organizationId,
    planName,
    duesAmountCents,
    enrollmentFeeAmountCents,
    billingFrequency,
    passFeesToMember,
    stripeConnectAccountId,
    memberIsCurrent,
    nextPaymentDue,
  } = params;

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    usage: "off_session",
    payment_method_types: ["card"],
    metadata: {
      membership_id: membershipId,
      member_id: memberId,
      organization_id: organizationId,
      plan_name: planName,
      dues_amount_cents: String(duesAmountCents),
      enrollment_fee_amount_cents: String(enrollmentFeeAmountCents),
      billing_frequency: billingFrequency,
      pass_fees_to_member: String(passFeesToMember),
      ...(stripeConnectAccountId && { stripe_connect_account_id: stripeConnectAccountId }),
      ...(memberIsCurrent && { member_is_current: "true" }),
      ...(nextPaymentDue && { next_payment_due: nextPaymentDue }),
    },
  });

  if (!setupIntent.client_secret) {
    throw new Error("Failed to create SetupIntent client secret");
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const url = `${baseUrl}/payment/setup?setup_intent=${setupIntent.id}&setup_intent_client_secret=${setupIntent.client_secret}`;

  return {
    setupIntentId: setupIntent.id,
    clientSecret: setupIntent.client_secret,
    url,
  };
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
  /** Optional override for the line item name (defaults to "{planName} Dues") */
  lineItemName?: string;
  /** Optional override for the line item description (defaults to interval description) */
  lineItemDescription?: string;
  /** Optional Connect params for destination charges */
  connectParams?: ConnectParams;
  /** Optional enrollment fee to add as one-time charge on first invoice */
  enrollmentFee?: {
    amountCents: number;
    description?: string;
  };
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
    lineItemName,
    lineItemDescription,
    connectParams,
    enrollmentFee,
  } = params;

  // Determine Stripe interval based on billing frequency
  let interval: "month" | "year" = "month";
  let intervalCount = 1;
  let defaultDescription = "Monthly membership dues";

  switch (billingFrequency) {
    case "monthly":
      interval = "month";
      intervalCount = 1;
      defaultDescription = "Monthly membership dues";
      break;
    case "biannual":
      interval = "month";
      intervalCount = 6;
      defaultDescription = "Biannual membership dues (every 6 months)";
      break;
    case "annual":
      interval = "year";
      intervalCount = 1;
      defaultDescription = "Annual membership dues";
      break;
  }

  // Build line items: recurring dues + optional one-time enrollment fee.
  // Checkout sessions support mixing one-time and recurring prices in subscription mode.
  // The one-time item is charged on the first invoice only.
  const lineItems: Array<{
    price_data: {
      currency: string;
      product_data: { name: string; description?: string };
      unit_amount: number;
      recurring?: { interval: "month" | "year"; interval_count: number };
    };
    quantity: number;
  }> = [
    {
      price_data: {
        currency: "usd",
        product_data: {
          name: lineItemName ?? `${planName} Dues`,
          description: lineItemDescription ?? defaultDescription,
        },
        unit_amount: priceAmountCents,
        recurring: {
          interval: interval,
          interval_count: intervalCount,
        },
      },
      quantity: 1,
    },
  ];

  if (enrollmentFee) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: enrollmentFee.description || `${planName} Enrollment Fee`,
        },
        unit_amount: enrollmentFee.amountCents,
      },
      quantity: 1,
    });
  }

  // Create checkout session with subscription mode
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: lineItems,
    subscription_data: {
      metadata: {
        membership_id: membershipId,
        member_id: memberId,
        organization_id: organizationId,
        billing_frequency: billingFrequency,
        // Track if enrollment fee is included
        ...(enrollmentFee && {
          includes_enrollment_fee: "true",
          enrollment_fee_amount_cents: String(enrollmentFee.amountCents),
        }),
      },
      // Note: billing_cycle_anchor_config is not supported in checkout sessions.
      // The billing day defaults to the checkout completion date, which matches
      // the member's billingAnniversaryDay (set to today during member creation).
      // Stripe Connect: Destination charges for subscriptions
      // Each invoice payment will be split automatically
      ...(connectParams && {
        transfer_data: {
          destination: connectParams.stripeConnectId,
          // Note: For subscriptions, we set the fee on invoices via webhook
        },
      }),
    },
    metadata: {
      membership_id: membershipId,
      member_id: memberId,
      organization_id: organizationId,
      billing_frequency: billingFrequency,
      // Also track in session metadata for checkout.session.completed
      ...(enrollmentFee && {
        includes_enrollment_fee: "true",
        enrollment_fee_amount_cents: String(enrollmentFee.amountCents),
      }),
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
 * Connect account parameters for destination charges
 */
export interface ConnectParams {
  /** The connected account ID (e.g., acct_xxxxx) */
  stripeConnectId: string;
  /** Platform fee in cents to keep (Amanah Logic's cut) */
  applicationFeeCents: number;
}

/**
 * Fee calculation result
 */
export interface FeeCalculation {
  /** What the member pays (total charge amount) */
  chargeAmountCents: number;
  /** Base amount before fees (what the org "receives" conceptually) */
  baseAmountCents: number;
  /** Stripe's processing fee */
  stripeFeeCents: number;
  /** Platform fee (Amanah Logic's cut) */
  platformFeeCents: number;
  /** For Connect: application_fee_amount (platform fee + stripe fee) */
  applicationFeeCents: number;
  /** What the org actually receives after all fees */
  netAmountCents: number;
  /** Fee breakdown for display purposes */
  breakdown: {
    baseAmount: number;
    stripeFee: number;
    platformFee: number;
    totalFees: number;
    chargeAmount: number;
  };
}

/**
 * Calculate fees for a payment
 *
 * @param baseAmountCents - The base amount (e.g., dues amount) in cents
 * @param platformFeeDollars - The platform fee in dollars (from org.platformFee)
 * @param passFeesToMember - If true, gross-up so org receives full base amount
 * @returns Fee calculation with all breakdowns
 */
export function calculateFees(
  baseAmountCents: number,
  platformFeeDollars: number,
  passFeesToMember: boolean = false
): FeeCalculation {
  const stripeFeePercent = 0.029; // 2.9%
  const stripeFixedFeeCents = 30; // $0.30 in cents
  const platformFeeCents = Math.round(platformFeeDollars * 100);

  let chargeAmountCents: number;
  let stripeFeeCents: number;
  let netAmountCents: number;

  if (passFeesToMember) {
    // GROSS-UP MODE: Calculate what to charge so org gets the full base amount
    // Formula: charge = (base + platformFee + stripeFixed) / (1 - stripePercent)
    // This ensures: charge - stripeFee - platformFee = base
    chargeAmountCents = Math.ceil(
      (baseAmountCents + platformFeeCents + stripeFixedFeeCents) / (1 - stripeFeePercent)
    );
    stripeFeeCents = Math.round(chargeAmountCents * stripeFeePercent) + stripeFixedFeeCents;
    // Org receives the base amount (that's the whole point)
    netAmountCents = baseAmountCents;
  } else {
    // STANDARD MODE: Org absorbs Stripe fees only; platform fee always passed to member
    chargeAmountCents = baseAmountCents + platformFeeCents;
    stripeFeeCents = Math.round(chargeAmountCents * stripeFeePercent) + stripeFixedFeeCents;
    // Org receives base minus Stripe fee (platform fee is paid by member, not deducted from org)
    netAmountCents = baseAmountCents - stripeFeeCents;
  }

  // For Connect destination charges, application_fee_amount includes both fees
  const applicationFeeCents = platformFeeCents + stripeFeeCents;

  // Human-readable breakdown in dollars
  const breakdown = {
    baseAmount: baseAmountCents / 100,
    stripeFee: stripeFeeCents / 100,
    platformFee: platformFeeCents / 100,
    totalFees: (stripeFeeCents + platformFeeCents) / 100,
    chargeAmount: chargeAmountCents / 100,
  };

  return {
    chargeAmountCents,
    baseAmountCents,
    stripeFeeCents,
    platformFeeCents,
    applicationFeeCents,
    netAmountCents,
    breakdown,
  };
}

/**
 * Reverse calculate base amount from a charge amount
 * Used by webhook to determine original dues amount from the charged amount
 *
 * @param chargeAmountCents - The total amount charged (includes fees)
 * @param platformFeeDollars - The platform fee in dollars
 * @param passFeesToMember - Whether Stripe fees were passed to the member
 * @returns The base amount in cents (what the org's dues are)
 */
export function reverseCalculateBaseAmount(
  chargeAmountCents: number,
  platformFeeDollars: number,
  passFeesToMember: boolean = true
): number {
  const platformFeeCents = Math.round(platformFeeDollars * 100);

  if (passFeesToMember) {
    // Reverse the gross-up formula:
    // charge = (base + platformFee + stripeFixed) / (1 - stripePercent)
    // base = charge * (1 - stripePercent) - platformFee - stripeFixed
    const stripeFeePercent = 0.029;
    const stripeFixedFeeCents = 30;
    const baseAmountCents = Math.round(
      chargeAmountCents * (1 - stripeFeePercent) - platformFeeCents - stripeFixedFeeCents
    );
    return Math.max(0, baseAmountCents);
  } else {
    // Standard mode: charge = base + platformFee, so base = charge - platformFee
    return Math.max(0, chargeAmountCents - platformFeeCents);
  }
}

/**
 * Create a PaymentIntent for a one-time charge
 *
 * If connectParams is provided, creates a destination charge that:
 * - Charges the customer on the platform account
 * - Automatically transfers funds to the connected account
 * - Keeps the application fee on the platform account
 */
export async function createPaymentIntent(params: {
  customerId: string;
  amountCents: number;
  membershipId: string;
  memberId: string;
  organizationId: string;
  paymentId?: string;
  description?: string;
  /** Optional Connect params for destination charges */
  connectParams?: ConnectParams;
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
    connectParams,
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
    // Stripe Connect: Destination charge with application fee
    ...(connectParams && {
      application_fee_amount: connectParams.applicationFeeCents,
      transfer_data: {
        destination: connectParams.stripeConnectId,
      },
    }),
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
