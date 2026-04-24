import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const {
  mockMembersCreate,
  mockMembersGetByEmail,
  mockMembersDelete,
  mockMembershipsCreate,
  mockPlansGetById,
  mockOrchestrateOnboarding,
  mockNormalizePhoneNumber,
  mockReturningAppsCreate,
  mockReturningAppsGetByEmail,
} = vi.hoisted(() => ({
  mockMembersCreate: vi.fn(),
  mockMembersGetByEmail: vi.fn(),
  mockMembersDelete: vi.fn(),
  mockMembershipsCreate: vi.fn(),
  mockPlansGetById: vi.fn(),
  mockOrchestrateOnboarding: vi.fn(),
  mockNormalizePhoneNumber: vi.fn((v: string) => v),
  mockReturningAppsCreate: vi.fn(),
  mockReturningAppsGetByEmail: vi.fn(),
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

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: "org-1", name: "Test Org", slug: "test-org" },
              error: null,
            })),
          })),
          single: vi.fn(() => ({
            data: { id: "org-1", name: "Test Org", slug: "test-org" },
            error: null,
          })),
        })),
      })),
    })),
  })),
}));

vi.mock("@/lib/database/members", () => ({
  MembersService: {
    create: mockMembersCreate,
    getByEmail: mockMembersGetByEmail,
    delete: mockMembersDelete,
  },
}));

vi.mock("@/lib/database/memberships", () => ({
  MembershipsService: {
    create: mockMembershipsCreate,
  },
}));

vi.mock("@/lib/database/plans", () => ({
  PlansService: {
    getById: mockPlansGetById,
  },
}));

vi.mock("@/lib/utils/phone", () => ({
  normalizePhoneNumber: mockNormalizePhoneNumber,
}));

vi.mock("@/lib/onboarding/orchestrate-onboarding", () => ({
  orchestrateOnboarding: mockOrchestrateOnboarding,
}));

vi.mock("@/lib/database/returning-applications", () => ({
  ReturningApplicationsService: {
    create: mockReturningAppsCreate,
    getByEmail: mockReturningAppsGetByEmail,
  },
}));

// ---------------------------------------------------------------------------
// Import route after mocks
// ---------------------------------------------------------------------------
import { POST } from "../route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockPlan = {
  id: "plan-1",
  organizationId: "org-1",
  type: "single",
  name: "Individual",
  pricing: { monthly: 50, biannual: 275, annual: 500 },
  enrollmentFee: 100,
  isActive: true,
};

const mockMember = {
  id: "member-1",
  organizationId: "org-1",
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
};

const mockMembership = {
  id: "membership-1",
  organizationId: "org-1",
  memberId: "member-1",
  planId: "plan-1",
  status: "pending",
  paidMonths: 0,
  enrollmentFeeStatus: "unpaid",
};

function makeRequest(body: Record<string, unknown>, headers?: Record<string, string>): Request {
  return new Request("http://localhost/api/join/test-org/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const defaultBody = {
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  phone: "+15551234567",
  planId: "plan-1",
  billingFrequency: "monthly",
};

const routeParams = { params: Promise.resolve({ slug: "test-org" }) };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/join/[slug]/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMembersGetByEmail.mockResolvedValue(null);
    mockPlansGetById.mockResolvedValue(mockPlan);
    mockMembersCreate.mockResolvedValue(mockMember);
    mockMembershipsCreate.mockResolvedValue(mockMembership);
    mockReturningAppsGetByEmail.mockResolvedValue(null);
    mockReturningAppsCreate.mockResolvedValue({ id: "app-1" });
    mockOrchestrateOnboarding.mockResolvedValue({
      welcomeEmailSent: true,
      agreementEmailSent: true,
      inviteCreated: true,
      onboardingInviteCreated: true,
      stripeSessionCreated: true,
      agreementCreated: true,
      paymentUrl: "https://stripe.com/checkout/123",
      errors: [],
      skipped: [],
    });
  });

  it("new-member signup creates a kind='new' application and skips member/membership/Stripe", async () => {
    const req = makeRequest(defaultBody);
    const res = await POST(req, routeParams);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      pendingApproval: true,
      returning: false,
    });
    expect(mockReturningAppsCreate).toHaveBeenCalledTimes(1);
    expect(mockReturningAppsCreate.mock.calls[0][0]).toMatchObject({ kind: "new" });
    expect(mockMembersCreate).not.toHaveBeenCalled();
    expect(mockMembershipsCreate).not.toHaveBeenCalled();
    expect(mockOrchestrateOnboarding).not.toHaveBeenCalled();
  });

  it("returning-member signup creates a kind='returning' application", async () => {
    const req = makeRequest({ ...defaultBody, returning: true });
    const res = await POST(req, routeParams);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      pendingApproval: true,
      returning: true,
    });
    expect(mockReturningAppsCreate).toHaveBeenCalledTimes(1);
    expect(mockReturningAppsCreate.mock.calls[0][0]).toMatchObject({ kind: "returning" });
    expect(mockMembersCreate).not.toHaveBeenCalled();
    expect(mockMembershipsCreate).not.toHaveBeenCalled();
    expect(mockOrchestrateOnboarding).not.toHaveBeenCalled();
  });

  it("duplicate email (existing member) returns 400", async () => {
    mockMembersGetByEmail.mockResolvedValue(mockMember);
    const req = makeRequest({ ...defaultBody, returning: true });
    const res = await POST(req, routeParams);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "A member with this email already exists" });
  });

  it("rate limits signups (new or returning) after 5 attempts per IP+kind", async () => {
    for (let i = 0; i < 5; i++) {
      const req = makeRequest(
        { ...defaultBody, email: `user${i}@example.com`, returning: true },
        { "x-forwarded-for": "1.2.3.4" }
      );
      const res = await POST(req, routeParams);
      expect(res.status).toBe(200);
    }

    const req = makeRequest(
      { ...defaultBody, email: "user5@example.com", returning: true },
      { "x-forwarded-for": "1.2.3.4" }
    );
    const res = await POST(req, routeParams);
    expect(res.status).toBe(429);
  });

  it("rate limits new-member signups after 5 attempts per IP", async () => {
    for (let i = 0; i < 5; i++) {
      const req = makeRequest(
        { ...defaultBody, email: `newuser${i}@example.com` },
        { "x-forwarded-for": "5.6.7.8" }
      );
      const res = await POST(req, routeParams);
      expect(res.status).toBe(200);
    }

    const req = makeRequest(
      { ...defaultBody, email: "newuser5@example.com" },
      { "x-forwarded-for": "5.6.7.8" }
    );
    const res = await POST(req, routeParams);
    expect(res.status).toBe(429);
  });
});
