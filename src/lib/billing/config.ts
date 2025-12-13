/**
 * Billing Configuration
 *
 * Centralized billing config loader used by:
 * - Billing engine (invoice generation, status transitions)
 * - Reminders (schedule, max reminders)
 * - Manual payment API (eligibility, validation)
 * - Stripe webhooks (eligibility)
 * - UI components (eligibility display)
 *
 * Falls back to DEFAULT_BILLING_CONFIG if org settings not found.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingConfig } from "@/lib/types";
import { DEFAULT_BILLING_CONFIG } from "@/lib/types";

/**
 * Load billing configuration for an organization
 *
 * @param organizationId - ID of the organization
 * @param supabase - Supabase client
 * @returns Merged billing config (org settings + defaults)
 *
 * @example
 * const config = await loadBillingConfig('org-123', supabase);
 * console.log(config.eligibilityMonths); // 60 (or org-specific value)
 */
export async function loadBillingConfig(
  organizationId: string,
  supabase: SupabaseClient
): Promise<BillingConfig> {
  try {
    const { data: settings } = await supabase
      .from("organization_settings")
      .select("billing_config")
      .eq("organization_id", organizationId)
      .single();

    if (settings?.billing_config) {
      // Merge with defaults to ensure all fields exist
      return {
        ...DEFAULT_BILLING_CONFIG,
        ...settings.billing_config,
      };
    }
  } catch {
    // Settings table may not exist yet - use defaults
  }

  return DEFAULT_BILLING_CONFIG;
}

/**
 * Get billing config for client-side use (API endpoint)
 *
 * Returns a safe subset of billing config for UI display.
 * Does not expose internal settings like reminder schedules.
 */
export interface ClientBillingConfig {
  eligibilityMonths: number;
  lapseDays: number;
  cancelMonths: number;
}

export function toClientBillingConfig(config: BillingConfig): ClientBillingConfig {
  return {
    eligibilityMonths: config.eligibilityMonths,
    lapseDays: config.lapseDays,
    cancelMonths: config.cancelMonths,
  };
}
