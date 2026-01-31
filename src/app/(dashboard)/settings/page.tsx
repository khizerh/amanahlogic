import { Metadata } from "next";
import { OrganizationsService } from "@/lib/database/organizations";

export const metadata: Metadata = {
  title: "Settings",
};
import { SettingsPageClient } from "./client";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { AgreementTemplatesService } from "@/lib/database/agreement-templates";
import { EmailTemplatesService } from "@/lib/database/email-templates";

export default async function SettingsPage() {
  const organizationId = await getOrganizationId();

  const [organization, agreementTemplates, initialEmailTemplates] = await Promise.all([
    OrganizationsService.getById(organizationId),
    AgreementTemplatesService.getAllByOrg(organizationId),
    EmailTemplatesService.getAll(organizationId),
  ]);

  // Ensure all default email templates exist (inserts any missing types)
  let emailTemplates = initialEmailTemplates;
  try {
    await EmailTemplatesService.seedDefaults(organizationId);
    emailTemplates = await EmailTemplatesService.getAll(organizationId);
  } catch (err) {
    console.error("Failed to seed default email templates:", err);
  }

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
      agreementTemplates={agreementTemplates}
      emailTemplates={emailTemplates}
    />
  );
}
