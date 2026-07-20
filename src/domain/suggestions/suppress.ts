import type { SupabaseClient } from "@supabase/supabase-js";

import type { RecipeRatingValue } from "@/domain/suggestions/constants";

export type SuppressSets = {
  refusedIds: Set<string>;
  dislikedIds: Set<string>;
  /** recipeId → rating (dislike excluded — those are in dislikedIds). */
  ratings: Map<string, Exclude<RecipeRatingValue, "dislike">>;
};

/**
 * Load Refusal + dislike Rating hard-suppress sets (AD-4).
 * Fail-closed: returns null when queries error (never empty-suppress bypass).
 */
export async function loadSuppressSets(
  supabase: SupabaseClient,
  userId: string,
): Promise<SuppressSets | null> {
  const refusedIds = new Set<string>();
  const dislikedIds = new Set<string>();
  const ratings = new Map<string, Exclude<RecipeRatingValue, "dislike">>();

  const [refusalsRes, ratingsRes] = await Promise.all([
    supabase
      .from("recipe_refusals")
      .select("recipe_id")
      .eq("user_id", userId),
    supabase
      .from("recipe_ratings")
      .select("recipe_id, rating")
      .eq("user_id", userId),
  ]);

  if (refusalsRes.error || ratingsRes.error) {
    return null;
  }

  for (const row of refusalsRes.data ?? []) {
    if (row.recipe_id) refusedIds.add(row.recipe_id);
  }

  for (const row of ratingsRes.data ?? []) {
    if (!row.recipe_id || !row.rating) continue;
    if (row.rating === "dislike") {
      dislikedIds.add(row.recipe_id);
    } else if (row.rating === "like" || row.rating === "medium") {
      ratings.set(row.recipe_id, row.rating);
    }
  }

  return { refusedIds, dislikedIds, ratings };
}

/** Pure: recipe hard-suppressed if refused or disliked. */
export function isHardSuppressed(
  recipeId: string,
  sets: Pick<SuppressSets, "refusedIds" | "dislikedIds">,
): boolean {
  return sets.refusedIds.has(recipeId) || sets.dislikedIds.has(recipeId);
}
