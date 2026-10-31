import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const {
  mockGetOrganizationId,
  mockGetById,
  mockUpdate,
  mockOrgGetById,
  mockPlanGetById,
  mockUpdateSubscriptionPricing,
} = vi.hoisted(() => ({
  mockGetOrganizationId: vi.fn(),
  mockGetById: vi.fn(),
  mockUpdate: vi.fn(),
  mockOrgGetById: vi.fn(),
  mockPlanGetById: vi.fn(),
  mockUpdateSubscriptionPricing: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status || 200,
      json: () => Promise.resolve(body),
    })),
  },
}));

vi.mock("@/lib/auth/get-organization-id", () => ({
  getOrganizationId: mockGetOrganizationId,
}));

vi.mock("@/lib/database/memberships", () => ({
  MembershipsService: {
    getById: mockGetById,
    update: mockUpdate,
  },
}));

vi.mock("@/lib/database/organizations", () => ({
  OrganizationsService: { getById: mockOrgGetById },
}));

vi.mock("@/lib/database/plans", () => ({
  PlansService: { getById: mockPlanGetById },
}));

vi.mock("@/lib/stripe", () => ({
  updateSubscriptionPricing: mockUpdateSubscriptionPricing,
}));

// ---------------------------------------------------------------------------
// Import route after mocks
// ---------------------------------------------------------------------------
import { PUT } from "../route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockMembership = {
  id: "membership-1",
  organizationId: "org-1",
  memberId: "member-1",
  planId: "plan-1",
  status: "pending",
  paidMonths: 0,
  enrollmentFeeStatus: "unpaid",
};

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/memberships/membership-1", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const routeParams = { params: Promise.resolve({ id: "membership-1" }) };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PUT /api/memberships/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrganizationId.mockResolvedValue("org-1");
    mockGetById.mockResolvedValue(mockMembership);
    mockUpdate.mockImplementation(async (input: Record<string, unknown>) => ({
      ...mockMembership,
      ...input,
    }));
  });

  it("updates enrollmentFeeStatus successfully", async () => {
    const req = makeRequest({ enrollmentFeeStatus: "waived" });
    const res = await PUT(req, routeParams);

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({
      id: "membership-1",
      enrollmentFeeStatus: "waived",
    });
  });

  it("updates paidMonths successfully", async () => {
    const req = makeRequest({ paidMonths: 36 });
    const res = await PUT(req, routeParams);

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({
      id: "membership-1",
      paidMonths: 36,
    });
  });

  it("rejects invalid enrollmentFeeStatus", async () => {
    const req = makeRequest({ enrollmentFeeStatus: "invalid" });
    const res = await PUT(req, routeParams);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "enrollmentFeeStatus must be one of: unpaid, paid, waived",
    });
  });

  it("rejects negative paidMonths", async () => {
    const req = makeRequest({ paidMonths: -1 });
    const res = await PUT(req, routeParams);

    expect(res.status).toBe(400);
  });

  it("rejects paidMonths > 720", async () => {
    const req = makeRequest({ paidMonths: 721 });
    const res = await PUT(req, routeParams);

    expect(res.status).toBe(400);
  });

  it("rejects non-integer paidMonths", async () => {
    const req = makeRequest({ paidMonths: 3.5 });
    const res = await PUT(req, routeParams);

    expect(res.status).toBe(400);
  });

  it("rejects request with no fields", async () => {
    const req = makeRequest({});
    const res = await PUT(req, routeParams);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "At least one field (enrollmentFeeStatus, paidMonths, planId, or payerRelationship) is required",
    });
  });

  describe("payerRelationship", () => {
    const org = {
      id: "org-1",
      platformFees: { monthly: 2, biannual: 9, annual: 12 },
      platformFeeDiscounts: { child: 50 },
      passFeesToMember: true,
      stripeConnectId: "acct_1",
    };
    const plan = { id: "plan-1", name: "Single", pricing: { monthly: 20, biannual: 120, annual: 240 } };
    const sponsored = {
      ...mockMembership,
      payerMemberId: "member-dad",
      payerRelationship: null,
      billingFrequency: "monthly",
      stripeSubscriptionId: "sub_1",
      subscriptionStatus: "active",
    };

    beforeEach(() => {
      mockOrgGetById.mockResolvedValue(org);
      mockPlanGetById.mockResolvedValue(plan);
      mockUpdateSubscriptionPricing.mockResolvedValue({});
    });

    it("rejects an unknown relationship", async () => {
      mockGetById.mockResolvedValue(sponsored);
      const res = await PUT(makeRequest({ payerRelationship: "kid" }), routeParams);
      expect(res.status).toBe(400);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("rejects a relationship on a membership with no payer", async () => {
      mockGetById.mockResolvedValue({ ...sponsored, payerMemberId: null });
      const res = await PUT(makeRequest({ payerRelationship: "child" }), routeParams);
      expect(res.status).toBe(400);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("saves without touching Stripe when there is no live subscription", async () => {
      mockGetById.mockResolvedValue({ ...sponsored, stripeSubscriptionId: null, subscriptionStatus: null });
      mockUpdate.mockResolvedValue({ ...sponsored, payerRelationship: "child" });
      const res = await PUT(makeRequest({ payerRelationship: "child" }), routeParams);
      expect(res.status).toBe(200);
      expect(mockUpdateSubscriptionPricing).not.toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledWith({ id: "membership-1", payerRelationship: "child" });
    });

    it("reprices a live subscription at the discounted fee before saving", async () => {
      mockGetById.mockResolvedValue(sponsored);
      mockUpdate.mockResolvedValue({ ...sponsored, payerRelationship: "child" });
      const res = await PUT(makeRequest({ payerRelationship: "child" }), routeParams);
      expect(res.status).toBe(200);
      expect(mockUpdateSubscriptionPricing).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionId: "sub_1",
          newDuesAmountCents: 2000,
          newBillingFrequency: "monthly",
          platformFeeDollars: 1,
          passFeesToMember: true,
        })
      );
      expect(mockUpdate).toHaveBeenCalledWith({ id: "membership-1", payerRelationship: "child" });
      expect(res.body).toMatchObject({ stripeUpdated: true });
    });

    it("skips repricing when the fee does not move", async () => {
      mockGetById.mockResolvedValue({ ...sponsored, payerRelationship: "spouse" });
      mockUpdate.mockResolvedValue({ ...sponsored, payerRelationship: "sibling" });
      const res = await PUT(makeRequest({ payerRelationship: "sibling" }), routeParams);
      expect(res.status).toBe(200);
      expect(mockUpdateSubscriptionPricing).not.toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledWith({ id: "membership-1", payerRelationship: "sibling" });
    });

    it("does not save when Stripe repricing fails", async () => {
      mockGetById.mockResolvedValue(sponsored);
      mockUpdateSubscriptionPricing.mockRejectedValue(new Error("stripe down"));
      const res = await PUT(makeRequest({ payerRelationship: "child" }), routeParams);
      expect(res.status).toBe(502);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("is a no-op when the relationship is unchanged", async () => {
      mockGetById.mockResolvedValue({ ...sponsored, payerRelationship: "child" });
      mockUpdate.mockResolvedValue({ ...sponsored, payerRelationship: "child" });
      const res = await PUT(makeRequest({ payerRelationship: "child" }), routeParams);
      expect(res.status).toBe(200);
      expect(mockUpdateSubscriptionPricing).not.toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledWith({ id: "membership-1" });
    });
  });

  it("returns 403 for membership from different org", async () => {
    mockGetById.mockResolvedValue({ ...mockMembership, organizationId: "org-2" });
    const req = makeRequest({ paidMonths: 10 });
    const res = await PUT(req, routeParams);

    expect(res.status).toBe(403);
  });

  it("returns 401 for unauthenticated request", async () => {
    mockGetOrganizationId.mockRejectedValue(new Error("User not authenticated"));
    const req = makeRequest({ paidMonths: 10 });
    const res = await PUT(req, routeParams);

    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent membership", async () => {
    mockGetById.mockResolvedValue(null);
    const req = makeRequest({ paidMonths: 10 });
    const res = await PUT(req, routeParams);

    expect(res.status).toBe(404);
  });
});
