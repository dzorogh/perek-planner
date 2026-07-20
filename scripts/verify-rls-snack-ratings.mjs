/**
 * Anon RLS deny for snack_ratings (Epic 4).
 * Usage: node --env-file=.env.local scripts/verify-rls-snack-ratings.mjs
 */

import { createClient } from "@supabase/supabase-js";

import { assertAnonDenied } from "./lib/assert-anon-denied.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !anon) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or publishable key");
  process.exit(1);
}

const supabase = createClient(url, anon);
await assertAnonDenied(
  supabase,
  "snack_ratings",
  "Apply snack_ratings migration first.",
);
console.log("All snack_ratings RLS anon checks passed");
