import "server-only";

import { createClient } from "@/lib/supabase/server";
import { OrganizationSettingsService } from "@/lib/database/organizations";
import type { BillingConfig } from "@/lib/types";

// Development fallback org ID - only used when DEV_AUTH_BYPASS is enabled
const DEV_ORG_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

/**
 * Check if development auth bypass is enabled
 * Requires both development mode AND explicit env flag
 */
function isDevAuthBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.DEV_AUTH_BYPASS === "true"
  );
}

/**
 * Get the organization_id for the currently authenticated user
 * Throws if not authenticated or not linked to an organization
 */
export async function getOrganizationId(): Promise<string> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // Check for authenticated user with org ID in metadata
  if (user) {
    const orgId = user.app_metadata?.organization_id;
    if (orgId) {
      return orgId;
    }
    // User is authenticated but has no org linked - allow dev bypass
    if (isDevAuthBypassEnabled()) {
      console.warn("[Auth] DEV_AUTH_BYPASS enabled - user has no org, using development org ID");
      return DEV_ORG_ID;
    }
    throw new Error("User not linked to an organization");
  }

  // No authenticated user - only allow dev bypass in development with explicit flag
  if (isDevAuthBypassEnabled()) {
    console.warn("[Auth] DEV_AUTH_BYPASS enabled - no user, using development org ID");
    return DEV_ORG_ID;
  }

  // In production or without bypass flag, require authentication
  if (authError) {
    throw new Error(`Authentication error: ${authError.message}`);
  }
  throw new Error("User not authenticated");
}

/**
 * Get the organization_id or return null if not authenticated
 */
export async function getOrganizationIdOrNull(): Promise<string | null> {
  try {
    return await getOrganizationId();
  } catch {
    return null;
  }
}

/**
 * Get organization context: org ID + billing config
 * Use this in pages that need threshold values
 */
export async function getOrgContext(): Promise<{
  organizationId: string;
  billingConfig: BillingConfig;
}> {
  const organizationId = await getOrganizationId();
  const billingConfig = await OrganizationSettingsService.getBillingConfig(organizationId);

  return { organizationId, billingConfig };
}
