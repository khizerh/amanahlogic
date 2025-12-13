import { OrganizationsService } from "@/lib/database/organizations";
import { PlansService } from "@/lib/database/plans";
import { SettingsPageClient } from "./client";
import { getEmailTemplates } from "@/lib/mock-data";
import { getOrganizationId } from "@/lib/auth/get-organization-id";

export default async function SettingsPage() {
  const organizationId = await getOrganizationId();

  const [organization, plans] = await Promise.all([
    OrganizationsService.getById(organizationId),
    PlansService.getAll(organizationId),
  ]);

  // Email templates still come from mock for now (would need a separate table)
  const emailTemplates = getEmailTemplates();

  if (!organization) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Organization not found</p>
      </div>
    );
  }

  return (
    <SettingsPageClient
      initialOrganization={organization}
      initialPlans={plans}
      emailTemplates={emailTemplates}
    />
  );
}
