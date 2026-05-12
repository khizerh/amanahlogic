import { NextResponse } from "next/server";
import { getOrganizationIdOrNull } from "@/lib/auth/get-organization-id";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * GET /api/sms/unread-count
 *
 * Returns the count of unread inbound messages for the current org.
 * Cheap query backed by idx_sms_messages_unread_inbound. Polled by the
 * Header to drive the nav badge.
 */
export async function GET() {
  try {
    const organizationId = await getOrganizationIdOrNull();
    if (!organizationId) return NextResponse.json({ count: 0 });

    const supabase = createServiceRoleClient();
    const { count, error } = await supabase
      .from("sms_messages")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("direction", "inbound")
      .is("read_at", null);

    if (error) return NextResponse.json({ count: 0 });
    return NextResponse.json({ count: count ?? 0 });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
