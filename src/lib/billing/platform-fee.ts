/**
 * Platform-fee resolution for a membership.
 *
 * The platform fee is the org's per-cycle flat fee (organizations.platform_fees).
 * A payer-managed membership can get a percentage off it based on who the
 * member is to their payer (memberships.payer_relationship), using the org's
 * organizations.platform_fee_discounts map, e.g. { child: 50 }.
 *
 * EVERY place that turns a platform fee into money or a quote must go through
 * resolvePlatformFee(). The Stripe webhook re-derives the fee from the DB when
 * an invoice lands, so a fee baked into a subscription price has to match what
 * this function returns for the same membership — otherwise payments are booked
 * at the wrong split.
 *
 * Pure module: no server-only imports, safe in server components and tests.
 */

import type { BillingFrequency, PlatformFees, PlatformFeeDiscounts } from "@/lib/types";

export const PAYER_RELATIONSHIPS = ["child", "parent", "spouse", "sibling", "other"] as const;
export type PayerRelationship = (typeof PAYER_RELATIONSHIPS)[number];

export const PAYER_RELATIONSHIP_LABELS: Record<PayerRelationship, string> = {
  child: "Child",
  parent: "Parent",
  spouse: "Spouse",
  sibling: "Sibling",
  other: "Other",
};

export function isPayerRelationship(value: unknown): value is PayerRelationship {
  return typeof value === "string" && (PAYER_RELATIONSHIPS as readonly string[]).includes(value);
}

export interface PlatformFeeContext {
  /** Org's per-frequency platform fees (dollars). */
  platformFees: PlatformFees | null | undefined;
  /** Org's discount map, percent off keyed by relationship. */
  platformFeeDiscounts?: PlatformFeeDiscounts | null;
  /** Membership's payer. Discounts only apply when a payer is set. */
  payerMemberId?: string | null;
  /** Who the member is to the payer. */
  payerRelationship?: string | null;
}

/**
 * Percent (0–100) off the platform fee for this membership. 0 when the
 * membership has no payer, no relationship, or the org has no discount for it.
 */
export function platformFeeDiscountPercent(ctx: PlatformFeeContext): number {
  if (!ctx.payerMemberId || !ctx.payerRelationship) return 0;
  const raw = ctx.platformFeeDiscounts?.[ctx.payerRelationship as PayerRelationship];
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.min(100, Math.max(0, raw));
}

/**
 * The platform fee (dollars) this membership pays per cycle at `frequency`,
 * after any payer-relationship discount. Rounded to the cent.
 */
export function resolvePlatformFee(ctx: PlatformFeeContext, frequency: BillingFrequency): number {
  const full = ctx.platformFees?.[frequency] || 0;
  const pct = platformFeeDiscountPercent(ctx);
  if (pct === 0) return full;
  return Math.round(full * (100 - pct)) / 100;
}
