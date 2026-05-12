import { NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { rowToMessage } from "@/lib/sms";

/**
 * GET /api/sms/threads/[memberId]
 *
 * Returns all messages for a member, oldest first. Also marks the inbound
 * messages as read since the admin is now viewing them.
 *
 * Special: memberId='unknown:+15551234' returns the unknown-sender thread.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId: rawKey } = await params;
    const organizationId = await getOrganizationId();
    const supabase = createServiceRoleClient();

    const isUnknown = rawKey.startsWith("unknown:");
    const query = supabase
      .from("sms_messages")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true });

    if (isUnknown) {
      const phone = rawKey.slice("unknown:".length);
      query.is("member_id", null).or(`from_number.eq.${phone},to_number.eq.${phone}`);
    } else {
      query.eq("member_id", rawKey);
    }

    const { data: rows, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Mark unread inbound as read.
    const unreadIds = (rows || [])
      .filter((r) => r.direction === "inbound" && r.read_at === null)
      .map((r) => r.id);

    if (unreadIds.length > 0) {
      await supabase
        .from("sms_messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadIds);
    }

    return NextResponse.json({
      messages: (rows || []).map(rowToMessage),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to load thread";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
