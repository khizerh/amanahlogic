/**
 * Read-only: for each membership affected by a failed webhook, ask Stripe
 * directly what its current subscription + payment state is, and diff against our DB.
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

const AFFECTED = [
  { id: "7b408eac-06ab-40f9-b454-ac20ab657824", label: "Wais Omari" },
  { id: "997e937a-cf81-4fcf-8233-bc99782d0d38", label: "Sabba Atai" },
  { id: "79be3074-25c3-4838-9e55-b13d3c9a7fd7", label: "Qais Mostamandi" },
  { id: "7d2ff833-1e2b-4a63-aa9d-bdb44d472f9f", label: "Nazrul Hussein" },
  { id: "3b421921-7597-4315-be69-a60371e36424", label: "Zahuran Mohammed" },
  { id: "76428a9a-2de3-4346-8c5a-9a3fae1e35b0", label: "Habiba Kochi" },
  { id: "f203fa9d-e906-414d-a2c8-0f9adecdb10f", label: "Noor Jabbar" },
  { id: "c863283a-f637-4b83-8f9c-335be0411505", label: "Mohammad Amin Ahmadzai" },
  { id: "2596d912-686e-4d92-b8ef-de147e871f2a", label: "Hedayat Hamid" },
];

async function main() {
  for (const { id, label } of AFFECTED) {
    console.log(`\n━━━ ${label} (${id}) ━━━`);
    const { data: m } = await supabase
      .from("memberships")
      .select("stripe_customer_id, stripe_subscription_id, billing_frequency, last_payment_date, next_payment_due, subscription_status, status")
      .eq("id", id)
      .single();
    if (!m) {
      console.log("  membership not found");
      continue;
    }
    console.log(`  DB: cust=${m.stripe_customer_id} sub=${m.stripe_subscription_id} bf=${m.billing_frequency} status=${m.status} sub_status=${m.subscription_status}`);
    console.log(`      last_pay=${m.last_payment_date} next_due=${m.next_payment_due}`);

    if (!m.stripe_customer_id) {
      console.log("  → no customer_id, skip Stripe");
      continue;
    }

    // List all subscriptions for this customer, any status
    try {
      const subs = await stripe.subscriptions.list({
        customer: m.stripe_customer_id,
        status: "all",
        limit: 20,
      });
      console.log(`  Stripe has ${subs.data.length} sub(s):`);
      for (const s of subs.data) {
        const marker = s.id === m.stripe_subscription_id ? "✓" : " ";
        console.log(`    ${marker} ${s.id}  status=${s.status}  created=${new Date(s.created * 1000).toISOString().slice(0,10)}  meta_bf=${s.metadata?.billing_frequency}`);
      }

      // Most recent paid invoice on the customer
      const invs = await stripe.invoices.list({
        customer: m.stripe_customer_id,
        limit: 5,
      });
      if (invs.data.length) {
        console.log(`  Latest invoices:`);
        for (const inv of invs.data.slice(0, 3)) {
          console.log(`    ${inv.id}  status=${inv.status}  paid=${inv.paid}  amount=${inv.amount_paid/100}  created=${new Date(inv.created*1000).toISOString().slice(0,10)}`);
        }
      }
    } catch (e) {
      console.log(`  ! Stripe list failed: ${(e as Error).message}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
