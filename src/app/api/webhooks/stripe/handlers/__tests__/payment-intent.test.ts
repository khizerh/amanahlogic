import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mock dependencies before imports
vi.mock("@/lib/billing/engine", () => ({
  settlePayment: vi.fn(),
}));

vi.mock("@/lib/billing/invoice-generator", () => ({
  generateInvoiceMetadata: vi.fn(),
  getTodayInOrgTimezone: vi.fn(),
  parseDateInOrgTimezone: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/email/send-payment-failed", () => ({
  sendPaymentFailedEmail: vi.fn(),
}));

import {
  handlePaymentIntentSucceeded,
  handlePaymentIntentFailed,
} from "../../handlers/payment-intent";
import { settlePayment } from "@/lib/billing/engine";
import {
  generateInvoiceMetadata,
  getTodayInOrgTimezone,
  parseDateInOrgTimezone,
} from "@/lib/billing/invoice-generator";
import { logger } from "@/lib/logger";
import { sendPaymentFailedEmail } from "@/lib/email/send-payment-failed";

// ---------------------------------------------------------------------------
// Supabase mock helpers
// ---------------------------------------------------------------------------

interface QueuedResult {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
}

function createMockSupabase() {
  const resultQueues: Record<string, QueuedResult[]> = {};
  const updateCalls: Array<{ table: string; data: unknown; match: Record<string, unknown> }> = [];
  const insertCalls: Array<{ table: string; data: unknown }> = [];

  function enqueue(table: string, result: QueuedResult) {
    if (!resultQueues[table]) resultQueues[table] = [];
    resultQueues[table].push(result);
  }

  function dequeue(table: string): QueuedResult {
    const queue = resultQueues[table];
    if (queue && queue.length > 0) return queue.shift()!;
    return { data: null, error: null };
  }

  // Chain builder that keeps track of table context
  function buildChain(table: string, isInsert = false, isUpdate = false) {
    const chain: Record<string, unknown> = {};
    const terminalMethods = ["single", "maybeSingle"];
    const chainMethods = ["select", "eq", "neq", "or", "is", "order", "limit", "insert", "update"];

    for (const method of chainMethods) {
      chain[method] = vi.fn((...args: unknown[]) => {
        if (method === "insert") {
          insertCalls.push({ table, data: args[0] });
          return buildChain(table, true);
        }
        if (method === "update") {
          return buildChain(table, false, true);
        }
        return chain;
      });
    }

    for (const method of terminalMethods) {
      chain[method] = vi.fn(() => {
        const result = dequeue(table);
        return Promise.resolve(result);
      });
    }

    // If no terminal method is called, the chain itself resolves
    chain.then = (resolve: (val: unknown) => void) => {
      if (isUpdate) {
        return Promise.resolve({ data: null, error: null }).then(resolve);
      }
      const result = dequeue(table);
      return Promise.resolve(result).then(resolve);
    };

    return chain;
  }

  const supabase = {
    from: vi.fn((table: string) => buildChain(table)),
  } as unknown as SupabaseClient;

  return { supabase, enqueue, dequeue, updateCalls, insertCalls };
}

// ---------------------------------------------------------------------------
// Test helper: create a mock PaymentIntent
// ---------------------------------------------------------------------------

