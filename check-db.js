import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable(table) {
  const res = await supabase.from(table).select('email').limit(1);
  if (res.error) {
    return { table, exists: false, error: res.error.message };
  }
  return { table, exists: true };
}

async function checkProfileColumns() {
  const fields = ['email', 'public_key', 'ninja_id', 'vbm_seal', 'updated_at'];
  const res = await supabase.from('profiles').select(fields.join(',')).limit(1);
  return {
    table: 'profiles',
    ok: !res.error,
    error: res.error ? res.error.message : null,
  };
}

async function run() {
  const results = [];
  for (const table of ['verification_codes', 'profiles']) {
    results.push(await checkTable(table));
  }
  results.push(await checkProfileColumns());
  console.log(JSON.stringify(results, null, 2));
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
