/**
 * Stripe Integration Tests
 *
 * Comprehensive tests for fee calculations, reverse calculations,
 * configuration checks, error type guards, and Stripe API wrappers.
 *
 * Fee math is critical for financial accuracy -- these tests verify
 * that organisations and members are charged and credited correctly
 * in both standard and gross-up (passFeesToMember) modes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Environment -- must be set BEFORE the module under test is imported,
// because the module evaluates `process.env.STRIPE_SECRET_KEY` at the top
// level to decide whether to create a Stripe instance.
// ---------------------------------------------------------------------------
process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_tests";

// ---------------------------------------------------------------------------
// Mocks -- vi.mock calls are hoisted by vitest above all imports.
//
// IMPORTANT: vi.mock factory functions cannot reference variables declared in
// the same file (because they are hoisted above variable declarations).
// We use vi.hoisted() to declare mock functions that ARE available inside
// the factory.
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}));

// Set env inside vi.hoisted so it runs before any module evaluation
vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_tests";
});

const {
  mockCustomersSearch,
  mockCustomersCreate,
  mockCustomersUpdate,
  mockCustomersRetrieve,
  mockPaymentIntentsCreate,
  mockPaymentIntentsRetrieve,
  mockPaymentIntentsConfirm,
  mockSetupIntentsCreate,
  mockCheckoutSessionsCreate,
  mockBillingPortalSessionsCreate,
  mockSubscriptionsUpdate,
  mockSubscriptionsRetrieve,
  mockSubscriptionsCancel,
  mockPaymentMethodsList,
  mockPaymentMethodsRetrieve,
  mockStripeInstance,
} = vi.hoisted(() => {
  const mockCustomersSearch = vi.fn();
  const mockCustomersCreate = vi.fn();
  const mockCustomersUpdate = vi.fn();
  const mockCustomersRetrieve = vi.fn();

  const mockPaymentIntentsCreate = vi.fn();
  const mockPaymentIntentsRetrieve = vi.fn();
  const mockPaymentIntentsConfirm = vi.fn();

  const mockSetupIntentsCreate = vi.fn();
  const mockCheckoutSessionsCreate = vi.fn();
  const mockBillingPortalSessionsCreate = vi.fn();

  const mockSubscriptionsUpdate = vi.fn();
  const mockSubscriptionsRetrieve = vi.fn();
  const mockSubscriptionsCancel = vi.fn();

  const mockPaymentMethodsList = vi.fn();
  const mockPaymentMethodsRetrieve = vi.fn();

  const mockStripeInstance = {
    customers: {
      search: mockCustomersSearch,
      create: mockCustomersCreate,
      update: mockCustomersUpdate,
      retrieve: mockCustomersRetrieve,
    },
    paymentIntents: {
      create: mockPaymentIntentsCreate,
      retrieve: mockPaymentIntentsRetrieve,
      confirm: mockPaymentIntentsConfirm,
    },
    setupIntents: {
      create: mockSetupIntentsCreate,
    },
    checkout: {
      sessions: {
        create: mockCheckoutSessionsCreate,
      },
    },
    billingPortal: {
      sessions: {
        create: mockBillingPortalSessionsCreate,
      },
    },
    subscriptions: {
      update: mockSubscriptionsUpdate,
      retrieve: mockSubscriptionsRetrieve,
      cancel: mockSubscriptionsCancel,
    },
    paymentMethods: {
      list: mockPaymentMethodsList,
      retrieve: mockPaymentMethodsRetrieve,
    },
  };

  return {
    mockCustomersSearch,
    mockCustomersCreate,
    mockCustomersUpdate,
    mockCustomersRetrieve,
    mockPaymentIntentsCreate,
    mockPaymentIntentsRetrieve,
    mockPaymentIntentsConfirm,
    mockSetupIntentsCreate,
    mockCheckoutSessionsCreate,
    mockBillingPortalSessionsCreate,
    mockSubscriptionsUpdate,
    mockSubscriptionsRetrieve,
    mockSubscriptionsCancel,
    mockPaymentMethodsList,
    mockPaymentMethodsRetrieve,
    mockStripeInstance,
  };
});

vi.mock("stripe", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("stripe");
  // Must use a class (or function declaration) so `new Stripe(...)` works.
  class MockStripe {
    constructor() {
      return mockStripeInstance;
    }
    static errors = actual.default.errors;
  }
  return { default: MockStripe };
});

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks & env are in place.
// Because vi.mock is hoisted, Stripe constructor already returns our mock
// when index.ts runs `new Stripe(...)`.
// ---------------------------------------------------------------------------
import Stripe from "stripe";
import {
  calculateFees,
  reverseCalculateBaseAmount,
  isStripeConfigured,
  isStripeConfigurationError,
  isStripeResourceMissingError,
  getOrCreateStripeCustomer,
  createPaymentIntent,
  confirmPaymentIntent,
  createSetupIntent,
  createSubscriptionCheckoutSession,
  createCustomerPortalSession,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  getCustomerDefaultPaymentMethod,
} from "../index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a real StripeInvalidRequestError instance for type-guard tests.
 * Because we spread the actual module into our mock, `Stripe.errors` still
 * points to the real error classes.
 */
function makeInvalidRequestError(message: string, code?: string) {
  return Stripe.errors.StripeError.generate({
    type: "invalid_request_error",
    message,
    ...(code ? { code } : {}),
  });
}

