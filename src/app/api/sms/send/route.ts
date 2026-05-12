import { NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { createClient } from "@/lib/supabase/server";
import { sendSms } from "@/lib/sms";

interface SendBody {
  memberId?: string | null;
  toNumber: string;
  body: string;
  overrideReason?: string;
}

/**
 * POST /api/sms/send
 *
 * Admin-initiated outbound SMS. Body validation is intentionally light —
 * the service layer enforces opt-out gating and provider routing.
 */
export async function POST(req: Request) {
  try {
    const organizationId = await getOrganizationId();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { memberId = null, toNumber, body, overrideReason }: SendBody = await req.json();

    if (!toNumber?.trim() || !body?.trim()) {
      return NextResponse.json(
        { error: "toNumber and body are required" },
        { status: 400 }
      );
    }

    const result = await sendSms({
      organizationId,
      memberId,
      toNumber: toNumber.trim(),
      body: body.trim(),
      overrideReason: overrideReason?.trim() || undefined,
      sentByUserId: user?.id ?? null,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ message: result.message });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to send SMS";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
