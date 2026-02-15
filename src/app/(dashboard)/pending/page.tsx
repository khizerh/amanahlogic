import { Metadata } from "next";
import Header from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { ReturningApplicationsService } from "@/lib/database/returning-applications";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { ReturningApplicationsTable } from "./client";

export const metadata: Metadata = {
  title: "Pending Members",
};

export default async function PendingMembersPage() {
  const organizationId = await getOrganizationId();
  const applications = await ReturningApplicationsService.getAll(organizationId);

  return (
    <>
      <Header />
      <div className="min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Pending Applications</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Returning member applications awaiting review
            </p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <ReturningApplicationsTable applications={applications} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
