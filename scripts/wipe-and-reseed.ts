/**
 * Database Wipe and Reseed Script
 *
 * This script:
 * 1. Auto-detects ALL tables in the public schema
 * 2. Determines correct deletion order via FK analysis
 * 3. Wipes ALL data (preserves auth.users - admin accounts)
 * 4. Reseeds with fresh test data
 *
 * Usage: npx tsx scripts/wipe-and-reseed.ts
 *
 * Options:
 *   --wipe-only     Only wipe data, don't reseed
 *   --seed-only     Only seed data (assumes tables are empty)
 *   --force         Skip confirmation prompt
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";

// Load environment variables from .env.local
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

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing environment variables:");
  console.error("   - NEXT_PUBLIC_SUPABASE_URL");
  console.error("   - SUPABASE_SERVICE_ROLE_KEY");
  console.error("\nMake sure you have a .env.local file with these values.");
  process.exit(1);
}

// Create service role client (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Parse command line arguments
const args = process.argv.slice(2);
const wipeOnly = args.includes("--wipe-only");
const seedOnly = args.includes("--seed-only");
const force = args.includes("--force");

// Tables to exclude from wiping (system tables, etc.)
const EXCLUDED_TABLES = [
  "schema_migrations", // Supabase migrations tracking
  "buckets",           // Storage buckets metadata
  "objects",           // Storage objects metadata
  "s3_multipart_uploads",
  "s3_multipart_uploads_parts",
];

// Fixed UUIDs for consistent seeding
const ORG_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const PLAN_IDS = {
  single: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01",
  married: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02",
  widow: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03",
};
const MEMBER_IDS = {
  ahmed: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01",
  muhammad: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c02",
  fatima: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c03",
  omar: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c04",
  aisha: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c05",
};
const MEMBERSHIP_IDS = {
  ahmed: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d01",
  muhammad: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d02",
  fatima: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d03",
  omar: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d04",
  aisha: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d05",
};

async function confirm(message: string): Promise<boolean> {
  if (force) return true;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

interface TableInfo {
  table_name: string;
}

interface ForeignKeyInfo {
  table_name: string;
  referenced_table: string;
}

/**
 * Get all tables in the public schema
 */
async function getAllTables(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client.rpc("get_all_tables");

  if (error) {
    // Fallback: create the function if it doesn't exist, or use raw query
    console.log("   Creating helper function for table discovery...");
    await client.rpc("exec_sql", {
      sql: `
        CREATE OR REPLACE FUNCTION get_all_tables()
        RETURNS TABLE(table_name text) AS $$
        BEGIN
          RETURN QUERY
          SELECT t.table_name::text
          FROM information_schema.tables t
          WHERE t.table_schema = 'public'
            AND t.table_type = 'BASE TABLE';
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `,
    });

    const { data: retryData, error: retryError } = await client.rpc("get_all_tables");
    if (retryError) {
      throw new Error(`Failed to get tables: ${retryError.message}`);
    }
    return (retryData as TableInfo[])?.map((t) => t.table_name) || [];
  }

  return (data as TableInfo[])?.map((t) => t.table_name) || [];
}

/**
 * Get foreign key relationships to determine deletion order
 */
async function getForeignKeys(client: SupabaseClient): Promise<ForeignKeyInfo[]> {
  const { data, error } = await client.rpc("get_foreign_keys");

  if (error) {
    // Create the function if it doesn't exist
    console.log("   Creating helper function for FK analysis...");
    await client.rpc("exec_sql", {
      sql: `
        CREATE OR REPLACE FUNCTION get_foreign_keys()
        RETURNS TABLE(table_name text, referenced_table text) AS $$
        BEGIN
          RETURN QUERY
          SELECT
            tc.table_name::text,
            ccu.table_name::text AS referenced_table
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public';
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `,
    });

    const { data: retryData, error: retryError } = await client.rpc("get_foreign_keys");
    if (retryError) {
      throw new Error(`Failed to get foreign keys: ${retryError.message}`);
    }
    return (retryData as ForeignKeyInfo[]) || [];
  }

  return (data as ForeignKeyInfo[]) || [];
}

/**
 * Topological sort to determine safe deletion order
 * Tables with dependencies on others should be deleted first
 */
