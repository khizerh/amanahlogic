import { NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { OrganizationsService } from "@/lib/database/organizations";

interface UpdateOrganizationBody {
  name?: string;
  email?: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
}

/**
 * POST /api/organizations/update
 *
 * Update organization details (name, contact info, address)
 */
export async function POST(req: Request) {
  try {
    const organizationId = await getOrganizationId();
    const body: UpdateOrganizationBody = await req.json();

    const updated = await OrganizationsService.update({
      id: organizationId,
      name: body.name,
      email: body.email,
      phone: body.phone,
      address: body.address,
    });

    return NextResponse.json({
      success: true,
      organization: updated,
    });
  } catch (error) {
    console.error("Error updating organization:", error);
    const message = error instanceof Error ? error.message : "Failed to update organization";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
