/**
 * Anon RLS deny for recipe_refusals / recipe_ratings (Story 2.3).
 * Usage: node --env-file=.env.local scripts/verify-rls-refusals-ratings.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !anon) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or publishable key");
  process.exit(1);
}

const supabase = createClient(url, anon);

let failed = 0;
function check(name, cond) {
  if (cond) console.log(`PASS: ${name}`);
  else {
    console.log(`FAIL: ${name}`);
    failed += 1;
  }
}

const refusals = await supabase.from("recipe_refusals").select("id").limit(1);
check(
  "anon cannot read recipe_refusals",
  refusals.data == null || refusals.data.length === 0,
);

const ratings = await supabase.from("recipe_ratings").select("id").limit(1);
check(
  "anon cannot read recipe_ratings",
  ratings.data == null || ratings.data.length === 0,
);

if (failed > 0) {
  console.log(`${failed} case(s) failed`);
  process.exit(1);
}
console.log("All refusals/ratings RLS anon checks passed");
