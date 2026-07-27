/**
 * Anon RLS deny for menu_dishes.
 * Usage: node --env-file=.env.local scripts/verify-rls-menu-dishes.mjs
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
  "menu_dishes",
  "Apply supabase/migrations/20260728010000_menu_dishes_cook_feedback.sql first.",
);
console.log("All menu_dishes RLS anon checks passed");
