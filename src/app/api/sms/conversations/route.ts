import { NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * GET /api/sms/conversations
 *
 * Returns one row per (member or unknown sender) summarising the latest
 * message + unread count. Used by the inbox left pane.
 */
export async function GET() {
  try {
    const organizationId = await getOrganizationId();
    const supabase = createServiceRoleClient();

    // Pull all messages for the org. For ~hundreds of members this is fine;
    // when volume grows we'd push the aggregation into SQL via a view or RPC.
    const { data: rows, error } = await supabase
      .from("sms_messages")
      .select(
        "id, member_id, from_number, to_number, body, direction, status, read_at, created_at"
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(2000);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    interface Conv {
      key: string;
      memberId: string | null;
      fromNumber: string;
      latestBody: string;
      latestAt: string;
      latestDirection: string;
      unreadCount: number;
    }

    const byKey = new Map<string, Conv>();
    for (const r of rows || []) {
      // Group by member if known, else by unknown sender's phone number.
      const key = r.member_id || `unknown:${r.direction === "inbound" ? r.from_number : r.to_number}`;
      const existing = byKey.get(key);
      const isUnread = r.direction === "inbound" && r.read_at === null;
      if (!existing) {
        byKey.set(key, {
          key,
          memberId: r.member_id,
          fromNumber: r.direction === "inbound" ? r.from_number : r.to_number,
          latestBody: r.body,
          latestAt: r.created_at,
          latestDirection: r.direction,
          unreadCount: isUnread ? 1 : 0,
        });
      } else if (isUnread) {
        existing.unreadCount += 1;
      }
    }

    // Pull member names for the keys we have.
    const memberIds = Array.from(byKey.values()).map((c) => c.memberId).filter(Boolean) as string[];
    const memberMap = new Map<string, { firstName: string; lastName: string; phone: string | null; smsOptedOutAt: string | null }>();
    if (memberIds.length > 0) {
      const { data: members } = await supabase
        .from("members")
        .select("id, first_name, last_name, phone, sms_opted_out_at")
        .in("id", memberIds);
      for (const m of members || []) {
        memberMap.set(m.id, {
          firstName: m.first_name,
          lastName: m.last_name,
          phone: m.phone,
          smsOptedOutAt: m.sms_opted_out_at,
        });
      }
    }

    const conversations = Array.from(byKey.values()).map((c) => {
      const m = c.memberId ? memberMap.get(c.memberId) : null;
      return {
        key: c.key,
        memberId: c.memberId,
        memberName: m ? `${m.firstName} ${m.lastName}` : null,
        memberOptedOutAt: m?.smsOptedOutAt ?? null,
        phoneNumber: c.fromNumber,
        latestBody: c.latestBody,
        latestAt: c.latestAt,
        latestDirection: c.latestDirection,
        unreadCount: c.unreadCount,
      };
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to load conversations";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
