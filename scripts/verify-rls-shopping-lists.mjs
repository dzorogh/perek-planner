/**
 * Anon RLS deny for shopping_lists / shopping_list_lines (Epic 3).
 * Usage: node --env-file=.env.local scripts/verify-rls-shopping-lists.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !anon) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or publishable key");
  process.exit(1);
}

const supabase = createClient(url, anon);

const lists = await supabase.from("shopping_lists").select("id").limit(1);
const lines = await supabase.from("shopping_list_lines").select("id").limit(1);

let failed = false;
if (lists.data != null && lists.data.length > 0) {
  console.log("FAIL: anon read shopping_lists", lists);
  failed = true;
} else {
  console.log("PASS: anon cannot read shopping_lists");
}

if (lines.data != null && lines.data.length > 0) {
  console.log("FAIL: anon read shopping_list_lines", lines);
  failed = true;
} else {
  console.log("PASS: anon cannot read shopping_list_lines");
}

if (failed) process.exit(1);
console.log("All shopping_lists RLS anon checks passed");
