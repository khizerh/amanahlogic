/**
 * Past-dues ("arrears") math.
 *
 * A member who stops paying sits at status=current with a stale
 * next_payment_due. When they come back onto auto-pay, the months between that
 * stale due date and today are real debt (the org would have paid out a benefit
 * for them during the gap), so the setup flow collects them up front.
 *
 * Definitions:
 *   - next_payment_due = first day of the first UNPAID period.
 *   - The new subscription's first invoice covers the CURRENT period, so the
 *     months owed are the whole months strictly before it.
 *
 *   next_payment_due = 2026-09-01, today = 2026-10-19 → owes Sep (1 month);
 *   the subscription's first charge covers Oct.
 *   next_payment_due = 2026-02-01, today = 2026-09-10 → owes Feb..Aug (7).
 *   next_payment_due in the future → 0 (member is current → trial_end flow).
 *
 * Pure and client-safe: no server-only imports. Dates are "YYYY-MM-DD" strings
 * already resolved to the org's timezone by the caller.
 */

function parseYmd(ymd: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/**
 * Whole months owed before the current period. Never negative.
 */
export function monthsOwed(nextPaymentDue: string | null | undefined, today: string): number {
  if (!nextPaymentDue) return 0;
  const due = parseYmd(nextPaymentDue);
  const now = parseYmd(today);
  if (!due || !now) return 0;
  if (nextPaymentDue.slice(0, 10) >= today.slice(0, 10)) return 0;
  const months = (now.year - due.year) * 12 + (now.month - due.month);
  return Math.max(0, months);
}

/**
 * Clamp an admin-entered arrears count to what is actually owed today.
 * Undefined/NaN means "collect everything owed". Admins can only waive downward.
 */
export function clampArrearsMonths(requested: number | null | undefined, owed: number): number {
  if (requested === null || requested === undefined || Number.isNaN(requested)) return owed;
  return Math.min(Math.max(0, Math.floor(requested)), owed);
}

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Human label for the owed months, e.g. "Sep 2026" or "Feb – Aug 2026" or
 * "Nov 2025 – Jan 2026". Empty string when nothing is owed.
 */
export function arrearsPeriodLabel(nextPaymentDue: string | null | undefined, months: number): string {
  if (!nextPaymentDue || months <= 0) return "";
  const due = parseYmd(nextPaymentDue);
  if (!due) return "";

  const startIdx = due.month - 1; // 0-based
  const endTotal = startIdx + months - 1;
  const endYear = due.year + Math.floor(endTotal / 12);
  const endIdx = endTotal % 12;

  const start = `${MONTHS_EN[startIdx]} ${due.year}`;
  if (months === 1) return start;
  if (endYear === due.year) return `${MONTHS_EN[startIdx]} – ${MONTHS_EN[endIdx]} ${due.year}`;
  return `${start} – ${MONTHS_EN[endIdx]} ${endYear}`;
}

/** Today's date as YYYY-MM-DD in the browser's local time. Client-side only. */
export function todayLocalYmd(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
