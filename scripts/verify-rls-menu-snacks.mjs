/**
 * Anon RLS deny for menu_snacks (Story 2.5).
 * Usage: node --env-file=.env.local scripts/verify-rls-menu-snacks.mjs
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
  "menu_snacks",
  "Apply supabase/migrations/20260720080000_menu_snacks.sql first.",
);
console.log("All menu_snacks RLS anon checks passed");
