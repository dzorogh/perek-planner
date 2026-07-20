/**
 * Smoke-proof Story 2.1 RLS after migration is applied.
 * Usage: node --env-file=.env.local scripts/verify-rls-menus.mjs
 *
 * PASS only when anon gets an explicit permission/RLS denial on menus + menu_slots.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

const anon = createClient(url, key);

function isPermissionDenied(err) {
  if (!err) return false;
  if (err.code === "42501") return true;
  return /permission denied|row-level security|rls/i.test(err.message ?? "");
}

async function assertAnonDenied(table) {
  const { data, error } = await anon.from(table).select("*").limit(1);

  if (error) {
    if (error.code === "PGRST205") {
      console.error(
        `Table public.${table} not found. Apply supabase/migrations/20260720040000_menus_menu_slots_recipes.sql first.`,
      );
      process.exit(2);
    }
    if (isPermissionDenied(error)) {
      console.log(`PASS: anon cannot read ${table}`);
      return;
    }
    console.error(
      `FAIL: unexpected anon error on ${table}:`,
      error.code,
      error.message,
    );
    process.exit(1);
  }

  if (Array.isArray(data) && data.length === 0) {
    console.error(
      `FAIL: anon select on ${table} returned [] without error — cannot prove RLS deny.`,
    );
    process.exit(1);
  }

  console.error(`FAIL: anon unexpectedly read ${table}:`, data);
  process.exit(1);
}

await assertAnonDenied("menus");
await assertAnonDenied("menu_slots");
await assertAnonDenied("recipes");

console.log("All menu RLS anon checks passed");
