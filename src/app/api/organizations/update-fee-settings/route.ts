import { NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { OrganizationsService } from "@/lib/database/organizations";

interface UpdateFeeSettingsBody {
  passFeesToMember?: boolean;
  /** Pass Stripe's fee on the one-time enrollment fee (dues setting still governs dues). */
  passFeesOnEnrollment?: boolean;
}

/**
 * POST /api/organizations/update-fee-settings
 *
 * Update organization's fee pass-through settings. Either field may be sent
 * on its own; at least one is required.
 */
export async function POST(req: Request) {
  try {
    const organizationId = await getOrganizationId();
    const { passFeesToMember, passFeesOnEnrollment }: UpdateFeeSettingsBody = await req.json();

    if (passFeesToMember !== undefined && typeof passFeesToMember !== "boolean") {
      return NextResponse.json(
        { error: "passFeesToMember must be a boolean" },
        { status: 400 }
      );
    }
    if (passFeesOnEnrollment !== undefined && typeof passFeesOnEnrollment !== "boolean") {
      return NextResponse.json(
        { error: "passFeesOnEnrollment must be a boolean" },
        { status: 400 }
      );
    }
    if (passFeesToMember === undefined && passFeesOnEnrollment === undefined) {
      return NextResponse.json({ error: "No fee setting provided" }, { status: 400 });
    }

    const updated = await OrganizationsService.update({
      id: organizationId,
      ...(passFeesToMember !== undefined && { passFeesToMember }),
      ...(passFeesOnEnrollment !== undefined && { passFeesOnEnrollment }),
    });

    return NextResponse.json({
      success: true,
      organization: updated,
    });
  } catch (error) {
    console.error("Error updating fee settings:", error);
    const message = error instanceof Error ? error.message : "Failed to update settings";
    const status =
      error instanceof Error &&
      message.includes("active Stripe subscriptions")
        ? 409
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
