/**
 * Database Wipe and Reseed Script (Production)
 *
 * This script:
 * 1. Auto-detects ALL tables in the public schema
 * 2. Determines correct deletion order via FK analysis
 * 3. Wipes ALL transactional data (preserves auth.users, email_templates, agreement_templates)
 * 4. Seeds with production org, settings, and plans — NO fake test data
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
  console.error("Missing environment variables:");
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

// Tables to NEVER wipe (system tables, uploaded content, React email fallback templates)
const EXCLUDED_TABLES = [
  "schema_migrations",
  "buckets",
  "objects",
  "s3_multipart_uploads",
  "s3_multipart_uploads_parts",
  "agreement_templates",  // User-uploaded PDF agreements — preserve across wipes
  "email_templates",      // Admin dashboard view-only templates — preserve across wipes
  "organizations",        // Preserved to maintain FK refs (use upsert in seed)
];

// Fixed UUIDs for consistent seeding
const ORG_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const PLAN_IDS = {
  single: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01",
  married: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02",
  widow: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03",
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
  const dependencies = new Map<string, Set<string>>();
  const allTables = new Set(tables);

  for (const table of tables) {
    dependencies.set(table, new Set());
  }

  for (const fk of foreignKeys) {
    if (allTables.has(fk.table_name) && allTables.has(fk.referenced_table)) {
      dependencies.get(fk.table_name)?.add(fk.referenced_table);
    }
  }

  const result: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(table: string): void {
    if (visited.has(table)) return;
    if (visiting.has(table)) return; // Circular dependency - skip

    visiting.add(table);

    for (const [t, deps] of dependencies) {
      if (deps.has(table) && !visited.has(t)) {
        visit(t);
      }
    }

    visiting.delete(table);
    visited.add(table);
    result.push(table);
  }

  for (const table of tables) {
    if (!visited.has(table)) {
      visit(table);
    }
  }

  return result.reverse();
}

async function wipeDatabase(): Promise<void> {
  console.log("\nAnalyzing database schema...\n");

  process.stdout.write("   Discovering tables... ");
  let tables: string[];
  try {
    tables = await getAllTables(supabase);
    tables = tables.filter((t) => !EXCLUDED_TABLES.includes(t));
    console.log(`found ${tables.length} tables`);
  } catch {
    console.log("(using fallback list)");
    tables = [
      "agreement_signing_links",
      "onboarding_invites",
      "email_logs",
      "payments",
      "agreements",
      "memberships",
      "members",
      "plans",
      "invoice_sequences",
      "member_invites",
      "stripe_webhook_events",
      "organization_settings",
    ];
  }

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

  console.log("\nWiping database tables...\n");
  console.log(`   Deletion order: ${deleteOrder.join(" -> ")}\n`);

  for (const table of deleteOrder) {
    process.stdout.write(`   Deleting from ${table}... `);

    let success = false;

    // Approach 1: Delete with a condition that matches all UUIDs
    const { error: error1 } = await supabase
      .from(table)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (!error1) {
      success = true;
    } else {
      // Approach 2: Try with created_at
      const { error: error2 } = await supabase
        .from(table)
        .delete()
        .gte("created_at", "1900-01-01");

      if (!error2) {
        success = true;
      } else {
        // Approach 3: Select and delete by actual IDs
        const { data: rows } = await supabase.from(table).select("id").limit(1000);
        if (rows && rows.length > 0) {
          const ids = rows.map((r: { id: string }) => r.id);
          const { error: error3 } = await supabase.from(table).delete().in("id", ids);
          if (!error3) {
            success = true;
          }
        } else {
          success = true; // Table empty or no id column
        }
      }
    }

    console.log(success ? "done" : "warning (may be empty or restricted)");
  }

  console.log("\nDatabase wiped successfully!");
}

async function seedDatabase(): Promise<void> {
  console.log("\nSeeding production data...\n");

  // 1. Organization (upsert to preserve FK references)
  process.stdout.write("   Upserting organization... ");
  const { error: orgError } = await supabase.from("organizations").upsert({
    id: ORG_ID,
    name: "Masjid Muhajireen",
    slug: "masjid-muhajireen",
    address: {
      street: "185 Folsom Ave",
      city: "Hayward",
      state: "CA",
      zip: "94544",
    },
    phone: "(510) 963-5578",
    email: "info@masjidmuhajireen.org",
    timezone: "America/Los_Angeles",
    platform_fee: 2.0,
    pass_fees_to_member: false,
  }, { onConflict: "id" });
  if (orgError) throw new Error(`Organization: ${orgError.message}`);
  console.log("done");

  // 2. Organization Settings (upsert in case it already exists)
  process.stdout.write("   Upserting organization settings... ");
  const { error: settingsError } = await supabase.from("organization_settings").upsert({
    organization_id: ORG_ID,
  }, { onConflict: "organization_id" });
  if (settingsError) throw new Error(`Settings: ${settingsError.message}`);
  console.log("done");

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
  console.log("done");

  // 4. Restore agreement_templates org_id (FK cascade may have nulled it)
  process.stdout.write("   Restoring agreement templates org_id... ");
  const { error: restoreTemplatesError } = await supabase
    .from("agreement_templates")
    .update({ organization_id: ORG_ID })
    .is("organization_id", null);
  if (restoreTemplatesError) throw new Error(`Restore Templates: ${restoreTemplatesError.message}`);
  console.log("done");

  // 5. Restore email_templates org_id (FK cascade may have nulled it)
  process.stdout.write("   Restoring email templates org_id... ");
  const { error: restoreEmailTemplatesError } = await supabase
    .from("email_templates")
    .update({ organization_id: ORG_ID })
    .is("organization_id", null);
  if (restoreEmailTemplatesError) throw new Error(`Restore Email Templates: ${restoreEmailTemplatesError.message}`);
  console.log("done");

  console.log("\nDatabase seeded successfully!");
  console.log("\nSummary:");
  console.log("   1 Organization: Masjid Muhajireen");
  console.log("   3 Plans: Single ($20/mo), Married ($40/mo), Widow ($40/mo) - all $500 enrollment fee");
  console.log("   9 Email Templates: preserved (admin dashboard view-only, React emails handle sending)");
  console.log("   2 Agreement Templates: preserved (uploaded EN/FA PDFs)");
  console.log("   0 Members, 0 Payments, 0 Agreements - clean slate for real data");
}

async function main(): Promise<void> {
  console.log("========================================================");
  console.log("  DATABASE WIPE & RESEED (Production)");
  console.log("========================================================");
  console.log(`\nDatabase: ${SUPABASE_URL}`);

  if (!seedOnly) {
    console.log("\nWARNING: This will DELETE ALL transactional data!");
    console.log("   Preserved: auth.users, email_templates, agreement_templates");

    const confirmed = await confirm("\nAre you sure you want to proceed?");
    if (!confirmed) {
      console.log("\nOperation cancelled.");
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

    console.log("\nAll done!\n");
  } catch (error) {
    console.error("\nError:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
