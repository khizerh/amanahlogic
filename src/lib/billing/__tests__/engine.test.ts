/**
 * Billing Engine Tests
 *
 * Comprehensive tests for the recurring billing engine including:
 * - processRecurringBilling: invoice generation for due memberships
 * - settlePayment: payment settlement with membership crediting
 * - processAllOrganizationsBilling: multi-org orchestrator
 * - Status transitions (current -> lapsed -> cancelled)
 * - Eligibility tracking (60 paid months threshold)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks - must be declared before any imports from the module under test
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../invoice-generator", () => ({
  generateInvoiceNumber: vi.fn().mockResolvedValue("INV-AL-202501-0001"),
  formatPeriodLabel: vi.fn().mockReturnValue("January 2025"),
  getTodayInOrgTimezone: vi.fn().mockReturnValue("2025-01-15"),
  parseDateInOrgTimezone: vi.fn().mockImplementation((dateStr: string) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  }),
}));

vi.mock("../config", () => ({
  loadBillingConfig: vi.fn().mockResolvedValue({
    lapseDays: 7,
    cancelMonths: 24,
    reminderSchedule: [3, 7, 14],
    maxReminders: 3,
    sendInvoiceReminders: true,
    eligibilityMonths: 60,
  }),
}));

vi.mock("@/lib/email/send-payment-receipt", () => ({
  sendPaymentReceiptEmail: vi.fn().mockResolvedValue({ success: true }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  processRecurringBilling,
  settlePayment,
  processAllOrganizationsBilling,
} from "../engine";
import { logger } from "../logger";
import { generateInvoiceNumber, getTodayInOrgTimezone } from "../invoice-generator";
import { loadBillingConfig } from "../config";
import { sendPaymentReceiptEmail } from "@/lib/email/send-payment-receipt";

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

const ORG_ID = "org-test-001";
const MEMBERSHIP_ID = "mem-001";
const MEMBER_ID = "mbr-001";
const PLAN_ID = "plan-001";
const PAYMENT_ID = "pay-001";

/** Build a mock membership row as returned by Supabase */
function makeMembership(overrides: Record<string, unknown> = {}) {
  return {
    id: MEMBERSHIP_ID,
    organization_id: ORG_ID,
    member_id: MEMBER_ID,
    plan_id: PLAN_ID,
    status: "current",
    billing_frequency: "monthly",
    billing_anniversary_day: 15,
    paid_months: 10,
    enrollment_fee_status: "paid",
    join_date: "2024-01-15",
    last_payment_date: "2024-12-15",
    next_payment_due: "2025-01-15",
    eligible_date: null,
    cancelled_date: null,
    agreement_signed_at: "2024-01-01T00:00:00Z",
    agreement_id: "agr-001",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-12-15T00:00:00Z",
    stripe_subscription_id: null,
    stripe_subscription_status: null,
    member: {
      first_name: "Ahmed",
      last_name: "Ali",
      email: "ahmed@example.com",
    },
    plan: {
      name: "Standard",
      type: "individual",
      pricing: { monthly: 25, biannual: 140, annual: 260 },
    },
    ...overrides,
  };
}

/** Build a mock payment row as returned by Supabase */
function makePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: PAYMENT_ID,
    organization_id: ORG_ID,
    membership_id: MEMBERSHIP_ID,
    member_id: MEMBER_ID,
    status: "pending",
    amount: 25,
    months_credited: 1,
    membership: {
      id: MEMBERSHIP_ID,
      organization_id: ORG_ID,
      status: "current",
      billing_frequency: "monthly",
      billing_anniversary_day: 15,
      paid_months: 10,
      next_payment_due: "2025-01-15",
      last_payment_date: "2024-12-15",
      eligible_date: null,
      agreement_signed_at: "2024-01-01T00:00:00Z",
      join_date: "2024-01-15",
    },
    ...overrides,
  };
}

/**
 * Creates a chainable mock Supabase client.
 *
 * Each call to .from(table) returns a builder that records chained method
 * calls (.select, .eq, .neq, .not, .lte, .gte, .in, .insert, .update,
 * .single, .maybeSingle) and resolves with configured data.
 *
 * Use `mockTable(table, data, error?)` to configure return values for a table.
 * Use `mockRpc(name, fn)` to configure RPC calls.
 */
