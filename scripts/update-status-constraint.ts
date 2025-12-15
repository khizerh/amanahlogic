/**
 * Update the memberships status constraint to use the new 4-status model
 *
 * Run with: npx ts-node scripts/update-status-constraint.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateConstraint() {
  console.log('Updating memberships status constraint...');
  console.log('Database:', supabaseUrl);
  console.log('');

  // First, let's check what constraints exist
  const { data: constraints, error: checkError } = await supabase
    .from('memberships')
    .select('status')
    .limit(1);

  if (checkError) {
    console.log('Table exists, checking constraint...');
  }

  console.log(`
⚠️  You need to run this SQL manually in Supabase Dashboard SQL Editor:

-- Update the status constraint for the new 4-status model
ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_status_check;
ALTER TABLE memberships ADD CONSTRAINT memberships_status_check
  CHECK (status IN ('pending', 'current', 'lapsed', 'cancelled'));

Go to: ${supabaseUrl.replace('.supabase.co', '')}/project/_/sql
  `);
}

updateConstraint();
