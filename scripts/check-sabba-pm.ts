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

async function main() {
  const sub = await stripe.subscriptions.retrieve("sub_1T2uJT05kFZ1PDWvC2UY0TLc", {
    expand: ["default_payment_method", "customer"],
  });
  const cust = sub.customer as Stripe.Customer;
  console.log(`Sub default_payment_method: ${sub.default_payment_method ? (sub.default_payment_method as Stripe.PaymentMethod).id : "NONE"}`);
  console.log(`Customer invoice_settings.default_payment_method: ${cust.invoice_settings?.default_payment_method || "NONE"}`);
  const pms = await stripe.paymentMethods.list({ customer: cust.id, limit: 10 });
  console.log(`Customer has ${pms.data.length} payment method(s):`);
  for (const pm of pms.data) {
    console.log(`  ${pm.id} type=${pm.type} ${pm.type === "card" ? `card=${pm.card?.brand} ****${pm.card?.last4}` : ""} ${pm.type === "us_bank_account" ? `ach=${pm.us_bank_account?.bank_name} ****${pm.us_bank_account?.last4}` : ""}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
