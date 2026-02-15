import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const {
  mockGetOrganizationId,
  mockMembershipsGetById,
  mockMembersGetById,
  mockPlansGetById,
  mockGetActiveForMembership,
  mockOrchestrateOnboarding,
} = vi.hoisted(() => ({
  mockGetOrganizationId: vi.fn(),
  mockMembershipsGetById: vi.fn(),
  mockMembersGetById: vi.fn(),
  mockPlansGetById: vi.fn(),
  mockGetActiveForMembership: vi.fn(),
  mockOrchestrateOnboarding: vi.fn(),
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
    getById: mockMembershipsGetById,
  },
}));

vi.mock("@/lib/database/members", () => ({
  MembersService: {
    getById: mockMembersGetById,
  },
}));

vi.mock("@/lib/database/plans", () => ({
  PlansService: {
    getById: mockPlansGetById,
  },
}));

vi.mock("@/lib/database/onboarding-invites", () => ({
  OnboardingInvitesService: {
    getActiveForMembership: mockGetActiveForMembership,
  },
}));

vi.mock("@/lib/onboarding/orchestrate-onboarding", () => ({
  orchestrateOnboarding: mockOrchestrateOnboarding,
}));

// ---------------------------------------------------------------------------
// Import route after mocks
// ---------------------------------------------------------------------------
import { POST } from "../route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockMembership = {
  id: "membership-1",
  organizationId: "org-1",
  memberId: "member-1",
  planId: "plan-1",
  status: "pending",
  paidMonths: 0,
  enrollmentFeeStatus: "unpaid",
  stripeCustomerId: null,
};

const mockMember = {
  id: "member-1",
  organizationId: "org-1",
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
};

const mockPlan = {
  id: "plan-1",
  organizationId: "org-1",
  name: "Individual",
  type: "single",
  pricing: { monthly: 50, biannual: 275, annual: 500 },
  enrollmentFee: 100,
  isActive: true,
};

const onboardingResult = {
  welcomeEmailSent: true,
  agreementEmailSent: true,
  inviteCreated: true,
  onboardingInviteCreated: true,
  stripeSessionCreated: true,
  agreementCreated: true,
  paymentUrl: "https://stripe.com/checkout/123",
  errors: [],
  skipped: [],
};

function makeRequest(): Request {
  return new Request("http://localhost/api/memberships/membership-1/onboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

const routeParams = { params: Promise.resolve({ id: "membership-1" }) };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/memberships/[id]/onboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrganizationId.mockResolvedValue("org-1");
    mockMembershipsGetById.mockResolvedValue(mockMembership);
    mockMembersGetById.mockResolvedValue(mockMember);
    mockPlansGetById.mockResolvedValue(mockPlan);
    mockGetActiveForMembership.mockResolvedValue(null);
    mockOrchestrateOnboarding.mockResolvedValue(onboardingResult);
  });

  it("happy path: triggers orchestration for pending membership", async () => {
    const res = await POST(makeRequest(), routeParams);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(mockOrchestrateOnboarding).toHaveBeenCalledWith({
      organizationId: "org-1",
      member: mockMember,
      membership: mockMembership,
      plan: mockPlan,
      paymentMethod: "stripe",
      includeEnrollmentFee: true,
    });
  });

  it("includes enrollment fee when status is unpaid", async () => {
    await POST(makeRequest(), routeParams);

    expect(mockOrchestrateOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({ includeEnrollmentFee: true })
    );
  });

  it("excludes enrollment fee when status is waived", async () => {
    mockMembershipsGetById.mockResolvedValue({
      ...mockMembership,
      enrollmentFeeStatus: "waived",
    });

    await POST(makeRequest(), routeParams);

    expect(mockOrchestrateOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({ includeEnrollmentFee: false })
    );
  });

  it("returns 409 when membership is not pending", async () => {
    mockMembershipsGetById.mockResolvedValue({
      ...mockMembership,
      status: "active",
    });

    const res = await POST(makeRequest(), routeParams);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "Membership is not pending" });
    expect(mockOrchestrateOnboarding).not.toHaveBeenCalled();
  });

  it("returns 409 when stripeCustomerId is already set", async () => {
    mockMembershipsGetById.mockResolvedValue({
      ...mockMembership,
      stripeCustomerId: "cus_existing",
    });

    const res = await POST(makeRequest(), routeParams);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "Onboarding already started" });
    expect(mockOrchestrateOnboarding).not.toHaveBeenCalled();
  });

  it("returns 409 when active onboarding invite exists", async () => {
    mockGetActiveForMembership.mockResolvedValue({
      id: "invite-1",
      status: "pending",
    });

    const res = await POST(makeRequest(), routeParams);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "Onboarding already in progress" });
    expect(mockOrchestrateOnboarding).not.toHaveBeenCalled();
  });

  it("returns 403 for membership from different org", async () => {
    mockMembershipsGetById.mockResolvedValue({
      ...mockMembership,
      organizationId: "org-2",
    });

    const res = await POST(makeRequest(), routeParams);

    expect(res.status).toBe(403);
  });

  it("returns 401 for unauthenticated request", async () => {
    mockGetOrganizationId.mockRejectedValue(new Error("User not authenticated"));

    const res = await POST(makeRequest(), routeParams);

    expect(res.status).toBe(401);
  });

  it("returns errors from partial orchestration failure", async () => {
    mockOrchestrateOnboarding.mockResolvedValue({
      ...onboardingResult,
      errors: ["Failed to send welcome email"],
    });

    const res = await POST(makeRequest(), routeParams);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      errors: ["Failed to send welcome email"],
    });
  });
});
