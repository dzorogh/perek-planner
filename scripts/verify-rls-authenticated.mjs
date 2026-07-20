/**
 * Authenticated RLS positive checks + anon INSERT deny.
 * Usage: node --env-file=.env.local scripts/verify-rls-authenticated.mjs
 *
 * Requires SMOKE_OPERATOR_EMAIL / SMOKE_OPERATOR_PASSWORD (or E2E_* aliases).
 * Cross-user A↛B isolation needs a second operator account — skipped with a note
 * when SMOKE_OPERATOR_B_* is unset.
 */

import { createClient } from "@supabase/supabase-js";

import { isPermissionDenied } from "./lib/assert-anon-denied.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const email =
  process.env.SMOKE_OPERATOR_EMAIL?.trim() ||
  process.env.E2E_OPERATOR_EMAIL?.trim() ||
  "";
const password =
  process.env.SMOKE_OPERATOR_PASSWORD?.trim() ||
  process.env.E2E_OPERATOR_PASSWORD?.trim() ||
  "";

if (!url || !anonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or publishable key");
  process.exit(1);
}
if (!email || !password) {
  console.log(
    "SKIP: authenticated RLS (set SMOKE_OPERATOR_EMAIL/PASSWORD or E2E_* to enable)",
  );
  process.exit(0);
}

const anon = createClient(url, anonKey);
const authed = createClient(url, anonKey);

const { error: signInError } = await authed.auth.signInWithPassword({
  email,
  password,
});
if (signInError) {
  console.error("FAIL: signInWithPassword", signInError.message);
  process.exit(1);
}

const {
  data: { user },
} = await authed.auth.getUser();
if (!user) {
  console.error("FAIL: no user after sign-in");
  process.exit(1);
}
console.log("PASS: operator signed in");

const { data: ownMenus, error: menusError } = await authed
  .from("menus")
  .select("id")
  .eq("user_id", user.id)
  .limit(5);
if (menusError) {
  console.error("FAIL: operator cannot select own menus", menusError.message);
  process.exit(1);
}
console.log("PASS: operator can select own menus", `(${ownMenus?.length ?? 0})`);

const { data: taste, error: tasteError } = await authed
  .from("taste_preferences")
  .select("id")
  .eq("user_id", user.id)
  .limit(5);
if (tasteError) {
  console.error("FAIL: operator cannot select taste_preferences", tasteError.message);
  process.exit(1);
}
console.log(
  "PASS: operator can select taste_preferences",
  `(${taste?.length ?? 0})`,
);

function anonInsertPayload(table) {
  if (table === "taste_preferences") {
    return { kind: "ban", body: "anon-should-fail" };
  }
  if (table === "snack_ratings") {
    return { label: "anon-should-fail", rating: "like" };
  }
  if (table === "recipe_ratings") {
    return {
      recipe_id: "00000000-0000-0000-0000-000000000000",
      rating: "like",
    };
  }
  return {
    recipe_id: "00000000-0000-0000-0000-000000000000",
    comment: "anon-should-fail",
  };
}

// Anon INSERT deny on refusals / ratings / taste_preferences
for (const table of [
  "recipe_refusals",
  "recipe_ratings",
  "taste_preferences",
  "snack_ratings",
]) {
  const { error } = await anon.from(table).insert({
    user_id: "00000000-0000-0000-0000-000000000000",
    ...anonInsertPayload(table),
  });
  if (!error || !isPermissionDenied(error)) {
    console.error(
      `FAIL: anon insert on ${table} not denied`,
      error?.code,
      error?.message,
    );
    process.exit(1);
  }
  console.log(`PASS: anon cannot insert ${table}`);
}

const emailB =
  process.env.SMOKE_OPERATOR_B_EMAIL?.trim() ||
  process.env.E2E_OPERATOR_B_EMAIL?.trim() ||
  "";
const passwordB =
  process.env.SMOKE_OPERATOR_B_PASSWORD?.trim() ||
  process.env.E2E_OPERATOR_B_PASSWORD?.trim() ||
  "";

if (!emailB || !passwordB) {
  console.log(
    "SKIP: cross-user A↛B (set SMOKE_OPERATOR_B_EMAIL/PASSWORD to enable)",
  );
} else if (ownMenus?.length) {
  const other = createClient(url, anonKey);
  const { error: bSignIn } = await other.auth.signInWithPassword({
    email: emailB,
    password: passwordB,
  });
  if (bSignIn) {
    console.error("FAIL: operator B sign-in", bSignIn.message);
    process.exit(1);
  }
  const menuId = ownMenus[0].id;
  const { data: leaked, error: leakError } = await other
    .from("menus")
    .select("id")
    .eq("id", menuId)
    .maybeSingle();
  if (leakError && isPermissionDenied(leakError)) {
    console.log("PASS: operator B cannot read A menu (error deny)");
  } else if (!leaked) {
    console.log("PASS: operator B cannot read A menu (empty)");
  } else {
    console.error("FAIL: operator B read A menu", leaked);
    process.exit(1);
  }
}

await authed.auth.signOut();
console.log("All authenticated RLS checks passed");
