/**
 * Shared anon RLS assertion: require explicit permission denial (not empty []).
 */

export function isPermissionDenied(err) {
  if (!err) return false;
  if (err.code === "42501") return true;
  return /permission denied|row-level security|rls/i.test(err.message ?? "");
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {string} table
 * @param {string} [migrationHint]
 */
export async function assertAnonDenied(client, table, migrationHint) {
  const { data, error } = await client.from(table).select("*").limit(1);

  if (error) {
    if (error.code === "PGRST205") {
      console.error(
        `Table public.${table} not found.${migrationHint ? ` ${migrationHint}` : ""}`,
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

  console.error(`FAIL: anon read ${table}`, { data, error });
  process.exit(1);
}
