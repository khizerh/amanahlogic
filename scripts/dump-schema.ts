/**
 * Regenerate supabase/schema.sql from the LIVE production database.
 *
 * The database itself is the source of truth (changes are applied directly
 * as SQL); this snapshot exists so the schema is readable/greppable in the
 * repo and a fresh environment can be rebuilt from one file.
 *
 * Usage:  npm run dump-schema
 * Needs:  SUPABASE_ACCESS_TOKEN in the environment (Management API token).
 */
import { writeFileSync } from "fs";

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "vlbwgjenstbfrkncsrte";
const OUT = process.argv[2] || "supabase/schema.sql";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) {
  console.error("SUPABASE_ACCESS_TOKEN is not set");
  process.exit(1);
}

async function sql<T = Record<string, unknown>>(query: string): Promise<T[]> {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, read_only: true }),
    }
  );
  if (!res.ok) {
    throw new Error(`Query failed (${res.status}): ${await res.text()}\n--- query was:\n${query.slice(0, 300)}`);
  }
  return (await res.json()) as T[];
}

/** Run a query whose single column `ddl` holds ready-made statements. */
async function ddl(query: string): Promise<string[]> {
  const rows = await sql<{ ddl: string }>(query);
  return rows.map((r) => r.ddl);
}

function section(title: string, statements: string[]): string {
  if (statements.length === 0) return "";
  return `-- ============================================================\n-- ${title}\n-- ============================================================\n\n${statements.join("\n\n")}\n\n`;
}