function getDeleteOrder(tables: string[], foreignKeys: ForeignKeyInfo[]): string[] {
  // Build dependency graph: table -> tables it depends on
  const dependencies = new Map<string, Set<string>>();
  const allTables = new Set(tables);

  for (const table of tables) {
    dependencies.set(table, new Set());
  }

  for (const fk of foreignKeys) {
    if (allTables.has(fk.table_name) && allTables.has(fk.referenced_table)) {
      // table_name depends on referenced_table
      dependencies.get(fk.table_name)?.add(fk.referenced_table);
    }
  }

  // Topological sort (Kahn's algorithm) - but we want reverse order
  const result: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(table: string): void {
    if (visited.has(table)) return;
    if (visiting.has(table)) {
      // Circular dependency - just skip
      return;
    }

    visiting.add(table);

    // Visit all tables that depend on this one first
    for (const [t, deps] of dependencies) {
      if (deps.has(table) && !visited.has(t)) {
        visit(t);
      }
    }

    visiting.delete(table);
    visited.add(table);
    result.push(table);
  }

  // Start from tables that are referenced by others (parent tables)
  for (const table of tables) {
    if (!visited.has(table)) {
      visit(table);
    }
  }

  // Reverse to get deletion order (children first, then parents)
  return result.reverse();
}

async function wipeDatabase(): Promise<void> {
  console.log("\n🔍 Analyzing database schema...\n");

  // Get all tables
  process.stdout.write("   Discovering tables... ");
  let tables: string[];
  try {
    tables = await getAllTables(supabase);
    // Filter out excluded tables
    tables = tables.filter((t) => !EXCLUDED_TABLES.includes(t));
    console.log(`found ${tables.length} tables`);
  } catch {
    // If RPC functions don't work, fall back to known tables
    console.log("(using fallback list)");
    tables = [
      "agreement_signing_links",
      "onboarding_invites",
      "email_logs",
      "payments",
      "agreements",
      "agreement_templates",
      "email_templates",
      "memberships",
      "members",
      "plans",
      "invoice_sequences",
      "organization_settings",
      "organizations",
    ];
  }

  // Get foreign keys and determine deletion order
  process.stdout.write("   Analyzing foreign keys... ");
  let deleteOrder: string[];
  try {
    const foreignKeys = await getForeignKeys(supabase);
    deleteOrder = getDeleteOrder(tables, foreignKeys);
    console.log("done");
  } catch {
    console.log("(using fallback order)");
    deleteOrder = tables;
  }

  console.log("\n🗑️  Wiping database tables...\n");
  console.log(`   Deletion order: ${deleteOrder.join(" → ")}\n`);

  for (const table of deleteOrder) {
    process.stdout.write(`   Deleting from ${table}... `);

    // Try multiple approaches to delete all rows
    let success = false;

    // Approach 1: Delete with a condition that matches all UUIDs
    const { error: error1 } = await supabase
      .from(table)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (!error1) {
      success = true;
    } else {
      // Approach 2: Try with created_at (most tables have this)
      const { error: error2 } = await supabase
        .from(table)
        .delete()
        .gte("created_at", "1900-01-01");

      if (!error2) {
        success = true;
      } else {
        // Approach 3: Try to select and delete by actual IDs
        const { data: rows } = await supabase.from(table).select("id").limit(1000);
        if (rows && rows.length > 0) {
          const ids = rows.map((r: { id: string }) => r.id);
          const { error: error3 } = await supabase.from(table).delete().in("id", ids);
          if (!error3) {
            success = true;
          }
        } else {
          // Table might be empty or have no id column
          success = true;
        }
      }
    }

    console.log(success ? "✓" : "⚠️  (may be empty or restricted)");
  }

  console.log("\n✅ Database wiped successfully!");
}