function createMockPaymentIntent(
  overrides: Partial<Stripe.PaymentIntent> = {}
): Stripe.PaymentIntent {
  return {
    id: "pi_test_123",
    amount: 5000, // $50.00
    created: Math.floor(Date.now() / 1000),
    metadata: {
      membership_id: "mem_123",
      organization_id: "org_123",
    },
    last_payment_error: null,
    ...overrides,
  } as unknown as Stripe.PaymentIntent;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handlePaymentIntentSucceeded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should skip when no membership_id in metadata", async () => {
    const { supabase } = createMockSupabase();
    const pi = createMockPaymentIntent({ metadata: {} });

    await handlePaymentIntentSucceeded(pi, {
      organization_id: "org_123",
      supabase,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      "Skipping payment_intent without membership metadata",
      expect.objectContaining({ paymentIntentId: "pi_test_123" })
    );
    expect(settlePayment).not.toHaveBeenCalled();
  });

  it("should skip when metadata is undefined", async () => {
    const { supabase } = createMockSupabase();
    const pi = createMockPaymentIntent();
    // @ts-expect-error - testing edge case
    pi.metadata = undefined;

    await handlePaymentIntentSucceeded(pi, {
      organization_id: "org_123",
      supabase,
    });

    expect(logger.warn).toHaveBeenCalled();
    expect(settlePayment).not.toHaveBeenCalled();
  });

  describe("with payment_id in metadata", () => {
    it("should settle the specific payment by ID", async () => {
      const { supabase } = createMockSupabase();
      const pi = createMockPaymentIntent({
        metadata: {
          membership_id: "mem_123",
          payment_id: "pay_456",
        },
      });

      vi.mocked(settlePayment).mockResolvedValueOnce({
        success: true,
        newPaidMonths: 5,
        newStatus: "current",
        becameEligible: false,
      });

      await handlePaymentIntentSucceeded(pi, {
        organization_id: "org_123",
        supabase,
      });

      expect(settlePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: "pay_456",
          method: "stripe",
          stripePaymentIntentId: "pi_test_123",
          supabase,
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        "Payment settled successfully",
        expect.objectContaining({
          paymentId: "pay_456",
          newPaidMonths: 5,
          newStatus: "current",
        })
      );
    });

    it("should throw when settlePayment fails", async () => {
      const { supabase } = createMockSupabase();
      const pi = createMockPaymentIntent({
        metadata: {
          membership_id: "mem_123",
          payment_id: "pay_456",
        },
      });

      vi.mocked(settlePayment).mockResolvedValueOnce({
        success: false,
        error: "Payment not found",
      });

      await expect(
        handlePaymentIntentSucceeded(pi, {
          organization_id: "org_123",
          supabase,
        })
      ).rejects.toThrow("Failed to settle payment: Payment not found");

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to settle payment from webhook",
        expect.objectContaining({ error: "Payment not found" })
      );
    });

    it("should convert amount from cents to dollars for logging", async () => {
      const { supabase } = createMockSupabase();
      const pi = createMockPaymentIntent({
        amount: 12500, // $125.00
        metadata: {
          membership_id: "mem_123",
          payment_id: "pay_456",
        },
      });

      vi.mocked(settlePayment).mockResolvedValueOnce({
        success: true,
        newPaidMonths: 1,
        newStatus: "current",
        becameEligible: false,
      });

      await handlePaymentIntentSucceeded(pi, {
        organization_id: "org_123",
        supabase,
      });

      expect(logger.info).toHaveBeenCalledWith(
        "Settling specific payment from metadata",
        expect.objectContaining({ amount: 125 })
      );
    });
  });

  describe("finding existing payment by stripe_payment_intent_id", () => {
    it("should skip if payment already completed", async () => {
      const { supabase, enqueue } = createMockSupabase();
      const pi = createMockPaymentIntent();

      // No payment_id in metadata, find by stripe_payment_intent_id
      enqueue("payments", {
        data: { id: "pay_existing", status: "completed" },
      });

      await handlePaymentIntentSucceeded(pi, {
        organization_id: "org_123",
        supabase,
      });

      expect(settlePayment).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        "Payment already completed, skipping",
        expect.objectContaining({ paymentId: "pay_existing" })
      );
    });

    it("should settle existing pending payment found by intent ID", async () => {
      const { supabase, enqueue } = createMockSupabase();
      const pi = createMockPaymentIntent();

      enqueue("payments", {
        data: { id: "pay_existing", status: "pending" },
      });

      vi.mocked(settlePayment).mockResolvedValueOnce({
        success: true,
        newPaidMonths: 3,
        newStatus: "current",
      });

      await handlePaymentIntentSucceeded(pi, {
        organization_id: "org_123",
        supabase,
      });

      expect(settlePayment).toHaveBeenCalledWith(
        expect.objectContaining({ paymentId: "pay_existing" })
      );
      expect(logger.info).toHaveBeenCalledWith(
        "Existing payment settled",
        expect.objectContaining({ paymentId: "pay_existing" })
      );
    });

    it("should throw when settling existing payment fails", async () => {
      const { supabase, enqueue } = createMockSupabase();
      const pi = createMockPaymentIntent();

      enqueue("payments", {
        data: { id: "pay_existing", status: "pending" },
      });

      vi.mocked(settlePayment).mockResolvedValueOnce({
        success: false,
        error: "DB error",
      });

      await expect(
        handlePaymentIntentSucceeded(pi, {
          organization_id: "org_123",
          supabase,
        })
      ).rejects.toThrow("Failed to settle payment: DB error");
    });
  });

  describe("finding pending payment by membership_id", () => {
    it("should link and settle pending payment with no stripe_payment_intent_id", async () => {
      const { supabase, enqueue } = createMockSupabase();
      const pi = createMockPaymentIntent();

      // First query: no payment by intent ID
      enqueue("payments", { data: null });
      // Second query: find pending payment by membership
      enqueue("payments", {
        data: { id: "pay_pending", amount: 50, due_date: "2025-02-15" },
      });

      vi.mocked(settlePayment).mockResolvedValueOnce({
        success: true,
        newPaidMonths: 2,
        newStatus: "current",
      });

      await handlePaymentIntentSucceeded(pi, {
        organization_id: "org_123",
        supabase,
      });

      expect(settlePayment).toHaveBeenCalledWith(
        expect.objectContaining({ paymentId: "pay_pending" })
      );
      expect(logger.info).toHaveBeenCalledWith(
        "Pending payment linked and settled",
        expect.objectContaining({ paymentId: "pay_pending" })
      );
    });

    it("should throw when settling pending payment fails", async () => {
      const { supabase, enqueue } = createMockSupabase();
      const pi = createMockPaymentIntent();

      enqueue("payments", { data: null });
      enqueue("payments", { data: { id: "pay_pending", amount: 50, due_date: "2025-02-15" } });

      vi.mocked(settlePayment).mockResolvedValueOnce({
        success: false,
        error: "Settlement failed",
      });

      await expect(
        handlePaymentIntentSucceeded(pi, {
          organization_id: "org_123",
          supabase,
        })
      ).rejects.toThrow("Failed to settle payment: Settlement failed");
    });
  });

  describe("creating new payment record (ad-hoc Stripe payment)", () => {
    it("should create and settle a new payment when no existing records found", async () => {
      const { supabase, enqueue } = createMockSupabase();
      const pi = createMockPaymentIntent({ amount: 5000 });

      // No payment by intent ID
      enqueue("payments", { data: null });
      // No pending payment by membership
      enqueue("payments", { data: null });
      // Membership lookup
      enqueue("memberships", {
        data: {
          member_id: "mbr_123",
          billing_frequency: "monthly",
          billing_anniversary_day: 15,
          next_payment_due: "2025-03-15",
        },
      });
      // Organization lookup
      enqueue("organizations", {
        data: { timezone: "America/New_York" },
      });
      // Insert payment
      enqueue("payments", {
        data: { id: "pay_new" },
        error: null,
      });

      vi.mocked(getTodayInOrgTimezone).mockReturnValueOnce("2025-02-10");
      vi.mocked(generateInvoiceMetadata).mockResolvedValueOnce({
        invoiceNumber: "INV-001",
        dueDate: "2025-03-15",
        periodStart: "2025-03-01",
        periodEnd: "2025-03-31",
        periodLabel: "Mar 2025",
        monthsCredited: 1,
      });

      vi.mocked(settlePayment).mockResolvedValueOnce({
        success: true,
        newPaidMonths: 4,
        newStatus: "current",
        becameEligible: false,
      });

      await handlePaymentIntentSucceeded(pi, {
        organization_id: "org_123",
        supabase,
      });

      expect(generateInvoiceMetadata).toHaveBeenCalledWith(
        "org_123",
        "2025-03-15", // Uses next_payment_due as billing anchor
        "monthly",
        "America/New_York",
        supabase
      );

      expect(settlePayment).toHaveBeenCalledWith(
        expect.objectContaining({ paymentId: "pay_new" })
      );

      expect(logger.info).toHaveBeenCalledWith(
        "New payment created and settled",
        expect.objectContaining({
          paymentId: "pay_new",
          newPaidMonths: 4,
          becameEligible: false,
        })
      );
    });

    it("should use billing_anniversary_day when no next_payment_due", async () => {
      const { supabase, enqueue } = createMockSupabase();
      const pi = createMockPaymentIntent({ amount: 5000 });

      enqueue("payments", { data: null });
      enqueue("payments", { data: null });
      enqueue("memberships", {
        data: {
          member_id: "mbr_123",
          billing_frequency: "monthly",
          billing_anniversary_day: 20,
          next_payment_due: null,
        },
      });
      enqueue("organizations", {
        data: { timezone: "America/Los_Angeles" },
      });
      enqueue("payments", { data: { id: "pay_new2" }, error: null });

      vi.mocked(getTodayInOrgTimezone).mockReturnValueOnce("2025-02-10");
      vi.mocked(parseDateInOrgTimezone).mockReturnValueOnce(new Date(2025, 1, 10)); // Feb 10, 2025
      vi.mocked(generateInvoiceMetadata).mockResolvedValueOnce({
        invoiceNumber: "INV-002",
        dueDate: "2025-02-20",
        periodStart: "2025-02-01",
        periodEnd: "2025-02-28",
        periodLabel: "Feb 2025",
        monthsCredited: 1,
      });
      vi.mocked(settlePayment).mockResolvedValueOnce({ success: true, newPaidMonths: 1, newStatus: "current" });

      await handlePaymentIntentSucceeded(pi, {
        organization_id: "org_123",
        supabase,
      });

      expect(generateInvoiceMetadata).toHaveBeenCalledWith(
        "org_123",
        "2025-02-20", // billing_anniversary_day = 20 in Feb
        "monthly",
        "America/Los_Angeles",
        supabase
      );
    });

    it("should use today when no next_payment_due and no billing_anniversary_day", async () => {
      const { supabase, enqueue } = createMockSupabase();
      const pi = createMockPaymentIntent({ amount: 5000 });

      enqueue("payments", { data: null });
      enqueue("payments", { data: null });
      enqueue("memberships", {
        data: {
          member_id: "mbr_123",
          billing_frequency: "annual",
          billing_anniversary_day: null,
          next_payment_due: null,
        },
      });
      enqueue("organizations", { data: { timezone: "UTC" } });
      enqueue("payments", { data: { id: "pay_new3" }, error: null });

      vi.mocked(getTodayInOrgTimezone).mockReturnValueOnce("2025-02-10");
      vi.mocked(generateInvoiceMetadata).mockResolvedValueOnce({
        invoiceNumber: "INV-003",
        dueDate: "2025-02-10",
        periodStart: "2025-02-10",
        periodEnd: "2026-02-09",
        periodLabel: "Feb 2025 - Feb 2026",
        monthsCredited: 12,
      });
      vi.mocked(settlePayment).mockResolvedValueOnce({ success: true, newPaidMonths: 12, newStatus: "current" });

      await handlePaymentIntentSucceeded(pi, {
        organization_id: "org_123",
        supabase,
      });

      expect(generateInvoiceMetadata).toHaveBeenCalledWith(
        "org_123",
        "2025-02-10", // today as fallback
        "annual",
        "UTC",
        supabase
      );
    });

    it("should default to America/Los_Angeles when org has no timezone", async () => {
      const { supabase, enqueue } = createMockSupabase();
      const pi = createMockPaymentIntent({ amount: 5000 });

      enqueue("payments", { data: null });
      enqueue("payments", { data: null });
      enqueue("memberships", {
        data: {
          member_id: "mbr_123",
          billing_frequency: "monthly",
          billing_anniversary_day: null,
          next_payment_due: "2025-03-01",
        },
      });
      enqueue("organizations", { data: null }); // No org found
      enqueue("payments", { data: { id: "pay_new4" }, error: null });

      vi.mocked(getTodayInOrgTimezone).mockReturnValueOnce("2025-02-10");
      vi.mocked(generateInvoiceMetadata).mockResolvedValueOnce({
        invoiceNumber: "INV-004",
        dueDate: "2025-03-01",
        periodStart: "2025-03-01",
        periodEnd: "2025-03-31",
        periodLabel: "Mar 2025",
        monthsCredited: 1,
      });
      vi.mocked(settlePayment).mockResolvedValueOnce({ success: true, newPaidMonths: 1, newStatus: "current" });

      await handlePaymentIntentSucceeded(pi, {
        organization_id: "org_123",
        supabase,
      });

      expect(getTodayInOrgTimezone).toHaveBeenCalledWith("America/Los_Angeles");
    });

    it("should default billing_frequency to monthly when not set", async () => {
      const { supabase, enqueue } = createMockSupabase();
      const pi = createMockPaymentIntent({ amount: 5000 });

      enqueue("payments", { data: null });
      enqueue("payments", { data: null });
      enqueue("memberships", {
        data: {
          member_id: "mbr_123",
          billing_frequency: null, // Not set
          billing_anniversary_day: null,
          next_payment_due: "2025-03-01",
        },
      });
      enqueue("organizations", { data: { timezone: "UTC" } });
      enqueue("payments", { data: { id: "pay_new5" }, error: null });

      vi.mocked(getTodayInOrgTimezone).mockReturnValueOnce("2025-02-10");
      vi.mocked(generateInvoiceMetadata).mockResolvedValueOnce({
        invoiceNumber: "INV-005",
        dueDate: "2025-03-01",
        periodStart: "2025-03-01",
        periodEnd: "2025-03-31",
        periodLabel: "Mar 2025",
        monthsCredited: 1,
      });
      vi.mocked(settlePayment).mockResolvedValueOnce({ success: true, newPaidMonths: 1, newStatus: "current" });

      await handlePaymentIntentSucceeded(pi, {
        organization_id: "org_123",
        supabase,
      });

      expect(generateInvoiceMetadata).toHaveBeenCalledWith(
        "org_123",
        "2025-03-01",
        "monthly", // Default
        "UTC",
        supabase
      );
    });

    it("should throw when membership is not found", async () => {
      const { supabase, enqueue } = createMockSupabase();
      const pi = createMockPaymentIntent();

      enqueue("payments", { data: null });
      enqueue("payments", { data: null });
      enqueue("memberships", { data: null }); // Not found

      vi.mocked(getTodayInOrgTimezone).mockReturnValueOnce("2025-02-10");

      await expect(
        handlePaymentIntentSucceeded(pi, {
          organization_id: "org_123",
          supabase,
        })
      ).rejects.toThrow("Membership not found");

      expect(logger.error).toHaveBeenCalledWith(
        "Membership not found for payment",
        expect.objectContaining({ membershipId: "mem_123" })
      );
    });

    it("should throw when creating payment record fails", async () => {
      const { supabase, enqueue } = createMockSupabase();
      const pi = createMockPaymentIntent({ amount: 5000 });

      enqueue("payments", { data: null });
      enqueue("payments", { data: null });
      enqueue("memberships", {
        data: {
          member_id: "mbr_123",
          billing_frequency: "monthly",
          billing_anniversary_day: null,
          next_payment_due: "2025-03-01",
        },
      });
      enqueue("organizations", { data: { timezone: "UTC" } });
      // Insert fails
      enqueue("payments", {
        data: null,
        error: { message: "Duplicate key" },
      });

      vi.mocked(getTodayInOrgTimezone).mockReturnValueOnce("2025-02-10");
      vi.mocked(generateInvoiceMetadata).mockResolvedValueOnce({
        invoiceNumber: "INV-006",
        dueDate: "2025-03-01",
        periodStart: "2025-03-01",
        periodEnd: "2025-03-31",
        periodLabel: "Mar 2025",
        monthsCredited: 1,
      });

      await expect(
        handlePaymentIntentSucceeded(pi, {
          organization_id: "org_123",
          supabase,
        })
      ).rejects.toThrow("Failed to create payment: Duplicate key");
    });

    it("should throw when settling new payment fails", async () => {
      const { supabase, enqueue } = createMockSupabase();
      const pi = createMockPaymentIntent({ amount: 5000 });

      enqueue("payments", { data: null });
      enqueue("payments", { data: null });
      enqueue("memberships", {
        data: {
          member_id: "mbr_123",
          billing_frequency: "monthly",
          billing_anniversary_day: null,
          next_payment_due: "2025-03-01",
        },
      });
      enqueue("organizations", { data: { timezone: "UTC" } });
      enqueue("payments", { data: { id: "pay_new_fail" }, error: null });

      vi.mocked(getTodayInOrgTimezone).mockReturnValueOnce("2025-02-10");
      vi.mocked(generateInvoiceMetadata).mockResolvedValueOnce({
        invoiceNumber: "INV-007",
        dueDate: "2025-03-01",
        periodStart: "2025-03-01",
        periodEnd: "2025-03-31",
        periodLabel: "Mar 2025",
        monthsCredited: 1,
      });
      vi.mocked(settlePayment).mockResolvedValueOnce({
        success: false,
        error: "Settlement engine error",
      });

      await expect(
        handlePaymentIntentSucceeded(pi, {
          organization_id: "org_123",
          supabase,
        })
      ).rejects.toThrow("Failed to settle payment: Settlement engine error");
    });

    it("should log becameEligible when member reaches eligibility", async () => {
      const { supabase, enqueue } = createMockSupabase();
      const pi = createMockPaymentIntent({ amount: 5000 });

      enqueue("payments", { data: null });
      enqueue("payments", { data: null });
      enqueue("memberships", {
        data: {
          member_id: "mbr_123",
          billing_frequency: "monthly",
          billing_anniversary_day: null,
          next_payment_due: "2025-03-01",
        },
      });
      enqueue("organizations", { data: { timezone: "UTC" } });
      enqueue("payments", { data: { id: "pay_eligible" }, error: null });

      vi.mocked(getTodayInOrgTimezone).mockReturnValueOnce("2025-02-10");
      vi.mocked(generateInvoiceMetadata).mockResolvedValueOnce({
        invoiceNumber: "INV-008",
        dueDate: "2025-03-01",
        periodStart: "2025-03-01",
        periodEnd: "2025-03-31",
        periodLabel: "Mar 2025",
        monthsCredited: 1,
      });
      vi.mocked(settlePayment).mockResolvedValueOnce({
        success: true,
        newPaidMonths: 60,
        newStatus: "current",
        becameEligible: true,
      });

      await handlePaymentIntentSucceeded(pi, {
        organization_id: "org_123",
        supabase,
      });

      expect(logger.info).toHaveBeenCalledWith(
        "New payment created and settled",
        expect.objectContaining({
          becameEligible: true,
          newPaidMonths: 60,
        })
      );
    });
  });

  describe("paidAt timestamp conversion", () => {
    it("should convert PaymentIntent created timestamp from seconds to ISO string", async () => {
      const { supabase } = createMockSupabase();
      const created = 1700000000; // Nov 14, 2023
      const pi = createMockPaymentIntent({
        created,
        metadata: {
          membership_id: "mem_123",
          payment_id: "pay_456",
        },
      });

      vi.mocked(settlePayment).mockResolvedValueOnce({
        success: true,
        newPaidMonths: 1,
        newStatus: "current",
      });

      await handlePaymentIntentSucceeded(pi, {
        organization_id: "org_123",
        supabase,
      });

      const call = vi.mocked(settlePayment).mock.calls[0][0];
      const paidAt = new Date(call.paidAt);
      expect(paidAt.getTime()).toBe(created * 1000);
    });
  });
});

