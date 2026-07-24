import {
  mealAllowsCompanion,
  type MealSlot,
} from "@/domain/menu/constants";
import type { PlateRole } from "@/domain/menu/meal-templates";
import type { SuggestionCandidate } from "@/domain/suggestions/candidates";
import {
  looksLikeCompanionOnly,
  looksLikeHeavyAnimalProteinDish,
  looksLikeProteinDish,
} from "@/domain/suggestions/meal-fit";
import type {
  ProposedAssignment,
  SlotPrompt,
} from "@/domain/suggestions/openrouter-generate";
import { legacyFksFromDishes } from "@/domain/suggestions/role-slots";

export type PlateKind = "complete" | "needs_companion";

export type PlateAssignment = ProposedAssignment;

export type PickCompanionOptions = {
  requireProtein?: boolean;
  forbidHeavyAnimal?: boolean;
};

/**
 * Normalize proposals to dishes[] (+ legacy FK shim).
 * Legacy recipeId/companion → dishes; dishes[] pass through (identity).
 */
export function normalizePlateAssignments(
  slots: SlotPrompt[],
  proposals: PlateAssignment[],
): ProposedAssignment[] {
  const mealBySlot = new Map(slots.map((s) => [s.slotId, s.meal]));
  return proposals.map((p) => normalizeOne(p, mealBySlot.get(p.slotId)));
}

function normalizeOne(
  proposal: PlateAssignment,
  meal: MealSlot | undefined,
): ProposedAssignment {
  if (proposal.dishes?.length) {
    const fks = legacyFksFromDishes(proposal.dishes);
    return {
      slotId: proposal.slotId,
      dishes: proposal.dishes,
      recipeId: fks.recipeId ?? proposal.recipeId ?? proposal.dishes[0]!.recipeId,
      companionRecipeId: fks.companionRecipeId,
    };
  }

  const recipeId = proposal.recipeId;
  if (!recipeId) {
    return { slotId: proposal.slotId, dishes: [], recipeId: "", companionRecipeId: null };
  }

  const dishes = legacyPairToDishes(
    meal,
    recipeId,
    proposal.companionRecipeId ?? null,
  );
  const fks = legacyFksFromDishes(dishes);
  return {
    slotId: proposal.slotId,
    dishes,
    recipeId: fks.recipeId ?? recipeId,
    companionRecipeId: fks.companionRecipeId,
  };
}

function legacyPairToDishes(
  meal: MealSlot | undefined,
  recipeId: string,
  companionRecipeId: string | null,
): Array<{ plateRole: PlateRole; recipeId: string }> {
  if (!meal || !mealAllowsCompanion(meal)) {
    return [{ plateRole: "main", recipeId }];
  }
  const out: Array<{ plateRole: PlateRole; recipeId: string }> = [
    { plateRole: "protein", recipeId },
  ];
  if (companionRecipeId && companionRecipeId !== recipeId) {
    out.push({ plateRole: "carb", recipeId: companionRecipeId });
  }
  return out;
}

/**
 * Structural fallback when a side id is missing (legacy paths / deterministic fill).
 */
export function pickCompanionCandidate(
  candidates: SuggestionCandidate[],
  mainRecipeId: string,
  alreadyUsed: ReadonlySet<string> = new Set(),
  avoidIds: ReadonlySet<string> = new Set(),
  options: PickCompanionOptions = {},
): string | null {
  const others = candidates.filter(
    (c) => c.recipeId !== mainRecipeId && !avoidIds.has(c.recipeId),
  );
  let pool =
    others.length > 0
      ? others
      : candidates.filter((c) => c.recipeId !== mainRecipeId);
  if (options.forbidHeavyAnimal) {
    pool = pool.filter(
      (c) =>
        looksLikeCompanionOnly(c.name) ||
        !looksLikeHeavyAnimalProteinDish(c.name),
    );
  }
  if (pool.length === 0) return null;

  const prefer = (list: SuggestionCandidate[]) => {
    if (list.length === 0) return null;
    const unused = list.find((c) => !alreadyUsed.has(c.recipeId));
    return unused ?? list[0] ?? null;
  };

  if (options.requireProtein) {
    const proteins = pool.filter((c) => looksLikeProteinDish(c.name));
    const proteinSides = proteins.filter(
      (c) => c.plateRole === "carb" || c.plateRole === "companion" || c.plateRole === "protein",
    );
    const preferList = proteinSides.length > 0 ? proteinSides : proteins;
    return (prefer(preferList) ?? prefer(pool))?.recipeId ?? null;
  }

  const sides = pool.filter(
    (c) =>
      c.plateRole === "carb" ||
      c.plateRole === "veg" ||
      c.plateRole === "companion",
  );
  const preferList = sides.length > 0 ? sides : pool;
  return prefer(preferList)?.recipeId ?? null;
}

export function parsePlateKind(raw: unknown): PlateKind | null {
  if (raw === "complete" || raw === "needs_companion") return raw;
  return null;
}

export function mealNeedsPlateKind(meal: MealSlot): boolean {
  return mealAllowsCompanion(meal);
}
