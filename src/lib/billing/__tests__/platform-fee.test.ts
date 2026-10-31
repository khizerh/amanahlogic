import { describe, it, expect } from "vitest";
import {
  resolvePlatformFee,
  platformFeeDiscountPercent,
  isPayerRelationship,
} from "../platform-fee";

const fees = { monthly: 2, biannual: 9, annual: 12 };
const discounts = { child: 50 };

describe("resolvePlatformFee", () => {
  it("returns the org fee when there is no payer", () => {
    expect(resolvePlatformFee({ platformFees: fees, platformFeeDiscounts: discounts }, "monthly")).toBe(2);
    expect(resolvePlatformFee({ platformFees: fees, platformFeeDiscounts: discounts, payerRelationship: "child" }, "biannual")).toBe(9);
  });

  it("returns the org fee when the payer has no relationship set", () => {
    expect(
      resolvePlatformFee({ platformFees: fees, platformFeeDiscounts: discounts, payerMemberId: "p1" }, "annual")
    ).toBe(12);
  });

  it("halves the fee for a child sponsorship at every frequency", () => {
    const ctx = { platformFees: fees, platformFeeDiscounts: discounts, payerMemberId: "p1", payerRelationship: "child" };
    expect(resolvePlatformFee(ctx, "monthly")).toBe(1);
    expect(resolvePlatformFee(ctx, "biannual")).toBe(4.5);
    expect(resolvePlatformFee(ctx, "annual")).toBe(6);
  });

  it("leaves other relationships at the full fee", () => {
    const ctx = { platformFees: fees, platformFeeDiscounts: discounts, payerMemberId: "p1", payerRelationship: "spouse" };
    expect(resolvePlatformFee(ctx, "monthly")).toBe(2);
  });

  it("treats a missing or empty discount map as no discount", () => {
    const ctx = { platformFees: fees, payerMemberId: "p1", payerRelationship: "child" };
    expect(resolvePlatformFee(ctx, "monthly")).toBe(2);
    expect(resolvePlatformFee({ ...ctx, platformFeeDiscounts: {} }, "monthly")).toBe(2);
    expect(resolvePlatformFee({ ...ctx, platformFeeDiscounts: null }, "monthly")).toBe(2);
  });

  it("rounds to the cent and clamps percentages", () => {
    const ctx = { platformFees: { monthly: 2.99, biannual: 0, annual: 0 }, payerMemberId: "p1", payerRelationship: "child" };
    expect(resolvePlatformFee({ ...ctx, platformFeeDiscounts: { child: 33 } }, "monthly")).toBe(2);
    expect(resolvePlatformFee({ ...ctx, platformFeeDiscounts: { child: 150 } }, "monthly")).toBe(0);
    expect(resolvePlatformFee({ ...ctx, platformFeeDiscounts: { child: -10 } }, "monthly")).toBe(2.99);
  });

  it("returns 0 when the org has no fees", () => {
    expect(resolvePlatformFee({ platformFees: null, payerMemberId: "p1", payerRelationship: "child", platformFeeDiscounts: discounts }, "monthly")).toBe(0);
  });
});

describe("platformFeeDiscountPercent", () => {
  it("is 0 without a payer, relationship, or matching discount", () => {
    expect(platformFeeDiscountPercent({ platformFees: fees, platformFeeDiscounts: discounts })).toBe(0);
    expect(platformFeeDiscountPercent({ platformFees: fees, platformFeeDiscounts: discounts, payerMemberId: "p1" })).toBe(0);
    expect(platformFeeDiscountPercent({ platformFees: fees, platformFeeDiscounts: discounts, payerMemberId: "p1", payerRelationship: "parent" })).toBe(0);
  });

  it("returns the configured percent for a matching relationship", () => {
    expect(platformFeeDiscountPercent({ platformFees: fees, platformFeeDiscounts: discounts, payerMemberId: "p1", payerRelationship: "child" })).toBe(50);
  });

  it("ignores non-numeric garbage in the map", () => {
    const bad = { child: "half" } as unknown as { child: number };
    expect(platformFeeDiscountPercent({ platformFees: fees, platformFeeDiscounts: bad, payerMemberId: "p1", payerRelationship: "child" })).toBe(0);
  });
});

describe("isPayerRelationship", () => {
  it("accepts the known values and rejects everything else", () => {
    for (const r of ["child", "parent", "spouse", "sibling", "other"]) expect(isPayerRelationship(r)).toBe(true);
    expect(isPayerRelationship("kid")).toBe(false);
    expect(isPayerRelationship("")).toBe(false);
    expect(isPayerRelationship(null)).toBe(false);
    expect(isPayerRelationship(undefined)).toBe(false);
  });
});
