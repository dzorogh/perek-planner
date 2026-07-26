/**
 * Anon RLS deny for shopping_lists (curated selection).
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
  "Apply supabase/migrations/20260726170000_shopping_list_curated_selection.sql first.",
);

// Snapshot lines must be dropped — only PGRST205 (missing relation) is PASS.
{
  const { error } = await supabase.from("shopping_list_lines").select("*").limit(1);
  if (!error) {
    console.error(
      "FAIL: shopping_list_lines still readable — drop via curated_selection migration.",
    );
    process.exit(1);
  }
  if (error.code === "PGRST205") {
    console.log("PASS: shopping_list_lines table absent");
  } else {
    console.error(
      "FAIL: shopping_list_lines must be dropped (expected PGRST205), got:",
      error.code,
      error.message,
    );
    process.exit(1);
  }
}

console.log("All shopping_lists RLS anon checks passed");
