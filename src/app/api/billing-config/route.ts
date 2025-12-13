import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadBillingConfig, toClientBillingConfig } from "@/lib/billing/config";

/**
 * GET /api/billing-config?organizationId=xxx
 *
 * Returns billing configuration for display in UI components.
 * Used by RecordPaymentSheet to show correct eligibility threshold.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const config = await loadBillingConfig(organizationId, supabase);
    const clientConfig = toClientBillingConfig(config);

    return NextResponse.json(clientConfig);
  } catch (error) {
    console.error("Error fetching billing config:", error);
    return NextResponse.json(
      { error: "Failed to fetch billing config" },
      { status: 500 }
    );
  }
}
