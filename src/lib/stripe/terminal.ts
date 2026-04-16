import "server-only";

import Stripe from "stripe";
import { stripe } from "./index";
import type { Address } from "@/lib/types";

// =============================================================================
// Location Management
// =============================================================================

/**
 * Create a Stripe Terminal Location for an organization.
 * Required before readers can be registered.
 */
export async function createTerminalLocation(params: {
  displayName: string;
  address: Address;
}): Promise<Stripe.Terminal.Location> {
  if (!stripe) throw new Error("Stripe is not configured");

  return stripe.terminal.locations.create({
    display_name: params.displayName,
    address: {
      line1: params.address.street,
      city: params.address.city,
      state: params.address.state,
      postal_code: params.address.zip,
      country: "US",
    },
  });
}

/**
 * Update an existing Terminal Location.
 */
export async function updateTerminalLocation(
  locationId: string,
  params: { displayName?: string; address?: Address }
): Promise<Stripe.Terminal.Location> {
  if (!stripe) throw new Error("Stripe is not configured");

  const updates: Stripe.Terminal.LocationUpdateParams = {};
  if (params.displayName) updates.display_name = params.displayName;
  if (params.address) {
    updates.address = {
      line1: params.address.street,
      city: params.address.city,
      state: params.address.state,
      postal_code: params.address.zip,
      country: "US",
    };
  }

  const result = await stripe.terminal.locations.update(locationId, updates);
  if ("deleted" in result && result.deleted) {
    throw new Error("Location has been deleted");
  }
  return result as Stripe.Terminal.Location;
}

// =============================================================================
// Reader Management
// =============================================================================

/**
 * Register a new reader to a location using its registration code.
 * The registration code is displayed on the reader during setup.
 */
export async function registerReader(params: {
  registrationCode: string;
  locationId: string;
  label?: string;
}): Promise<Stripe.Terminal.Reader> {
  if (!stripe) throw new Error("Stripe is not configured");

  return stripe.terminal.readers.create({
    registration_code: params.registrationCode,
    location: params.locationId,
    label: params.label || "M2 Reader",
  });
}

/**
 * List all readers for a location.
 */
export async function listReaders(
  locationId: string
): Promise<Stripe.Terminal.Reader[]> {
  if (!stripe) throw new Error("Stripe is not configured");

  const readers = await stripe.terminal.readers.list({
    location: locationId,
    limit: 100,
  });

  return readers.data;
}

/**
 * Get a single reader's current status.
 */
export async function getReader(
  readerId: string
): Promise<Stripe.Terminal.Reader> {
  if (!stripe) throw new Error("Stripe is not configured");
  const result = await stripe.terminal.readers.retrieve(readerId);
  if ("deleted" in result && result.deleted) {
    throw new Error("Reader has been deleted");
  }
  return result as Stripe.Terminal.Reader;
}

/**
 * Delete a reader.
 */
export async function deleteReader(
  readerId: string
): Promise<Stripe.Terminal.DeletedReader> {
  if (!stripe) throw new Error("Stripe is not configured");
  return stripe.terminal.readers.del(readerId);
}

// =============================================================================
// Payment Collection (Server-Driven)
// =============================================================================

/**
 * Create a PaymentIntent for a Terminal in-person payment and hand it off
 * to the reader. The reader will prompt the customer to tap/insert their card.
 *
 * Returns the PaymentIntent (status will be "requires_action" while reader waits).
 */
export async function collectTerminalPayment(params: {
  readerId: string;
  amountCents: number;
  description: string;
  metadata: Record<string, string>;
  stripeConnectAccountId?: string;
  applicationFeeCents?: number;
}): Promise<{ paymentIntent: Stripe.PaymentIntent; reader: Stripe.Terminal.Reader }> {
  if (!stripe) throw new Error("Stripe is not configured");

  const {
    readerId,
    amountCents,
    description,
    metadata,
    stripeConnectAccountId,
    applicationFeeCents,
  } = params;

  // Create PaymentIntent for Terminal
  const piParams: Stripe.PaymentIntentCreateParams = {
    amount: amountCents,
    currency: "usd",
    payment_method_types: ["card_present"],
    capture_method: "automatic",
    description,
    metadata,
  };

  // Add Connect params if applicable
  if (stripeConnectAccountId) {
    piParams.transfer_data = { destination: stripeConnectAccountId };
    if (applicationFeeCents && applicationFeeCents > 0) {
      piParams.application_fee_amount = applicationFeeCents;
    }
  }

  const paymentIntent = await stripe.paymentIntents.create(piParams);

  // Hand off to the reader — this makes the reader prompt for a card
  const reader = await stripe.terminal.readers.processPaymentIntent(readerId, {
    payment_intent: paymentIntent.id,
  });

  return { paymentIntent, reader };
}

/**
 * Cancel the current action on a reader (e.g. if admin wants to abort).
 */
export async function cancelReaderAction(
  readerId: string
): Promise<Stripe.Terminal.Reader> {
  if (!stripe) throw new Error("Stripe is not configured");
  return stripe.terminal.readers.cancelAction(readerId);
}

/**
 * Retrieve the current status of a PaymentIntent (for polling).
 */
export async function getPaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  if (!stripe) throw new Error("Stripe is not configured");
  return stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge.payment_method_details"],
  });
}

// =============================================================================
// Payment Method Cloning (Terminal → Recurring)
// =============================================================================

/**
 * After a Terminal payment succeeds, the payment method is `card_present` which
 * cannot be reused for online/recurring charges. We need to clone it to a
 * regular `card` payment method that can be attached to a subscription.
 *
 * Stripe calls this "saving payment details for later" from Terminal.
 * The generated_card on the charge is the reusable payment method.
 */
export async function getReusablePaymentMethod(
  paymentIntentId: string
): Promise<{ paymentMethodId: string; last4: string; brand: string }> {
  if (!stripe) throw new Error("Stripe is not configured");

  const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge.payment_method_details"],
  });

  const charge = pi.latest_charge;
  if (!charge || typeof charge === "string") {
    throw new Error("No charge found on PaymentIntent");
  }

  const pmDetails = charge.payment_method_details;
  if (!pmDetails || pmDetails.type !== "card_present") {
    throw new Error("Payment method is not card_present");
  }

  // The generated_card field contains the reusable card payment method
  const generatedCard = pmDetails.card_present?.generated_card;
  if (!generatedCard) {
    throw new Error(
      "No generated_card on card_present payment — card may not support saving"
    );
  }

  // Retrieve the generated payment method for details
  const pm = await stripe.paymentMethods.retrieve(generatedCard);

  return {
    paymentMethodId: generatedCard,
    last4: pm.card?.last4 || "****",
    brand: pm.card?.brand || "unknown",
  };
}

/**
 * Create a Stripe ConnectionToken for Terminal SDK (if we ever need client-side).
 * For server-driven integration this isn't needed, but useful for future flexibility.
 */
export async function createConnectionToken(): Promise<string> {
  if (!stripe) throw new Error("Stripe is not configured");
  const token = await stripe.terminal.connectionTokens.create();
  return token.secret;
}
