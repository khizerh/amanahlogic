import { NextRequest, NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { PlansService } from "@/lib/database/plans";
import type { PlanPricing } from "@/lib/types";

/**
 * POST /api/plans/create
 * Create a new membership plan
 * Type is auto-generated from name (lowercase, spaces to hyphens)
 */
export async function POST(req: NextRequest) {
  try {
    const organizationId = await getOrganizationId();
    const body = await req.json();

    const { name, description, pricing, enrollmentFee } = body;

    // Validate required fields
    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    if (!pricing || typeof pricing !== "object") {
      return NextResponse.json(
        { error: "pricing object is required with monthly, biannual, annual" },
        { status: 400 }
      );
    }

    const planPricing: PlanPricing = {
      monthly: Number(pricing.monthly) || 0,
      biannual: Number(pricing.biannual) || 0,
      annual: Number(pricing.annual) || 0,
    };

    // Auto-generate type from name: lowercase, spaces to hyphens
    const planName = name.trim();
    const planType = planName.toLowerCase().replace(/\s+/g, "-");

    const plan = await PlansService.create({
      organizationId,
      name: planName,
      type: planType,
      description: description?.trim() || undefined,
      pricing: planPricing,
      enrollmentFee: Number(enrollmentFee) || 0,
      isActive: true,
    });

    return NextResponse.json({ success: true, plan });
  } catch (error) {
    console.error("Error creating plan:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create plan" },
      { status: 500 }
    );
  }
}
