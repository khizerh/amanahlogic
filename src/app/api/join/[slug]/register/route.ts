import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { MembersService } from "@/lib/database/members";
import { MembershipsService } from "@/lib/database/memberships";
import { PlansService } from "@/lib/database/plans";
import { normalizePhoneNumber } from "@/lib/utils/phone";
import { orchestrateOnboarding } from "@/lib/onboarding/orchestrate-onboarding";
import type { BillingFrequency } from "@/lib/types";

// =============================================================================
// Rate Limiter (best-effort, in-memory)
// =============================================================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(key: string): boolean {
  const now = Date.now();

  // Clean up stale entries
  for (const [k, v] of rateLimitMap) {
    if (now > v.resetAt) {
      rateLimitMap.delete(k);
    }
  }

  const entry = rateLimitMap.get(key);
  if (!entry) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// =============================================================================
// Route
// =============================================================================

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const supabase = createServiceRoleClient();

    // 1. Resolve org from slug
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .eq("slug", slug)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      firstName,
      middleName,
      lastName,
      email,
      phone,
      street,
      city,
      state,
      zip,
      spouseName,
      emergencyName,
      emergencyPhone,
      planId,
      billingFrequency,
      preferredLanguage,
      children,
      returning,
    } = body as {
      firstName: string;
      middleName?: string;
      lastName: string;
      email: string;
      phone: string;
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      spouseName?: string;
      emergencyName?: string;
      emergencyPhone?: string;
      planId: string;
      billingFrequency: BillingFrequency;
      preferredLanguage?: "en" | "fa";
      children?: { id: string; name: string; dateOfBirth: string }[];
      returning?: boolean;
    };

    // 2. Rate limit returning registrations
    if (returning) {
      const forwardedFor = request.headers.get("x-forwarded-for");
      const realIp = request.headers.get("x-real-ip");
      const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : realIp?.trim() || null;
      const normalizedEmail = (email || "").trim().toLowerCase();
      const rateLimitKey = ip
        ? `${ip}:${slug}:returning`
        : `${normalizedEmail}:${slug}:returning`;

      if (!checkRateLimit(rateLimitKey)) {
        return NextResponse.json(
          { error: "Too many registration attempts. Please try again later." },
          { status: 429 }
        );
      }
    }

    // 3. Validate required fields
    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "First name and last name are required" },
        { status: 400 }
      );
    }
    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }
    if (!phone) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }
    if (!planId) {
      return NextResponse.json(
        { error: "Please select a plan" },
        { status: 400 }
      );
    }
    if (!billingFrequency) {
      return NextResponse.json(
        { error: "Billing frequency is required" },
        { status: 400 }
      );
    }

    // 4. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    // 5. Check for duplicate email in org
    const existingMember = await MembersService.getByEmail(org.id, email, supabase);
    if (existingMember) {
      return NextResponse.json(
        { error: "A member with this email already exists" },
        { status: 400 }
      );
    }

    // 6. Validate plan belongs to org and is active
    const plan = await PlansService.getById(planId, supabase);
    if (!plan || plan.organizationId !== org.id || !plan.isActive) {
      return NextResponse.json(
        { error: "Selected plan is not available" },
        { status: 400 }
      );
    }

    // 7. Normalize phone numbers
    const normalizedPhone = normalizePhoneNumber(phone);
    const normalizedEmergencyPhone = emergencyPhone
      ? normalizePhoneNumber(emergencyPhone)
      : "";

    // 8. Create member
    const member = await MembersService.create(
      {
        organizationId: org.id,
        firstName,
        middleName: middleName || null,
        lastName,
        email,
        phone: normalizedPhone || undefined,
        address: {
          street: street || "",
          city: city || "",
          state: state || "",
          zip: zip || "",
        },
        spouseName: spouseName || null,
        children: children || [],
        emergencyContact: {
          name: emergencyName || "",
          phone: normalizedEmergencyPhone,
        },
        preferredLanguage: preferredLanguage || "en",
      },
      supabase
    );

    // 9. Create membership
    let membership;
    try {
      membership = await MembershipsService.create(
        {
          organizationId: org.id,
          memberId: member.id,
          planId: plan.id,
          status: "pending",
          billingFrequency: billingFrequency || "monthly",
          paidMonths: 0,
          enrollmentFeeStatus: "unpaid",
          joinDate: null,
        },
        supabase
      );
    } catch (membershipError) {
      // Roll back: delete the orphaned member record
      try {
        await MembersService.delete(member.id, supabase);
      } catch {
        // Best effort cleanup
      }
      throw membershipError;
    }

    // 10. For returning members, skip orchestration entirely
    if (returning) {
      return NextResponse.json({
        success: true,
        returning: true,
      });
    }

    // 11. Orchestrate onboarding (Stripe SetupIntent, agreement, portal invite, emails)
    const onboarding = await orchestrateOnboarding({
      organizationId: org.id,
      member,
      membership,
      plan,
      paymentMethod: "stripe",
      includeEnrollmentFee: true,
    });

    // 12. Return payment URL
    if (!onboarding.paymentUrl) {
      return NextResponse.json(
        {
          error:
            onboarding.errors.length > 0
              ? onboarding.errors[0]
              : "Failed to create payment session. Please contact the organization.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      paymentUrl: onboarding.paymentUrl,
    });
  } catch (error) {
    console.error("Error in self-service registration:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Registration failed",
      },
      { status: 500 }
    );
  }
}
