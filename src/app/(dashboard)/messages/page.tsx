import { Metadata } from "next";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { MembersService } from "@/lib/database/members";
import { isSmsLive } from "@/lib/sms/provider";
import { MessagesClient } from "./client";

export const metadata: Metadata = {
  title: "Messages",
};

export default async function MessagesPage() {
  const organizationId = await getOrganizationId();
  const members = await MembersService.getAllWithMembership(organizationId);

  const memberOptions = members.map((m) => ({
    id: m.id,
    name: `${m.firstName} ${m.lastName}`.trim(),
    phone: m.phone ?? null,
  }));

  return (
    <MessagesClient
      memberOptions={memberOptions}
      smsLive={isSmsLive()}
      isDev={process.env.NODE_ENV !== "production"}
    />
  );
}
