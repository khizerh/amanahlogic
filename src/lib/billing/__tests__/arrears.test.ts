import { describe, it, expect } from "vitest";
import {
  monthsOwed,
  clampArrearsMonths,
  arrearsPeriodLabel,
  todayLocalYmd,
} from "../arrears";

describe("monthsOwed", () => {
  it("returns 0 for null/undefined due", () => {
    expect(monthsOwed(null, "2026-10-19")).toBe(0);
    expect(monthsOwed(undefined, "2026-10-19")).toBe(0);
  });

  it("returns 0 when due is in the future", () => {
    expect(monthsOwed("2026-11-01", "2026-10-19")).toBe(0);
  });

  it("returns 0 when due is today", () => {
    expect(monthsOwed("2026-10-19", "2026-10-19")).toBe(0);
  });

  it("counts whole months before the current period", () => {
    expect(monthsOwed("2026-09-01", "2026-10-19")).toBe(1);
    expect(monthsOwed("2026-02-01", "2026-09-10")).toBe(7);
  });

  it("handles mid-month due dates", () => {
    expect(monthsOwed("2026-09-19", "2026-10-05")).toBe(1);
    expect(monthsOwed("2026-09-19", "2026-09-25")).toBe(0);
  });

  it("handles year boundaries", () => {
    expect(monthsOwed("2025-11-01", "2026-02-15")).toBe(3);
  });

  it("parses timestamps with a time suffix", () => {
    expect(monthsOwed("2026-09-01T00:00:00Z", "2026-10-19")).toBe(1);
  });
});

describe("clampArrearsMonths", () => {
  it("defaults to owed for undefined/null/NaN", () => {
    expect(clampArrearsMonths(undefined, 5)).toBe(5);
    expect(clampArrearsMonths(null, 5)).toBe(5);
    expect(clampArrearsMonths(NaN, 5)).toBe(5);
  });

  it("clamps negatives to 0", () => {
    expect(clampArrearsMonths(-3, 5)).toBe(0);
  });

  it("clamps above owed down to owed", () => {
    expect(clampArrearsMonths(10, 5)).toBe(5);
  });

  it("floors fractions", () => {
    expect(clampArrearsMonths(2.9, 5)).toBe(2);
  });

  it("passes through valid values", () => {
    expect(clampArrearsMonths(3, 5)).toBe(3);
    expect(clampArrearsMonths(0, 5)).toBe(0);
  });
});

describe("arrearsPeriodLabel", () => {
  it("is empty for 0 months", () => {
    expect(arrearsPeriodLabel("2026-09-01", 0)).toBe("");
  });

  it("labels a single month", () => {
    expect(arrearsPeriodLabel("2026-09-01", 1)).toBe("Sep 2026");
  });

  it("labels a same-year range", () => {
    expect(arrearsPeriodLabel("2026-02-01", 7)).toBe("Feb – Aug 2026");
  });

  it("labels a cross-year range", () => {
    expect(arrearsPeriodLabel("2025-11-01", 3)).toBe("Nov 2025 – Jan 2026");
  });
});

describe("todayLocalYmd", () => {
  it("formats local date with zero padding", () => {
    expect(todayLocalYmd(new Date(2026, 9, 5))).toBe("2026-10-05");
  });
});
