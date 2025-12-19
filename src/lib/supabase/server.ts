import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

/**
 * Create a Supabase client with service role privileges
 *
 * Use this for:
 * - Cron jobs without user sessions
 * - Server-side operations that need to bypass RLS
 *
 * WARNING: This client bypasses Row Level Security. Use with caution.
 */
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/**
 * Check if development auth bypass is enabled
 */
function isDevAuthBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.DEV_AUTH_BYPASS === "true"
  );
}

/**
 * Create a Supabase client appropriate for the current context
 *
 * - In production: Uses the regular client with user session (RLS enforced)
 * - In development with DEV_AUTH_BYPASS: Uses service role client (RLS bypassed)
 *
 * Use this in database services for automatic dev/prod handling.
 */
export async function createClientForContext() {
  if (isDevAuthBypassEnabled()) {
    return createServiceRoleClient();
  }
  return createClient();
}
