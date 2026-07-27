import type { SupabaseClient } from "@supabase/supabase-js";

export type SuppressSets = {
  refusedIds: Set<string>;
};

/**
 * Load Refusal hard-suppress set.
 * Ratings (History / menu cook feedback) do not suppress.
 * Fail-closed: returns null when queries error (never empty-suppress bypass).
 */
export async function loadSuppressSets(
  supabase: SupabaseClient,
  userId: string,
): Promise<SuppressSets | null> {
  const refusedIds = new Set<string>();

  const refusalsRes = await supabase
    .from("recipe_refusals")
    .select("recipe_id")
    .eq("user_id", userId);

  if (refusalsRes.error) {
    return null;
  }

  for (const row of refusalsRes.data ?? []) {
    if (row.recipe_id) refusedIds.add(row.recipe_id);
  }

  return { refusedIds };
}

/** Pure: recipe hard-suppressed only when refused. */
export function isHardSuppressed(
  recipeId: string,
  sets: Pick<SuppressSets, "refusedIds">,
): boolean {
  return sets.refusedIds.has(recipeId);
}
