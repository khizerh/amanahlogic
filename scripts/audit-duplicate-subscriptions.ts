/**
 * READ-ONLY. Definitive double-charge detector at the subscription level.
 *
 * A member is only genuinely double-charged if a single membership is billed by
 * 2+ active Stripe subscriptions. (Multiple subs on one CUSTOMER is normal — one
 * payer funding several family members, each a distinct membership.)
 *
 * Lists every active/past_due/trialing subscription, groups by metadata.membership_id,
 * and flags any membership carrying more than one. Also cross-checks the DB member
 * name for each flagged membership so the output is actionable.
 *
 * Usage: npx tsx scripts/audit-duplicate-subscriptions.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import * as fs from "fs";
import * as path from "path";

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const [k, ...v] = t.split("=");
    if (k && !process.env[k]) process.env[k] = v.join("=").replace(/^["']|["']$/g, "");
  }
}
loadEnvFile();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } }) as SupabaseClient;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });

async function listAllSubscriptions(): Promise<Stripe.Subscription[]> {
  const out: Stripe.Subscription[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < 20; page++) {
    const res = await stripe.subscriptions.list({ status: "all", limit: 100, starting_after: startingAfter });
    out.push(...res.data);
    if (!res.has_more) break;
    startingAfter = res.data[res.data.length - 1]?.id;
  }
  return out;
}

async function main() {
  console.log(`\n=== Duplicate-subscription audit (READ-ONLY) ===\n`);
  const subs = await listAllSubscriptions();
  const live = subs.filter((s) => ["active", "trialing", "past_due", "unpaid"].includes(s.status));
  console.log(`${subs.length} subscriptions total; ${live.length} live (active/trialing/past_due/unpaid).\n`);

  // names for membership ids
  const { data: mems } = await supabase.from("memberships").select("id, member_id, subscription_status, stripe_subscription_id");
  const { data: members } = await supabase.from("members").select("id, first_name, last_name");
  const nameByMember = new Map<string, string>();
  for (const m of (members || []) as { id: string; first_name: string; last_name: string }[]) nameByMember.set(m.id, `${m.first_name} ${m.last_name}`);
  const memById = new Map<string, { member_id: string | null; subscription_status: string | null; stripe_subscription_id: string | null }>();
  for (const m of (mems || []) as { id: string; member_id: string | null; subscription_status: string | null; stripe_subscription_id: string | null }[]) memById.set(m.id, m);

  const byMembership = new Map<string, Stripe.Subscription[]>();
  const noMembershipMeta: Stripe.Subscription[] = [];
  for (const s of live) {
    const mid = s.metadata?.membership_id;
    if (!mid) { noMembershipMeta.push(s); continue; }
    if (!byMembership.has(mid)) byMembership.set(mid, []);
    byMembership.get(mid)!.push(s);
  }

  const dupes = Array.from(byMembership.entries()).filter(([, ss]) => ss.length > 1);
  console.log(`--- Memberships with 2+ live subscriptions (TRUE double-charge) ---`);
  if (dupes.length === 0) {
    console.log(`  ✅ NONE. No membership is billed by more than one live subscription.\n`);
  } else {
    for (const [mid, ss] of dupes) {
      const mem = memById.get(mid);
      const name = mem?.member_id ? nameByMember.get(mem.member_id) : undefined;
      console.log(`  ⛔ ${name ?? "(unknown member)"}  membership=${mid}  — ${ss.length} live subs:`);
      for (const s of ss) {
        const amt = s.items.data[0]?.price?.unit_amount;
        console.log(`       ${s.id} [${s.status}] $${amt != null ? (amt / 100).toFixed(2) : "?"}/${s.items.data[0]?.price?.recurring?.interval ?? "?"} created ${new Date(s.created * 1000).toISOString().slice(0, 10)} | DB tracks: ${mem?.stripe_subscription_id ?? "—"}`);
      }
    }
    console.log();
  }

  if (noMembershipMeta.length) {
    console.log(`--- Live subscriptions with NO membership_id metadata (${noMembershipMeta.length}) ---`);
    for (const s of noMembershipMeta.slice(0, 30)) console.log(`  ${s.id} [${s.status}] customer=${typeof s.customer === "string" ? s.customer : s.customer.id} created ${new Date(s.created * 1000).toISOString().slice(0, 10)}`);
    if (noMembershipMeta.length > 30) console.log(`  ... and ${noMembershipMeta.length - 30} more`);
    console.log();
  }

  // DB sanity: memberships whose DB stripe_subscription_id doesn't match any live sub for that membership
  console.log(`--- DB vs Stripe subscription mismatch (membership points at a sub that isn't live) ---`);
  let mismatch = 0;
  for (const [mid, ss] of byMembership) {
    const mem = memById.get(mid);
    if (mem?.stripe_subscription_id && !ss.some((s) => s.id === mem.stripe_subscription_id)) {
      mismatch++;
      if (mismatch <= 20) console.log(`  ${nameByMember.get(mem.member_id ?? "") ?? mid}: DB sub ${mem.stripe_subscription_id} not among live subs [${ss.map((s) => s.id).join(", ")}]`);
    }
  }
  if (mismatch === 0) console.log(`  ✅ none`);
  console.log();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