async function main() {
  const parts: string[] = [];

  parts.push(
    `-- AUTO-GENERATED SNAPSHOT of the production database schema.\n` +
      `-- Do not edit by hand — apply changes directly to the database,\n` +
      `-- then refresh this file with:  npm run dump-schema\n` +
      `-- Project: ${PROJECT_REF}\n\n`
  );

  // Extensions (skip defaults that every Postgres/Supabase project has)
  parts.push(
    section(
      "EXTENSIONS",
      await ddl(`
        SELECT 'CREATE EXTENSION IF NOT EXISTS "' || e.extname || '" WITH SCHEMA ' || n.nspname || ';' AS ddl
        FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
        WHERE e.extname NOT IN ('plpgsql')
        ORDER BY e.extname`)
    )
  );

  // Enum types
  parts.push(
    section(
      "ENUM TYPES",
      await ddl(`
        SELECT 'CREATE TYPE public.' || quote_ident(t.typname) || ' AS ENUM (' ||
               string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) || ');' AS ddl
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
        GROUP BY t.typname
        ORDER BY t.typname`)
    )
  );

  // Tables: columns + defaults + not-null, with PK/UNIQUE/CHECK inline
  parts.push(
    section(
      "TABLES",
      await ddl(`
        WITH cols AS (
          SELECT c.oid, a.attnum,
                 '  ' || quote_ident(a.attname) || ' ' || format_type(a.atttypid, a.atttypmod)
                 || COALESCE(' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid), '')
                 || CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END AS col
          FROM pg_attribute a
          JOIN pg_class c ON c.oid = a.attrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
          WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
        ),
        cons AS (
          SELECT conrelid AS oid,
                 '  CONSTRAINT ' || quote_ident(conname) || ' ' || pg_get_constraintdef(pg_constraint.oid) AS con,
                 conname
          FROM pg_constraint
          WHERE contype IN ('p','u','c') AND connamespace = 'public'::regnamespace
        )
        SELECT 'CREATE TABLE IF NOT EXISTS public.' || quote_ident(c.relname) || ' (' || E'\\n' ||
               (SELECT string_agg(col, E',\\n' ORDER BY attnum) FROM cols WHERE cols.oid = c.oid) ||
               COALESCE((SELECT E',\\n' || string_agg(con, E',\\n' ORDER BY conname) FROM cons WHERE cons.oid = c.oid), '') ||
               E'\\n);' AS ddl
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY c.relname`)
    )
  );

  // Foreign keys (separate so table creation order never matters)
  parts.push(
    section(
      "FOREIGN KEYS",
      await ddl(`
        SELECT 'ALTER TABLE public.' || quote_ident(cl.relname) || ' ADD CONSTRAINT ' ||
               quote_ident(con.conname) || ' ' || pg_get_constraintdef(con.oid) || ';' AS ddl
        FROM pg_constraint con
        JOIN pg_class cl ON cl.oid = con.conrelid
        WHERE con.contype = 'f' AND con.connamespace = 'public'::regnamespace
        ORDER BY cl.relname, con.conname`)
    )
  );

  // Indexes not backing a constraint
  parts.push(
    section(
      "INDEXES",
      await ddl(`
        SELECT replace(indexdef, 'CREATE INDEX', 'CREATE INDEX IF NOT EXISTS')
               || ';' AS ddl
        FROM pg_indexes i
        WHERE schemaname = 'public'
          AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = (schemaname||'.'||indexname)::regclass)
        ORDER BY tablename, indexname`)
    )
  );

  // Functions (exclude extension-owned)
  parts.push(
    section(
      "FUNCTIONS",
      await ddl(`
        SELECT pg_get_functiondef(p.oid) || ';' AS ddl
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
        ORDER BY p.proname`)
    )
  );

  // Views
  parts.push(
    section(
      "VIEWS",
      await ddl(`
        SELECT 'CREATE OR REPLACE VIEW public.' || quote_ident(viewname) || ' AS ' ||
               pg_get_viewdef((schemaname||'.'||viewname)::regclass, true) AS ddl
        FROM pg_views WHERE schemaname = 'public' ORDER BY viewname`)
    )
  );

  // Triggers (non-internal)
  parts.push(
    section(
      "TRIGGERS",
      await ddl(`
        SELECT pg_get_triggerdef(t.oid, true) || ';' AS ddl
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND NOT t.tgisinternal
        ORDER BY c.relname, t.tgname`)
    )
  );

  // Row level security + policies
  parts.push(
    section(
      "ROW LEVEL SECURITY",
      await ddl(`
        SELECT 'ALTER TABLE public.' || quote_ident(relname) || ' ENABLE ROW LEVEL SECURITY;' AS ddl
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
        ORDER BY relname`)
    )
  );
  parts.push(
    section(
      "POLICIES",
      await ddl(`
        SELECT 'CREATE POLICY ' || quote_ident(policyname) || ' ON public.' || quote_ident(tablename) ||
               CASE WHEN permissive = 'RESTRICTIVE' THEN ' AS RESTRICTIVE' ELSE '' END ||
               ' FOR ' || cmd ||
               ' TO ' || array_to_string(roles, ', ') ||
               COALESCE(' USING (' || qual || ')', '') ||
               COALESCE(' WITH CHECK (' || with_check || ')', '') || ';' AS ddl
        FROM pg_policies WHERE schemaname = 'public'
        ORDER BY tablename, policyname`)
    )
  );

  // Storage: buckets + storage.objects policies (signature images live here)
  parts.push(
    section(
      "STORAGE BUCKETS",
      await ddl(`
        SELECT 'INSERT INTO storage.buckets (id, name, public) VALUES (' ||
               quote_literal(id) || ', ' || quote_literal(name) || ', ' || public || ') ON CONFLICT (id) DO NOTHING;' AS ddl
        FROM storage.buckets ORDER BY id`)
    )
  );
  parts.push(
    section(
      "STORAGE POLICIES",
      await ddl(`
        SELECT 'CREATE POLICY ' || quote_ident(policyname) || ' ON storage.' || quote_ident(tablename) ||
               CASE WHEN permissive = 'RESTRICTIVE' THEN ' AS RESTRICTIVE' ELSE '' END ||
               ' FOR ' || cmd ||
               ' TO ' || array_to_string(roles, ', ') ||
               COALESCE(' USING (' || qual || ')', '') ||
               COALESCE(' WITH CHECK (' || with_check || ')', '') || ';' AS ddl
        FROM pg_policies WHERE schemaname = 'storage'
        ORDER BY tablename, policyname`)
    )
  );

  // Realtime publication membership (if any tables are broadcast)
  parts.push(
    section(
      "REALTIME PUBLICATION",
      await ddl(`
        SELECT 'ALTER PUBLICATION supabase_realtime ADD TABLE ' || schemaname || '.' || tablename || ';' AS ddl
        FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
        ORDER BY schemaname, tablename`)
    )
  );

  // Comments on tables and columns
  parts.push(
    section(
      "COMMENTS",
      await ddl(`
        SELECT 'COMMENT ON TABLE public.' || quote_ident(c.relname) || ' IS ' || quote_literal(d.description) || ';' AS ddl
        FROM pg_description d
        JOIN pg_class c ON c.oid = d.objoid AND d.objsubid = 0
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        UNION ALL
        SELECT 'COMMENT ON COLUMN public.' || quote_ident(c.relname) || '.' || quote_ident(a.attname) ||
               ' IS ' || quote_literal(d.description) || ';' AS ddl
        FROM pg_description d
        JOIN pg_class c ON c.oid = d.objoid AND d.objsubid > 0
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY 1`)
    )
  );

  writeFileSync(OUT, parts.join(""));
  console.log(`Wrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
