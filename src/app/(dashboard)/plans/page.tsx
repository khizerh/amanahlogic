import { PlansService } from "@/lib/database/plans";
import { PlansPageClient } from "./client";
import { getOrganizationId } from "@/lib/auth/get-organization-id";

export default async function PlansPage() {
  const organizationId = await getOrganizationId();
  const plans = await PlansService.getAll(organizationId);

  return <PlansPageClient initialPlans={plans} />;
}
