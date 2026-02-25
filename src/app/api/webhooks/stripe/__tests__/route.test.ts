import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

// ---------------------------------------------------------------------------
// Hoisted mock variables — available inside vi.mock factories
// ---------------------------------------------------------------------------
const {
  mockConstructEvent,
  mockSubscriptionsRetrieve,
  mockPaymentMethodsRetrieve,
  mockInvoicesUpdate,
  mockInvoicesList,
  mockCustomersUpdate,
  mockPricesCreate,
  mockSubscriptionsCreate,
  mockPaymentIntentsCreate,
  mockPaymentIntentsRetrieve,
  mockSettlePayment,
  mockGenerateAdHocInvoiceMetadata,
  mockGetTodayInOrgTimezone,
  mockCalculateFees,
  mockReverseCalculateBaseAmount,
  mockSendPaymentReceiptEmail,
  mockGetByCheckoutSessionId,
  mockGetBySetupIntentId,
  mockRecordFullPayment,
  supabaseQueues,
  supabaseInsertCalls,
  supabaseUpdateCalls,
} = vi.hoisted(() => {
  // Set env vars inside hoisted block so they're available when route.ts module loads
  process.env.STRIPE_SECRET_KEY = "sk_test_mock";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_mock";

  return {
    mockConstructEvent: vi.fn(),
    mockSubscriptionsRetrieve: vi.fn(),
    mockPaymentMethodsRetrieve: vi.fn(),
    mockInvoicesUpdate: vi.fn(),
    mockInvoicesList: vi.fn(),
    mockCustomersUpdate: vi.fn(),
    mockPricesCreate: vi.fn(),
    mockSubscriptionsCreate: vi.fn(),
    mockPaymentIntentsCreate: vi.fn(),
    mockPaymentIntentsRetrieve: vi.fn(),
    mockSettlePayment: vi.fn(),
    mockGenerateAdHocInvoiceMetadata: vi.fn(),
    mockGetTodayInOrgTimezone: vi.fn(),
    mockCalculateFees: vi.fn(),
    mockReverseCalculateBaseAmount: vi.fn(),
    mockSendPaymentReceiptEmail: vi.fn(),
    mockGetByCheckoutSessionId: vi.fn(),
    mockGetBySetupIntentId: vi.fn(),
    mockRecordFullPayment: vi.fn(),
    supabaseQueues: {} as Record<string, Array<{ data?: unknown; error?: { message: string; code?: string } | null }>>,
    supabaseInsertCalls: [] as Array<{ table: string; data: unknown }>,
    supabaseUpdateCalls: [] as Array<{ table: string; data: unknown }>,
  };
});

// ---------------------------------------------------------------------------
// Mock all external dependencies
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}));

vi.mock("stripe", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("stripe");

  const mockStripeInstance = {
    webhooks: { constructEvent: mockConstructEvent },
    subscriptions: {
      retrieve: mockSubscriptionsRetrieve,
      create: mockSubscriptionsCreate,
    },
    paymentMethods: { retrieve: mockPaymentMethodsRetrieve },
    invoices: { update: mockInvoicesUpdate, list: mockInvoicesList },
    customers: { update: mockCustomersUpdate },
    prices: { create: mockPricesCreate },
    paymentIntents: { create: mockPaymentIntentsCreate, retrieve: mockPaymentIntentsRetrieve },
  };

  class MockStripe {
    constructor() {
      return mockStripeInstance;
    }
    static errors = actual.default.errors;
  }

  return { default: MockStripe };
});

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn((name: string) => {
      if (name === "stripe-signature") return "sig_test_123";
      return null;
    }),
  }),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status || 200,
    })),
  },
}));

// ---------------------------------------------------------------------------
// Supabase mock with chainable API
// ---------------------------------------------------------------------------

function enqueueResult(table: string, result: { data?: unknown; error?: { message: string; code?: string } | null }) {
  if (!supabaseQueues[table]) supabaseQueues[table] = [];
  supabaseQueues[table].push(result);
}

function dequeueResult(table: string) {
  const queue = supabaseQueues[table];
  if (queue && queue.length > 0) return queue.shift()!;
  return { data: null, error: null };
}

function resetQueues() {
  for (const key of Object.keys(supabaseQueues)) {
    delete supabaseQueues[key];
  }
  supabaseInsertCalls.length = 0;
  supabaseUpdateCalls.length = 0;
}

