import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Get the organization_id for the currently authenticated user
 * Throws an error if user is not authenticated or not linked to an organization
 */
export async function getOrganizationId(): Promise<string> {
  const supabase = await createClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("User not authenticated");
  }

  // Look up admin_user record to get organization_id
  const { data: adminUser, error: adminError } = await supabase
    .from("admin_users")
    .select("organization_id, active")
    .eq("user_id", user.id)
    .single();

  if (adminError || !adminUser) {
    throw new Error("User not linked to an organization");
  }

  if (!adminUser.active) {
    throw new Error("User account is deactivated");
  }

  return adminUser.organization_id;
}

/**
 * Get the organization_id or return null if not authenticated
 * Useful for optional authentication scenarios
 */
export async function getOrganizationIdOrNull(): Promise<string | null> {
  try {
    return await getOrganizationId();
  } catch {
    return null;
  }
}
