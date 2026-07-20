/**
 * Anon RLS deny for menu_snacks (Story 2.5).
 * Usage: node --env-file=.env.local scripts/verify-rls-menu-snacks.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !anon) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or publishable key");
  process.exit(1);
}

const supabase = createClient(url, anon);
const { data, error } = await supabase.from("menu_snacks").select("id").limit(1);

if (data == null || data.length === 0) {
  console.log("PASS: anon cannot read menu_snacks");
  console.log("All menu_snacks RLS anon checks passed");
  process.exit(0);
}

console.log("FAIL: anon read menu_snacks", { data, error });
process.exit(1);
