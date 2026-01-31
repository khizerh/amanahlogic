import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MemberPortalService } from "@/lib/database/member-portal";
import { normalizePhoneNumber } from "@/lib/utils";

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get member ID from user link
    const { data: member } = await supabase
      .from("members")
      .select("id, organization_id")
      .eq("user_id", user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const body = await request.json();
    const { phone, address, emergencyContact, preferredLanguage } = body;

    // Normalize phone numbers to E.164 before storage
    const normalizedPhone = phone ? normalizePhoneNumber(phone) : undefined;
    const normalizedEmergencyContact = emergencyContact
      ? {
          ...emergencyContact,
          phone: emergencyContact.phone ? normalizePhoneNumber(emergencyContact.phone) : "",
        }
      : undefined;

    const updatedMember = await MemberPortalService.updateProfile(
      member.id,
      member.organization_id,
      {
        phone: normalizedPhone,
        address,
        emergencyContact: normalizedEmergencyContact,
        preferredLanguage,
      }
    );

    return NextResponse.json({ success: true, member: updatedMember });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
