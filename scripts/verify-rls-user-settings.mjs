/**
 * Smoke-proof Story 1.2 RLS after migration is applied.
 * Usage: node --env-file=.env.local scripts/verify-rls-user-settings.mjs
 *
 * PASS only when anon gets an explicit permission/RLS denial.
 * Empty `[]` without error is FAIL (cannot distinguish open SELECT on empty table).
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

const anon = createClient(url, key);

const { data, error } = await anon.from("user_settings").select("*");

function isPermissionDenied(err) {
  if (!err) return false;
  if (err.code === "42501") return true;
  return /permission denied|row-level security|rls/i.test(err.message ?? "");
}

if (error) {
  console.log("anon_select_error:", error.code, error.message);
  if (error.code === "PGRST205") {
    console.error(
      "Table public.user_settings not found. Apply supabase/migrations/20260720010000_user_settings_rls.sql first.",
    );
    process.exit(2);
  }
  if (isPermissionDenied(error)) {
    console.log("PASS: anon/unauthenticated cannot read user_settings");
    process.exit(0);
  }
  console.error(
    "FAIL: unexpected anon error (not a permission/RLS deny):",
    error.code,
    error.message,
  );
  process.exit(1);
}

if (Array.isArray(data) && data.length === 0) {
  console.error(
    "FAIL: anon select returned zero rows without error — cannot prove RLS deny (table may be empty with open SELECT).",
  );
  process.exit(1);
}

console.error("FAIL: anon unexpectedly read rows:", data);
process.exit(1);
