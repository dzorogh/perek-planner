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
 * Prefer just-invented recipes for this menu; else fresh; else full list.
 */
export function preferInventedCandidates<
  T extends { recipeId: string; recentlyUsed: boolean },
>(
  candidates: T[],
  inventedIds: ReadonlySet<string>,
  minNeeded: number,
): T[] {
  if (inventedIds.size > 0) {
    const invented = candidates.filter((c) => inventedIds.has(c.recipeId));
    if (invented.length >= Math.min(minNeeded, inventedIds.size)) {
      return invented.length >= minNeeded
        ? invented
        : [
          ...invented,
          ...candidates.filter((c) => !inventedIds.has(c.recipeId)),
        ];
    }
  }
  return preferFreshCandidates(candidates, minNeeded);
}
