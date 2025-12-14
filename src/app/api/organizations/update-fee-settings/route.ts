import { NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { OrganizationsService } from "@/lib/database/organizations";

interface UpdateFeeSettingsBody {
  passFeesToMember: boolean;
}

/**
 * POST /api/organizations/update-fee-settings
 *
 * Update organization's fee pass-through setting
 */
export async function POST(req: Request) {
  try {
    const organizationId = await getOrganizationId();
    const { passFeesToMember }: UpdateFeeSettingsBody = await req.json();

    if (typeof passFeesToMember !== "boolean") {
      return NextResponse.json(
        { error: "passFeesToMember must be a boolean" },
        { status: 400 }
      );
    }

    const updated = await OrganizationsService.update({
      id: organizationId,
      passFeesToMember,
    });

    return NextResponse.json({
      success: true,
      organization: updated,
    });
  } catch (error) {
    console.error("Error updating fee settings:", error);
    const message = error instanceof Error ? error.message : "Failed to update settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
