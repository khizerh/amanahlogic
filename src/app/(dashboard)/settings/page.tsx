import { OrganizationsService } from "@/lib/database/organizations";
import { PlansService } from "@/lib/database/plans";
import { SettingsPageClient } from "./client";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { AgreementTemplatesService } from "@/lib/database/agreement-templates";
import { EmailTemplatesService } from "@/lib/database/email-templates";

export default async function SettingsPage() {
  const organizationId = await getOrganizationId();

  const [organization, plans, agreementTemplates, emailTemplates] = await Promise.all([
    OrganizationsService.getById(organizationId),
    PlansService.getAll(organizationId),
    AgreementTemplatesService.getAllByOrg(organizationId),
    EmailTemplatesService.getAll(organizationId),
  ]);

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
      agreementTemplates={agreementTemplates}
      emailTemplates={emailTemplates}
    />
  );
}
