import { NextResponse } from "next/server";

import { MembershipsService } from "@/lib/database/memberships";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { BillingFrequency } from "@/lib/types";

interface ChangeFrequencyBody {
  membershipId: string;
  newFrequency: BillingFrequency;
}

const VALID_FREQUENCIES: BillingFrequency[] = ["monthly", "biannual", "annual"];

/**
 * POST /api/memberships/change-frequency
 *
 * Change the billing frequency of a membership.
 */
export async function POST(req: Request) {
  try {
    const organizationId = await getOrganizationId();

    const { membershipId, newFrequency }: ChangeFrequencyBody = await req.json();

    if (!membershipId || !newFrequency) {
      return NextResponse.json(
        { error: "membershipId and newFrequency are required" },
        { status: 400 }
      );
    }

    if (!VALID_FREQUENCIES.includes(newFrequency)) {
      return NextResponse.json(
        { error: `Invalid frequency. Must be one of: ${VALID_FREQUENCIES.join(", ")}` },
        { status: 400 }
      );
    }

    // Get membership and verify it belongs to this organization
    const membership = await MembershipsService.getById(membershipId);
    if (!membership || membership.organizationId !== organizationId) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    const previousFrequency = membership.billingFrequency;

    // Update billing frequency
    await MembershipsService.update({
      id: membershipId,
      billingFrequency: newFrequency,
    });

    return NextResponse.json({
      success: true,
      previousFrequency,
      newFrequency,
    });
  } catch (error) {
    console.error("Error changing billing frequency:", error);
    const message = error instanceof Error ? error.message : "Failed to change billing frequency";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