function makeApiError(message: string) {
  return Stripe.errors.StripeError.generate({
    type: "api_error",
    message,
  });
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe("Stripe Integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // calculateFees
  // --------------------------------------------------------------------------
  describe("calculateFees", () => {
    const STRIPE_PERCENT = 0.029;
    const STRIPE_FIXED_CENTS = 30;

    describe("standard mode (passFeesToMember = false)", () => {
      it("should calculate fees for $100 base with $0 platform fee", () => {
        const result = calculateFees(10000, 0, false);

        expect(result.chargeAmountCents).toBe(10000);
        expect(result.baseAmountCents).toBe(10000);
        expect(result.platformFeeCents).toBe(0);
        expect(result.stripeFeeCents).toBe(320);
        expect(result.netAmountCents).toBe(9680);
        expect(result.applicationFeeCents).toBe(320);
      });

      it("should calculate fees for $100 base with $2 platform fee", () => {
        const result = calculateFees(10000, 2, false);

        expect(result.chargeAmountCents).toBe(10200);
        expect(result.platformFeeCents).toBe(200);

        const expectedStripeFee = Math.round(10200 * STRIPE_PERCENT) + STRIPE_FIXED_CENTS;
        expect(result.stripeFeeCents).toBe(expectedStripeFee);
        expect(result.netAmountCents).toBe(10000 - expectedStripeFee);
        expect(result.applicationFeeCents).toBe(200 + expectedStripeFee);
      });

      it("should handle zero base amount", () => {
        const result = calculateFees(0, 0, false);

        expect(result.chargeAmountCents).toBe(0);
        expect(result.baseAmountCents).toBe(0);
        expect(result.stripeFeeCents).toBe(STRIPE_FIXED_CENTS);
        expect(result.netAmountCents).toBe(-STRIPE_FIXED_CENTS);
      });

      it("should handle $1 minimum base (small amounts)", () => {
        const result = calculateFees(100, 0, false);

        expect(result.chargeAmountCents).toBe(100);
        expect(result.stripeFeeCents).toBe(33);
        expect(result.netAmountCents).toBe(67);
      });

      it("should handle fractional platform fee in dollars", () => {
        const result = calculateFees(5000, 1.5, false);

        expect(result.platformFeeCents).toBe(150);
        expect(result.chargeAmountCents).toBe(5150);
      });

      it("should produce correct dollar breakdown", () => {
        const result = calculateFees(10000, 2, false);

        expect(result.breakdown.baseAmount).toBe(100);
        expect(result.breakdown.platformFee).toBe(2);
        expect(result.breakdown.chargeAmount).toBe(102);
        expect(result.breakdown.stripeFee).toBeCloseTo(result.stripeFeeCents / 100, 2);
        expect(result.breakdown.totalFees).toBeCloseTo(
          (result.stripeFeeCents + result.platformFeeCents) / 100,
          2
        );
      });
    });

    describe("gross-up mode (passFeesToMember = true)", () => {
      it("should calculate fees for $100 base with $0 platform fee", () => {
        const result = calculateFees(10000, 0, true);

        const expectedCharge = Math.ceil((10000 + 0 + STRIPE_FIXED_CENTS) / (1 - STRIPE_PERCENT));
        expect(result.chargeAmountCents).toBe(expectedCharge);

        const expectedStripeFee = Math.round(expectedCharge * STRIPE_PERCENT) + STRIPE_FIXED_CENTS;
        expect(result.stripeFeeCents).toBe(expectedStripeFee);

        expect(result.netAmountCents).toBe(10000);
        expect(result.baseAmountCents).toBe(10000);
      });

      it("should calculate fees for $100 base with $2 platform fee", () => {
        const result = calculateFees(10000, 2, true);

        const platformFeeCents = 200;
        const expectedCharge = Math.ceil(
          (10000 + platformFeeCents + STRIPE_FIXED_CENTS) / (1 - STRIPE_PERCENT)
        );
        expect(result.chargeAmountCents).toBe(expectedCharge);
        expect(result.platformFeeCents).toBe(platformFeeCents);
        expect(result.netAmountCents).toBe(10000);
      });

      it("should ensure charge - stripeFee - platformFee >= base (within rounding)", () => {
        const testCases = [
          { base: 10000, platformDollars: 0 },
          { base: 10000, platformDollars: 2 },
          { base: 5000, platformDollars: 1.5 },
          { base: 15000, platformDollars: 3 },
          { base: 100, platformDollars: 0.5 },
          { base: 99999, platformDollars: 5 },
        ];

        for (const { base, platformDollars } of testCases) {
          const result = calculateFees(base, platformDollars, true);
          const afterFees =
            result.chargeAmountCents - result.stripeFeeCents - result.platformFeeCents;
          expect(afterFees).toBeGreaterThanOrEqual(base - 1);
        }
      });

      it("should handle zero base amount in gross-up mode", () => {
        const result = calculateFees(0, 0, true);

        const expectedCharge = Math.ceil(STRIPE_FIXED_CENTS / (1 - STRIPE_PERCENT));
        expect(result.chargeAmountCents).toBe(expectedCharge);
        expect(result.netAmountCents).toBe(0);
      });

      it("should handle small amounts in gross-up mode", () => {
        const result = calculateFees(100, 0, true);

        expect(result.chargeAmountCents).toBeGreaterThan(100);
        expect(result.netAmountCents).toBe(100);
      });

      it("should produce correct applicationFee in gross-up mode", () => {
        const result = calculateFees(10000, 2, true);

        expect(result.applicationFeeCents).toBe(
          result.platformFeeCents + result.stripeFeeCents
        );
      });
    });

    describe("default parameter", () => {
      it("should default passFeesToMember to false", () => {
        const explicit = calculateFees(10000, 0, false);
        const defaulted = calculateFees(10000, 0);

        expect(defaulted.chargeAmountCents).toBe(explicit.chargeAmountCents);
        expect(defaulted.stripeFeeCents).toBe(explicit.stripeFeeCents);
        expect(defaulted.netAmountCents).toBe(explicit.netAmountCents);
      });
    });

    describe("comparison between modes", () => {
      it("should charge more in gross-up mode than standard mode for same base", () => {
        const standard = calculateFees(10000, 2, false);
        const grossUp = calculateFees(10000, 2, true);

        expect(grossUp.chargeAmountCents).toBeGreaterThan(standard.chargeAmountCents);
      });

      it("should give org higher net in gross-up mode than standard mode", () => {
        const standard = calculateFees(10000, 2, false);
        const grossUp = calculateFees(10000, 2, true);

        expect(grossUp.netAmountCents).toBeGreaterThan(standard.netAmountCents);
      });
    });
  });

  // --------------------------------------------------------------------------
  // reverseCalculateBaseAmount
  // --------------------------------------------------------------------------
  describe("reverseCalculateBaseAmount", () => {
    describe("standard mode (passFeesToMember = false)", () => {
      it("should reverse: base = charge - platformFee", () => {
        const base = reverseCalculateBaseAmount(10200, 2, false);
        expect(base).toBe(10000);
      });

      it("should reverse with zero platform fee", () => {
        const base = reverseCalculateBaseAmount(10000, 0, false);
        expect(base).toBe(10000);
      });

      it("should never return negative", () => {
        const base = reverseCalculateBaseAmount(100, 5, false);
        expect(base).toBe(0);
      });
    });

    describe("gross-up mode (passFeesToMember = true)", () => {
      it("should reverse the gross-up formula", () => {
        const base = reverseCalculateBaseAmount(10340, 0, true);

        const expected = Math.floor(10340 * (1 - 0.029) - 0 - 30);
        expect(base).toBe(Math.max(0, expected));
      });

      it("should never return negative in gross-up mode", () => {
        const base = reverseCalculateBaseAmount(0, 0, true);
        expect(base).toBe(0);

        const base2 = reverseCalculateBaseAmount(10, 5, true);
        expect(base2).toBe(0);
      });

      it("should default passFeesToMember to true", () => {
        const explicit = reverseCalculateBaseAmount(10340, 2, true);
        const defaulted = reverseCalculateBaseAmount(10340, 2);
        expect(defaulted).toBe(explicit);
      });
    });

    describe("round-trip: calculateFees -> reverseCalculateBaseAmount", () => {
      it("should recover base in standard mode (exact)", () => {
        const originalBase = 10000;
        const platformDollars = 2;

        const fees = calculateFees(originalBase, platformDollars, false);
        const recovered = reverseCalculateBaseAmount(
          fees.chargeAmountCents,
          platformDollars,
          false
        );

        expect(recovered).toBe(originalBase);
      });

      it("should recover base in gross-up mode (within 1 cent)", () => {
        const originalBase = 10000;
        const platformDollars = 2;

        const fees = calculateFees(originalBase, platformDollars, true);
        const recovered = reverseCalculateBaseAmount(
          fees.chargeAmountCents,
          platformDollars,
          true
        );

        expect(Math.abs(recovered - originalBase)).toBeLessThanOrEqual(1);
      });

      it("should round-trip multiple amounts in gross-up mode", () => {
        const testCases = [100, 500, 1000, 5000, 10000, 50000, 99999];

        for (const base of testCases) {
          const fees = calculateFees(base, 2, true);
          const recovered = reverseCalculateBaseAmount(fees.chargeAmountCents, 2, true);
          expect(Math.abs(recovered - base)).toBeLessThanOrEqual(1);
        }
      });

      it("should round-trip with zero platform fee", () => {
        const fees = calculateFees(7500, 0, true);
        const recovered = reverseCalculateBaseAmount(fees.chargeAmountCents, 0, true);
        expect(Math.abs(recovered - 7500)).toBeLessThanOrEqual(1);
      });
    });
  });

  // --------------------------------------------------------------------------
  // isStripeConfigured
  // --------------------------------------------------------------------------
  describe("isStripeConfigured", () => {
    it("should return true when STRIPE_SECRET_KEY is set", () => {
      expect(isStripeConfigured()).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // isStripeConfigurationError
  // --------------------------------------------------------------------------
  describe("isStripeConfigurationError", () => {
    it("should return true for StripeInvalidRequestError with 'configuration' in message", () => {
      const error = makeInvalidRequestError("No such configuration for this portal");
      expect(isStripeConfigurationError(error)).toBe(true);
    });

    it("should return true for StripeInvalidRequestError with 'portal' in message", () => {
      const error = makeInvalidRequestError("No billing portal has been set up");
      expect(isStripeConfigurationError(error)).toBe(true);
    });

    it("should return false for StripeInvalidRequestError without config/portal keywords", () => {
      const error = makeInvalidRequestError("No such customer: cus_123");
      expect(isStripeConfigurationError(error)).toBe(false);
    });

    it("should return false for non-Stripe errors", () => {
      expect(isStripeConfigurationError(new Error("configuration error"))).toBe(false);
      expect(isStripeConfigurationError("configuration")).toBe(false);
      expect(isStripeConfigurationError(null)).toBe(false);
      expect(isStripeConfigurationError(undefined)).toBe(false);
    });

    it("should return false for other Stripe error types", () => {
      const error = makeApiError("Something about configuration went wrong");
      expect(isStripeConfigurationError(error)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // isStripeResourceMissingError
  // --------------------------------------------------------------------------
  describe("isStripeResourceMissingError", () => {
    it("should return true for 'No such customer' message", () => {
      const error = makeInvalidRequestError("No such customer: cus_123");
      expect(isStripeResourceMissingError(error)).toBe(true);
    });

    it("should return true for resource_missing code", () => {
      const error = makeInvalidRequestError("Some resource not found", "resource_missing");
      expect(isStripeResourceMissingError(error)).toBe(true);
    });

    it("should return false for other StripeInvalidRequestError messages", () => {
      const error = makeInvalidRequestError("Invalid amount");
      expect(isStripeResourceMissingError(error)).toBe(false);
    });

    it("should return false for non-Stripe errors", () => {
      expect(isStripeResourceMissingError(new Error("No such customer"))).toBe(false);
      expect(isStripeResourceMissingError(null)).toBe(false);
      expect(isStripeResourceMissingError(42)).toBe(false);
    });
  });

  // ==========================================================================
  // API FUNCTIONS (require mocked Stripe instance)
  // ==========================================================================

  // --------------------------------------------------------------------------
  // getOrCreateStripeCustomer
  // --------------------------------------------------------------------------
  describe("getOrCreateStripeCustomer", () => {
    const baseParams = {
      memberId: "member-1",
      membershipId: "membership-1",
      email: "test@example.com",
      name: "Test User",
      organizationId: "org-1",
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should find existing customer by membership_id metadata", async () => {
      mockCustomersSearch.mockResolvedValueOnce({
        data: [
          {
            id: "cus_existing",
            metadata: {
              membership_id: "membership-1",
              organization_id: "org-1",
              member_id: "member-1",
            },
          },
        ],
      });

      const customerId = await getOrCreateStripeCustomer(baseParams);

      expect(customerId).toBe("cus_existing");
      expect(mockCustomersSearch).toHaveBeenCalledWith({
        query: 'metadata["membership_id"]:"membership-1"',
        limit: 1,
      });
      expect(mockCustomersCreate).not.toHaveBeenCalled();
    });

    it("should skip customer from different org and create new", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      mockCustomersSearch
        .mockResolvedValueOnce({
          data: [
            {
              id: "cus_other_org",
              metadata: {
                membership_id: "membership-1",
                organization_id: "org-DIFFERENT",
              },
            },
          ],
        })
        .mockResolvedValueOnce({ data: [] });

      mockCustomersCreate.mockResolvedValueOnce({ id: "cus_new" });

      const customerId = await getOrCreateStripeCustomer(baseParams);

      expect(customerId).toBe("cus_new");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("cus_other_org")
      );
      expect(mockCustomersCreate).toHaveBeenCalledWith({
        email: "test@example.com",
        name: "Test User",
        metadata: {
          member_id: "member-1",
          membership_id: "membership-1",
          organization_id: "org-1",
        },
      });

      consoleSpy.mockRestore();
    });

    it("should find existing customer by org + member_id and update metadata", async () => {
      mockCustomersSearch
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({
          data: [
            {
              id: "cus_by_member",
              metadata: {
                organization_id: "org-1",
                member_id: "member-1",
                membership_id: "old-membership",
              },
            },
          ],
        });

      mockCustomersUpdate.mockResolvedValueOnce({});

      const customerId = await getOrCreateStripeCustomer(baseParams);

      expect(customerId).toBe("cus_by_member");
      expect(mockCustomersUpdate).toHaveBeenCalledWith("cus_by_member", {
        metadata: {
          member_id: "member-1",
          membership_id: "membership-1",
          organization_id: "org-1",
        },
      });
    });

    it("should create new customer when none found", async () => {
      mockCustomersSearch
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] });

      mockCustomersCreate.mockResolvedValueOnce({ id: "cus_brand_new" });

      const customerId = await getOrCreateStripeCustomer(baseParams);

      expect(customerId).toBe("cus_brand_new");
      expect(mockCustomersCreate).toHaveBeenCalledWith({
        email: "test@example.com",
        name: "Test User",
        metadata: {
          member_id: "member-1",
          membership_id: "membership-1",
          organization_id: "org-1",
        },
      });
    });
  });

  // --------------------------------------------------------------------------
  // createPaymentIntent
  // --------------------------------------------------------------------------
  describe("createPaymentIntent", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should create a payment intent with correct parameters", async () => {
      mockPaymentIntentsCreate.mockResolvedValueOnce({
        id: "pi_test_123",
        client_secret: "pi_test_123_secret",
      });

      const result = await createPaymentIntent({
        customerId: "cus_123",
        amountCents: 10000,
        membershipId: "membership-1",
        memberId: "member-1",
        organizationId: "org-1",
        description: "Monthly dues",
      });

      expect(result).toEqual({
        clientSecret: "pi_test_123_secret",
        paymentIntentId: "pi_test_123",
      });

      expect(mockPaymentIntentsCreate).toHaveBeenCalledWith({
        amount: 10000,
        currency: "usd",
        customer: "cus_123",
        description: "Monthly dues",
        metadata: {
          membership_id: "membership-1",
          member_id: "member-1",
          organization_id: "org-1",
        },
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: "never",
        },
      });
    });

    it("should add Connect params when provided", async () => {
      mockPaymentIntentsCreate.mockResolvedValueOnce({
        id: "pi_connect_123",
        client_secret: "pi_connect_123_secret",
      });

      await createPaymentIntent({
        customerId: "cus_123",
        amountCents: 10000,
        membershipId: "membership-1",
        memberId: "member-1",
        organizationId: "org-1",
        connectParams: {
          stripeConnectId: "acct_connected",
          applicationFeeCents: 500,
        },
      });

      expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          application_fee_amount: 500,
          transfer_data: {
            destination: "acct_connected",
          },
        })
      );
    });

    it("should include payment_id in metadata when provided", async () => {
      mockPaymentIntentsCreate.mockResolvedValueOnce({
        id: "pi_123",
        client_secret: "pi_123_secret",
      });

      await createPaymentIntent({
        customerId: "cus_123",
        amountCents: 5000,
        membershipId: "membership-1",
        memberId: "member-1",
        organizationId: "org-1",
        paymentId: "pay-uuid-1",
      });

      expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            payment_id: "pay-uuid-1",
          }),
        })
      );
    });

    it("should use default description when none provided", async () => {
      mockPaymentIntentsCreate.mockResolvedValueOnce({
        id: "pi_123",
        client_secret: "pi_123_secret",
      });

      await createPaymentIntent({
        customerId: "cus_123",
        amountCents: 5000,
        membershipId: "membership-1",
        memberId: "member-1",
        organizationId: "org-1",
      });

      expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Membership payment",
        })
      );
    });

    it("should throw when client_secret is missing", async () => {
      mockPaymentIntentsCreate.mockResolvedValueOnce({
        id: "pi_no_secret",
        client_secret: null,
      });

      await expect(
        createPaymentIntent({
          customerId: "cus_123",
          amountCents: 5000,
          membershipId: "membership-1",
          memberId: "member-1",
          organizationId: "org-1",
        })
      ).rejects.toThrow("Failed to create payment intent");
    });
  });

  // --------------------------------------------------------------------------
  // confirmPaymentIntent
  // --------------------------------------------------------------------------
  describe("confirmPaymentIntent", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return succeeded without confirming if already succeeded", async () => {
      mockPaymentIntentsRetrieve.mockResolvedValueOnce({
        status: "succeeded",
      });

      const result = await confirmPaymentIntent({ paymentIntentId: "pi_123" });

      expect(result).toEqual({ status: "succeeded", succeeded: true });
      expect(mockPaymentIntentsConfirm).not.toHaveBeenCalled();
    });

    it("should confirm with payment method when provided", async () => {
      mockPaymentIntentsRetrieve.mockResolvedValueOnce({
        status: "requires_confirmation",
      });
      mockPaymentIntentsConfirm.mockResolvedValueOnce({
        status: "succeeded",
      });

      const result = await confirmPaymentIntent({
        paymentIntentId: "pi_123",
        paymentMethodId: "pm_card_visa",
      });

      expect(result).toEqual({ status: "succeeded", succeeded: true });
      expect(mockPaymentIntentsConfirm).toHaveBeenCalledWith("pi_123", {
        payment_method: "pm_card_visa",
      });
    });

    it("should confirm without payment method when not provided", async () => {
      mockPaymentIntentsRetrieve.mockResolvedValueOnce({
        status: "requires_confirmation",
      });
      mockPaymentIntentsConfirm.mockResolvedValueOnce({
        status: "requires_action",
      });

      const result = await confirmPaymentIntent({ paymentIntentId: "pi_123" });

      expect(result).toEqual({ status: "requires_action", succeeded: false });
      expect(mockPaymentIntentsConfirm).toHaveBeenCalledWith("pi_123", {});
    });
  });

  // --------------------------------------------------------------------------
  // createSetupIntent
  // --------------------------------------------------------------------------
  describe("createSetupIntent", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    });

    it("should create a setup intent with correct metadata", async () => {
      mockSetupIntentsCreate.mockResolvedValueOnce({
        id: "seti_123",
        client_secret: "seti_123_secret_abc",
      });

      const result = await createSetupIntent({
        customerId: "cus_123",
        membershipId: "membership-1",
        memberId: "member-1",
        organizationId: "org-1",
        planName: "Gold Plan",
        duesAmountCents: 10000,
        enrollmentFeeAmountCents: 500,
        billingFrequency: "monthly",
        passFeesToMember: true,
      });

      expect(result.setupIntentId).toBe("seti_123");
      expect(result.clientSecret).toBe("seti_123_secret_abc");
      expect(result.url).toBe(
        "https://app.example.com/payment/setup?setup_intent=seti_123&setup_intent_client_secret=seti_123_secret_abc"
      );

      expect(mockSetupIntentsCreate).toHaveBeenCalledWith({
        customer: "cus_123",
        usage: "off_session",
        payment_method_types: ["card"],
        metadata: {
          membership_id: "membership-1",
          member_id: "member-1",
          organization_id: "org-1",
          plan_name: "Gold Plan",
          dues_amount_cents: "10000",
          enrollment_fee_amount_cents: "500",
          billing_frequency: "monthly",
          pass_fees_to_member: "true",
        },
      });
    });

    it("should include stripeConnectAccountId in metadata when provided", async () => {
      mockSetupIntentsCreate.mockResolvedValueOnce({
        id: "seti_connect",
        client_secret: "seti_connect_secret",
      });

      await createSetupIntent({
        customerId: "cus_123",
        membershipId: "membership-1",
        memberId: "member-1",
        organizationId: "org-1",
        planName: "Standard",
        duesAmountCents: 5000,
        enrollmentFeeAmountCents: 0,
        billingFrequency: "annual",
        passFeesToMember: false,
        stripeConnectAccountId: "acct_connected_123",
      });

      expect(mockSetupIntentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            stripe_connect_account_id: "acct_connected_123",
          }),
        })
      );
    });

    it("should include memberIsCurrent flag when true", async () => {
      mockSetupIntentsCreate.mockResolvedValueOnce({
        id: "seti_current",
        client_secret: "seti_current_secret",
      });

      await createSetupIntent({
        customerId: "cus_123",
        membershipId: "membership-1",
        memberId: "member-1",
        organizationId: "org-1",
        planName: "Standard",
        duesAmountCents: 5000,
        enrollmentFeeAmountCents: 0,
        billingFrequency: "monthly",
        passFeesToMember: false,
        memberIsCurrent: true,
      });

      expect(mockSetupIntentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            member_is_current: "true",
          }),
        })
      );
    });

    it("should include nextPaymentDue when provided", async () => {
      mockSetupIntentsCreate.mockResolvedValueOnce({
        id: "seti_due",
        client_secret: "seti_due_secret",
      });

      await createSetupIntent({
        customerId: "cus_123",
        membershipId: "membership-1",
        memberId: "member-1",
        organizationId: "org-1",
        planName: "Standard",
        duesAmountCents: 5000,
        enrollmentFeeAmountCents: 0,
        billingFrequency: "monthly",
        passFeesToMember: false,
        nextPaymentDue: "2025-02-15",
      });

      expect(mockSetupIntentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            next_payment_due: "2025-02-15",
          }),
        })
      );
    });

    it("should throw when client_secret is missing from setup intent", async () => {
      mockSetupIntentsCreate.mockResolvedValueOnce({
        id: "seti_no_secret",
        client_secret: null,
      });

      await expect(
        createSetupIntent({
          customerId: "cus_123",
          membershipId: "membership-1",
          memberId: "member-1",
          organizationId: "org-1",
          planName: "Standard",
          duesAmountCents: 5000,
          enrollmentFeeAmountCents: 0,
          billingFrequency: "monthly",
          passFeesToMember: false,
        })
      ).rejects.toThrow("Failed to create SetupIntent client secret");
    });

    it("should fallback to NEXT_PUBLIC_BASE_URL when NEXT_PUBLIC_APP_URL is not set", async () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      process.env.NEXT_PUBLIC_BASE_URL = "https://base.example.com";

      mockSetupIntentsCreate.mockResolvedValueOnce({
        id: "seti_base",
        client_secret: "seti_base_secret",
      });

      const result = await createSetupIntent({
        customerId: "cus_123",
        membershipId: "membership-1",
        memberId: "member-1",
        organizationId: "org-1",
        planName: "Standard",
        duesAmountCents: 5000,
        enrollmentFeeAmountCents: 0,
        billingFrequency: "monthly",
        passFeesToMember: false,
      });

      expect(result.url).toContain("https://base.example.com/payment/setup");
    });
  });

  // --------------------------------------------------------------------------
  // createSubscriptionCheckoutSession
  // --------------------------------------------------------------------------
  describe("createSubscriptionCheckoutSession", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should create a checkout session with monthly billing", async () => {
      mockCheckoutSessionsCreate.mockResolvedValueOnce({
        id: "cs_monthly",
        url: "https://checkout.stripe.com/session/cs_monthly",
      });

      const result = await createSubscriptionCheckoutSession({
        customerId: "cus_123",
        priceAmountCents: 5000,
        membershipId: "membership-1",
        memberId: "member-1",
        organizationId: "org-1",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        billingFrequency: "monthly",
        planName: "Gold",
      });

      expect(result.url).toBe("https://checkout.stripe.com/session/cs_monthly");
      expect(result.sessionId).toBe("cs_monthly");

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_123",
          mode: "subscription",
          success_url: "https://example.com/success",
          cancel_url: "https://example.com/cancel",
          payment_method_types: ["card"],
          line_items: [
            expect.objectContaining({
              price_data: expect.objectContaining({
                currency: "usd",
                unit_amount: 5000,
                product_data: expect.objectContaining({
                  name: "Gold Dues",
                  description: "Monthly membership dues",
                }),
                recurring: {
                  interval: "month",
                  interval_count: 1,
                },
              }),
              quantity: 1,
            }),
          ],
        })
      );
    });

    it("should create a checkout session with biannual billing", async () => {
      mockCheckoutSessionsCreate.mockResolvedValueOnce({
        id: "cs_biannual",
        url: "https://checkout.stripe.com/session/cs_biannual",
      });

      await createSubscriptionCheckoutSession({
        customerId: "cus_123",
        priceAmountCents: 30000,
        membershipId: "membership-1",
        memberId: "member-1",
        organizationId: "org-1",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        billingFrequency: "biannual",
      });

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            expect.objectContaining({
              price_data: expect.objectContaining({
                recurring: {
                  interval: "month",
                  interval_count: 6,
                },
                product_data: expect.objectContaining({
                  description: "Biannual membership dues (every 6 months)",
                }),
              }),
            }),
          ],
        })
      );
    });

    it("should create a checkout session with annual billing", async () => {
      mockCheckoutSessionsCreate.mockResolvedValueOnce({
        id: "cs_annual",
        url: "https://checkout.stripe.com/session/cs_annual",
      });

      await createSubscriptionCheckoutSession({
        customerId: "cus_123",
        priceAmountCents: 60000,
        membershipId: "membership-1",
        memberId: "member-1",
        organizationId: "org-1",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        billingFrequency: "annual",
      });

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            expect.objectContaining({
              price_data: expect.objectContaining({
                recurring: {
                  interval: "year",
                  interval_count: 1,
                },
                product_data: expect.objectContaining({
                  description: "Annual membership dues",
                }),
              }),
            }),
          ],
        })
      );
    });

    it("should use custom lineItemName and lineItemDescription", async () => {
      mockCheckoutSessionsCreate.mockResolvedValueOnce({
        id: "cs_custom",
        url: "https://checkout.stripe.com/session/cs_custom",
      });

      await createSubscriptionCheckoutSession({
        customerId: "cus_123",
        priceAmountCents: 5000,
        membershipId: "membership-1",
        memberId: "member-1",
        organizationId: "org-1",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        lineItemName: "Custom Dues Name",
        lineItemDescription: "Custom description here",
      });

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            expect.objectContaining({
              price_data: expect.objectContaining({
                product_data: {
                  name: "Custom Dues Name",
                  description: "Custom description here",
                },
              }),
            }),
          ],
        })
      );
    });

    it("should include enrollment fee as additional one-time line item", async () => {
      mockCheckoutSessionsCreate.mockResolvedValueOnce({
        id: "cs_enrollment",
        url: "https://checkout.stripe.com/session/cs_enrollment",
      });

      await createSubscriptionCheckoutSession({
        customerId: "cus_123",
        priceAmountCents: 5000,
        membershipId: "membership-1",
        memberId: "member-1",
        organizationId: "org-1",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        planName: "Gold",
        enrollmentFee: {
          amountCents: 2500,
          description: "One-time enrollment",
        },
      });

      const callArgs = mockCheckoutSessionsCreate.mock.calls[0][0];
      expect(callArgs.line_items).toHaveLength(2);

      const enrollmentItem = callArgs.line_items[1];
      expect(enrollmentItem.price_data.unit_amount).toBe(2500);
      expect(enrollmentItem.price_data.product_data.name).toBe("One-time enrollment");
      expect(enrollmentItem.price_data.recurring).toBeUndefined();
    });

    it("should use default enrollment fee description when not provided", async () => {
      mockCheckoutSessionsCreate.mockResolvedValueOnce({
        id: "cs_enrollment_default",
        url: "https://checkout.stripe.com/session/cs_enrollment_default",
      });

      await createSubscriptionCheckoutSession({
        customerId: "cus_123",
        priceAmountCents: 5000,
        membershipId: "membership-1",
        memberId: "member-1",
        organizationId: "org-1",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        planName: "Silver",
        enrollmentFee: {
          amountCents: 1000,
        },
      });

      const callArgs = mockCheckoutSessionsCreate.mock.calls[0][0];
      const enrollmentItem = callArgs.line_items[1];
      expect(enrollmentItem.price_data.product_data.name).toBe("Silver Enrollment Fee");
    });

    it("should include enrollment fee tracking metadata in subscription and session", async () => {
      mockCheckoutSessionsCreate.mockResolvedValueOnce({
        id: "cs_meta",
        url: "https://checkout.stripe.com/session/cs_meta",
      });

      await createSubscriptionCheckoutSession({
        customerId: "cus_123",
        priceAmountCents: 5000,
        membershipId: "membership-1",
        memberId: "member-1",
        organizationId: "org-1",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        enrollmentFee: { amountCents: 2500 },
      });

      const callArgs = mockCheckoutSessionsCreate.mock.calls[0][0];

      expect(callArgs.metadata.includes_enrollment_fee).toBe("true");
      expect(callArgs.metadata.enrollment_fee_amount_cents).toBe("2500");
      expect(callArgs.subscription_data.metadata.includes_enrollment_fee).toBe("true");
      expect(callArgs.subscription_data.metadata.enrollment_fee_amount_cents).toBe("2500");
    });

    it("should add Connect transfer_data when connectParams provided", async () => {
      mockCheckoutSessionsCreate.mockResolvedValueOnce({
        id: "cs_connect",
        url: "https://checkout.stripe.com/session/cs_connect",
      });

      await createSubscriptionCheckoutSession({
        customerId: "cus_123",
        priceAmountCents: 5000,
        membershipId: "membership-1",
        memberId: "member-1",
        organizationId: "org-1",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        connectParams: {
          stripeConnectId: "acct_connected",
          applicationFeeCents: 500,
        },
      });

      const callArgs = mockCheckoutSessionsCreate.mock.calls[0][0];
      expect(callArgs.subscription_data.transfer_data).toEqual({
        destination: "acct_connected",
      });
    });

    it("should throw when session URL is null", async () => {
      mockCheckoutSessionsCreate.mockResolvedValueOnce({
        id: "cs_no_url",
        url: null,
      });

      await expect(
        createSubscriptionCheckoutSession({
          customerId: "cus_123",
          priceAmountCents: 5000,
          membershipId: "membership-1",
          memberId: "member-1",
          organizationId: "org-1",
          successUrl: "https://example.com/success",
          cancelUrl: "https://example.com/cancel",
        })
      ).rejects.toThrow("Failed to create checkout session URL");
    });

    it("should use defaults for billingFrequency and planName", async () => {
      mockCheckoutSessionsCreate.mockResolvedValueOnce({
        id: "cs_defaults",
        url: "https://checkout.stripe.com/session/cs_defaults",
      });

      await createSubscriptionCheckoutSession({
        customerId: "cus_123",
        priceAmountCents: 5000,
        membershipId: "membership-1",
        memberId: "member-1",
        organizationId: "org-1",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      });

      const callArgs = mockCheckoutSessionsCreate.mock.calls[0][0];
      expect(callArgs.line_items[0].price_data.product_data.name).toBe("Membership Dues");
      expect(callArgs.line_items[0].price_data.recurring).toEqual({
        interval: "month",
        interval_count: 1,
      });
      expect(callArgs.metadata.billing_frequency).toBe("monthly");
    });
  });

  // --------------------------------------------------------------------------
  // createCustomerPortalSession
  // --------------------------------------------------------------------------
  describe("createCustomerPortalSession", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should create a portal session and return the URL", async () => {
      mockBillingPortalSessionsCreate.mockResolvedValueOnce({
        url: "https://billing.stripe.com/portal/sess_123",
      });

      const result = await createCustomerPortalSession({
        customerId: "cus_123",
        returnUrl: "https://example.com/dashboard",
      });

      expect(result.url).toBe("https://billing.stripe.com/portal/sess_123");
      expect(mockBillingPortalSessionsCreate).toHaveBeenCalledWith({
        customer: "cus_123",
        return_url: "https://example.com/dashboard",
      });
    });
  });

  // --------------------------------------------------------------------------
  // cancelSubscription
  // --------------------------------------------------------------------------
  describe("cancelSubscription", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return true for already canceled subscription", async () => {
      mockSubscriptionsRetrieve.mockResolvedValueOnce({ status: "canceled" });

      const result = await cancelSubscription("sub_already_canceled");

      expect(result).toBe(true);
      expect(mockSubscriptionsCancel).not.toHaveBeenCalled();
    });

    it("should cancel and return true when subscription is active", async () => {
      mockSubscriptionsRetrieve.mockResolvedValueOnce({ status: "active" });
      mockSubscriptionsCancel.mockResolvedValueOnce({ status: "canceled" });

      const result = await cancelSubscription("sub_active");

      expect(result).toBe(true);
      expect(mockSubscriptionsCancel).toHaveBeenCalledWith("sub_active");
    });

    it("should return true when subscription does not exist", async () => {
      mockSubscriptionsRetrieve.mockRejectedValueOnce(
        new Error("No such subscription: sub_gone")
      );

      const result = await cancelSubscription("sub_gone");

      expect(result).toBe(true);
    });

    it("should throw for other errors", async () => {
      mockSubscriptionsRetrieve.mockRejectedValueOnce(
        new Error("Stripe API is down")
      );

      await expect(cancelSubscription("sub_123")).rejects.toThrow("Stripe API is down");
    });
  });

  // --------------------------------------------------------------------------
  // pauseSubscription
  // --------------------------------------------------------------------------
  describe("pauseSubscription", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should pause subscription with mark_uncollectible behavior", async () => {
      mockSubscriptionsUpdate.mockResolvedValueOnce({});

      await pauseSubscription("sub_to_pause");

      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith("sub_to_pause", {
        pause_collection: {
          behavior: "mark_uncollectible",
        },
      });
    });
  });

  // --------------------------------------------------------------------------
  // resumeSubscription
  // --------------------------------------------------------------------------
  describe("resumeSubscription", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should resume subscription by clearing pause_collection", async () => {
      mockSubscriptionsUpdate.mockResolvedValueOnce({});

      await resumeSubscription("sub_to_resume");

      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith("sub_to_resume", {
        pause_collection: null,
      });
    });
  });

  // --------------------------------------------------------------------------
  // getCustomerDefaultPaymentMethod
  // --------------------------------------------------------------------------
  describe("getCustomerDefaultPaymentMethod", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return null for deleted customer", async () => {
      mockCustomersRetrieve.mockResolvedValueOnce({ deleted: true });

      const result = await getCustomerDefaultPaymentMethod("cus_deleted");

      expect(result).toBeNull();
    });

    it("should return default payment method when set", async () => {
      mockCustomersRetrieve.mockResolvedValueOnce({
        deleted: false,
        invoice_settings: { default_payment_method: "pm_card_visa" },
      });
      mockPaymentMethodsRetrieve.mockResolvedValueOnce({
        id: "pm_card_visa",
        type: "card",
        card: { last4: "4242", brand: "visa" },
      });

      const result = await getCustomerDefaultPaymentMethod("cus_123");

      expect(result).toEqual({
        id: "pm_card_visa",
        type: "card",
        last4: "4242",
        brand: "visa",
      });
    });

    it("should fallback to payment methods list when no default set", async () => {
      mockCustomersRetrieve.mockResolvedValueOnce({
        deleted: false,
        invoice_settings: { default_payment_method: null },
      });
      mockPaymentMethodsList.mockResolvedValueOnce({
        data: [
          {
            id: "pm_fallback",
            type: "card",
            card: { last4: "1234", brand: "mastercard" },
          },
        ],
      });

      const result = await getCustomerDefaultPaymentMethod("cus_123");

      expect(result).toEqual({
        id: "pm_fallback",
        type: "card",
        last4: "1234",
        brand: "mastercard",
      });
      expect(mockPaymentMethodsList).toHaveBeenCalledWith({
        customer: "cus_123",
        type: "card",
        limit: 1,
      });
    });

    it("should return null when no payment methods exist at all", async () => {
      mockCustomersRetrieve.mockResolvedValueOnce({
        deleted: false,
        invoice_settings: { default_payment_method: null },
      });
      mockPaymentMethodsList.mockResolvedValueOnce({ data: [] });

      const result = await getCustomerDefaultPaymentMethod("cus_no_pm");

      expect(result).toBeNull();
    });

    it("should use '****' when card last4 is not available", async () => {
      mockCustomersRetrieve.mockResolvedValueOnce({
        deleted: false,
        invoice_settings: { default_payment_method: "pm_no_card_details" },
      });
      mockPaymentMethodsRetrieve.mockResolvedValueOnce({
        id: "pm_no_card_details",
        type: "card",
        card: null,
      });

      const result = await getCustomerDefaultPaymentMethod("cus_123");

      expect(result).toEqual({
        id: "pm_no_card_details",
        type: "card",
        last4: "****",
        brand: undefined,
      });
    });

    it("should fallback to list when default_payment_method is an object (not string)", async () => {
      mockCustomersRetrieve.mockResolvedValueOnce({
        deleted: false,
        invoice_settings: {
          default_payment_method: { id: "pm_expanded" },
        },
      });
      mockPaymentMethodsList.mockResolvedValueOnce({
        data: [
          {
            id: "pm_from_list",
            type: "card",
            card: { last4: "5678", brand: "amex" },
          },
        ],
      });

      const result = await getCustomerDefaultPaymentMethod("cus_123");

      expect(result).toEqual({
        id: "pm_from_list",
        type: "card",
        last4: "5678",
        brand: "amex",
      });
    });
  });

  // ==========================================================================
  // INTEGRATION SCENARIOS
  // ==========================================================================
  describe("Integration scenarios", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should calculate fees and use them in a Connect payment intent", async () => {
      const baseAmountCents = 10000;
      const platformFeeDollars = 2;
      const passFeesToMember = true;

      const fees = calculateFees(baseAmountCents, platformFeeDollars, passFeesToMember);

      mockPaymentIntentsCreate.mockResolvedValueOnce({
        id: "pi_integration",
        client_secret: "pi_integration_secret",
      });

      await createPaymentIntent({
        customerId: "cus_123",
        amountCents: fees.chargeAmountCents,
        membershipId: "membership-1",
        memberId: "member-1",
        organizationId: "org-1",
        connectParams: {
          stripeConnectId: "acct_org",
          applicationFeeCents: fees.applicationFeeCents,
        },
      });

      expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: fees.chargeAmountCents,
          application_fee_amount: fees.applicationFeeCents,
          transfer_data: {
            destination: "acct_org",
          },
        })
      );
    });

    it("should reverse-calculate base from a webhook charge amount", () => {
      const originalBase = 10000;
      const platformDollars = 2;

      const fees = calculateFees(originalBase, platformDollars, true);

      const recoveredBase = reverseCalculateBaseAmount(
        fees.chargeAmountCents,
        platformDollars,
        true
      );

      expect(Math.abs(recoveredBase - originalBase)).toBeLessThanOrEqual(1);
    });
  });
});
