import { NextResponse } from "next/server";

import { OrganizationsService } from "@/lib/database/organizations";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { createTerminalLocation } from "@/lib/stripe/terminal";
import { isStripeConfigured } from "@/lib/stripe";
import { createClientForContext } from "@/lib/supabase/server";

/**
 * POST /api/stripe/terminal/location
 *
 * One-time setup: Create a Stripe Terminal Location for the organization.
 * Stores the location ID on the org record.
 */
export async function POST() {
  try {
    const organizationId = await getOrganizationId();

    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 503 }
      );
    }

    const org = await OrganizationsService.getById(organizationId);
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Don't create duplicate locations
    if (org.terminalLocationId) {
      return NextResponse.json({
        success: true,
        locationId: org.terminalLocationId,
        alreadyExists: true,
      });
    }

    const location = await createTerminalLocation({
      displayName: org.name,
      address: org.address,
    });

    // Save location ID to org
    const supabase = await createClientForContext();
    await supabase
      .from("organizations")
      .update({ terminal_location_id: location.id })
      .eq("id", organizationId);

    return NextResponse.json({
      success: true,
      locationId: location.id,
    });
  } catch (error) {
    console.error("Error creating Terminal location:", error);
    const message = error instanceof Error ? error.message : "Failed to create location";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/stripe/terminal/location
 *
 * Check if Terminal is set up for this org.
 */
export async function GET() {
  try {
    const organizationId = await getOrganizationId();
    const org = await OrganizationsService.getById(organizationId);

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json({
      configured: !!org.terminalLocationId,
      locationId: org.terminalLocationId,
    });
  } catch (error) {
    console.error("Error checking Terminal location:", error);
    const message = error instanceof Error ? error.message : "Failed to check location";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
