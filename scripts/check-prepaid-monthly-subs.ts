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
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });

const MEMBERS = [
  { id: "47d3de84-8425-4766-9424-7eb682854be6", name: "Khaled Kohistani", cust: "cus_TyVqr7b3Nj7Xh9" },
  { id: "40b693c2-c286-4590-9337-a54b313bd45a", name: "Mejgan Zamon Koenig", cust: "cus_TyVNWThs3SUYSO" },
  { id: "737a21af-a926-4cab-a93b-c74d93cdb89c", name: "Tahir Mohammad Zamon", cust: "cus_TyVY32yekehlbO" },
  { id: "4cc2c55c-ae99-4a40-b229-21ccfae2b541", name: "Mustafa Zamon", cust: "cus_TyVjzFV7rkrwBs" },
  { id: "199ce9df-825e-4c44-8b41-260375b8410d", name: "Walid Assef", cust: "cus_TzL093UdFgYkgR" },
  { id: "c83efedd-edcc-4e0c-83bd-b69c272a5948", name: "Idris Osmani", cust: "cus_TzKuYIDqNm9mfj" },
  { id: "58dad9e5-4913-42cc-8cc5-8e1206e66020", name: "Fahima Azami", cust: "cus_UK92MujJ9HqosB" },
];

async function main() {
  for (const { id, name, cust } of MEMBERS) {
    console.log(`\n━━━ ${name} (${id}) ━━━`);
    const subs = await stripe.subscriptions.list({ customer: cust, status: "all", limit: 20 });
    if (!subs.data.length) {
      console.log(`  ⚠ NO subs in Stripe — they paid $480 but nothing set up for renewal`);
      continue;
    }
    for (const s of subs.data) {
      const item = s.items.data[0] as Stripe.SubscriptionItem & { current_period_end?: number };
      const trialEnd = s.trial_end ? new Date(s.trial_end * 1000).toISOString().slice(0,10) : "none";
      const periodEnd = item.current_period_end ? new Date(item.current_period_end * 1000).toISOString().slice(0,10) : "?";
      console.log(`  sub=${s.id} status=${s.status} interval=${item.price.recurring?.interval} trial_end=${trialEnd} period_end=${periodEnd} meta_bf=${s.metadata?.billing_frequency}`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
