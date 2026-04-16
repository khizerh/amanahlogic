import { NextResponse } from "next/server";

import { OrganizationsService } from "@/lib/database/organizations";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { registerReader, listReaders, deleteReader } from "@/lib/stripe/terminal";
import { isStripeConfigured } from "@/lib/stripe";

/**
 * GET /api/stripe/terminal/readers
 *
 * List all readers registered to this org's Terminal location.
 */
export async function GET() {
  try {
    const organizationId = await getOrganizationId();

    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
    }

    const org = await OrganizationsService.getById(organizationId);
    if (!org?.terminalLocationId) {
      return NextResponse.json({ readers: [], configured: false });
    }

    const readers = await listReaders(org.terminalLocationId);

    return NextResponse.json({
      configured: true,
      readers: readers.map((r) => ({
        id: r.id,
        label: r.label,
        status: r.status,
        deviceType: r.device_type,
        serialNumber: r.serial_number,
        ipAddress: r.ip_address,
      })),
    });
  } catch (error) {
    console.error("Error listing Terminal readers:", error);
    const message = error instanceof Error ? error.message : "Failed to list readers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/stripe/terminal/readers
 *
 * Register a new reader using its registration code.
 */
export async function POST(req: Request) {
  try {
    const organizationId = await getOrganizationId();

    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
    }

    const { registrationCode, label } = await req.json();

    if (!registrationCode) {
      return NextResponse.json(
        { error: "registrationCode is required" },
        { status: 400 }
      );
    }

    const org = await OrganizationsService.getById(organizationId);
    if (!org?.terminalLocationId) {
      return NextResponse.json(
        { error: "Terminal location not set up. Set up Terminal in Settings first." },
        { status: 400 }
      );
    }

    const reader = await registerReader({
      registrationCode,
      locationId: org.terminalLocationId,
      label,
    });

    return NextResponse.json({
      success: true,
      reader: {
        id: reader.id,
        label: reader.label,
        status: reader.status,
        deviceType: reader.device_type,
        serialNumber: reader.serial_number,
      },
    });
  } catch (error) {
    console.error("Error registering Terminal reader:", error);
    const message = error instanceof Error ? error.message : "Failed to register reader";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/stripe/terminal/readers
 *
 * Delete a reader by ID.
 */
export async function DELETE(req: Request) {
  try {
    await getOrganizationId();

    const { readerId } = await req.json();
    if (!readerId) {
      return NextResponse.json({ error: "readerId is required" }, { status: 400 });
    }

    await deleteReader(readerId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting Terminal reader:", error);
    const message = error instanceof Error ? error.message : "Failed to delete reader";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
