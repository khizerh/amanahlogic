import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // Find the invite
    const { data: invite, error: inviteError } = await supabase
      .from("member_invites")
      .select(`
        id,
        email,
        status,
        expires_at,
        member:members(id, first_name, last_name, user_id),
        organization:organizations(name)
      `)
      .eq("token", token)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: "Invite has expired" }, { status: 400 });
    }

    // Check if already used
    if (invite.status !== "pending") {
      return NextResponse.json({ error: "Invite has already been used" }, { status: 400 });
    }

    // Check if member already has an account
    const member = Array.isArray(invite.member) ? invite.member[0] : invite.member;
    if (member?.user_id) {
      return NextResponse.json({ error: "Member already has portal access" }, { status: 400 });
    }

    const org = Array.isArray(invite.organization) ? invite.organization[0] : invite.organization;

    return NextResponse.json({
      email: invite.email,
      memberName: `${member?.first_name} ${member?.last_name}`,
      orgName: org?.name || "Your Organization",
    });
  } catch (error) {
    console.error("Error verifying invite:", error);
    return NextResponse.json({ error: "Failed to verify invite" }, { status: 500 });
  }
}
