/**
 * Anon RLS deny for menu_slot_dishes (Story 6.1).
 * Usage: node --env-file=.env.local scripts/verify-rls-menu-slot-dishes.mjs
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
  "menu_slot_dishes",
  "Apply supabase/migrations/20260725030000_menu_slot_dishes_and_covers_roles.sql first.",
);
console.log("All menu_slot_dishes RLS anon checks passed");
