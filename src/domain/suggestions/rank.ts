import {
  RATING_WEIGHT,
  type RecipeRatingValue,
} from "@/domain/suggestions/constants";

export type RankableCandidate = {
  recipeId: string;
  name: string;
  fridgeKeepDays: number;
  longIdle: boolean;
  /** Appeared on one of the user's most recent menus — demote for cross-menu variety. */
  recentlyUsed: boolean;
  rating: RecipeRatingValue | "none";
  /** From invent persist; null/undefined = legacy/seed (treat as main-capable). */
  plateRole?: "main" | "companion" | null;
};

/**
 * Sort candidates: not-recently-used first, then long-idle, then rating, then name.
 * Deterministic for tests and stable LLM input order.
 */
export function rankCandidates(candidates: RankableCandidate[]): RankableCandidate[] {
  return [...candidates].sort((a, b) => {
    if (a.recentlyUsed !== b.recentlyUsed) {
      return a.recentlyUsed ? 1 : -1;
    }
    if (a.longIdle !== b.longIdle) {
      return a.longIdle ? -1 : 1;
    }
    const wa = RATING_WEIGHT[a.rating];
    const wb = RATING_WEIGHT[b.rating];
    if (wa !== wb) return wb - wa;
    return a.name.localeCompare(b.name, "ru");
  });
}

/** Pure weight helper for verify scripts. */
export function ratingWeight(rating: RecipeRatingValue | "none"): number {
  return RATING_WEIGHT[rating];
}

/**
 * Prefer a fresh pool (not on recent menus) when it is large enough for batching.
 * Otherwise fall back to the full ranked list.
 */
export function preferFreshCandidates<T extends { recentlyUsed: boolean }>(
  candidates: T[],
  minFresh: number,
): T[] {
  const fresh = candidates.filter((c) => !c.recentlyUsed);
  return fresh.length >= minFresh ? fresh : candidates;
}

/**
 * Restrict the assign pool to recipes invented in this generation.
 * Never fall back to the pre-existing library — cookable slots are AI-invented only.
 */
export function preferInventedCandidates<
  T extends { recipeId: string },
>(
  candidates: T[],
  inventedIds: ReadonlySet<string>,
): T[] {
  if (inventedIds.size === 0) return [];
  return candidates.filter((c) => inventedIds.has(c.recipeId));
}
