/**
 * One-off: export members who have paid (completed dues/enrollment) but whose
 * onboarding is incomplete — unsigned agreement, no portal login, or pending.
 * Writes paid-incomplete-onboarding.csv to repo root.
 *
 * Run: npx tsx scripts/export-paid-incomplete.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const [k, ...v] = t.split("=");
    const val = v.join("=").replace(/^["']|["']$/g, "");
    if (k && !process.env[k]) process.env[k] = val;
  }
}
loadEnvFile();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
) as SupabaseClient;

const ORG = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const { data: rows, error: qErr } = await supabase
    .from("memberships")
    .select(`
      status, billing_frequency, agreement_signed_at, next_payment_due,
      member:members!memberships_member_id_fkey!inner ( first_name, last_name, email, phone, preferred_language, user_id ),
      payments:payments!inner ( type, status, paid_at )
    `)
    .eq("organization_id", ORG);

  if (qErr) throw qErr;

  type Row = {
    status: string;
    billing_frequency: string;
    agreement_signed_at: string | null;
    next_payment_due: string | null;
    member: { first_name: string; last_name: string; email: string | null; phone: string | null; preferred_language: string | null; user_id: string | null };
    payments: { type: string; status: string; paid_at: string | null }[];
  };

  const out: string[][] = [];
  for (const r of (rows as unknown as Row[]) || []) {
    const m = Array.isArray(r.member) ? r.member[0] : r.member;
    const paid = (r.payments || []).filter(
      (p) => ["dues", "enrollment_fee"].includes(p.type) && p.status === "completed"
    );
    if (!paid.length) continue; // must have paid
    const unsigned = !r.agreement_signed_at;
    const noLogin = !m.user_id;
    const pending = r.status === "pending";
    if (!unsigned && !noLogin && !pending) continue; // onboarding complete

    const lastPaid = paid
      .map((p) => p.paid_at)
      .filter(Boolean)
      .sort()
      .pop() || "";

    out.push([
      m.first_name, m.last_name, m.email || "", m.phone || "", m.preferred_language || "",
      r.status, r.billing_frequency,
      unsigned ? "YES" : "", noLogin ? "YES" : "", pending ? "YES" : "",
      r.next_payment_due || "", lastPaid.slice(0, 10),
    ]);
  }

  out.sort((a, b) => (a[1] || "").localeCompare(b[1] || ""));

  const header = [
    "first_name", "last_name", "email", "phone", "language",
    "status", "billing", "agreement_unsigned", "no_portal_login", "pending",
    "next_payment_due", "last_paid",
  ];
  const csv = [header, ...out].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
  const file = path.resolve(process.cwd(), "paid-incomplete-onboarding.csv");
  fs.writeFileSync(file, csv);
  console.log(`Wrote ${out.length} rows → ${file}`);
  console.log(`  unsigned agreement: ${out.filter((r) => r[7] === "YES").length}`);
  console.log(`  no portal login:    ${out.filter((r) => r[8] === "YES").length}`);
  console.log(`  pending status:     ${out.filter((r) => r[9] === "YES").length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
