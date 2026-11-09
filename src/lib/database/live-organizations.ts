import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * An organization the public can join online: Stripe is onboarded and it has
 * at least one active plan. Used by the homepage org picker and /join.
 */
export interface LiveOrganization {
  name: string;
  slug: string;
  /** "City, ST" when the org has an address on file. */
  location: string | null;
}

export async function getLiveOrganizations(): Promise<LiveOrganization[]> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("organizations")
      .select("name, slug, address, plans!inner(id)")
      .eq("stripe_onboarded", true)
      .eq("plans.is_active", true)
      .order("name", { ascending: true });

    if (error || !data) {
      console.error("getLiveOrganizations failed:", error);
      return [];
    }

    return data.map((org) => {
      const address = (org.address ?? {}) as { city?: string; state?: string };
      const location = [address.city, address.state].filter(Boolean).join(", ");
      return { name: org.name, slug: org.slug, location: location || null };
    });
  } catch (err) {
    console.error("getLiveOrganizations threw:", err);
    return [];
  }
}
