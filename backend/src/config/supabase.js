/**
 * config/supabase.js
 * Initialises the Supabase Admin client (service-role key).
 * This runs SERVER-SIDE only — the service-role key is never exposed to browsers.
 */

const { createClient } = require('@supabase/supabase-js');

const url  = process.env.SUPABASE_URL;
const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || url.includes('YOUR_PROJECT_ID')) {
  console.error('❌  SUPABASE_URL is not set in .env');
  process.exit(1);
}
if (!key || key.includes('YOUR_SERVICE_ROLE_KEY')) {
  console.error('❌  SUPABASE_SERVICE_ROLE_KEY is not set in .env');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

module.exports = supabase;
