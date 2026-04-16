import { Metadata } from "next";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { OrganizationsService } from "@/lib/database/organizations";
import { PlansService } from "@/lib/database/plans";
import { EnrollClient } from "./client";

export const metadata: Metadata = {
  title: "In-Person Enrollment",
};

export default async function EnrollPage() {
  const organizationId = await getOrganizationId();

  const [org, activePlans] = await Promise.all([
    OrganizationsService.getById(organizationId),
    PlansService.getActive(organizationId),
  ]);

  if (!org) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Organization not found</p>
      </div>
    );
  }

  return <EnrollClient organization={org} plans={activePlans} />;
}
