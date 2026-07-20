/**
 * Anon RLS deny for recipe_refusals / recipe_ratings (Story 2.3).
 * Usage: node --env-file=.env.local scripts/verify-rls-refusals-ratings.mjs
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
  "recipe_refusals",
  "Apply supabase/migrations/20260720060000_recipe_refusals_ratings.sql first.",
);
await assertAnonDenied(
  supabase,
  "recipe_ratings",
  "Apply supabase/migrations/20260720060000_recipe_refusals_ratings.sql first.",
);
console.log("All refusals/ratings RLS anon checks passed");
