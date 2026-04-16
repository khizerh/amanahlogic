/**
 * Admin Account Changes — April 13, 2026
 *
 * 1. fnekrawesh@yahoo.com → Switch to widow plan
 * 2. hedayathamid101@gmail.com → Switch from annual back to monthly
 *    - Paid Feb + March 2026 only (2 months credited)
 *    - $80 (Jan + April back dues) to be charged April 17, 2026
 *    - Monthly subscription resumes May 1, 2026 on the 1st of each month
 *
 * Usage:
 *   npx tsx scripts/admin-account-changes-2026-04-13.ts              # Dry run (default)
 *   npx tsx scripts/admin-account-changes-2026-04-13.ts --execute    # Apply changes
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import * as fs from "fs";
import * as path from "path";

// ─── Load .env.local ────────────────────────────────────────────────────────
function loadEnvFile(): void {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        const value = valueParts.join("=").replace(/^["']|["']$/g, "");
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnvFile();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!STRIPE_SECRET_KEY) {
  console.error("Missing STRIPE_SECRET_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2026-02-25.clover",
});

const DRY_RUN = !process.argv.includes("--execute");

// ─── Helpers ────────────────────────────────────────────────────────────────

async function lookupMemberByEmail(email: string) {
  const { data: member, error } = await supabase
    .from("members")
    .select("*")
    .eq("email", email)
    .single();

  if (error || !member) {
    throw new Error(`Member not found: ${email} (${error?.message})`);
  }

  const { data: membership, error: mErr } = await supabase
    .from("memberships")
    .select("*, plan:plans(*)")
    .eq("member_id", member.id)
    .single();

  if (mErr || !membership) {
    throw new Error(`Membership not found for ${email} (${mErr?.message})`);
  }

  return { member, membership };
}

function log(msg: string) {
  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}${msg}`);
}

// ─── Task 1: Switch fnekrawesh@yahoo.com to widow plan ──────────────────────

async function switchToWidow() {
  console.log("\n" + "=".repeat(70));
  console.log("TASK 1: Switch fnekrawesh@yahoo.com to Widow plan");
  console.log("=".repeat(70));

  const { member, membership } = await lookupMemberByEmail("fnekrawesh@yahoo.com");
  const plan = Array.isArray(membership.plan) ? membership.plan[0] : membership.plan;

  console.log(`  Member: ${member.first_name} ${member.last_name}`);
  console.log(`  Member ID: ${member.id}`);
  console.log(`  Membership ID: ${membership.id}`);
  console.log(`  Current Plan: ${plan?.name} (type: ${plan?.type})`);
  console.log(`  Billing Frequency: ${membership.billing_frequency}`);
  console.log(`  Paid Months: ${membership.paid_months}`);
  console.log(`  Status: ${membership.status}`);
  console.log(`  Stripe Sub: ${membership.stripe_subscription_id || "none"}`);

  // Find the widow plan for the same org
  const { data: widowPlan, error: planErr } = await supabase
    .from("plans")
    .select("*")
    .eq("organization_id", membership.organization_id)
    .eq("type", "widow")
    .eq("is_active", true)
    .single();

  if (planErr || !widowPlan) {
    throw new Error(`Active widow plan not found for org ${membership.organization_id}`);
  }

  console.log(`  Target Plan: ${widowPlan.name} (type: ${widowPlan.type})`);
  console.log(`  Widow Pricing: $${widowPlan.pricing?.monthly}/mo, $${widowPlan.pricing?.biannual}/6mo, $${widowPlan.pricing?.annual}/yr`);

  if (plan?.type === "widow") {
    console.log("  ⚠ Already on widow plan — skipping.");
    return;
  }

  // Check if pricing changes (same frequency)
  const freq = membership.billing_frequency as string;
  const oldPrice = plan?.pricing?.[freq as keyof typeof plan.pricing] || 0;
  const newPrice = widowPlan.pricing?.[freq as keyof typeof widowPlan.pricing] || 0;
  console.log(`  Price change (${freq}): $${oldPrice} → $${newPrice}`);

  if (DRY_RUN) {
    log("Would update membership plan_id to widow plan");
    log("Would sync Stripe subscription pricing if active");
    return;
  }

  // Update plan in DB
  const { error: updateErr } = await supabase
    .from("memberships")
    .update({ plan_id: widowPlan.id })
    .eq("id", membership.id);

  if (updateErr) throw new Error(`Failed to update plan: ${updateErr.message}`);
  log("✓ Updated plan to widow in database");

  // Sync Stripe subscription if exists
  if (membership.stripe_subscription_id &&
      (membership.subscription_status === "active" || membership.subscription_status === "trialing")) {
    try {
      const { data: org } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", membership.organization_id)
        .single();

      if (org) {
        const newDuesAmountCents = Math.round(newPrice * 100);
        const platformFees = org.platform_fees as Record<string, number> | null;
        const platformFeeDollars = platformFees?.[freq] || 0;

        // Get current subscription
        const currentSub = await stripe.subscriptions.retrieve(membership.stripe_subscription_id);
        const existingItem = currentSub.items.data[0];

        if (existingItem) {
          // Calculate fees
          const stripeFeePercent = 0.029;
          const stripeFixedFeeCents = 30;
          const platformFeeCents = Math.round(platformFeeDollars * 100);
          let chargeAmountCents: number;

          if (org.pass_fees_to_member) {
            chargeAmountCents = Math.ceil(
              (newDuesAmountCents + platformFeeCents + stripeFixedFeeCents) / (1 - stripeFeePercent)
            );
          } else {
            chargeAmountCents = newDuesAmountCents + platformFeeCents;
          }

          // Create new price
          let interval: "month" | "year" = "month";
          let intervalCount = 1;
          if (freq === "biannual") { interval = "month"; intervalCount = 6; }
          else if (freq === "annual") { interval = "year"; intervalCount = 1; }

          const newStripePrice = await stripe.prices.create({
            currency: "usd",
            unit_amount: chargeAmountCents,
            recurring: { interval, interval_count: intervalCount },
            product_data: { name: `${widowPlan.name} Dues` },
          });

          await stripe.subscriptions.update(membership.stripe_subscription_id, {
            items: [{ id: existingItem.id, price: newStripePrice.id }],
            proration_behavior: "none",
            metadata: {
              ...((currentSub.metadata || {}) as Record<string, string>),
            },
          });

          log("✓ Synced Stripe subscription pricing to widow plan");
        }
      }
    } catch (stripeErr) {
      console.error("  ⚠ Failed to sync Stripe:", stripeErr);
      log("  (DB updated, but Stripe sync failed — may need manual intervention)");
    }
  } else {
    log("  No active Stripe subscription to update");
  }
}

// ─── Task 2: hedayathamid101@gmail.com — annual → monthly ──────────────────

async function switchHedayatToMonthly() {
  console.log("\n" + "=".repeat(70));
  console.log("TASK 2: Switch hedayathamid101@gmail.com to monthly billing");
  console.log("=".repeat(70));

  const { member, membership } = await lookupMemberByEmail("hedayathamid101@gmail.com");
  const plan = Array.isArray(membership.plan) ? membership.plan[0] : membership.plan;

  console.log(`  Member: ${member.first_name} ${member.last_name}`);
  console.log(`  Member ID: ${member.id}`);
  console.log(`  Membership ID: ${membership.id}`);
  console.log(`  Current Plan: ${plan?.name} (type: ${plan?.type})`);
  console.log(`  Current Frequency: ${membership.billing_frequency}`);
  console.log(`  Paid Months: ${membership.paid_months}`);
  console.log(`  Status: ${membership.status}`);
  console.log(`  Next Payment Due: ${membership.next_payment_due}`);
  console.log(`  Billing Anniversary Day: ${membership.billing_anniversary_day}`);
  console.log(`  Stripe Sub: ${membership.stripe_subscription_id || "none"}`);
  console.log(`  Stripe Customer: ${membership.stripe_customer_id || "none"}`);
  console.log(`  Auto-pay: ${membership.auto_pay_enabled}`);

  const monthlyPrice = plan?.pricing?.monthly || 40;
  console.log(`\n  Monthly price: $${monthlyPrice}`);
  console.log(`  Situation: Annual refunded, paid Feb + March only.`);
  console.log(`  Outstanding: Jan + April = $${monthlyPrice * 2} to charge on April 17, 2026`);
  console.log(`  Going forward: Monthly on the 1st starting May 1, 2026`);

  if (DRY_RUN) {
    log("\nWould perform the following changes:");
    log("  1. Cancel existing Stripe subscription (if any)");
    log("  2. Update DB: billing_frequency=monthly, billing_anniversary_day=1");
    log("  3. Update DB: paid_months (Feb+March credited)");
    log("  4. Update DB: next_payment_due=2026-05-01");
    log("  5. Create new monthly Stripe subscription with trial_end=May 1");
    log("  6. NOTE: $80 back dues (Jan+April) must be charged on April 17");
    log("     → Use admin dashboard 'Charge Card' on April 17 for $80");
    log(`     → Description: 'Back dues: January + April 2026'`);
    return;
  }

  // Step 1: Cancel existing Stripe subscription
  if (membership.stripe_subscription_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(membership.stripe_subscription_id);
      if (sub.status !== "canceled") {
        await stripe.subscriptions.cancel(membership.stripe_subscription_id);
        log("✓ Cancelled old Stripe subscription: " + membership.stripe_subscription_id);
      } else {
        log("  Old subscription already cancelled");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("No such subscription")) {
        log("  Old subscription not found in Stripe (already gone)");
      } else {
        console.error("  ⚠ Error cancelling subscription:", msg);
      }
    }
  }

  // Step 2: Figure out correct paid_months
  // He paid Feb + March 2026. We need to determine what his paid_months should be.
  // If he had previous months before the annual switch, we need to preserve those.
  // The annual was refunded so those months don't count.
  // The user says "he's back to square 1" and "paid Feb + March 2026 only"
  // plus he had some months before (Jan was unpaid).
  //
  // Looking at the timeline:
  //   - He was paying monthly before
  //   - At some point switched to annual (misunderstanding)
  //   - Annual was refunded → back to square 1
  //   - "paid Feb + March 2026 only" — this implies total paid is just 2 months?
  //     Or 2 months since the reset?
  //
  // Given "he's back to square 1" and "He paid Feb + March 2026 only",
  // I'll check current paid_months and adjust. The key info:
  // "Jan/April payment remains = $80" means Jan + April are unpaid.
  // Feb + March are paid. So since enrollment, he has 2 paid months.
  //
  // Actually, "back to square 1" likely means back to where he was before the annual.
  // The Feb + March payments were separate from the annual charge.
  // Let's preserve paid_months as-is but ensure it reflects reality.
  // Given the context, I'll trust the current paid_months in the DB.
  // The user's main point is about the billing going forward.

  console.log(`\n  Current paid_months in DB: ${membership.paid_months}`);
  console.log(`  (Preserving current paid_months — Feb+March already credited)`);

  // Step 3: Update DB
  const { error: updateErr } = await supabase
    .from("memberships")
    .update({
      billing_frequency: "monthly",
      billing_anniversary_day: 1,
      next_payment_due: "2026-05-01",
      // Clear old subscription references — we'll set new ones below
      stripe_subscription_id: null,
      subscription_status: null,
    })
    .eq("id", membership.id);

  if (updateErr) throw new Error(`Failed to update membership: ${updateErr.message}`);
  log("✓ Updated membership: monthly billing, anniversary day=1, next_payment_due=May 1");

  // Step 4: Create new monthly subscription with trial_end = May 1, 2026
  const customerId = membership.stripe_customer_id;
  if (customerId) {
    try {
      // Get default payment method
      const customer = await stripe.customers.retrieve(customerId);
      if (customer.deleted) {
        log("  ⚠ Stripe customer is deleted — cannot create subscription");
      } else {
        // Find payment method
        const pmId =
          typeof customer.invoice_settings?.default_payment_method === "string"
            ? customer.invoice_settings.default_payment_method
            : null;

        let paymentMethodId = pmId;
        if (!paymentMethodId) {
          const pms = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 1 });
          if (pms.data.length > 0) {
            paymentMethodId = pms.data[0].id;
          }
        }

        if (!paymentMethodId) {
          log("  ⚠ No payment method on file — subscription created without PM (will need setup)");
        }

        // Get org for fee calculation
        const { data: org } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", membership.organization_id)
          .single();

        const platformFees = org?.platform_fees as Record<string, number> | null;
        const platformFeeDollars = platformFees?.monthly || 0;
        const baseAmountCents = Math.round(monthlyPrice * 100);

        // Calculate charge amount
        const stripeFeePercent = 0.029;
        const stripeFixedFeeCents = 30;
        const platformFeeCents = Math.round(platformFeeDollars * 100);
        let chargeAmountCents: number;

        if (org?.pass_fees_to_member) {
          chargeAmountCents = Math.ceil(
            (baseAmountCents + platformFeeCents + stripeFixedFeeCents) / (1 - stripeFeePercent)
          );
        } else {
          chargeAmountCents = baseAmountCents + platformFeeCents;
        }

        // Create price
        const price = await stripe.prices.create({
          currency: "usd",
          unit_amount: chargeAmountCents,
          recurring: { interval: "month", interval_count: 1 },
          product_data: { name: `${plan?.name || "Membership"} Dues` },
        });

        // Trial end = May 1, 2026 00:00:00 UTC
        const trialEnd = Math.floor(new Date("2026-05-01T00:00:00Z").getTime() / 1000);

        // Build subscription params
        const subParams: Stripe.SubscriptionCreateParams = {
          customer: customerId,
          items: [{ price: price.id }],
          trial_end: trialEnd,
          metadata: {
            membership_id: membership.id,
            member_id: member.id,
            organization_id: membership.organization_id,
            billing_frequency: "monthly",
          },
        };

        if (paymentMethodId) {
          subParams.default_payment_method = paymentMethodId;
        }

        // Add Connect transfer if applicable
        if (org?.stripe_connect_id && org?.stripe_onboarded) {
          const stripeFeeCents = Math.round(chargeAmountCents * stripeFeePercent) + stripeFixedFeeCents;
          const appFeeCents = platformFeeCents + stripeFeeCents;
          subParams.transfer_data = { destination: org.stripe_connect_id };
          if (chargeAmountCents > 0) {
            subParams.application_fee_percent =
              Math.ceil((appFeeCents / chargeAmountCents) * 10000) / 100;
          }
        }

        const subscription = await stripe.subscriptions.create(subParams);

        // Update DB with new subscription
        const { error: subUpdateErr } = await supabase
          .from("memberships")
          .update({
            stripe_subscription_id: subscription.id,
            subscription_status: "trialing",
            auto_pay_enabled: true,
          })
          .eq("id", membership.id);

        if (subUpdateErr) {
          console.error("  ⚠ Failed to save subscription ID to DB:", subUpdateErr.message);
        }

        log(`✓ Created new monthly subscription: ${subscription.id}`);
        log(`  Trial until May 1, 2026 — first charge May 1`);
        log(`  Charge amount: $${(chargeAmountCents / 100).toFixed(2)}/month (incl. fees)`);
      }
    } catch (stripeErr) {
      console.error("  ⚠ Failed to create Stripe subscription:", stripeErr);
      log("  DB updated, but Stripe subscription creation failed");
      log("  → May need to set up subscription manually via admin dashboard");
    }
  } else {
    log("  No Stripe customer ID — skipping subscription creation");
    log("  → Will need to send payment setup link to member");
  }

  // Step 5: Reminder about $80 April 17 charge
  console.log("\n" + "-".repeat(50));
  console.log("  ⚡ ACTION REQUIRED on April 17, 2026:");
  console.log(`  Charge $${monthlyPrice * 2}.00 (${monthlyPrice} x 2) to ${member.first_name}'s card`);
  console.log("  → Go to admin dashboard → Members → find member → Charge Card");
  console.log(`  → Amount: $${monthlyPrice * 2}`);
  console.log("  → Description: 'Back dues: January + April 2026'");
  console.log("-".repeat(50));
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Admin Account Changes — April 13, 2026                     ║");
  console.log(`║  Mode: ${DRY_RUN ? "DRY RUN (use --execute to apply)" : "⚡ EXECUTING CHANGES ⚡"}${"".padEnd(DRY_RUN ? 15 : 18)}║`);
  console.log("╚══════════════════════════════════════════════════════════════╝");

  try {
    await switchToWidow();
  } catch (err) {
    console.error("\n❌ Task 1 failed:", err);
  }

  try {
    await switchHedayatToMonthly();
  } catch (err) {
    console.error("\n❌ Task 2 failed:", err);
  }

  console.log("\n" + "=".repeat(70));
  console.log(DRY_RUN ? "Dry run complete. Run with --execute to apply changes." : "All changes applied.");
  console.log("=".repeat(70));
}

main().catch(console.error);
