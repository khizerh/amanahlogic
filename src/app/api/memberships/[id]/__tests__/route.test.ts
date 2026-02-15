import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const {
  mockGetOrganizationId,
  mockGetById,
  mockUpdate,
} = vi.hoisted(() => ({
  mockGetOrganizationId: vi.fn(),
  mockGetById: vi.fn(),
  mockUpdate: vi.fn(),
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
      error: "At least one field (enrollmentFeeStatus or paidMonths) is required",
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