function buildChain(table: string) {
  const chain: Record<string, unknown> = {};
  const chainMethods = ["select", "eq", "neq", "or", "is", "in", "gte", "order", "limit"];

  for (const method of chainMethods) {
    chain[method] = vi.fn(() => chain);
  }

  chain.insert = vi.fn((data: unknown) => {
    supabaseInsertCalls.push({ table, data });
    return buildChain(table);
  });

  chain.update = vi.fn((data: unknown) => {
    supabaseUpdateCalls.push({ table, data });
    return buildChain(table);
  });

  chain.single = vi.fn(() => Promise.resolve(dequeueResult(table)));
  chain.maybeSingle = vi.fn(() => Promise.resolve(dequeueResult(table)));

  // For non-terminal chains (insert/update without select)
  chain.then = (resolve: (val: unknown) => void) => {
    return Promise.resolve(dequeueResult(table)).then(resolve);
  };

  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({
    from: vi.fn((table: string) => buildChain(table)),
  }),
  createClientForContext: vi.fn(),
}));

vi.mock("@/lib/billing/engine", () => ({
  settlePayment: (...args: unknown[]) => mockSettlePayment(...args),
}));

vi.mock("@/lib/billing/invoice-generator", () => ({
  generateAdHocInvoiceMetadata: (...args: unknown[]) => mockGenerateAdHocInvoiceMetadata(...args),
  getTodayInOrgTimezone: (...args: unknown[]) => mockGetTodayInOrgTimezone(...args),
}));

vi.mock("@/lib/stripe", () => ({
  calculateFees: (...args: unknown[]) => mockCalculateFees(...args),
  reverseCalculateBaseAmount: (...args: unknown[]) => mockReverseCalculateBaseAmount(...args),
  getPlatformFee: (fees: Record<string, number> | null | undefined, freq: string) => fees?.[freq] || 0,
}));

vi.mock("@/lib/email/send-payment-receipt", () => ({
  sendPaymentReceiptEmail: (...args: unknown[]) => mockSendPaymentReceiptEmail(...args),
}));

vi.mock("@/lib/database/onboarding-invites", () => ({
  OnboardingInvitesService: {
    getByCheckoutSessionId: (...args: unknown[]) => mockGetByCheckoutSessionId(...args),
    getBySetupIntentId: (...args: unknown[]) => mockGetBySetupIntentId(...args),
    recordFullPayment: (...args: unknown[]) => mockRecordFullPayment(...args),
  },
}));

// ---------------------------------------------------------------------------
// Import the route under test AFTER all mocks
// ---------------------------------------------------------------------------

import { POST } from "../route";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRequest(body = "mock_body"): Request {
  return {
    text: () => Promise.resolve(body),
  } as unknown as Request;
}

