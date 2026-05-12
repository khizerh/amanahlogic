import { NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { recordInboundSms } from "@/lib/sms";

interface SimulateBody {
  fromNumber: string;
  body: string;
}

/**
 * POST /api/sms/simulate-inbound
 *
 * Dev-only: fake an incoming SMS so the UI can be tested without Twilio.
 * Gated behind NODE_ENV !== "production" so it can't be hit in prod.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  try {
    const organizationId = await getOrganizationId();
    const { fromNumber, body }: SimulateBody = await req.json();

    if (!fromNumber?.trim() || !body?.trim()) {
      return NextResponse.json(
        { error: "fromNumber and body are required" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const { data: org } = await supabase
      .from("organizations")
      .select("twilio_phone_number")
      .eq("id", organizationId)
      .single();

    const message = await recordInboundSms({
      organizationId,
      fromNumber: fromNumber.trim(),
      toNumber: org?.twilio_phone_number || "+15555550000",
      body: body.trim(),
      provider: "stub",
      supabase,
    });

    return NextResponse.json({ message });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to simulate inbound";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
