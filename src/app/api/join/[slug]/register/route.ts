import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { MembersService } from "@/lib/database/members";
import { PlansService } from "@/lib/database/plans";
import { ReturningApplicationsService } from "@/lib/database/returning-applications";
import { normalizePhoneNumber } from "@/lib/utils/phone";
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

    // 2. Rate limit all public registrations (new + returning)
    {
      const forwardedFor = request.headers.get("x-forwarded-for");
      const realIp = request.headers.get("x-real-ip");
      const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : realIp?.trim() || null;
      const normalizedEmail = (email || "").trim().toLowerCase();
      const kindKey = returning ? "returning" : "new";
      const rateLimitKey = ip
        ? `${ip}:${slug}:${kindKey}`
        : `${normalizedEmail}:${slug}:${kindKey}`;

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

    // 8. Both new and returning signups go into the application queue.
    // An admin reviews and approves from /pending — approval creates the member,
    // membership, Stripe customer, and sends onboarding emails.
    const existingApp = await ReturningApplicationsService.getByEmail(
      org.id,
      email,
      supabase
    );
    if (existingApp) {
      return NextResponse.json(
        { error: "A pending application with this email already exists. Please wait for it to be reviewed." },
        { status: 400 }
      );
    }

    await ReturningApplicationsService.create(
      {
        organizationId: org.id,
        kind: returning ? "returning" : "new",
        firstName,
        middleName: middleName || null,
        lastName,
        email,
        phone: normalizedPhone || phone,
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
        planId: plan.id,
        billingFrequency: billingFrequency || "monthly",
      },
      supabase
    );

    return NextResponse.json({
      success: true,
      pendingApproval: true,
      returning: !!returning,
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
