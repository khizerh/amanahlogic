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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });

const SUBS = [
  { label: "Sabba Atai (monthly)", sub: "sub_1T2uJT05kFZ1PDWvC2UY0TLc" },
  { label: "Nazrul Hussein (annual)", sub: "sub_1T70cU05kFZ1PDWv3URhrrKf" },
  { label: "Hedayat Hamid (monthly)", sub: "sub_1TLtw705kFZ1PDWvHKKmSxld" },
];

async function main() {
  for (const { label, sub } of SUBS) {
    const s = await stripe.subscriptions.retrieve(sub, { expand: ["items.data.price"] });
    const item = s.items.data[0] as Stripe.SubscriptionItem & { current_period_end?: number; current_period_start?: number };
    console.log(`\n${label} (${sub})`);
    console.log(`  status=${s.status}`);
    console.log(`  trial_end=${s.trial_end ? new Date(s.trial_end * 1000).toISOString() : "null"}`);
    console.log(`  trial_start=${s.trial_start ? new Date(s.trial_start * 1000).toISOString() : "null"}`);
    console.log(`  item.current_period_end=${item.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : "null"}`);
    console.log(`  item.current_period_start=${item.current_period_start ? new Date(item.current_period_start * 1000).toISOString() : "null"}`);
    console.log(`  price interval=${item.price.recurring?.interval} * ${item.price.recurring?.interval_count}`);
    console.log(`  metadata=${JSON.stringify(s.metadata)}`);
    console.log(`  created=${new Date(s.created * 1000).toISOString()}`);
    console.log(`  cancel_at_period_end=${s.cancel_at_period_end}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