describe("handlePaymentIntentFailed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should skip when no membership_id in metadata", async () => {
    const { supabase } = createMockSupabase();
    const pi = createMockPaymentIntent({ metadata: {} });

    await handlePaymentIntentFailed(pi, {
      organization_id: "org_123",
      supabase,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      "Skipping failed payment_intent without membership metadata",
      expect.objectContaining({ paymentIntentId: "pi_test_123" })
    );
  });

  it("should update existing payment to failed status", async () => {
    const { supabase, enqueue } = createMockSupabase();
    const pi = createMockPaymentIntent({
      last_payment_error: { message: "Card declined" } as Stripe.PaymentIntent.LastPaymentError,
    });

    // Find existing payment
    enqueue("payments", { data: { id: "pay_existing" } });
    // Membership lookup for email
    enqueue("memberships", { data: { member_id: "mbr_123" } });
    // Member lookup for email
    enqueue("members", {
      data: {
        id: "mbr_123",
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
        preferred_language: "en",
      },
    });

    vi.mocked(sendPaymentFailedEmail).mockResolvedValueOnce({
      success: true,
    });

    await handlePaymentIntentFailed(pi, {
      organization_id: "org_123",
      supabase,
    });

    expect(logger.info).toHaveBeenCalledWith(
      "Payment marked as failed",
      expect.objectContaining({
        paymentId: "pay_existing",
        reason: "Card declined",
      })
    );
  });

  it("should use default error message when last_payment_error is null", async () => {
    const { supabase, enqueue } = createMockSupabase();
    const pi = createMockPaymentIntent({ last_payment_error: null });

    enqueue("payments", { data: { id: "pay_existing" } });
    enqueue("memberships", { data: { member_id: "mbr_123" } });
    enqueue("members", { data: null }); // No member found

    await handlePaymentIntentFailed(pi, {
      organization_id: "org_123",
      supabase,
    });

    expect(logger.info).toHaveBeenCalledWith(
      "Payment marked as failed",
      expect.objectContaining({ reason: "Payment failed" })
    );
  });

  it("should warn when no existing payment is found to mark as failed", async () => {
    const { supabase, enqueue } = createMockSupabase();
    const pi = createMockPaymentIntent();

    // No existing payment found
    enqueue("payments", { data: null });
    // Still try to send email
    enqueue("memberships", { data: { member_id: "mbr_123" } });
    enqueue("members", {
      data: {
        id: "mbr_123",
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
        preferred_language: "en",
      },
    });

    vi.mocked(sendPaymentFailedEmail).mockResolvedValueOnce({ success: true });

    await handlePaymentIntentFailed(pi, {
      organization_id: "org_123",
      supabase,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      "No payment found to mark as failed",
      expect.objectContaining({ membershipId: "mem_123" })
    );
  });

  it("should send payment failed email to member", async () => {
    const { supabase, enqueue } = createMockSupabase();
    const pi = createMockPaymentIntent({
      amount: 7500, // $75.00
      last_payment_error: { message: "Insufficient funds" } as Stripe.PaymentIntent.LastPaymentError,
    });

    enqueue("payments", { data: { id: "pay_existing" } });
    enqueue("memberships", { data: { member_id: "mbr_123" } });
    enqueue("members", {
      data: {
        id: "mbr_123",
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
        preferred_language: "fa",
      },
    });

    vi.mocked(sendPaymentFailedEmail).mockResolvedValueOnce({ success: true });

    await handlePaymentIntentFailed(pi, {
      organization_id: "org_123",
      supabase,
    });

    expect(sendPaymentFailedEmail).toHaveBeenCalledWith({
      to: "test@example.com",
      memberName: "John Doe",
      memberId: "mbr_123",
      organizationId: "org_123",
      amount: "75.00",
      failureReason: "Insufficient funds",
      language: "fa",
    });
  });

  it("should default language to en when not set", async () => {
    const { supabase, enqueue } = createMockSupabase();
    const pi = createMockPaymentIntent({ amount: 5000 });

    enqueue("payments", { data: null });
    enqueue("memberships", { data: { member_id: "mbr_123" } });
    enqueue("members", {
      data: {
        id: "mbr_123",
        email: "test@example.com",
        first_name: "Jane",
        last_name: "Doe",
        preferred_language: null,
      },
    });

    vi.mocked(sendPaymentFailedEmail).mockResolvedValueOnce({ success: true });

    await handlePaymentIntentFailed(pi, {
      organization_id: "org_123",
      supabase,
    });

    expect(sendPaymentFailedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ language: "en" })
    );
  });

  it("should handle $0 amount gracefully", async () => {
    const { supabase, enqueue } = createMockSupabase();
    const pi = createMockPaymentIntent({ amount: 0 });

    enqueue("payments", { data: null });
    enqueue("memberships", { data: { member_id: "mbr_123" } });
    enqueue("members", {
      data: {
        id: "mbr_123",
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
        preferred_language: "en",
      },
    });

    vi.mocked(sendPaymentFailedEmail).mockResolvedValueOnce({ success: true });

    await handlePaymentIntentFailed(pi, {
      organization_id: "org_123",
      supabase,
    });

    expect(sendPaymentFailedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ amount: "0.00" })
    );
  });

  it("should not skip when no member email found", async () => {
    const { supabase, enqueue } = createMockSupabase();
    const pi = createMockPaymentIntent();

    enqueue("payments", { data: { id: "pay_existing" } });
    enqueue("memberships", { data: { member_id: "mbr_123" } });
    enqueue("members", {
      data: {
        id: "mbr_123",
        email: null,
        first_name: "John",
        last_name: "Doe",
        preferred_language: "en",
      },
    });

    await handlePaymentIntentFailed(pi, {
      organization_id: "org_123",
      supabase,
    });

    expect(sendPaymentFailedEmail).not.toHaveBeenCalled();
  });

  it("should not skip when membership is not found for email", async () => {
    const { supabase, enqueue } = createMockSupabase();
    const pi = createMockPaymentIntent();

    enqueue("payments", { data: { id: "pay_existing" } });
    enqueue("memberships", { data: null }); // Not found

    await handlePaymentIntentFailed(pi, {
      organization_id: "org_123",
      supabase,
    });

    expect(sendPaymentFailedEmail).not.toHaveBeenCalled();
    // Should still complete without throwing
  });

  it("should not throw when email sending fails", async () => {
    const { supabase, enqueue } = createMockSupabase();
    const pi = createMockPaymentIntent();

    enqueue("payments", { data: { id: "pay_existing" } });
    enqueue("memberships", { data: { member_id: "mbr_123" } });
    enqueue("members", {
      data: {
        id: "mbr_123",
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
        preferred_language: "en",
      },
    });

    vi.mocked(sendPaymentFailedEmail).mockRejectedValueOnce(
      new Error("Email service down")
    );

    // Should not throw
    await handlePaymentIntentFailed(pi, {
      organization_id: "org_123",
      supabase,
    });

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to send payment failure email",
      expect.objectContaining({ error: "Email service down" })
    );
  });

  it("should handle non-Error thrown by email service", async () => {
    const { supabase, enqueue } = createMockSupabase();
    const pi = createMockPaymentIntent();

    enqueue("payments", { data: { id: "pay_existing" } });
    enqueue("memberships", { data: { member_id: "mbr_123" } });
    enqueue("members", {
      data: {
        id: "mbr_123",
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
        preferred_language: "en",
      },
    });

    vi.mocked(sendPaymentFailedEmail).mockRejectedValueOnce("string error");

    await handlePaymentIntentFailed(pi, {
      organization_id: "org_123",
      supabase,
    });

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to send payment failure email",
      expect.objectContaining({ error: "string error" })
    );
  });
});