async function seedDatabase(): Promise<void> {
  console.log("\n🌱 Seeding database...\n");

  // 1. Organization
  process.stdout.write("   Creating organization... ");
  const { error: orgError } = await supabase.from("organizations").insert({
    id: ORG_ID,
    name: "Masjid Muhajireen",
    slug: "masjid-muhajireen",
    address: {
      street: "1234 Islamic Center Dr",
      city: "Houston",
      state: "TX",
      zip: "77001",
    },
    phone: "(713) 555-0100",
    email: "admin@masjidmuhajireen.org",
    timezone: "America/Chicago",
    platform_fee: 1.0,
  });
  if (orgError) throw new Error(`Organization: ${orgError.message}`);
  console.log("✓");

  // 2. Organization Settings
  process.stdout.write("   Creating organization settings... ");
  const { error: settingsError } = await supabase.from("organization_settings").insert({
    organization_id: ORG_ID,
  });
  if (settingsError) throw new Error(`Settings: ${settingsError.message}`);
  console.log("✓");

  // 3. Plans
  process.stdout.write("   Creating plans... ");
  const { error: plansError } = await supabase.from("plans").insert([
    {
      id: PLAN_IDS.single,
      organization_id: ORG_ID,
      type: "single",
      name: "Single",
      description: "Individual coverage only",
      pricing: { monthly: 20, biannual: 120, annual: 240 },
      enrollment_fee: 500,
    },
    {
      id: PLAN_IDS.married,
      organization_id: ORG_ID,
      type: "married",
      name: "Married",
      description: "Member + spouse + children",
      pricing: { monthly: 40, biannual: 240, annual: 480 },
      enrollment_fee: 500,
    },
    {
      id: PLAN_IDS.widow,
      organization_id: ORG_ID,
      type: "widow",
      name: "Widow/Widower",
      description: "Member + children",
      pricing: { monthly: 40, biannual: 240, annual: 480 },
      enrollment_fee: 500,
    },
  ]);
  if (plansError) throw new Error(`Plans: ${plansError.message}`);
  console.log("✓");

  // 4. Members
  process.stdout.write("   Creating members... ");
  const { error: membersError } = await supabase.from("members").insert([
    {
      id: MEMBER_IDS.ahmed,
      organization_id: ORG_ID,
      first_name: "Ahmed",
      last_name: "Khan",
      email: "ahmed.khan@email.com",
      phone: "(713) 555-1001",
      address: { street: "123 Oak Lane", city: "Houston", state: "TX", zip: "77001" },
      spouse_name: "Fatima Khan",
      children: [{ id: "child_1", name: "Yusuf Khan", dateOfBirth: "2015-03-15" }],
      emergency_contact: { name: "Hassan Khan", phone: "(713) 555-2001" },
      preferred_language: "en",
    },
    {
      id: MEMBER_IDS.muhammad,
      organization_id: ORG_ID,
      first_name: "Muhammad",
      last_name: "Ali",
      email: "muhammad.ali@email.com",
      phone: "(713) 555-1002",
      address: { street: "456 Maple Drive", city: "Houston", state: "TX", zip: "77002" },
      spouse_name: null,
      children: [],
      emergency_contact: { name: "Omar Ali", phone: "(713) 555-2002" },
      preferred_language: "en",
    },
    {
      id: MEMBER_IDS.fatima,
      organization_id: ORG_ID,
      first_name: "Fatima",
      last_name: "Hassan",
      email: "fatima.hassan@email.com",
      phone: "(713) 555-1003",
      address: { street: "789 Cedar Street", city: "Dallas", state: "TX", zip: "75201" },
      spouse_name: "Ibrahim Hassan",
      children: [],
      emergency_contact: { name: "Aisha Hassan", phone: "(713) 555-2003" },
      preferred_language: "fa",
    },
    {
      id: MEMBER_IDS.omar,
      organization_id: ORG_ID,
      first_name: "Omar",
      last_name: "Syed",
      email: "omar.syed@email.com",
      phone: "(713) 555-1004",
      address: { street: "321 Pine Road", city: "Austin", state: "TX", zip: "78701" },
      spouse_name: null,
      children: [],
      emergency_contact: { name: "Bilal Syed", phone: "(713) 555-2004" },
      preferred_language: "en",
    },
    {
      id: MEMBER_IDS.aisha,
      organization_id: ORG_ID,
      first_name: "Aisha",
      last_name: "Rahman",
      email: "aisha.rahman@email.com",
      phone: "(713) 555-1005",
      address: { street: "654 Elm Avenue", city: "Houston", state: "TX", zip: "77003" },
      spouse_name: null,
      children: [],
      emergency_contact: { name: "Maryam Rahman", phone: "(713) 555-2005" },
      preferred_language: "en",
    },
  ]);
  if (membersError) throw new Error(`Members: ${membersError.message}`);
  console.log("✓");

  // 5. Memberships
  process.stdout.write("   Creating memberships... ");
  const { error: membershipsError } = await supabase.from("memberships").insert([
    {
      id: MEMBERSHIP_IDS.ahmed,
      organization_id: ORG_ID,
      member_id: MEMBER_IDS.ahmed,
      plan_id: PLAN_IDS.married,
      status: "active",
      billing_frequency: "monthly",
      billing_anniversary_day: 15,
      paid_months: 65,
      enrollment_fee_paid: true,
      join_date: "2019-07-15",
      last_payment_date: "2024-12-01",
      next_payment_due: "2025-01-15",
      eligible_date: "2024-12-15",
      agreement_signed_at: "2019-07-15T10:00:00Z",
      auto_pay_enabled: true,
      // Stripe autopay fields - use test IDs (won't work with real Stripe)
      stripe_customer_id: "cus_test_ahmed_khan",
      stripe_subscription_id: "sub_test_ahmed_khan",
      subscription_status: "active",
      payment_method: {
        type: "card",
        last4: "4242",
        brand: "visa",
        expiryMonth: 12,
        expiryYear: 2027,
      },
    },
    {
      id: MEMBERSHIP_IDS.muhammad,
      organization_id: ORG_ID,
      member_id: MEMBER_IDS.muhammad,
      plan_id: PLAN_IDS.single,
      status: "waiting_period",
      billing_frequency: "monthly",
      billing_anniversary_day: 10,
      paid_months: 24,
      enrollment_fee_paid: true,
      join_date: "2022-12-10",
      last_payment_date: "2024-12-01",
      next_payment_due: "2025-01-10",
      eligible_date: null,
      agreement_signed_at: "2022-12-10T10:00:00Z",
      auto_pay_enabled: false,
    },
    {
      id: MEMBERSHIP_IDS.fatima,
      organization_id: ORG_ID,
      member_id: MEMBER_IDS.fatima,
      plan_id: PLAN_IDS.married,
      status: "lapsed",
      billing_frequency: "monthly",
      billing_anniversary_day: 5,
      paid_months: 45,
      enrollment_fee_paid: true,
      join_date: "2021-01-05",
      last_payment_date: "2024-10-01",
      next_payment_due: "2024-11-05",
      eligible_date: null,
      agreement_signed_at: "2021-01-05T10:00:00Z",
      auto_pay_enabled: false,
    },
    {
      id: MEMBERSHIP_IDS.omar,
      organization_id: ORG_ID,
      member_id: MEMBER_IDS.omar,
      plan_id: PLAN_IDS.single,
      status: "pending",
      billing_frequency: "monthly",
      billing_anniversary_day: 1,
      paid_months: 0,
      enrollment_fee_paid: false,
      join_date: null,
      last_payment_date: null,
      next_payment_due: null,
      eligible_date: null,
      agreement_signed_at: null,
      auto_pay_enabled: false,
    },
    {
      id: MEMBERSHIP_IDS.aisha,
      organization_id: ORG_ID,
      member_id: MEMBER_IDS.aisha,
      plan_id: PLAN_IDS.single,
      status: "awaiting_signature",
      billing_frequency: "monthly",
      billing_anniversary_day: 20,
      paid_months: 0,
      enrollment_fee_paid: true,
      join_date: null,
      last_payment_date: null,
      next_payment_due: null,
      eligible_date: null,
      agreement_signed_at: null,
      auto_pay_enabled: false,
    },
  ]);
  if (membershipsError) throw new Error(`Memberships: ${membershipsError.message}`);
  console.log("✓");

  // 6. Payments
  process.stdout.write("   Creating payments... ");
  const { error: paymentsError } = await supabase.from("payments").insert([
    // Ahmed's enrollment fee
    {
      organization_id: ORG_ID,
      membership_id: MEMBERSHIP_IDS.ahmed,
      member_id: MEMBER_IDS.ahmed,
      type: "enrollment_fee",
      method: "stripe",
      status: "completed",
      amount: 500.0,
      stripe_fee: 14.8,
      platform_fee: 1.0,
      total_charged: 514.8,
      net_amount: 499.0,
      months_credited: 0,
      invoice_number: "INV-2019-0001",
      period_label: "Enrollment Fee",
      created_at: "2019-07-15T10:00:00Z",
      paid_at: "2019-07-15T10:00:00Z",
    },
    // Ahmed's recent dues
    {
      organization_id: ORG_ID,
      membership_id: MEMBERSHIP_IDS.ahmed,
      member_id: MEMBER_IDS.ahmed,
      type: "dues",
      method: "stripe",
      status: "completed",
      amount: 40.0,
      stripe_fee: 1.46,
      platform_fee: 1.0,
      total_charged: 41.46,
      net_amount: 39.0,
      months_credited: 1,
      invoice_number: "INV-2024-0010",
      period_label: "December 2024",
      created_at: "2024-12-01T10:00:00Z",
      paid_at: "2024-12-01T10:00:00Z",
    },
    {
      organization_id: ORG_ID,
      membership_id: MEMBERSHIP_IDS.ahmed,
      member_id: MEMBER_IDS.ahmed,
      type: "dues",
      method: "stripe",
      status: "completed",
      amount: 40.0,
      stripe_fee: 1.46,
      platform_fee: 1.0,
      total_charged: 41.46,
      net_amount: 39.0,
      months_credited: 1,
      invoice_number: "INV-2024-0009",
      period_label: "November 2024",
      created_at: "2024-11-01T10:00:00Z",
      paid_at: "2024-11-01T10:00:00Z",
    },
    {
      organization_id: ORG_ID,
      membership_id: MEMBERSHIP_IDS.ahmed,
      member_id: MEMBER_IDS.ahmed,
      type: "dues",
      method: "stripe",
      status: "completed",
      amount: 40.0,
      stripe_fee: 1.46,
      platform_fee: 1.0,
      total_charged: 41.46,
      net_amount: 39.0,
      months_credited: 1,
      invoice_number: "INV-2024-0008",
      period_label: "October 2024",
      created_at: "2024-10-01T10:00:00Z",
      paid_at: "2024-10-01T10:00:00Z",
    },
    // Muhammad's payments
    {
      organization_id: ORG_ID,
      membership_id: MEMBERSHIP_IDS.muhammad,
      member_id: MEMBER_IDS.muhammad,
      type: "enrollment_fee",
      method: "check",
      status: "completed",
      amount: 500.0,
      stripe_fee: 0.0,
      platform_fee: 1.0,
      total_charged: 500.0,
      net_amount: 499.0,
      months_credited: 0,
      invoice_number: "INV-2022-0050",
      period_label: "Enrollment Fee",
      created_at: "2022-12-10T10:00:00Z",
      paid_at: "2022-12-10T10:00:00Z",
    },
    {
      organization_id: ORG_ID,
      membership_id: MEMBERSHIP_IDS.muhammad,
      member_id: MEMBER_IDS.muhammad,
      type: "dues",
      method: "cash",
      status: "completed",
      amount: 20.0,
      stripe_fee: 0.0,
      platform_fee: 1.0,
      total_charged: 20.0,
      net_amount: 19.0,
      months_credited: 1,
      invoice_number: "INV-2024-0011",
      period_label: "December 2024",
      created_at: "2024-12-01T10:00:00Z",
      paid_at: "2024-12-01T10:00:00Z",
    },
    // Fatima's pending payment
    {
      organization_id: ORG_ID,
      membership_id: MEMBERSHIP_IDS.fatima,
      member_id: MEMBER_IDS.fatima,
      type: "dues",
      method: null,
      status: "pending",
      amount: 40.0,
      stripe_fee: 0.0,
      platform_fee: 1.0,
      total_charged: 40.0,
      net_amount: 39.0,
      months_credited: 1,
      invoice_number: "INV-2024-0012",
      due_date: "2024-11-05",
      period_label: "November 2024",
      reminder_count: 2,
      created_at: "2024-11-01T10:00:00Z",
    },
  ]);
  if (paymentsError) throw new Error(`Payments: ${paymentsError.message}`);
  console.log("✓");

  // 7. Agreements
  process.stdout.write("   Creating agreements... ");
  const { error: agreementsError } = await supabase.from("agreements").insert([
    {
      organization_id: ORG_ID,
      membership_id: MEMBERSHIP_IDS.aisha,
      member_id: MEMBER_IDS.aisha,
      template_version: "1.0",
      sent_at: "2024-12-10T10:00:00Z",
    },
  ]);
  if (agreementsError) throw new Error(`Agreements: ${agreementsError.message}`);
  console.log("✓");

  // 8. Email Logs
  process.stdout.write("   Creating email logs... ");
  const { error: emailLogsError } = await supabase.from("email_logs").insert([
    {
      organization_id: ORG_ID,
      member_id: MEMBER_IDS.ahmed,
      member_name: "Ahmed Khan",
      member_email: "ahmed.khan@email.com",
      template_type: "payment_receipt",
      to: "ahmed.khan@email.com",
      subject: "Payment Receipt - $40.00",
      body_preview: "Thank you for your payment of $40.00...",
      language: "en",
      status: "delivered",
      sent_at: "2024-12-01T10:01:00Z",
      delivered_at: "2024-12-01T10:01:30Z",
      resend_id: "re_abc123",
    },
    {
      organization_id: ORG_ID,
      member_id: MEMBER_IDS.fatima,
      member_name: "Fatima Hassan",
      member_email: "fatima.hassan@email.com",
      template_type: "payment_reminder",
      to: "fatima.hassan@email.com",
      subject: "Payment Reminder - Due Nov 5, 2024",
      body_preview: "This is a friendly reminder that your membership dues...",
      language: "fa",
      status: "delivered",
      sent_at: "2024-11-08T10:00:00Z",
      delivered_at: "2024-11-08T10:00:30Z",
      resend_id: "re_def456",
    },
    {
      organization_id: ORG_ID,
      member_id: MEMBER_IDS.aisha,
      member_name: "Aisha Rahman",
      member_email: "aisha.rahman@email.com",
      template_type: "agreement_sent",
      to: "aisha.rahman@email.com",
      subject: "Membership Agreement Ready for Signature",
      body_preview: "Your membership agreement is ready for your signature...",
      language: "en",
      status: "delivered",
      sent_at: "2024-12-10T10:00:00Z",
      delivered_at: "2024-12-10T10:00:30Z",
      resend_id: "re_ghi789",
    },
  ]);
  if (emailLogsError) throw new Error(`Email Logs: ${emailLogsError.message}`);
  console.log("✓");

  // 9. Onboarding Invites
  process.stdout.write("   Creating onboarding invites... ");
  const { error: onboardingError } = await supabase.from("onboarding_invites").insert([
    {
      organization_id: ORG_ID,
      membership_id: MEMBERSHIP_IDS.aisha,
      member_id: MEMBER_IDS.aisha,
      payment_method: "stripe",
      enrollment_fee_amount: 500.0,
      includes_enrollment_fee: true,
      dues_amount: 20.0,
      billing_frequency: "monthly",
      planned_amount: 20.0,
      status: "pending",
      sent_at: "2024-12-10T11:00:00Z",
    },
  ]);
  if (onboardingError) throw new Error(`Onboarding Invites: ${onboardingError.message}`);
  console.log("✓");

  // 10. Email Templates
  process.stdout.write("   Creating email templates... ");
  const { error: emailTemplatesError } = await supabase.from("email_templates").insert([
    // Agreement Sent
    {
      organization_id: ORG_ID,
      type: "agreement_sent",
      name: "Agreement Sent",
      description: "Sent when a membership agreement is ready for signature",
      subject: {
        en: "Your Membership Agreement is Ready to Sign",
        fa: "قرارداد عضویت شما آماده امضا است",
      },
      body: {
        en: `Assalamu Alaikum {{member_name}},

Welcome to {{organization_name}}! We are pleased to have you join our community.

Your membership agreement is ready for your review and signature. Please click the link below to read and sign the agreement:

{{agreement_url}}

Once you have signed the agreement, you will receive a separate email with payment instructions for your enrollment fee and first dues payment.

If you have any questions, please don't hesitate to contact us.

JazakAllah Khair,
{{organization_name}}`,
        fa: `السلام علیکم {{member_name}}،

به {{organization_name}} خوش آمدید! ما خوشحالیم که شما به جامعه ما می‌پیوندید.

قرارداد عضویت شما آماده بررسی و امضا است. لطفاً روی لینک زیر کلیک کنید تا قرارداد را بخوانید و امضا کنید:

{{agreement_url}}

پس از امضای قرارداد، ایمیل جداگانه‌ای با دستورالعمل پرداخت برای هزینه ثبت‌نام و اولین پرداخت حق عضویت دریافت خواهید کرد.

اگر سوالی دارید، لطفاً با ما تماس بگیرید.

جزاک الله خیر،
{{organization_name}}`,
      },
      variables: ["member_name", "organization_name", "agreement_url"],
      is_active: true,
    },
    // Payment Setup - Stripe
    {
      organization_id: ORG_ID,
      type: "payment_setup_stripe",
      name: "Payment Setup (Stripe)",
      description: "Sent after agreement is signed - contains Stripe checkout link",
      subject: {
        en: "Complete Your Membership Payment",
        fa: "پرداخت عضویت خود را تکمیل کنید",
      },
      body: {
        en: `Assalamu Alaikum {{member_name}},

Thank you for signing your membership agreement with {{organization_name}}.

To complete your enrollment, please make your payment using the secure link below:

{{checkout_url}}

Payment Summary:
{{#if enrollment_fee}}• Enrollment Fee: {{enrollment_fee}}{{/if}}
• {{billing_frequency}} Dues: {{dues_amount}}
• Total: {{total_amount}}

This link will expire in 24 hours. If you have any issues, please contact us.

JazakAllah Khair,
{{organization_name}}`,
        fa: `السلام علیکم {{member_name}}،

از امضای قرارداد عضویت با {{organization_name}} متشکریم.

برای تکمیل ثبت‌نام، لطفاً با استفاده از لینک امن زیر پرداخت کنید:

{{checkout_url}}

خلاصه پرداخت:
{{#if enrollment_fee}}• هزینه ثبت‌نام: {{enrollment_fee}}{{/if}}
• حق عضویت {{billing_frequency}}: {{dues_amount}}
• مجموع: {{total_amount}}

این لینک تا ۲۴ ساعت معتبر است. اگر مشکلی دارید، لطفاً با ما تماس بگیرید.

جزاک الله خیر،
{{organization_name}}`,
      },
      variables: ["member_name", "organization_name", "checkout_url", "enrollment_fee", "dues_amount", "billing_frequency", "total_amount"],
      is_active: true,
    },
    // Payment Setup - Manual
    {
      organization_id: ORG_ID,
      type: "payment_setup_manual",
      name: "Payment Setup (Manual)",
      description: "Sent after agreement is signed - manual payment instructions",
      subject: {
        en: "Payment Instructions for Your Membership",
        fa: "دستورالعمل پرداخت برای عضویت شما",
      },
      body: {
        en: `Assalamu Alaikum {{member_name}},

Thank you for signing your membership agreement with {{organization_name}}.

To complete your enrollment, please make your payment using one of the following methods:

Payment Summary:
{{#if enrollment_fee}}• Enrollment Fee: {{enrollment_fee}}{{/if}}
• {{billing_frequency}} Dues: {{dues_amount}}
• Total Due: {{total_amount}}

Payment Methods:
• Cash - Pay in person at our office
• Check - Make payable to "{{organization_name}}"
• Zelle - Contact us for Zelle details

Please include your name with any payment so we can properly credit your account.

If you have any questions, please contact us.

JazakAllah Khair,
{{organization_name}}`,
        fa: `السلام علیکم {{member_name}}،

از امضای قرارداد عضویت با {{organization_name}} متشکریم.

برای تکمیل ثبت‌نام، لطفاً با یکی از روش‌های زیر پرداخت کنید:

خلاصه پرداخت:
{{#if enrollment_fee}}• هزینه ثبت‌نام: {{enrollment_fee}}{{/if}}
• حق عضویت {{billing_frequency}}: {{dues_amount}}
• مجموع قابل پرداخت: {{total_amount}}

روش‌های پرداخت:
• نقدی - حضوری در دفتر ما پرداخت کنید
• چک - به نام "{{organization_name}}" صادر کنید
• Zelle - برای جزئیات Zelle با ما تماس بگیرید

لطفاً نام خود را همراه با هر پرداختی ذکر کنید تا بتوانیم حساب شما را به درستی اعتبار دهیم.

اگر سوالی دارید، لطفاً با ما تماس بگیرید.

جزاک الله خیر،
{{organization_name}}`,
      },
      variables: ["member_name", "organization_name", "enrollment_fee", "dues_amount", "billing_frequency", "total_amount"],
      is_active: true,
    },
    // Payment Reminder
    {
      organization_id: ORG_ID,
      type: "payment_reminder",
      name: "Payment Reminder",
      description: "Sent when a payment is overdue",
      subject: {
        en: "Reminder: Membership Payment Due",
        fa: "یادآوری: پرداخت حق عضویت",
      },
      body: {
        en: `Assalamu Alaikum {{member_name}},

This is a friendly reminder that your membership dues payment is due.

Amount Due: {{amount_due}}
Due Date: {{due_date}}
Days Overdue: {{days_overdue}}

Please make your payment at your earliest convenience to keep your membership in good standing.

If you have already made this payment, please disregard this notice.

If you have any questions or need to discuss payment arrangements, please contact us.

JazakAllah Khair,
{{organization_name}}`,
        fa: `السلام علیکم {{member_name}}،

این یک یادآوری دوستانه است که پرداخت حق عضویت شما سررسید شده است.

مبلغ قابل پرداخت: {{amount_due}}
تاریخ سررسید: {{due_date}}
روزهای تأخیر: {{days_overdue}}

لطفاً در اسرع وقت پرداخت خود را انجام دهید تا عضویت شما فعال بماند.

اگر قبلاً این پرداخت را انجام داده‌اید، لطفاً این اطلاعیه را نادیده بگیرید.

اگر سوالی دارید یا نیاز به بحث در مورد ترتیبات پرداخت دارید، لطفاً با ما تماس بگیرید.

جزاک الله خیر،
{{organization_name}}`,
      },
      variables: ["member_name", "organization_name", "amount_due", "due_date", "days_overdue"],
      is_active: true,
    },
    // Payment Receipt
    {
      organization_id: ORG_ID,
      type: "payment_receipt",
      name: "Payment Receipt",
      description: "Sent after a payment is received",
      subject: {
        en: "Payment Receipt - {{organization_name}}",
        fa: "رسید پرداخت - {{organization_name}}",
      },
      body: {
        en: `Assalamu Alaikum {{member_name}},

Thank you for your payment! This email confirms that we have received your payment.

Payment Details:
• Amount: {{amount}}
• Date: {{payment_date}}
• Method: {{payment_method}}
• Invoice #: {{invoice_number}}
{{#if period_label}}• Period: {{period_label}}{{/if}}

Your membership is in good standing. Thank you for your continued support of {{organization_name}}.

JazakAllah Khair,
{{organization_name}}`,
        fa: `السلام علیکم {{member_name}}،

از پرداخت شما متشکریم! این ایمیل تأیید می‌کند که پرداخت شما را دریافت کرده‌ایم.

جزئیات پرداخت:
• مبلغ: {{amount}}
• تاریخ: {{payment_date}}
• روش پرداخت: {{payment_method}}
• شماره فاکتور: {{invoice_number}}
{{#if period_label}}• دوره: {{period_label}}{{/if}}

عضویت شما فعال است. از حمایت مداوم شما از {{organization_name}} متشکریم.

جزاک الله خیر،
{{organization_name}}`,
      },
      variables: ["member_name", "organization_name", "amount", "payment_date", "payment_method", "invoice_number", "period_label"],
      is_active: true,
    },
  ]);
  if (emailTemplatesError) throw new Error(`Email Templates: ${emailTemplatesError.message}`);
  console.log("✓");

  console.log("\n✅ Database seeded successfully!");
  console.log("\n📊 Summary:");
  console.log("   • 1 Organization (Masjid Muhajireen)");
  console.log("   • 3 Plans (Single, Married, Widow)");
  console.log("   • 5 Members (various statuses)");
  console.log("   • 5 Memberships");
  console.log("   • 7 Payments");
  console.log("   • 1 Agreement (awaiting signature)");
  console.log("   • 3 Email Logs");
  console.log("   • 1 Onboarding Invite");
  console.log("   • 5 Email Templates (EN + FA)");
  console.log("\n🧪 Test Scenarios:");
  console.log("   1. Ahmed Khan: Active with Stripe autopay - test payment blocking");
  console.log("   2. Muhammad Ali: Waiting period with manual payments");
  console.log("   3. Fatima Hassan: Lapsed - test payment reminders");
  console.log("   4. Omar Syed: Pending (no enrollment fee) - test 'Set Up Auto-Pay' includes fee");
  console.log("   5. Aisha Rahman: Awaiting signature - test agreement flow");
  console.log("   6. Create NEW member with Stripe -> checkout includes enrollment fee + subscription");
}

async function main(): Promise<void> {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║         DATABASE WIPE & RESEED SCRIPT                      ║");
  console.log("║         (Auto-detects new tables)                          ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`\n🔗 Database: ${SUPABASE_URL}`);

  if (!seedOnly) {
    console.log("\n⚠️  WARNING: This will DELETE ALL DATA from the application tables!");
    console.log("   (Admin users in auth.users will be preserved)");

    const confirmed = await confirm("\nAre you sure you want to proceed?");
    if (!confirmed) {
      console.log("\n❌ Operation cancelled.");
      process.exit(0);
    }
  }

  try {
    if (!seedOnly) {
      await wipeDatabase();
    }

    if (!wipeOnly) {
      await seedDatabase();
    }

    console.log("\n🎉 All done!\n");
  } catch (error) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
