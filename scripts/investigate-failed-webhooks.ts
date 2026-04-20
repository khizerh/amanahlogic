/**
 * Read-only: fetch the 15 failed stripe_webhook_events rows from Stripe,
 * show the real error, the real subscription, and the current DB state of
 * the affected membership. No writes.
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
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

async function main() {
  const { data: failed, error } = await supabase
    .from("stripe_webhook_events")
    .select("event_id, event_type, created_at, membership_id, organization_id")
    .eq("status", "failed")
    .order("created_at", { ascending: true });
  if (error) throw error;

  console.log(`Found ${failed.length} failed events\n`);

  for (const row of failed) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`${row.event_id}  ${row.event_type}  ${row.created_at}`);
    console.log(`  recorded membership_id: ${row.membership_id || "(null)"}`);

    let event: Stripe.Event;
    try {
      event = await stripe.events.retrieve(row.event_id);
    } catch (e) {
      console.log(`  ! stripe.events.retrieve failed: ${(e as Error).message}`);
      continue;
    }

    const obj = event.data.object as unknown as Record<string, unknown>;
    const metadata = (obj.metadata || {}) as Record<string, string>;

    console.log(`  stripe object id: ${obj.id}`);
    console.log(`  metadata: ${JSON.stringify(metadata)}`);

    // For subscriptions + setup intents: show customer and sub state
    if (event.type.startsWith("customer.subscription.")) {
      const sub = event.data.object as Stripe.Subscription;
      console.log(`  sub.status: ${sub.status}  customer: ${sub.customer}`);
      console.log(`  items: ${sub.items.data.map((i) => i.price.id).join(",")}`);
      // Current state per our DB, keyed by stripe_subscription_id
      const { data: m } = await supabase
        .from("memberships")
        .select("id, status, subscription_status, last_payment_date, next_payment_due, stripe_customer_id, member_id")
        .eq("stripe_subscription_id", sub.id)
        .maybeSingle();
      if (m) {
        const { data: mem } = await supabase
          .from("members")
          .select("first_name, last_name, email")
          .eq("id", m.member_id)
          .single();
        console.log(`  → DB membership ${m.id}: ${mem?.first_name} ${mem?.last_name} <${mem?.email}>`);
        console.log(`    status=${m.status} sub_status=${m.subscription_status} last_pay=${m.last_payment_date} next_due=${m.next_payment_due}`);
      } else {
        console.log(`  → NO membership in DB for sub ${sub.id}`);
      }
    } else if (event.type === "setup_intent.succeeded") {
      const si = event.data.object as Stripe.SetupIntent;
      console.log(`  si.status: ${si.status}  customer: ${si.customer}  pm: ${si.payment_method}`);
      if (si.customer) {
        const { data: m } = await supabase
          .from("memberships")
          .select("id, status, subscription_status, stripe_subscription_id, member_id")
          .eq("stripe_customer_id", si.customer as string)
          .maybeSingle();
        if (m) {
          const { data: mem } = await supabase
            .from("members")
            .select("first_name, last_name, email")
            .eq("id", m.member_id)
            .single();
          console.log(`  → DB membership ${m.id}: ${mem?.first_name} ${mem?.last_name} <${mem?.email}>`);
          console.log(`    status=${m.status} sub_status=${m.subscription_status} sub_id=${m.stripe_subscription_id}`);
        } else {
          console.log(`  → NO membership in DB for customer ${si.customer}`);
        }
      }
    }
    console.log();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
