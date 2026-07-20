/**
 * Anon RLS deny for snack_ratings (Epic 4).
 * Usage: node --env-file=.env.local scripts/verify-rls-snack-ratings.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !anon) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or publishable key");
  process.exit(1);
}

const supabase = createClient(url, anon);
const { data, error } = await supabase.from("snack_ratings").select("id").limit(1);

if (data == null || data.length === 0) {
  console.log("PASS: anon cannot read snack_ratings");
  process.exit(0);
}

console.log("FAIL: anon read snack_ratings", { data, error });
process.exit(1);
