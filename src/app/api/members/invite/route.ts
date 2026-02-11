import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { sendMemberInviteEmail } from "@/lib/email/send-member-invite";

export async function POST(request: NextRequest) {
  try {
    const organizationId = await getOrganizationId();
    const { memberId } = await request.json();

    if (!memberId) {
      return NextResponse.json({ error: "Member ID required" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // Get member details
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("id, email, first_name, last_name, user_id")
      .eq("id", memberId)
      .eq("organization_id", organizationId)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Check if already linked
    if (member.user_id) {
      return NextResponse.json({ error: "Member already has portal access" }, { status: 400 });
    }

    // Cancel any existing pending invites
    await supabase
      .from("member_invites")
      .update({ status: "expired" })
      .eq("member_id", memberId)
      .eq("status", "pending");

    // Create new invite
    const { data: invite, error: inviteError } = await supabase
      .from("member_invites")
      .insert({
        organization_id: organizationId,
        member_id: memberId,
        email: member.email,
      })
      .select()
      .single();

    if (inviteError) {
      console.error("Error creating invite:", inviteError);
      return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
    }

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/accept-invite?token=${invite.token}`;

    // Send invite email to the member
    const emailResult = await sendMemberInviteEmail({
      to: member.email,
      memberName: `${member.first_name} ${member.last_name}`,
      memberId: member.id,
      organizationId,
      inviteUrl,
      expiresAt: invite.expires_at,
      language: "en",
    });

    if (!emailResult.success) {
      console.error("Failed to send invite email:", emailResult.error);
    }

    return NextResponse.json({
      success: true,
      inviteUrl,
      emailSent: emailResult.success,
      message: emailResult.success
        ? `Invite sent to ${member.email}`
        : `Invite created for ${member.first_name} ${member.last_name} (email delivery failed)`,
    });
  } catch (error) {
    console.error("Error sending invite:", error);
    return NextResponse.json({ error: "Failed to send invite" }, { status: 500 });
  }
}