function createStripeEvent(
  type: string,
  dataObject: Record<string, unknown> = {},
  overrides: Partial<Stripe.Event> = {}
): Stripe.Event {
  return {
    id: `evt_test_${Date.now()}`,
    type,
    data: {
      object: {
        metadata: {},
        ...dataObject,
      },
    },
    ...overrides,
  } as unknown as Stripe.Event;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Stripe Webhook Route POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetQueues();
  });

  describe("Signature verification", () => {
    it("should return 400 for invalid signature", async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error("Webhook signature verification failed");
      });

      await POST(createMockRequest());

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "Invalid signature" },
        { status: 400 }
      );
    });
  });

  describe("Ignored events", () => {
    it("should acknowledge billing_portal.configuration.created", async () => {
      const event = createStripeEvent("billing_portal.configuration.created");
      mockConstructEvent.mockReturnValueOnce(event);

      await POST(createMockRequest());

      expect(NextResponse.json).toHaveBeenCalledWith({ acknowledged: true });
    });

    it("should acknowledge billing_portal.configuration.updated", async () => {
      const event = createStripeEvent("billing_portal.configuration.updated");
      mockConstructEvent.mockReturnValueOnce(event);

      await POST(createMockRequest());

      expect(NextResponse.json).toHaveBeenCalledWith({ acknowledged: true });
    });

    it("should acknowledge billing_portal.session.created", async () => {
      const event = createStripeEvent("billing_portal.session.created");
      mockConstructEvent.mockReturnValueOnce(event);

      await POST(createMockRequest());

      expect(NextResponse.json).toHaveBeenCalledWith({ acknowledged: true });
    });

    it("should acknowledge invoice.payment_succeeded", async () => {
      const event = createStripeEvent("invoice.payment_succeeded");
      mockConstructEvent.mockReturnValueOnce(event);

      await POST(createMockRequest());

      expect(NextResponse.json).toHaveBeenCalledWith({ acknowledged: true });
    });
  });

  describe("Idempotency", () => {
    it("should skip already-processed events", async () => {
      const event = createStripeEvent("checkout.session.completed", {
        metadata: { membership_id: "mem_123" },
      });
      mockConstructEvent.mockReturnValueOnce(event);

      // Event already exists in DB
      enqueueResult("stripe_webhook_events", {
        data: { id: "we_123", status: "processed" },
      });

      await POST(createMockRequest());

      expect(NextResponse.json).toHaveBeenCalledWith({
        received: true,
        duplicate: true,
      });
    });
  });

  describe("checkout.session.completed", () => {
    it("should save subscription ID to membership", async () => {
      const event = createStripeEvent("checkout.session.completed", {
        id: "cs_test_123",
        mode: "subscription",
        subscription: "sub_test_456",
        metadata: {
          membership_id: "mem_123",
          organization_id: "org_123",
        },
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });

      // Subscription retrieve for payment method
      mockSubscriptionsRetrieve.mockResolvedValueOnce({
        default_payment_method: "pm_test_789",
      });
      mockPaymentMethodsRetrieve.mockResolvedValueOnce({
        type: "card",
        card: { last4: "4242", brand: "visa", exp_month: 12, exp_year: 2025 },
      });

      // Membership update
      enqueueResult("memberships", { data: null, error: null });
      // Onboarding invite lookup
      mockGetByCheckoutSessionId.mockResolvedValueOnce(null);
      // Record webhook event
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(NextResponse.json).toHaveBeenCalledWith({ received: true });
      expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith("sub_test_456");
    });

    it("should handle enrollment fee in checkout", async () => {
      const event = createStripeEvent("checkout.session.completed", {
        id: "cs_test_enroll",
        mode: "subscription",
        subscription: "sub_enroll",
        metadata: {
          membership_id: "mem_enroll",
          organization_id: "org_123",
          member_id: "mbr_123",
          includes_enrollment_fee: "true",
          enrollment_fee_amount_cents: "5000",
        },
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      // Enrollment fee payment insert
      enqueueResult("payments", { data: null, error: null });
      // Subscription retrieve
      mockSubscriptionsRetrieve.mockResolvedValueOnce({
        default_payment_method: "pm_123",
      });
      mockPaymentMethodsRetrieve.mockResolvedValueOnce({
        type: "card",
        card: { last4: "1234", brand: "mastercard", exp_month: 6, exp_year: 2026 },
      });
      // Membership update
      enqueueResult("memberships", { data: null, error: null });
      // Onboarding invite
      mockGetByCheckoutSessionId.mockResolvedValueOnce(null);
      // Webhook event record
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(NextResponse.json).toHaveBeenCalledWith({ received: true });
      const enrollmentInsert = supabaseInsertCalls.find(
        (c) => c.table === "payments" && (c.data as Record<string, unknown>).type === "enrollment_fee"
      );
      expect(enrollmentInsert).toBeDefined();
    });

    it("should skip when no membership_id in session metadata", async () => {
      const event = createStripeEvent("checkout.session.completed", {
        metadata: {},
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(NextResponse.json).toHaveBeenCalledWith({ received: true });
      expect(mockSubscriptionsRetrieve).not.toHaveBeenCalled();
    });

    it("should complete onboarding invite when present", async () => {
      const event = createStripeEvent("checkout.session.completed", {
        id: "cs_invite_test",
        mode: "subscription",
        subscription: "sub_invite",
        metadata: { membership_id: "mem_invite" },
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      mockSubscriptionsRetrieve.mockResolvedValueOnce({
        default_payment_method: null,
      });
      enqueueResult("memberships", { data: null, error: null });
      mockGetByCheckoutSessionId.mockResolvedValueOnce({
        id: "invite_123",
        status: "pending",
      });
      mockRecordFullPayment.mockResolvedValueOnce({});
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(mockRecordFullPayment).toHaveBeenCalledWith(
        "invite_123",
        expect.anything()
      );
    });

    it("should handle US bank account payment method", async () => {
      const event = createStripeEvent("checkout.session.completed", {
        id: "cs_bank",
        mode: "subscription",
        subscription: "sub_bank",
        metadata: { membership_id: "mem_bank" },
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      mockSubscriptionsRetrieve.mockResolvedValueOnce({
        default_payment_method: "pm_bank",
      });
      mockPaymentMethodsRetrieve.mockResolvedValueOnce({
        type: "us_bank_account",
        us_bank_account: { last4: "6789", bank_name: "Chase" },
        card: null,
      });
      enqueueResult("memberships", { data: null, error: null });
      mockGetByCheckoutSessionId.mockResolvedValueOnce(null);
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(NextResponse.json).toHaveBeenCalledWith({ received: true });
    });
  });

  describe("customer.subscription.updated", () => {
    it("should sync subscription status to local database", async () => {
      const event = createStripeEvent("customer.subscription.updated", {
        id: "sub_updated",
        status: "active",
        metadata: { membership_id: "mem_sub_update" },
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("memberships", { data: null, error: null });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(NextResponse.json).toHaveBeenCalledWith({ received: true });
      const membershipUpdate = supabaseUpdateCalls.find((c) => c.table === "memberships");
      expect(membershipUpdate).toBeDefined();
      expect((membershipUpdate!.data as Record<string, unknown>).subscription_status).toBe("active");
      expect((membershipUpdate!.data as Record<string, unknown>).auto_pay_enabled).toBe(true);
    });

    it("should map past_due status and disable auto_pay", async () => {
      const event = createStripeEvent("customer.subscription.updated", {
        id: "sub_past_due",
        status: "past_due",
        metadata: { membership_id: "mem_past_due" },
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("memberships", { data: null, error: null });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      const membershipUpdate = supabaseUpdateCalls.find((c) => c.table === "memberships");
      expect((membershipUpdate!.data as Record<string, unknown>).subscription_status).toBe("past_due");
      expect((membershipUpdate!.data as Record<string, unknown>).auto_pay_enabled).toBe(false);
    });

    it("should enable auto_pay for trialing status", async () => {
      const event = createStripeEvent("customer.subscription.updated", {
        id: "sub_trialing",
        status: "trialing",
        metadata: { membership_id: "mem_trialing" },
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("memberships", { data: null, error: null });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      const membershipUpdate = supabaseUpdateCalls.find((c) => c.table === "memberships");
      expect((membershipUpdate!.data as Record<string, unknown>).auto_pay_enabled).toBe(true);
    });

    it("should skip when no membership_id in metadata", async () => {
      const event = createStripeEvent("customer.subscription.updated", {
        id: "sub_no_meta",
        status: "active",
        metadata: {},
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      const membershipUpdate = supabaseUpdateCalls.find((c) => c.table === "memberships");
      expect(membershipUpdate).toBeUndefined();
    });

    it("should map canceled status correctly", async () => {
      const event = createStripeEvent("customer.subscription.updated", {
        id: "sub_canceled",
        status: "canceled",
        metadata: { membership_id: "mem_canceled" },
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("memberships", { data: null, error: null });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      const membershipUpdate = supabaseUpdateCalls.find((c) => c.table === "memberships");
      expect((membershipUpdate!.data as Record<string, unknown>).subscription_status).toBe("canceled");
      expect((membershipUpdate!.data as Record<string, unknown>).auto_pay_enabled).toBe(false);
    });
  });

  describe("customer.subscription.created", () => {
    it("should be handled same as subscription.updated", async () => {
      const event = createStripeEvent("customer.subscription.created", {
        id: "sub_created",
        status: "active",
        metadata: { membership_id: "mem_created" },
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("memberships", { data: null, error: null });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(NextResponse.json).toHaveBeenCalledWith({ received: true });
      const update = supabaseUpdateCalls.find((c) => c.table === "memberships");
      expect(update).toBeDefined();
      expect((update!.data as Record<string, unknown>).subscription_status).toBe("active");
    });
  });

  describe("customer.subscription.deleted", () => {
    it("should clear subscription ID and mark as canceled", async () => {
      const event = createStripeEvent("customer.subscription.deleted", {
        id: "sub_deleted",
        metadata: { membership_id: "mem_deleted" },
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("memberships", { data: null, error: null });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(NextResponse.json).toHaveBeenCalledWith({ received: true });
      const membershipUpdate = supabaseUpdateCalls.find((c) => c.table === "memberships");
      expect(membershipUpdate).toBeDefined();
      expect((membershipUpdate!.data as Record<string, unknown>).stripe_subscription_id).toBeNull();
      expect((membershipUpdate!.data as Record<string, unknown>).subscription_status).toBe("canceled");
      expect((membershipUpdate!.data as Record<string, unknown>).auto_pay_enabled).toBe(false);
    });

    it("should record failed event and return 500 on DB error", async () => {
      const event = createStripeEvent("customer.subscription.deleted", {
        id: "sub_fail",
        metadata: { membership_id: "mem_fail" },
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("memberships", {
        data: null,
        error: { message: "DB error" },
      });
      // Error recording
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(String) }),
        { status: 500 }
      );
    });
  });

  describe("invoice.created", () => {
    it("should set application_fee_amount for Connect subscription invoice", async () => {
      const event = createStripeEvent("invoice.created", {
        id: "inv_created",
        subscription: "sub_connect",
        amount_due: 5000,
        application_fee_amount: null,
        metadata: {},
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("memberships", {
        data: { id: "mem_connect", organization_id: "org_connect", billing_frequency: "monthly" },
      });
      enqueueResult("organizations", {
        data: {
          stripe_connect_id: "acct_connect",
          stripe_onboarded: true,
          platform_fees: { monthly: 3, biannual: 3, annual: 3 },
          pass_fees_to_member: false,
        },
      });

      mockReverseCalculateBaseAmount.mockReturnValueOnce(4700);
      mockCalculateFees.mockReturnValueOnce({
        applicationFeeCents: 475,
        platformFeeCents: 300,
        stripeFeeCents: 175,
        netAmountCents: 4525,
      });
      mockInvoicesUpdate.mockResolvedValueOnce({});

      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(mockInvoicesUpdate).toHaveBeenCalledWith("inv_created", {
        application_fee_amount: 475,
      });
    });

    it("should skip non-subscription invoices", async () => {
      const event = createStripeEvent("invoice.created", {
        id: "inv_no_sub",
        subscription: null,
        amount_due: 5000,
        metadata: {},
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(mockInvoicesUpdate).not.toHaveBeenCalled();
    });

    it("should skip when application_fee_amount already set", async () => {
      const event = createStripeEvent("invoice.created", {
        id: "inv_already_set",
        subscription: "sub_already",
        amount_due: 5000,
        application_fee_amount: 300,
        metadata: {},
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(mockInvoicesUpdate).not.toHaveBeenCalled();
    });

    it("should skip $0 invoices", async () => {
      const event = createStripeEvent("invoice.created", {
        id: "inv_zero",
        subscription: "sub_zero",
        amount_due: 0,
        application_fee_amount: null,
        metadata: {},
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("memberships", {
        data: { id: "mem_zero", organization_id: "org_zero", billing_frequency: "monthly" },
      });
      enqueueResult("organizations", {
        data: {
          stripe_connect_id: "acct_zero",
          stripe_onboarded: true,
          platform_fees: { monthly: 3, biannual: 3, annual: 3 },
          pass_fees_to_member: false,
        },
      });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(mockInvoicesUpdate).not.toHaveBeenCalled();
    });

    it("should skip when org has no Connect account", async () => {
      const event = createStripeEvent("invoice.created", {
        id: "inv_no_connect",
        subscription: "sub_no_connect",
        amount_due: 5000,
        application_fee_amount: null,
        metadata: {},
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("memberships", {
        data: { id: "mem_nc", organization_id: "org_nc", billing_frequency: "monthly" },
      });
      enqueueResult("organizations", {
        data: {
          stripe_connect_id: null,
          stripe_onboarded: false,
          platform_fees: { monthly: 0, biannual: 0, annual: 0 },
          pass_fees_to_member: false,
        },
      });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(mockInvoicesUpdate).not.toHaveBeenCalled();
    });

    it("should skip when no membership found for subscription", async () => {
      const event = createStripeEvent("invoice.created", {
        id: "inv_no_mem",
        subscription: "sub_orphan",
        amount_due: 5000,
        application_fee_amount: null,
        metadata: {},
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("memberships", { data: null });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(mockInvoicesUpdate).not.toHaveBeenCalled();
    });
  });

  describe("invoice.paid", () => {
    it("should create payment record and settle via engine", async () => {
      const event = createStripeEvent("invoice.paid", {
        id: "inv_paid",
        subscription: "sub_paid",
        amount_paid: 5000,
        payment_intent: "pi_inv_paid",
        number: "INV-2025-001",
        metadata: {},
        subscription_details: { metadata: {} },
        billing_reason: "subscription_cycle",
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      // Lookup membership by subscription
      enqueueResult("memberships", {
        data: {
          id: "mem_inv_paid",
          organization_id: "org_inv_paid",
          member_id: "mbr_inv_paid",
          billing_frequency: "monthly",
          plan: { pricing: { monthly: 47, biannual: 270, annual: 500 } },
        },
      });
      // Check for existing completed payment (idempotency)
      enqueueResult("payments", { data: null });
      // Check for pending/processing payment to settle (PI-based)
      enqueueResult("payments", { data: null });
      // Fallback: check for orphaned processing payment (no PI)
      enqueueResult("payments", { data: null });
      // Get membership details for months
      enqueueResult("memberships", {
        data: {
          billing_frequency: "monthly",
          plan: { pricing: { monthly: 47, biannual: 270, annual: 500 } },
        },
      });
      // Org lookup
      enqueueResult("organizations", {
        data: {
          timezone: "America/New_York",
          platform_fees: { monthly: 3, biannual: 3, annual: 3 },
          stripe_connect_id: "acct_paid",
          pass_fees_to_member: false,
        },
      });

      mockGetTodayInOrgTimezone.mockReturnValueOnce("2025-02-10");
      mockReverseCalculateBaseAmount.mockReturnValueOnce(4700);
      mockCalculateFees.mockReturnValueOnce({
        chargeAmountCents: 5000,
        applicationFeeCents: 475,
        platformFeeCents: 300,
        stripeFeeCents: 175,
        netAmountCents: 4525,
        breakdown: {
          stripeFee: 1.75,
          platformFee: 3.0,
          chargeAmount: 50.0,
          totalFees: 4.75,
        },
      });

      mockGenerateAdHocInvoiceMetadata.mockResolvedValueOnce({
        invoiceNumber: "INV-ORG-001",
        dueDate: "2025-02-10",
        periodStart: "2025-02-10",
        periodEnd: "2025-03-09",
        periodLabel: "Feb 2025",
      });

      // Mock paymentIntents.retrieve for stripe_payment_method_type derivation
      mockPaymentIntentsRetrieve.mockResolvedValueOnce({
        id: "pi_inv_paid",
        payment_method: "pm_card_123",
      });
      mockPaymentMethodsRetrieve.mockResolvedValueOnce({
        id: "pm_card_123",
        type: "card",
        card: { last4: "4242", brand: "visa" },
      });
      // Create payment
      enqueueResult("payments", { data: { id: "pay_inv_paid" }, error: null });
      // Settle payment
      mockSettlePayment.mockResolvedValueOnce({
        success: true,
        newPaidMonths: 5,
        newStatus: "current",
        becameEligible: false,
      });
      // Record webhook event
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(NextResponse.json).toHaveBeenCalledWith({ received: true });
      expect(mockSettlePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: "pay_inv_paid",
          method: "stripe",
        })
      );

      // Verify stripe_payment_method_type was included in the payment insert
      const paymentInsert = supabaseInsertCalls.find(
        (c) => c.table === "payments" && (c.data as Record<string, unknown>).type === "dues"
      );
      expect(paymentInsert).toBeDefined();
      expect((paymentInsert!.data as Record<string, unknown>).stripe_payment_method_type).toBe("card");
    });

    it("should skip $0 invoices", async () => {
      const event = createStripeEvent("invoice.paid", {
        id: "inv_zero_paid",
        subscription: "sub_zero_paid",
        amount_paid: 0,
        metadata: {},
        subscription_details: { metadata: {} },
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("memberships", {
        data: { id: "mem_z", organization_id: "org_z", member_id: "mbr_z" },
      });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(mockSettlePayment).not.toHaveBeenCalled();
    });

    it("should skip duplicate payment (already completed)", async () => {
      const event = createStripeEvent("invoice.paid", {
        id: "inv_dup",
        subscription: "sub_dup",
        amount_paid: 5000,
        payment_intent: "pi_dup",
        metadata: {},
        subscription_details: { metadata: {} },
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("memberships", {
        data: { id: "mem_dup", organization_id: "org_dup", member_id: "mbr_dup" },
      });
      // Existing completed payment found
      enqueueResult("payments", { data: { id: "pay_dup_existing" } });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(mockSettlePayment).not.toHaveBeenCalled();
    });

    it("should subtract enrollment fee from first invoice", async () => {
      const event = createStripeEvent("invoice.paid", {
        id: "inv_with_enroll",
        subscription: "sub_enroll",
        amount_paid: 10000,
        payment_intent: "pi_enroll",
        metadata: {},
        subscription_details: {
          metadata: {
            includes_enrollment_fee: "true",
            enrollment_fee_amount_cents: "5000",
          },
        },
        billing_reason: "subscription_create",
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("memberships", {
        data: { id: "mem_e", organization_id: "org_e", member_id: "mbr_e" },
      });
      // Check for existing completed payment
      enqueueResult("payments", { data: null });
      // Check for pending/processing payment (PI-based)
      enqueueResult("payments", { data: null });
      // Fallback: check for orphaned processing payment (no PI)
      enqueueResult("payments", { data: null });
      enqueueResult("memberships", {
        data: {
          billing_frequency: "monthly",
          plan: { pricing: { monthly: 47, biannual: 270, annual: 500 } },
        },
      });
      enqueueResult("organizations", {
        data: {
          timezone: "UTC",
          platform_fees: { monthly: 0, biannual: 0, annual: 0 },
          stripe_connect_id: null,
          pass_fees_to_member: false,
        },
      });

      mockGetTodayInOrgTimezone.mockReturnValueOnce("2025-02-10");
      mockReverseCalculateBaseAmount.mockReturnValueOnce(5000);
      mockCalculateFees.mockReturnValueOnce({
        chargeAmountCents: 5000,
        netAmountCents: 5000,
        breakdown: { stripeFee: 0, platformFee: 0, chargeAmount: 50, totalFees: 0 },
      });
      mockGenerateAdHocInvoiceMetadata.mockResolvedValueOnce({
        invoiceNumber: "INV-001",
        dueDate: "2025-02-10",
        periodStart: "2025-02-10",
        periodEnd: "2025-03-09",
        periodLabel: "Feb 2025",
      });
      // Mock paymentIntents.retrieve for stripe_payment_method_type
      mockPaymentIntentsRetrieve.mockResolvedValueOnce({
        id: "pi_enroll",
        payment_method: "pm_card_enroll",
      });
      mockPaymentMethodsRetrieve.mockResolvedValueOnce({
        id: "pm_card_enroll",
        type: "card",
        card: { last4: "4242", brand: "visa" },
      });
      enqueueResult("payments", { data: { id: "pay_enroll" }, error: null });
      mockSettlePayment.mockResolvedValueOnce({ success: true, newPaidMonths: 1, newStatus: "current" });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      // The dues amount should be $50 (10000 - 5000 = 5000 cents)
      expect(mockReverseCalculateBaseAmount).toHaveBeenCalledWith(5000, 0, false);
    });

    it("should skip when no membership or org found", async () => {
      const event = createStripeEvent("invoice.paid", {
        id: "inv_no_mem",
        amount_paid: 5000,
        metadata: {},
        subscription_details: { metadata: {} },
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(mockSettlePayment).not.toHaveBeenCalled();
    });
  });

  describe("invoice.payment_failed", () => {
    it("should mark membership as past_due and create failed payment", async () => {
      const event = createStripeEvent("invoice.payment_failed", {
        id: "inv_failed",
        subscription: "sub_failed",
        amount_due: 5000,
        metadata: { membership_id: "mem_failed", organization_id: "org_failed" },
        last_finalization_error: { message: "Card declined" },
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("memberships", { data: null, error: null });
      enqueueResult("payments", { data: null, error: null });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(NextResponse.json).toHaveBeenCalledWith({ received: true });

      const membershipUpdate = supabaseUpdateCalls.find((c) => c.table === "memberships");
      expect(membershipUpdate).toBeDefined();
      expect((membershipUpdate!.data as Record<string, unknown>).subscription_status).toBe("past_due");
    });

    it("should look up membership from subscription when not in metadata", async () => {
      const event = createStripeEvent("invoice.payment_failed", {
        id: "inv_failed_sub",
        subscription: "sub_failed_lookup",
        amount_due: 5000,
        metadata: {},
        last_finalization_error: null,
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("memberships", {
        data: { id: "mem_looked_up", organization_id: "org_looked_up" },
      });
      enqueueResult("memberships", { data: null, error: null });
      enqueueResult("payments", { data: null, error: null });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(NextResponse.json).toHaveBeenCalledWith({ received: true });
    });

    it("should skip when membership cannot be determined", async () => {
      const event = createStripeEvent("invoice.payment_failed", {
        id: "inv_no_mem",
        subscription: null,
        amount_due: 5000,
        metadata: {},
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      const membershipUpdate = supabaseUpdateCalls.find((c) => c.table === "memberships");
      expect(membershipUpdate).toBeUndefined();
    });
  });

  describe("payment_intent.succeeded (route version)", () => {
    it("should settle existing pending payment", async () => {
      const event = createStripeEvent("payment_intent.succeeded", {
        id: "pi_success",
        metadata: { membership_id: "mem_pi" },
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("payments", {
        data: { id: "pay_pi_existing", status: "pending" },
      });
      mockSettlePayment.mockResolvedValueOnce({
        success: true,
        newPaidMonths: 3,
        newStatus: "current",
      });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(NextResponse.json).toHaveBeenCalledWith({ received: true });
      expect(mockSettlePayment).toHaveBeenCalled();
    });

    it("should skip when payment already completed", async () => {
      const event = createStripeEvent("payment_intent.succeeded", {
        id: "pi_already_done",
        metadata: { membership_id: "mem_pi_done" },
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("payments", {
        data: { id: "pay_done", status: "completed" },
      });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(mockSettlePayment).not.toHaveBeenCalled();
    });

    it("should skip when no membership_id in metadata", async () => {
      const event = createStripeEvent("payment_intent.succeeded", {
        id: "pi_no_meta",
        metadata: {},
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(mockSettlePayment).not.toHaveBeenCalled();
    });

    it("should log when no matching payment record exists", async () => {
      const event = createStripeEvent("payment_intent.succeeded", {
        id: "pi_no_payment",
        metadata: { membership_id: "mem_orphan" },
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("payments", { data: null });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(mockSettlePayment).not.toHaveBeenCalled();
      expect(NextResponse.json).toHaveBeenCalledWith({ received: true });
    });
  });

  describe("payment_intent.payment_failed (route version)", () => {
    it("should mark pending payment as failed", async () => {
      const event = createStripeEvent("payment_intent.payment_failed", {
        id: "pi_failed",
        metadata: { membership_id: "mem_pi_failed" },
        last_payment_error: { message: "Insufficient funds" },
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("payments", {
        data: { id: "pay_fail", status: "pending", notes: "Original note" },
      });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(NextResponse.json).toHaveBeenCalledWith({ received: true });
      const paymentUpdate = supabaseUpdateCalls.find((c) => c.table === "payments");
      expect(paymentUpdate).toBeDefined();
      expect((paymentUpdate!.data as Record<string, unknown>).status).toBe("failed");
    });

    it("should skip when no membership_id in metadata", async () => {
      const event = createStripeEvent("payment_intent.payment_failed", {
        id: "pi_no_meta_fail",
        metadata: {},
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      const paymentUpdate = supabaseUpdateCalls.find((c) => c.table === "payments");
      expect(paymentUpdate).toBeUndefined();
    });

    it("should handle non-pending payment status gracefully", async () => {
      const event = createStripeEvent("payment_intent.payment_failed", {
        id: "pi_non_pending",
        metadata: { membership_id: "mem_np" },
        last_payment_error: { message: "Card declined" },
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      // Payment exists but is already completed
      enqueueResult("payments", {
        data: { id: "pay_completed", status: "completed", notes: null },
      });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      // Should not update non-pending payment
      const paymentUpdate = supabaseUpdateCalls.find((c) => c.table === "payments");
      expect(paymentUpdate).toBeUndefined();
    });
  });

  describe("Unhandled events", () => {
    it("should log and acknowledge unhandled event types", async () => {
      const event = createStripeEvent("some.unknown.event", { metadata: {} });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(NextResponse.json).toHaveBeenCalledWith({ received: true });
    });
  });

  describe("Error handling", () => {
    it("should record failed webhook event on error and return 500", async () => {
      const event = createStripeEvent("customer.subscription.deleted", {
        id: "sub_error",
        metadata: { membership_id: "mem_error" },
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("memberships", {
        data: null,
        error: { message: "Connection refused" },
      });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(String) }),
        { status: 500 }
      );

      const failedEventInsert = supabaseInsertCalls.find(
        (c) =>
          c.table === "stripe_webhook_events" &&
          (c.data as Record<string, unknown>).status === "failed"
      );
      expect(failedEventInsert).toBeDefined();
    });

    it("should include error message from Error objects", async () => {
      const event = createStripeEvent("customer.subscription.deleted", {
        id: "sub_error2",
        metadata: { membership_id: "mem_error2" },
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("memberships", {
        data: null,
        error: { message: "Timeout" },
      });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      const failedEventInsert = supabaseInsertCalls.find(
        (c) =>
          c.table === "stripe_webhook_events" &&
          (c.data as Record<string, unknown>).status === "failed"
      );
      expect(failedEventInsert).toBeDefined();
      expect(
        (failedEventInsert!.data as Record<string, unknown>).error_message
      ).toBeDefined();
    });
  });

  describe("Processing status and payment method type", () => {
    it("should settle a processing payment via invoice.paid", async () => {
      const event = createStripeEvent("invoice.paid", {
        id: "inv_ach_settle",
        subscription: "sub_ach_settle",
        amount_paid: 5000,
        payment_intent: "pi_ach_settle",
        metadata: {},
        subscription_details: { metadata: {} },
        billing_reason: "subscription_cycle",
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      // Lookup membership
      enqueueResult("memberships", {
        data: { id: "mem_ach", organization_id: "org_ach", member_id: "mbr_ach" },
      });
      // No existing completed payment
      enqueueResult("payments", { data: null });
      // Found a "processing" payment to settle
      enqueueResult("payments", { data: { id: "pay_processing_1" } });
      // Settle succeeds
      mockSettlePayment.mockResolvedValueOnce({
        success: true,
        newPaidMonths: 3,
        newStatus: "current",
        becameEligible: false,
      });
      // Record webhook event
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      expect(NextResponse.json).toHaveBeenCalledWith({ received: true });
      expect(mockSettlePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: "pay_processing_1",
          method: "stripe",
        })
      );
    });
  });

  describe("Webhook event recording", () => {
    it("should record successful processing", async () => {
      const event = createStripeEvent("some.new.event", {
        metadata: { organization_id: "org_rec", membership_id: "mem_rec" },
      });
      mockConstructEvent.mockReturnValueOnce(event);

      enqueueResult("stripe_webhook_events", { data: null });
      enqueueResult("stripe_webhook_events", { data: null, error: null });

      await POST(createMockRequest());

      const successInsert = supabaseInsertCalls.find(
        (c) =>
          c.table === "stripe_webhook_events" &&
          (c.data as Record<string, unknown>).status === "processed"
      );
      expect(successInsert).toBeDefined();
      expect(
        (successInsert!.data as Record<string, unknown>).organization_id
      ).toBe("org_rec");
      expect(
        (successInsert!.data as Record<string, unknown>).membership_id
      ).toBe("mem_rec");
    });
  });
});
