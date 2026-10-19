import type { PaymentMethodDetails } from "@/lib/types";

/**
 * Client-safe display helpers for saved payment methods.
 * Link wallets have no card number: brand is "link", last4 is empty,
 * and the wallet email is shown instead.
 */
export function formatPaymentMethodLabel(
  pm: PaymentMethodDetails | null | undefined,
  opts: { mask?: "••••" | "****" } = {}
): string {
  if (!pm) return "No payment method";
  const mask = opts.mask ?? "••••";

  if (pm.type === "us_bank_account") {
    return `${pm.bankName || "Bank Account"} ${mask} ${pm.last4}`;
  }
  if (pm.brand?.toLowerCase() === "link") {
    return pm.email ? `Link (${pm.email})` : "Link";
  }
  return `${pm.brand?.toUpperCase() || "Card"} ${mask} ${pm.last4}`;
}

/** "MM/YYYY", or "" when there is no expiry (Link, bank accounts). */
export function formatPaymentMethodExpiry(
  pm: PaymentMethodDetails | null | undefined
): string {
  if (!pm?.expiryMonth || !pm.expiryYear) return "";
  return `${String(pm.expiryMonth).padStart(2, "0")}/${pm.expiryYear}`;
}
