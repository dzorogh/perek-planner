/**
 * Anon RLS deny for shopping_lists / shopping_list_lines (Epic 3).
 * Usage: node --env-file=.env.local scripts/verify-rls-shopping-lists.mjs
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
  "shopping_lists",
  "Apply supabase/migrations/20260720090000_slot_servings_shopping_lists.sql first.",
);
await assertAnonDenied(
  supabase,
  "shopping_list_lines",
  "Apply supabase/migrations/20260720090000_slot_servings_shopping_lists.sql first.",
);
console.log("All shopping_lists RLS anon checks passed");
