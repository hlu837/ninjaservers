import { createClient } from '@supabase/supabase-js';
import { getSecret } from './envSecrets.js';

// Supabase must have a `verification_codes` table with at least:
//   email text primary key,
//   code text not null,
//   created_at timestamp with time zone default now()
const supabaseUrl = getSecret('SUPABASE_URL');
const supabaseServiceRoleKey = getSecret('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables or secret files');
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
  global: { headers: { 'x-application-name': 'ninja-servers-supabase' } },
});

const VERIFICATION_TABLE = 'verification_codes';

export async function upsertVerificationCode(email, code) {
  return supabase
    .from(VERIFICATION_TABLE)
    .upsert({ email, code, created_at: new Date().toISOString() }, { onConflict: ['email'] });
}

export async function getVerificationCode(email) {
  return supabase
    .from(VERIFICATION_TABLE)
    .select('email, code, created_at')
    .eq('email', email)
    .single();
}

export async function deleteVerificationCode(email) {
  return supabase
    .from(VERIFICATION_TABLE)
    .delete()
    .eq('email', email);
}

export async function upsertProfileIdentity(email, public_key, ninja_id, vbm_seal) {
  return supabase
    .from('profiles')
    .upsert(
      { email, public_key, ninja_id, vbm_seal, updated_at: new Date().toISOString() },
      { onConflict: ['email'] }
    );
}

export async function getProfileByEmail(email) {
  return supabase
    .from('profiles')
    .select('email')
    .eq('email', email)
    .maybeSingle();
}
