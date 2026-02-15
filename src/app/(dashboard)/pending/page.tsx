import { Metadata } from "next";
import Header from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { MembersService } from "@/lib/database/members";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { PendingMembersTable } from "./client";

export const metadata: Metadata = {
  title: "Pending Members",
};

export default async function PendingMembersPage() {
  const organizationId = await getOrganizationId();
  const members = await MembersService.getAllWithMembership(organizationId, {
    status: "pending",
  });

  return (
    <>
      <Header />
      <div className="min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Pending Members</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Members awaiting agreement signature, payment setup, or admin review
            </p>
          </div>

          {/* DataTable wrapped in Card */}
          <Card>
            <CardContent className="pt-6">
              <PendingMembersTable members={members} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
