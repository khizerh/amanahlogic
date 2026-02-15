import { Metadata } from "next";
import Header from "@/components/Header";
import { MembersService } from "@/lib/database/members";
import { ReturningApplicationsService } from "@/lib/database/returning-applications";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { PendingPageClient } from "./client";

export const metadata: Metadata = {
  title: "Pending Members",
};

export default async function PendingMembersPage() {
  const organizationId = await getOrganizationId();

  const [returningApplications, pendingMembers] = await Promise.all([
    ReturningApplicationsService.getAll(organizationId, "pending"),
    MembersService.getAllWithMembership(organizationId, { status: "pending" }),
  ]);

  return (
    <>
      <Header />
      <div className="min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Pending Members</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Returning member applications and new members awaiting onboarding
            </p>
          </div>

          <PendingPageClient
            returningApplications={returningApplications}
            pendingMembers={pendingMembers}
          />
        </div>
      </div>
    </>
  );
}