function createMockSupabase() {
  const tableResults: Record<
    string,
    Array<{ match?: Record<string, unknown>; data: unknown; error: unknown }>
  > = {};
  const rpcHandlers: Record<string, (...args: unknown[]) => unknown> = {};

  // Track insert/update calls for assertions
  const insertCalls: Record<string, unknown[]> = {};
  const updateCalls: Record<string, unknown[]> = {};

  function mockTable(
    table: string,
    data: unknown,
    error: unknown = null,
    match?: Record<string, unknown>
  ) {
    if (!tableResults[table]) tableResults[table] = [];
    tableResults[table].push({ match, data, error });
  }

  function mockRpc(name: string, handler: (...args: unknown[]) => unknown) {
    rpcHandlers[name] = handler;
  }

  function getTableResult(table: string, _filters?: Record<string, unknown>) {
    const entries = tableResults[table];
    if (!entries || entries.length === 0) return { data: null, error: null };
    // Simple: return the first entry, shift it off for sequential calls
    if (entries.length === 1) return entries[0];
    return entries.shift()!;
  }

  function makeChain(table: string) {
    let pendingInsertData: unknown = null;
    let pendingUpdateData: unknown = null;

    const chain: Record<string, unknown> = {};
    const self = () => chain;

    // All filter/query methods just return the chain
    for (const method of [
      "select",
      "eq",
      "neq",
      "not",
      "lte",
      "gte",
      "in",
      "order",
      "limit",
    ]) {
      chain[method] = vi.fn().mockImplementation(self);
    }

    chain.insert = vi.fn().mockImplementation((data: unknown) => {
      pendingInsertData = data;
      if (!insertCalls[table]) insertCalls[table] = [];
      insertCalls[table].push(data);
      return chain;
    });

    chain.update = vi.fn().mockImplementation((data: unknown) => {
      pendingUpdateData = data;
      if (!updateCalls[table]) updateCalls[table] = [];
      updateCalls[table].push(data);
      return chain;
    });

    chain.single = vi.fn().mockImplementation(() => {
      const result = getTableResult(table);
      return Promise.resolve({ data: result.data, error: result.error });
    });

    chain.maybeSingle = vi.fn().mockImplementation(() => {
      const result = getTableResult(table);
      return Promise.resolve({ data: result.data, error: result.error });
    });

    // If chain is awaited directly (no .single/.maybeSingle), resolve array
    chain.then = (resolve: (val: unknown) => void) => {
      const result = getTableResult(table);
      return Promise.resolve({ data: result.data, error: result.error }).then(resolve);
    };

    return chain;
  }

  const supabase = {
    from: vi.fn().mockImplementation((table: string) => makeChain(table)),
    rpc: vi.fn().mockImplementation((name: string, params: unknown) => {
      if (rpcHandlers[name]) {
        return Promise.resolve(rpcHandlers[name](params));
      }
      return Promise.resolve({ data: null, error: null });
    }),
  };

  return { supabase, mockTable, mockRpc, insertCalls, updateCalls };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Billing Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTodayInOrgTimezone).mockReturnValue("2025-01-15");
    vi.mocked(generateInvoiceNumber).mockResolvedValue("INV-AL-202501-0001");
    vi.mocked(loadBillingConfig).mockResolvedValue({
      lapseDays: 7,
      cancelMonths: 24,
      reminderSchedule: [3, 7, 14],
      maxReminders: 3,
      sendInvoiceReminders: true,
      eligibilityMonths: 60,
    });
  });

  // =========================================================================
  // processRecurringBilling
  // =========================================================================

  describe("processRecurringBilling", () => {
    describe("happy path", () => {
      it("creates a pending payment for a membership whose next_payment_due <= today", async () => {
        const { supabase, mockTable, mockRpc } = createMockSupabase();

        // org timezone lookup
        mockTable("organizations", { timezone: "America/Los_Angeles" });
        // memberships query returns one due membership
        mockTable("memberships", [makeMembership()]);
        // no existing payment for period
        mockTable("payments", null); // maybeSingle -> null means no duplicate
        // payment insert
        mockTable("payments", { id: "pay-new-001" });
        // status transitions: toLapse query
        mockTable("memberships", []);
        // status transitions: toCancel query
        mockTable("memberships", []);

        mockRpc("acquire_billing_lock", () => ({ data: true, error: null }));
        mockRpc("release_billing_lock", () => ({ data: null, error: null }));

        const result = await processRecurringBilling(ORG_ID, { supabase: supabase as never });

        expect(result.success).toBe(true);
        expect(result.paymentsCreated).toBe(1);
        expect(result.paymentIds).toContain("pay-new-001");
        expect(result.errors).toHaveLength(0);
      });

      it("uses correct amount from plan pricing based on billing_frequency", async () => {
        const { supabase, mockTable, mockRpc, insertCalls } = createMockSupabase();

        const biannualMembership = makeMembership({
          billing_frequency: "biannual",
        });

        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockTable("memberships", [biannualMembership]);
        mockTable("payments", null);
        mockTable("payments", { id: "pay-new-002" });
        mockTable("memberships", []);
        mockTable("memberships", []);

        mockRpc("acquire_billing_lock", () => ({ data: true, error: null }));
        mockRpc("release_billing_lock", () => ({ data: null, error: null }));

        await processRecurringBilling(ORG_ID, { supabase: supabase as never });

        // Verify the insert was called with the biannual price
        const paymentInserts = insertCalls["payments"];
        expect(paymentInserts).toBeDefined();
        expect(paymentInserts.length).toBeGreaterThanOrEqual(1);
        const inserted = paymentInserts[0] as Record<string, unknown>;
        expect(inserted.amount).toBe(140); // biannual pricing
        expect(inserted.months_credited).toBe(6);
      });

      it("sets correct months_credited: 1 for monthly, 6 for biannual, 12 for annual", async () => {
        for (const [frequency, expectedMonths, expectedAmount] of [
          ["monthly", 1, 25],
          ["biannual", 6, 140],
          ["annual", 12, 260],
        ] as const) {
          const { supabase, mockTable, mockRpc, insertCalls } = createMockSupabase();

          mockTable("organizations", { timezone: "America/Los_Angeles" });
          mockTable("memberships", [makeMembership({ billing_frequency: frequency })]);
          mockTable("payments", null);
          mockTable("payments", { id: `pay-${frequency}` });
          mockTable("memberships", []);
          mockTable("memberships", []);

          mockRpc("acquire_billing_lock", () => ({ data: true, error: null }));
          mockRpc("release_billing_lock", () => ({ data: null, error: null }));

          await processRecurringBilling(ORG_ID, { supabase: supabase as never });

          const inserted = insertCalls["payments"]?.[0] as Record<string, unknown>;
          expect(inserted.months_credited).toBe(expectedMonths);
          expect(inserted.amount).toBe(expectedAmount);
        }
      });

      it("returns success=true with correct counts when all memberships processed", async () => {
        const { supabase, mockTable, mockRpc } = createMockSupabase();

        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockTable("memberships", [
          makeMembership({ id: "mem-a" }),
          makeMembership({ id: "mem-b" }),
        ]);
        // Duplicate check for mem-a -> no duplicate
        mockTable("payments", null);
        // Insert for mem-a
        mockTable("payments", { id: "pay-a" });
        // Duplicate check for mem-b -> no duplicate
        mockTable("payments", null);
        // Insert for mem-b
        mockTable("payments", { id: "pay-b" });
        // Status transitions
        mockTable("memberships", []);
        mockTable("memberships", []);

        mockRpc("acquire_billing_lock", () => ({ data: true, error: null }));
        mockRpc("release_billing_lock", () => ({ data: null, error: null }));

        const result = await processRecurringBilling(ORG_ID, { supabase: supabase as never });

        expect(result.success).toBe(true);
        expect(result.paymentsCreated).toBe(2);
        expect(result.paymentIds).toEqual(["pay-a", "pay-b"]);
        expect(result.skipped).toBe(0);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe("skip conditions", () => {
      it("skips members with an active Stripe subscription", async () => {
        const { supabase, mockTable, mockRpc } = createMockSupabase();

        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockTable("memberships", [
          makeMembership({
            stripe_subscription_id: "sub_abc123",
            stripe_subscription_status: "active",
          }),
        ]);
        mockTable("memberships", []);
        mockTable("memberships", []);

        mockRpc("acquire_billing_lock", () => ({ data: true, error: null }));
        mockRpc("release_billing_lock", () => ({ data: null, error: null }));

        const result = await processRecurringBilling(ORG_ID, { supabase: supabase as never });

        expect(result.success).toBe(true);
        expect(result.paymentsCreated).toBe(0);
        expect(result.skipped).toBe(1);
        expect(logger.info).toHaveBeenCalledWith(
          "membership_skipped",
          expect.objectContaining({ reason: "stripe_subscription" })
        );
      });

      it("skips members with a trialing Stripe subscription", async () => {
        const { supabase, mockTable, mockRpc } = createMockSupabase();

        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockTable("memberships", [
          makeMembership({
            stripe_subscription_id: "sub_trial",
            stripe_subscription_status: "trialing",
          }),
        ]);
        mockTable("memberships", []);
        mockTable("memberships", []);

        mockRpc("acquire_billing_lock", () => ({ data: true, error: null }));
        mockRpc("release_billing_lock", () => ({ data: null, error: null }));

        const result = await processRecurringBilling(ORG_ID, { supabase: supabase as never });

        expect(result.skipped).toBe(1);
        expect(result.paymentsCreated).toBe(0);
      });

      it("skips members with invalid next_payment_due format", async () => {
        const { supabase, mockTable, mockRpc } = createMockSupabase();

        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockTable("memberships", [
          makeMembership({ next_payment_due: "invalid-date" }),
        ]);
        mockTable("memberships", []);
        mockTable("memberships", []);

        mockRpc("acquire_billing_lock", () => ({ data: true, error: null }));
        mockRpc("release_billing_lock", () => ({ data: null, error: null }));

        const result = await processRecurringBilling(ORG_ID, { supabase: supabase as never });

        expect(result.skipped).toBe(1);
        expect(result.paymentsCreated).toBe(0);
        expect(logger.warn).toHaveBeenCalledWith(
          "membership_skipped_invalid_payment_due",
          expect.objectContaining({ membership_id: MEMBERSHIP_ID })
        );
      });

      it("skips members with an existing pending payment for the period", async () => {
        const { supabase, mockTable, mockRpc } = createMockSupabase();

        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockTable("memberships", [makeMembership()]);
        // Existing pending payment found
        mockTable("payments", {
          id: "pay-existing",
          status: "pending",
          created_at: "2025-01-15T00:00:00Z",
        });
        mockTable("memberships", []);
        mockTable("memberships", []);

        mockRpc("acquire_billing_lock", () => ({ data: true, error: null }));
        mockRpc("release_billing_lock", () => ({ data: null, error: null }));

        const result = await processRecurringBilling(ORG_ID, { supabase: supabase as never });

        expect(result.skipped).toBe(1);
        expect(result.paymentsCreated).toBe(0);
        expect(logger.warn).toHaveBeenCalledWith(
          "membership_skipped_duplicate",
          expect.objectContaining({
            existing_payment_id: "pay-existing",
            reason: "payment_already_exists_for_period",
          })
        );
      });

      it("skips members with an existing completed payment for the period", async () => {
        const { supabase, mockTable, mockRpc } = createMockSupabase();

        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockTable("memberships", [makeMembership()]);
        mockTable("payments", {
          id: "pay-completed",
          status: "completed",
          created_at: "2025-01-15T00:00:00Z",
        });
        mockTable("memberships", []);
        mockTable("memberships", []);

        mockRpc("acquire_billing_lock", () => ({ data: true, error: null }));
        mockRpc("release_billing_lock", () => ({ data: null, error: null }));

        const result = await processRecurringBilling(ORG_ID, { supabase: supabase as never });

        expect(result.skipped).toBe(1);
        expect(result.paymentsCreated).toBe(0);
      });

      it("returns empty result when no memberships are due for billing", async () => {
        const { supabase, mockTable, mockRpc } = createMockSupabase();

        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockTable("memberships", []);

        mockRpc("acquire_billing_lock", () => ({ data: true, error: null }));
        mockRpc("release_billing_lock", () => ({ data: null, error: null }));

        const result = await processRecurringBilling(ORG_ID, { supabase: supabase as never });

        expect(result.success).toBe(true);
        expect(result.paymentsCreated).toBe(0);
        expect(result.skipped).toBe(0);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe("dry run mode", () => {
      it("logs what would be created without inserting records", async () => {
        const { supabase, mockTable, insertCalls } = createMockSupabase();

        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockTable("memberships", [makeMembership()]);
        // No duplicate payment
        mockTable("payments", null);

        const result = await processRecurringBilling(ORG_ID, {
          supabase: supabase as never,
          dryRun: true,
        });

        expect(result.success).toBe(true);
        expect(result.paymentsCreated).toBe(1);
        // No actual insert should have been made
        expect(insertCalls["payments"]).toBeUndefined();
        expect(logger.debug).toHaveBeenCalledWith(
          "dry_run_would_create_payment",
          expect.objectContaining({ membership_id: MEMBERSHIP_ID })
        );
      });

      it("does not acquire or release the billing lock in dry run mode", async () => {
        const { supabase, mockTable } = createMockSupabase();

        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockTable("memberships", []);

        await processRecurringBilling(ORG_ID, {
          supabase: supabase as never,
          dryRun: true,
        });

        // rpc should not have been called for lock operations
        expect(supabase.rpc).not.toHaveBeenCalledWith(
          "acquire_billing_lock",
          expect.anything()
        );
        expect(supabase.rpc).not.toHaveBeenCalledWith(
          "release_billing_lock",
          expect.anything()
        );
      });
    });

    describe("lock behavior", () => {
      it("returns error when lock acquisition fails with an RPC error", async () => {
        const { supabase, mockTable, mockRpc } = createMockSupabase();

        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockRpc("acquire_billing_lock", () => ({
          data: null,
          error: { message: "Database connection lost" },
        }));

        const result = await processRecurringBilling(ORG_ID, { supabase: supabase as never });

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].error).toContain("Failed to acquire billing lock");
      });

      it("returns error when another billing run is already in progress", async () => {
        const { supabase, mockTable, mockRpc } = createMockSupabase();

        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockRpc("acquire_billing_lock", () => ({ data: false, error: null }));

        const result = await processRecurringBilling(ORG_ID, { supabase: supabase as never });

        expect(result.success).toBe(false);
        expect(result.errors[0].error).toContain("Billing run already in progress");
        expect(logger.warn).toHaveBeenCalledWith(
          "billing_run_already_in_progress",
          expect.objectContaining({ organization_id: ORG_ID })
        );
      });
    });

    describe("organization lookup failure", () => {
      it("returns error when organization timezone lookup fails", async () => {
        const { supabase, mockTable } = createMockSupabase();

        mockTable("organizations", null, { message: "Org not found" });

        const result = await processRecurringBilling("org-invalid", {
          supabase: supabase as never,
        });

        expect(result.success).toBe(false);
        expect(result.errors[0].error).toContain("Failed to get organization");
      });
    });

    describe("status transitions (processStatusTransitions)", () => {
      it("transitions current to lapsed when payment overdue > lapseDays", async () => {
        const { supabase, mockTable, mockRpc, updateCalls } = createMockSupabase();

        mockTable("organizations", { timezone: "America/Los_Angeles" });
        // Provide a membership with Stripe sub so it gets skipped but flow continues past early return
        mockTable("memberships", [
          makeMembership({
            id: "mem-stripe",
            stripe_subscription_id: "sub_skip",
            stripe_subscription_status: "active",
          }),
        ]);

        // toLapse query: one membership to lapse
        mockTable("memberships", [
          { id: "mem-lapse", member_id: "mbr-lapse", next_payment_due: "2025-01-01" },
        ]);
        // Update result for lapse
        mockTable("memberships", null);
        // toCancel query: none
        mockTable("memberships", []);

        mockRpc("acquire_billing_lock", () => ({ data: true, error: null }));
        mockRpc("release_billing_lock", () => ({ data: null, error: null }));

        const result = await processRecurringBilling(ORG_ID, { supabase: supabase as never });

        expect(result.statusUpdates).toBe(1);
        // Verify the update was made with lapsed status
        const membershipUpdates = updateCalls["memberships"];
        expect(membershipUpdates).toBeDefined();
        expect(membershipUpdates.length).toBeGreaterThanOrEqual(1);
        const updatePayload = membershipUpdates[0] as Record<string, unknown>;
        expect(updatePayload.status).toBe("lapsed");
      });

      it("transitions lapsed to cancelled when unpaid > cancelMonths", async () => {
        const { supabase, mockTable, mockRpc, updateCalls } = createMockSupabase();

        mockTable("organizations", { timezone: "America/Los_Angeles" });
        // Provide a membership with Stripe sub so it gets skipped but flow continues
        mockTable("memberships", [
          makeMembership({
            id: "mem-stripe",
            stripe_subscription_id: "sub_skip",
            stripe_subscription_status: "active",
          }),
        ]);

        // toLapse query: none
        mockTable("memberships", []);
        // toCancel query: one membership to cancel
        mockTable("memberships", [
          {
            id: "mem-cancel",
            member_id: "mbr-cancel",
            next_payment_due: "2023-01-01",
            last_payment_date: "2022-12-15",
          },
        ]);
        // Update result for cancel
        mockTable("memberships", null);

        mockRpc("acquire_billing_lock", () => ({ data: true, error: null }));
        mockRpc("release_billing_lock", () => ({ data: null, error: null }));

        const result = await processRecurringBilling(ORG_ID, { supabase: supabase as never });

        expect(result.statusUpdates).toBe(1);
        const membershipUpdates = updateCalls["memberships"];
        expect(membershipUpdates).toBeDefined();
        const updatePayload = membershipUpdates[0] as Record<string, unknown>;
        expect(updatePayload.status).toBe("cancelled");
        expect(updatePayload.cancelled_date).toBe("2025-01-15");
      });

      it("uses configurable thresholds from billing config", async () => {
        vi.mocked(loadBillingConfig).mockResolvedValueOnce({
          lapseDays: 14,
          cancelMonths: 12,
          reminderSchedule: [3, 7, 14],
          maxReminders: 3,
          sendInvoiceReminders: true,
          eligibilityMonths: 60,
        });

        const { supabase, mockTable, mockRpc } = createMockSupabase();

        mockTable("organizations", { timezone: "America/Los_Angeles" });
        // Provide a membership with Stripe sub so it gets skipped but flow continues
        mockTable("memberships", [
          makeMembership({
            id: "mem-stripe",
            stripe_subscription_id: "sub_skip",
            stripe_subscription_status: "active",
          }),
        ]);
        // With lapseDays=14, cutoff date is 2025-01-01 (15 - 14 = 1)
        // The query filters lte on that cutoff, so memberships due before Jan 1 would lapse
        mockTable("memberships", []);
        mockTable("memberships", []);

        mockRpc("acquire_billing_lock", () => ({ data: true, error: null }));
        mockRpc("release_billing_lock", () => ({ data: null, error: null }));

        const result = await processRecurringBilling(ORG_ID, { supabase: supabase as never });

        expect(result.success).toBe(true);
        expect(loadBillingConfig).toHaveBeenCalledWith(ORG_ID, expect.anything());
      });

      it("does not run status transitions in dry run mode", async () => {
        const { supabase, mockTable } = createMockSupabase();

        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockTable("memberships", []);

        const result = await processRecurringBilling(ORG_ID, {
          supabase: supabase as never,
          dryRun: true,
        });

        expect(result.statusUpdates).toBe(0);
        expect(loadBillingConfig).not.toHaveBeenCalled();
      });
    });

    describe("error handling", () => {
      it("records error and continues when payment creation fails for one membership", async () => {
        const { supabase, mockTable, mockRpc } = createMockSupabase();

        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockTable("memberships", [
          makeMembership({ id: "mem-fail" }),
          makeMembership({ id: "mem-ok" }),
        ]);

        // Duplicate check for mem-fail -> no dup
        mockTable("payments", null);
        // Insert for mem-fail FAILS
        mockTable("payments", null, { message: "Unique constraint violation" });
        // Duplicate check for mem-ok -> no dup
        mockTable("payments", null);
        // Insert for mem-ok succeeds
        mockTable("payments", { id: "pay-ok" });
        // Status transitions
        mockTable("memberships", []);
        mockTable("memberships", []);

        mockRpc("acquire_billing_lock", () => ({ data: true, error: null }));
        mockRpc("release_billing_lock", () => ({ data: null, error: null }));

        const result = await processRecurringBilling(ORG_ID, { supabase: supabase as never });

        expect(result.success).toBe(false); // has errors
        expect(result.paymentsCreated).toBe(1);
        expect(result.errors.length).toBe(1);
        expect(result.errors[0].membership_id).toBe("mem-fail");
      });
    });
  });

  // =========================================================================
  // settlePayment
  // =========================================================================

  describe("settlePayment", () => {
    describe("happy path", () => {
      it("marks payment as completed and credits months on the membership", async () => {
        const { supabase, mockTable, updateCalls } = createMockSupabase();

        // Payment lookup
        mockTable("payments", makePayment());
        // Org timezone
        mockTable("organizations", { timezone: "America/Los_Angeles" });
        // Update payment to completed
        mockTable("payments", null);
        // Update membership
        mockTable("memberships", null);
        // Org settings for email
        mockTable("organization_settings", { send_receipt_email: false });

        const result = await settlePayment({
          paymentId: PAYMENT_ID,
          method: "cash",
          supabase: supabase as never,
        });

        expect(result.success).toBe(true);
        expect(result.membershipUpdated).toBe(true);
        expect(result.newPaidMonths).toBe(11); // 10 + 1

        // Verify payment was updated to completed
        const paymentUpdates = updateCalls["payments"];
        expect(paymentUpdates).toBeDefined();
        const paymentUpdate = paymentUpdates[0] as Record<string, unknown>;
        expect(paymentUpdate.status).toBe("completed");
        expect(paymentUpdate.method).toBe("cash");
      });

      it("advances next_payment_due by the correct number of months", async () => {
        const { supabase, mockTable, updateCalls } = createMockSupabase();

        mockTable("payments", makePayment());
        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockTable("payments", null);
        mockTable("memberships", null);
        mockTable("organization_settings", { send_receipt_email: false });

        await settlePayment({
          paymentId: PAYMENT_ID,
          method: "cash",
          supabase: supabase as never,
        });

        const membershipUpdate = updateCalls["memberships"]?.[0] as Record<string, unknown>;
        // next_payment_due was 2025-01-15, monthly (1 month) -> 2025-02-15
        expect(membershipUpdate.next_payment_due).toBe("2025-02-15");
      });

      it("sets last_payment_date on settlement", async () => {
        const { supabase, mockTable, updateCalls } = createMockSupabase();

        mockTable("payments", makePayment());
        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockTable("payments", null);
        mockTable("memberships", null);
        mockTable("organization_settings", { send_receipt_email: false });

        const paidAt = "2025-01-16T10:00:00Z";
        await settlePayment({
          paymentId: PAYMENT_ID,
          method: "check",
          paidAt,
          supabase: supabase as never,
        });

        const membershipUpdate = updateCalls["memberships"]?.[0] as Record<string, unknown>;
        expect(membershipUpdate.last_payment_date).toBe("2025-01-16");
      });

      it("advances next_payment_due correctly for biannual frequency", async () => {
        const { supabase, mockTable, updateCalls } = createMockSupabase();

        mockTable(
          "payments",
          makePayment({
            months_credited: 6,
            amount: 140,
            membership: {
              id: MEMBERSHIP_ID,
              organization_id: ORG_ID,
              status: "current",
              billing_frequency: "biannual",
              billing_anniversary_day: 15,
              paid_months: 10,
              next_payment_due: "2025-01-15",
              last_payment_date: "2024-07-15",
              eligible_date: null,
              agreement_signed_at: "2024-01-01T00:00:00Z",
              join_date: "2024-01-15",
            },
          })
        );
        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockTable("payments", null);
        mockTable("memberships", null);
        mockTable("organization_settings", { send_receipt_email: false });

        await settlePayment({
          paymentId: PAYMENT_ID,
          method: "stripe",
          supabase: supabase as never,
        });

        const membershipUpdate = updateCalls["memberships"]?.[0] as Record<string, unknown>;
        // 2025-01-15 + 6 months = 2025-07-15
        expect(membershipUpdate.next_payment_due).toBe("2025-07-15");
        expect(membershipUpdate.paid_months).toBe(16); // 10 + 6
      });
    });

    describe("status transitions on settlement", () => {
      it("transitions pending to current when agreement is signed (first payment)", async () => {
        const { supabase, mockTable } = createMockSupabase();

        mockTable(
          "payments",
          makePayment({
            membership: {
              id: MEMBERSHIP_ID,
              organization_id: ORG_ID,
              status: "pending",
              billing_frequency: "monthly",
              billing_anniversary_day: 15,
              paid_months: 0,
              next_payment_due: "2025-01-15",
              last_payment_date: null,
              eligible_date: null,
              agreement_signed_at: "2025-01-10T00:00:00Z",
              join_date: null,
            },
          })
        );
        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockTable("payments", null);
        mockTable("memberships", null);
        mockTable("organization_settings", { send_receipt_email: false });

        const result = await settlePayment({
          paymentId: PAYMENT_ID,
          method: "stripe",
          supabase: supabase as never,
        });

        expect(result.newStatus).toBe("current");
        expect(logger.info).toHaveBeenCalledWith(
          "membership_joined",
          expect.objectContaining({
            old_status: "pending",
            new_status: "current",
          })
        );
      });

      it("transitions lapsed to current on payment (reinstatement)", async () => {
        const { supabase, mockTable } = createMockSupabase();

        mockTable(
          "payments",
          makePayment({
            membership: {
              id: MEMBERSHIP_ID,
              organization_id: ORG_ID,
              status: "lapsed",
              billing_frequency: "monthly",
              billing_anniversary_day: 15,
              paid_months: 10,
              next_payment_due: "2025-01-15",
              last_payment_date: "2024-12-15",
              eligible_date: null,
              agreement_signed_at: "2024-01-01T00:00:00Z",
              join_date: "2024-01-15",
            },
          })
        );
        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockTable("payments", null);
        mockTable("memberships", null);
        mockTable("organization_settings", { send_receipt_email: false });

        const result = await settlePayment({
          paymentId: PAYMENT_ID,
          method: "zelle",
          supabase: supabase as never,
        });

        expect(result.newStatus).toBe("current");
        expect(logger.info).toHaveBeenCalledWith(
          "membership_reinstated",
          expect.objectContaining({
            old_status: "lapsed",
            new_status: "current",
          })
        );
      });

      it("sets join_date on first payment when member was pending", async () => {
        const { supabase, mockTable, updateCalls } = createMockSupabase();

        mockTable(
          "payments",
          makePayment({
            membership: {
              id: MEMBERSHIP_ID,
              organization_id: ORG_ID,
              status: "pending",
              billing_frequency: "monthly",
              billing_anniversary_day: null,
              paid_months: 0,
              next_payment_due: "2025-01-15",
              last_payment_date: null,
              eligible_date: null,
              agreement_signed_at: "2025-01-10T00:00:00Z",
              join_date: null,
            },
          })
        );
        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockTable("payments", null);
        mockTable("memberships", null);
        mockTable("organization_settings", { send_receipt_email: false });

        await settlePayment({
          paymentId: PAYMENT_ID,
          method: "cash",
          supabase: supabase as never,
        });

        const membershipUpdate = updateCalls["memberships"]?.[0] as Record<string, unknown>;
        expect(membershipUpdate.join_date).toBe("2025-01-15");
      });
    });

    describe("eligibility", () => {
      it("sets eligible_date and returns becameEligible=true when paid_months reaches 60", async () => {
        const { supabase, mockTable, updateCalls } = createMockSupabase();

        // Member at 59 months, paying 1 more -> 60
        mockTable(
          "payments",
          makePayment({
            months_credited: 1,
            membership: {
              id: MEMBERSHIP_ID,
              organization_id: ORG_ID,
              status: "current",
              billing_frequency: "monthly",
              billing_anniversary_day: 15,
              paid_months: 59,
              next_payment_due: "2025-01-15",
              last_payment_date: "2024-12-15",
              eligible_date: null,
              agreement_signed_at: "2020-01-01T00:00:00Z",
              join_date: "2020-01-15",
            },
          })
        );
        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockTable("payments", null);
        mockTable("memberships", null);
        mockTable("organization_settings", { send_receipt_email: false });

        const result = await settlePayment({
          paymentId: PAYMENT_ID,
          method: "cash",
          supabase: supabase as never,
        });

        expect(result.becameEligible).toBe(true);
        expect(result.newPaidMonths).toBe(60);

        const membershipUpdate = updateCalls["memberships"]?.[0] as Record<string, unknown>;
        expect(membershipUpdate.eligible_date).toBe("2025-01-15");
      });

      it("does not set eligible_date when already past 60 months", async () => {
        const { supabase, mockTable, updateCalls } = createMockSupabase();

        // Already at 65 months
        mockTable(
          "payments",
          makePayment({
            months_credited: 1,
            membership: {
              id: MEMBERSHIP_ID,
              organization_id: ORG_ID,
              status: "current",
              billing_frequency: "monthly",
              billing_anniversary_day: 15,
              paid_months: 65,
              next_payment_due: "2025-01-15",
              last_payment_date: "2024-12-15",
              eligible_date: "2024-06-15",
              agreement_signed_at: "2019-01-01T00:00:00Z",
              join_date: "2019-01-15",
            },
          })
        );
        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockTable("payments", null);
        mockTable("memberships", null);
        mockTable("organization_settings", { send_receipt_email: false });

        const result = await settlePayment({
          paymentId: PAYMENT_ID,
          method: "cash",
          supabase: supabase as never,
        });

        expect(result.becameEligible).toBe(false);

        const membershipUpdate = updateCalls["memberships"]?.[0] as Record<string, unknown>;
        expect(membershipUpdate.eligible_date).toBeUndefined();
      });

      it("becomes eligible with annual payment that crosses the 60-month threshold", async () => {
        const { supabase, mockTable } = createMockSupabase();

        // At 50 months, paying 12 more -> 62
        mockTable(
          "payments",
          makePayment({
            months_credited: 12,
            amount: 260,
            membership: {
              id: MEMBERSHIP_ID,
              organization_id: ORG_ID,
              status: "current",
              billing_frequency: "annual",
              billing_anniversary_day: 15,
              paid_months: 50,
              next_payment_due: "2025-01-15",
              last_payment_date: "2024-01-15",
              eligible_date: null,
              agreement_signed_at: "2020-01-01T00:00:00Z",
              join_date: "2020-01-15",
            },
          })
        );
        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockTable("payments", null);
        mockTable("memberships", null);
        mockTable("organization_settings", { send_receipt_email: false });

        const result = await settlePayment({
          paymentId: PAYMENT_ID,
          method: "stripe",
          supabase: supabase as never,
        });

        expect(result.becameEligible).toBe(true);
        expect(result.newPaidMonths).toBe(62);
      });
    });

    describe("idempotency", () => {
      it("returns success for already-completed payments without double-crediting", async () => {
        const { supabase, mockTable, updateCalls } = createMockSupabase();

        mockTable("payments", makePayment({ status: "completed" }));

        const result = await settlePayment({
          paymentId: PAYMENT_ID,
          method: "stripe",
          supabase: supabase as never,
        });

        expect(result.success).toBe(true);
        expect(result.membershipUpdated).toBe(false);
        // No updates should have been made
        expect(updateCalls["payments"]).toBeUndefined();
        expect(updateCalls["memberships"]).toBeUndefined();
      });
    });

    describe("edge cases", () => {
      it("cannot settle a refunded payment", async () => {
        const { supabase, mockTable } = createMockSupabase();

        mockTable("payments", makePayment({ status: "refunded" }));

        const result = await settlePayment({
          paymentId: PAYMENT_ID,
          method: "cash",
          supabase: supabase as never,
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe("Cannot settle a refunded payment");
      });

      it("returns error for non-existent payment", async () => {
        const { supabase, mockTable } = createMockSupabase();

        mockTable("payments", null, { message: "Row not found" });

        const result = await settlePayment({
          paymentId: "pay-nonexistent",
          method: "cash",
          supabase: supabase as never,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("Payment not found");
      });

      it("returns error when membership is missing from payment join", async () => {
        const { supabase, mockTable } = createMockSupabase();

        mockTable("payments", makePayment({ membership: null }));

        const result = await settlePayment({
          paymentId: PAYMENT_ID,
          method: "cash",
          supabase: supabase as never,
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe("Membership not found for payment");
      });

      it("returns partial success when payment settles but membership update fails", async () => {
        const { supabase, mockTable } = createMockSupabase();

        mockTable("payments", makePayment());
        mockTable("organizations", { timezone: "America/Los_Angeles" });
        // Payment update succeeds
        mockTable("payments", null);
        // Membership update fails
        mockTable("memberships", null, { message: "Row lock timeout" });

        const result = await settlePayment({
          paymentId: PAYMENT_ID,
          method: "cash",
          supabase: supabase as never,
        });

        expect(result.success).toBe(true);
        expect(result.membershipUpdated).toBe(false);
        expect(result.error).toContain("membership update failed");
      });

      it("anchors billing anniversary day on first payment when next_payment_due is null", async () => {
        const { supabase, mockTable, updateCalls } = createMockSupabase();

        // Simulate first payment: next_payment_due is null
        mockTable(
          "payments",
          makePayment({
            membership: {
              id: MEMBERSHIP_ID,
              organization_id: ORG_ID,
              status: "pending",
              billing_frequency: "monthly",
              billing_anniversary_day: null,
              paid_months: 0,
              next_payment_due: null,
              last_payment_date: null,
              eligible_date: null,
              agreement_signed_at: "2025-01-10T00:00:00Z",
              join_date: null,
            },
          })
        );
        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockTable("payments", null);
        mockTable("memberships", null);
        mockTable("organization_settings", { send_receipt_email: false });

        await settlePayment({
          paymentId: PAYMENT_ID,
          method: "cash",
          supabase: supabase as never,
        });

        const membershipUpdate = updateCalls["memberships"]?.[0] as Record<string, unknown>;
        // billing_anniversary_day should be set (clamped to <=28)
        expect(membershipUpdate.billing_anniversary_day).toBeDefined();
        expect(membershipUpdate.billing_anniversary_day).toBeLessThanOrEqual(28);
      });

      it("handles payment with zero months_credited gracefully", async () => {
        const { supabase, mockTable } = createMockSupabase();

        mockTable(
          "payments",
          makePayment({
            months_credited: 0,
            membership: {
              id: MEMBERSHIP_ID,
              organization_id: ORG_ID,
              status: "current",
              billing_frequency: "monthly",
              billing_anniversary_day: 15,
              paid_months: 10,
              next_payment_due: "2025-01-15",
              last_payment_date: "2024-12-15",
              eligible_date: null,
              agreement_signed_at: "2024-01-01T00:00:00Z",
              join_date: "2024-01-15",
            },
          })
        );
        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockTable("payments", null);
        mockTable("memberships", null);
        mockTable("organization_settings", { send_receipt_email: false });

        const result = await settlePayment({
          paymentId: PAYMENT_ID,
          method: "cash",
          supabase: supabase as never,
        });

        expect(result.success).toBe(true);
        expect(result.newPaidMonths).toBe(10); // unchanged
      });
    });

    describe("receipt email", () => {
      it("sends receipt email on settlement when org has receipts enabled", async () => {
        const { supabase, mockTable } = createMockSupabase();

        mockTable("payments", makePayment());
        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockTable("payments", null); // payment update
        mockTable("memberships", null); // membership update
        // Org settings: receipts enabled
        mockTable("organization_settings", { send_receipt_email: true });
        // Member lookup for email
        mockTable("members", {
          email: "ahmed@example.com",
          first_name: "Ahmed",
          last_name: "Ali",
          preferred_language: "en",
        });
        // Full payment lookup for receipt
        mockTable("payments", {
          amount: 25,
          total_charged: 25,
          invoice_number: "INV-AL-202501-0001",
          period_label: "January 2025",
          method: "cash",
          paid_at: "2025-01-15T10:00:00Z",
        });

        await settlePayment({
          paymentId: PAYMENT_ID,
          method: "cash",
          supabase: supabase as never,
        });

        expect(sendPaymentReceiptEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            to: "ahmed@example.com",
            memberName: "Ahmed Ali",
            amount: "$25.00",
          })
        );
      });

      it("does not fail settlement if receipt email throws", async () => {
        const { supabase, mockTable } = createMockSupabase();

        mockTable("payments", makePayment());
        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockTable("payments", null);
        mockTable("memberships", null);
        // Org settings lookup throws
        mockTable("organization_settings", null, { message: "Table not found" });

        vi.mocked(sendPaymentReceiptEmail).mockRejectedValueOnce(
          new Error("SMTP connection refused")
        );

        const result = await settlePayment({
          paymentId: PAYMENT_ID,
          method: "cash",
          supabase: supabase as never,
        });

        // Settlement should still succeed
        expect(result.success).toBe(true);
        expect(result.membershipUpdated).toBe(true);
      });

      it("does not send email when org has send_receipt_email disabled", async () => {
        const { supabase, mockTable } = createMockSupabase();

        mockTable("payments", makePayment());
        mockTable("organizations", { timezone: "America/Los_Angeles" });
        mockTable("payments", null);
        mockTable("memberships", null);
        mockTable("organization_settings", { send_receipt_email: false });

        await settlePayment({
          paymentId: PAYMENT_ID,
          method: "cash",
          supabase: supabase as never,
        });

        expect(sendPaymentReceiptEmail).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // processAllOrganizationsBilling
  // =========================================================================

  describe("processAllOrganizationsBilling", () => {
    it("processes all active organizations and aggregates results", async () => {
      const { supabase, mockTable, mockRpc } = createMockSupabase();

      // Query active organizations
      mockTable("organizations", [
        { id: "org-1", name: "Org One" },
        { id: "org-2", name: "Org Two" },
      ]);

      // === Org 1 billing run ===
      mockTable("organizations", { timezone: "America/Los_Angeles" }); // timezone
      mockTable("memberships", []); // no memberships
      // === Org 2 billing run ===
      mockTable("organizations", { timezone: "America/New_York" }); // timezone
      mockTable("memberships", []); // no memberships

      mockRpc("acquire_billing_lock", () => ({ data: true, error: null }));
      mockRpc("release_billing_lock", () => ({ data: null, error: null }));

      const results = await processAllOrganizationsBilling({ supabase: supabase as never });

      expect(Object.keys(results)).toHaveLength(2);
      expect(results["org-1"]).toBeDefined();
      expect(results["org-2"]).toBeDefined();
      expect(results["org-1"].success).toBe(true);
      expect(results["org-2"].success).toBe(true);
    });

    it("continues processing remaining orgs when one org fails", async () => {
      const { supabase, mockTable, mockRpc } = createMockSupabase();

      mockTable("organizations", [
        { id: "org-fail", name: "Failing Org" },
        { id: "org-ok", name: "Good Org" },
      ]);

      // org-fail: timezone lookup fails
      mockTable("organizations", null, { message: "Connection refused" });
      // org-ok: timezone lookup succeeds
      mockTable("organizations", { timezone: "America/Los_Angeles" });
      mockTable("memberships", []);

      mockRpc("acquire_billing_lock", () => ({ data: true, error: null }));
      mockRpc("release_billing_lock", () => ({ data: null, error: null }));

      const results = await processAllOrganizationsBilling({ supabase: supabase as never });

      expect(Object.keys(results)).toHaveLength(2);
      expect(results["org-fail"].success).toBe(false);
      expect(results["org-fail"].errors.length).toBeGreaterThan(0);
      expect(results["org-ok"].success).toBe(true);
    });

    it("throws when the organizations query itself fails", async () => {
      const { supabase, mockTable } = createMockSupabase();

      mockTable("organizations", null, { message: "Database unavailable" });

      await expect(
        processAllOrganizationsBilling({ supabase: supabase as never })
      ).rejects.toThrow("Failed to query organizations");
    });

    it("returns empty results when no active organizations exist", async () => {
      const { supabase, mockTable } = createMockSupabase();

      mockTable("organizations", []);

      const results = await processAllOrganizationsBilling({ supabase: supabase as never });

      expect(Object.keys(results)).toHaveLength(0);
    });

    it("passes billing options through to each org processing run", async () => {
      const { supabase, mockTable } = createMockSupabase();

      mockTable("organizations", [{ id: "org-1", name: "Org One" }]);
      // Org 1: timezone
      mockTable("organizations", { timezone: "America/Los_Angeles" });
      // Org 1: no memberships (dry run skips lock)
      mockTable("memberships", []);

      const results = await processAllOrganizationsBilling({
        supabase: supabase as never,
        dryRun: true,
        billingDate: "2025-06-01",
      });

      expect(results["org-1"].success).toBe(true);
      // Lock RPCs should not have been called in dry run
      expect(supabase.rpc).not.toHaveBeenCalledWith(
        "acquire_billing_lock",
        expect.anything()
      );
    });
  });

  // =========================================================================
  // addMonthsPreserveDay (tested indirectly through settlePayment)
  // =========================================================================

  describe("addMonthsPreserveDay (indirect via settlePayment)", () => {
    it("preserves the day of month when advancing billing date", async () => {
      const { supabase, mockTable, updateCalls } = createMockSupabase();

      mockTable(
        "payments",
        makePayment({
          months_credited: 1,
          membership: {
            id: MEMBERSHIP_ID,
            organization_id: ORG_ID,
            status: "current",
            billing_frequency: "monthly",
            billing_anniversary_day: 20,
            paid_months: 5,
            next_payment_due: "2025-03-20",
            last_payment_date: "2025-02-20",
            eligible_date: null,
            agreement_signed_at: "2024-01-01T00:00:00Z",
            join_date: "2024-01-20",
          },
        })
      );
      mockTable("organizations", { timezone: "America/Los_Angeles" });
      mockTable("payments", null);
      mockTable("memberships", null);
      mockTable("organization_settings", { send_receipt_email: false });

      await settlePayment({
        paymentId: PAYMENT_ID,
        method: "cash",
        supabase: supabase as never,
      });

      const membershipUpdate = updateCalls["memberships"]?.[0] as Record<string, unknown>;
      // 2025-03-20 + 1 month = 2025-04-20
      expect(membershipUpdate.next_payment_due).toBe("2025-04-20");
    });

    it("clamps to last day of month when target month has fewer days", async () => {
      const { supabase, mockTable, updateCalls } = createMockSupabase();

      // Billing on Jan 31, advancing to Feb (which has 28 days in 2025)
      mockTable(
        "payments",
        makePayment({
          months_credited: 1,
          membership: {
            id: MEMBERSHIP_ID,
            organization_id: ORG_ID,
            status: "current",
            billing_frequency: "monthly",
            billing_anniversary_day: 31,
            paid_months: 3,
            next_payment_due: "2025-01-31",
            last_payment_date: "2024-12-31",
            eligible_date: null,
            agreement_signed_at: "2024-01-01T00:00:00Z",
            join_date: "2024-01-31",
          },
        })
      );
      mockTable("organizations", { timezone: "America/Los_Angeles" });
      mockTable("payments", null);
      mockTable("memberships", null);
      mockTable("organization_settings", { send_receipt_email: false });

      await settlePayment({
        paymentId: PAYMENT_ID,
        method: "cash",
        supabase: supabase as never,
      });

      const membershipUpdate = updateCalls["memberships"]?.[0] as Record<string, unknown>;
      // Jan 31 + 1 month should clamp to Feb 28, 2025
      expect(membershipUpdate.next_payment_due).toBe("2025-02-28");
    });

    it("handles annual advancement across year boundary", async () => {
      const { supabase, mockTable, updateCalls } = createMockSupabase();

      mockTable(
        "payments",
        makePayment({
          months_credited: 12,
          amount: 260,
          membership: {
            id: MEMBERSHIP_ID,
            organization_id: ORG_ID,
            status: "current",
            billing_frequency: "annual",
            billing_anniversary_day: 15,
            paid_months: 24,
            next_payment_due: "2025-03-15",
            last_payment_date: "2024-03-15",
            eligible_date: null,
            agreement_signed_at: "2023-03-01T00:00:00Z",
            join_date: "2023-03-15",
          },
        })
      );
      mockTable("organizations", { timezone: "America/Los_Angeles" });
      mockTable("payments", null);
      mockTable("memberships", null);
      mockTable("organization_settings", { send_receipt_email: false });

      await settlePayment({
        paymentId: PAYMENT_ID,
        method: "stripe",
        supabase: supabase as never,
      });

      const membershipUpdate = updateCalls["memberships"]?.[0] as Record<string, unknown>;
      // 2025-03-15 + 12 months = 2026-03-15
      expect(membershipUpdate.next_payment_due).toBe("2026-03-15");
    });
  });

  // =========================================================================
  // Processing status support
  // =========================================================================

  describe("processing status", () => {
    it("settlePayment works on a processing status payment", async () => {
      const { supabase, mockTable, updateCalls } = createMockSupabase();

      mockTable("payments", makePayment({ status: "processing" }));
      mockTable("organizations", { timezone: "America/Los_Angeles" });
      mockTable("payments", null);
      mockTable("memberships", null);
      mockTable("organization_settings", { send_receipt_email: false });

      const result = await settlePayment({
        paymentId: PAYMENT_ID,
        method: "stripe",
        supabase: supabase as never,
      });

      expect(result.success).toBe(true);
      expect(result.membershipUpdated).toBe(true);
      expect(result.newPaidMonths).toBe(11);

      const paymentUpdates = updateCalls["payments"];
      expect(paymentUpdates).toBeDefined();
      const paymentUpdate = paymentUpdates[0] as Record<string, unknown>;
      expect(paymentUpdate.status).toBe("completed");
    });

    it("duplicate check includes processing status", async () => {
      const { supabase, mockTable, mockRpc } = createMockSupabase();

      mockTable("organizations", { timezone: "America/Los_Angeles" });
      mockTable("memberships", [makeMembership()]);
      // Duplicate check finds a "processing" payment
      mockTable("payments", {
        id: "pay-processing",
        status: "processing",
        created_at: "2025-01-15T00:00:00Z",
      });
      mockTable("memberships", []);
      mockTable("memberships", []);

      mockRpc("acquire_billing_lock", () => ({ data: true, error: null }));
      mockRpc("release_billing_lock", () => ({ data: null, error: null }));

      const result = await processRecurringBilling(ORG_ID, { supabase: supabase as never });

      expect(result.skipped).toBe(1);
      expect(result.paymentsCreated).toBe(0);
      expect(logger.warn).toHaveBeenCalledWith(
        "membership_skipped_duplicate",
        expect.objectContaining({
          existing_payment_id: "pay-processing",
          reason: "payment_already_exists_for_period",
        })
      );
    });
  });
});
