import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { token, userId } = await request.json();

    if (!token || !userId) {
      return NextResponse.json({ error: "Token and userId required" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // Find the invite
    const { data: invite, error: inviteError } = await supabase
      .from("member_invites")
      .select("id, member_id, status, expires_at")
      .eq("token", token)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
    }

    // Validate invite
    if (invite.status !== "pending") {
      return NextResponse.json({ error: "Invite already used" }, { status: 400 });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: "Invite expired" }, { status: 400 });
    }

    // Link member to user
    const { error: updateMemberError } = await supabase
      .from("members")
      .update({ user_id: userId })
      .eq("id", invite.member_id);

    if (updateMemberError) {
      console.error("Error linking member:", updateMemberError);
      return NextResponse.json({ error: "Failed to link account" }, { status: 500 });
    }

    // Mark invite as accepted
    const { error: updateInviteError } = await supabase
      .from("member_invites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invite.id);

    if (updateInviteError) {
      console.error("Error updating invite:", updateInviteError);
      // Don't fail - member is already linked
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error linking invite:", error);
    return NextResponse.json({ error: "Failed to link account" }, { status: 500 });
  }
}
