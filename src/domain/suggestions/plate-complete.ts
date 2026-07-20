import {
  MEAL_SLOTS,
  mealAllowsCompanion,
  type MealSlot,
} from "@/domain/menu/constants";
import type { SuggestionCandidate } from "@/domain/suggestions/candidates";
import {
  isBreakfastMeal,
  looksLikeCompanionOnly,
  looksLikeHeavyAnimalProteinDish,
  looksLikeProteinDish,
} from "@/domain/suggestions/meal-fit";
import type {
  ProposedAssignment,
  SlotPrompt,
} from "@/domain/suggestions/openrouter-generate";

export type PlateKind = "complete" | "needs_companion";

export type PlateAssignment = ProposedAssignment & {
  plateKind?: PlateKind | null;
};

export type PickCompanionOptions = {
  /** When true, prefer (and require when possible) a protein add-on. */
  requireProtein?: boolean;
  /**
   * When true (protein main needing a side), never pick a second meat/fish
   * dish — only carb/veg/sauce companions.
   */
  forbidHeavyAnimal?: boolean;
};

/**
 * Apply AI plateKind to lunch/dinner/late_dinner, with a protein safety net:
 * - complete → no companion, but only if the main itself looks like protein
 * - needs_companion → keep AI companion when valid; fill if missing
 * - veg/carb main + veg/carb side is invalid — replace with a protein companion
 * - meat/fish main + meat/fish companion is invalid — replace with a side or clear
 * - no plateKind and protein main → leave alone (do not invent a side)
 * - no plateKind and protein-less main → force a protein companion
 * Structural only otherwise: same-day / breakfast-main reuse for companions.
 * Breakfast-family: companion always cleared.
 */
export function normalizePlateAssignments(
  slots: SlotPrompt[],
  proposals: PlateAssignment[],
  candidates: SuggestionCandidate[],
): ProposedAssignment[] {
  const mealBySlot = new Map(slots.map((s) => [s.slotId, s.meal]));
  const dayBySlot = new Map(slots.map((s) => [s.slotId, s.dayIndex]));
  const nameById = new Map(candidates.map((c) => [c.recipeId, c.name]));

  const usedCompanionIds = new Set<string>();
  for (const p of proposals) {
    if (p.companionRecipeId) usedCompanionIds.add(p.companionRecipeId);
  }

  // Don't reuse breakfast mains as lunch/dinner sides on the same menu.
  const breakfastMains = new Set<string>();
  for (const p of proposals) {
    const meal = mealBySlot.get(p.slotId);
    if (meal && isBreakfastMeal(meal)) breakfastMains.add(p.recipeId);
  }

  // Seed each day with every main on that day so lunch cannot "borrow"
  // dinner's protein (and vice versa) as a companion.
  const usedOnDay = new Map<number, Set<string>>();
  for (const p of proposals) {
    const day = dayBySlot.get(p.slotId);
    if (day == null) continue;
    const set = usedOnDay.get(day) ?? new Set<string>();
    set.add(p.recipeId);
    usedOnDay.set(day, set);
  }

  const ordered = [...proposals].sort((a, b) => {
    const dayA = dayBySlot.get(a.slotId) ?? 0;
    const dayB = dayBySlot.get(b.slotId) ?? 0;
    if (dayA !== dayB) return dayA - dayB;
    return mealOrderIndex(mealBySlot.get(a.slotId)) -
      mealOrderIndex(mealBySlot.get(b.slotId));
  });

  const outBySlot = new Map<string, ProposedAssignment>();
  for (const proposal of ordered) {
    const normalized = normalizePlateAssignment(
      proposal,
      mealBySlot,
      dayBySlot,
      candidates,
      nameById,
      usedCompanionIds,
      breakfastMains,
      usedOnDay,
    );
    outBySlot.set(proposal.slotId, normalized);
  }

  // Preserve caller order.
  return proposals.map(
    (p) =>
      outBySlot.get(p.slotId) ?? {
        slotId: p.slotId,
        recipeId: p.recipeId,
        companionRecipeId: null,
      },
  );
}

function normalizePlateAssignment(
  proposal: PlateAssignment,
  mealBySlot: ReadonlyMap<string, MealSlot>,
  dayBySlot: ReadonlyMap<string, number>,
  candidates: SuggestionCandidate[],
  nameById: ReadonlyMap<string, string>,
  usedCompanionIds: Set<string>,
  breakfastMains: ReadonlySet<string>,
  usedOnDay: Map<number, Set<string>>,
): ProposedAssignment {
  const meal = mealBySlot.get(proposal.slotId);
  const mainName = nameById.get(proposal.recipeId) ?? "";
  const mainHasProtein = looksLikeProteinDish(mainName);
  const mainIsHeavy = looksLikeHeavyAnimalProteinDish(mainName);
  if (
    !meal ||
    !mealAllowsCompanion(meal) ||
    resolvePlateKind(proposal, mainHasProtein) === "complete"
  ) {
    return {
      slotId: proposal.slotId,
      recipeId: proposal.recipeId,
      companionRecipeId: null,
    };
  }

  const day = dayBySlot.get(proposal.slotId);
  const dayUsed = day == null ? new Set<string>() : (usedOnDay.get(day) ?? new Set<string>());
  const avoidAsCompanion = new Set([...breakfastMains, ...dayUsed]);
  let companion = validRequestedCompanion(proposal, avoidAsCompanion, candidates);

  // Veg/carb main + veg/carb side (оладьи + морковный салат) is invalid.
  if (
    companion &&
    !mainHasProtein &&
    !looksLikeProteinDish(nameById.get(companion) ?? "")
  ) {
    companion = null;
  }

  // Meat/fish main + meat/fish companion (курица + рыба) is invalid.
  // Sauces stay allowed even if the name mentions a protein.
  if (
    companion &&
    mainIsHeavy &&
    looksLikeHeavyAnimalProteinDish(nameById.get(companion) ?? "") &&
    !looksLikeCompanionOnly(nameById.get(companion) ?? "")
  ) {
    companion = null;
  }

  if (!companion) {
    companion = pickCompanionCandidate(
      candidates,
      proposal.recipeId,
      usedCompanionIds,
      avoidAsCompanion,
      {
        requireProtein: !mainHasProtein,
        forbidHeavyAnimal: mainHasProtein,
      },
    );
  }

  recordCompanion(companion, day, usedCompanionIds, usedOnDay);
  return {
    slotId: proposal.slotId,
    recipeId: proposal.recipeId,
    companionRecipeId: companion,
  };
}

function validRequestedCompanion(
  proposal: PlateAssignment,
  avoidIds: ReadonlySet<string>,
  candidates: SuggestionCandidate[],
): string | null {
  const id = proposal.companionRecipeId;
  if (!id || id === proposal.recipeId || avoidIds.has(id)) return null;
  return candidates.some((candidate) => candidate.recipeId === id) ? id : null;
}

function recordCompanion(
  companion: string | null,
  day: number | undefined,
  usedCompanionIds: Set<string>,
  usedOnDay: Map<number, Set<string>>,
): void {
  if (!companion) return;
  usedCompanionIds.add(companion);
  if (day == null) return;
  const set = usedOnDay.get(day) ?? new Set<string>();
  set.add(companion);
  usedOnDay.set(day, set);
}

function mealOrderIndex(meal: MealSlot | undefined): number {
  if (!meal) return 99;
  const idx = MEAL_SLOTS.indexOf(meal);
  return idx >= 0 ? idx : 99;
}

/**
 * Culinary plateKind is the model's, except protein-less "complete" is never a meal.
 */
function resolvePlateKind(
  proposal: PlateAssignment,
  mainHasProtein: boolean,
): PlateKind {
  if (proposal.plateKind === "complete" && mainHasProtein) return "complete";
  if (proposal.plateKind === "needs_companion") return "needs_companion";
  // Explicit companion without plateKind → honor the pairing.
  if (proposal.companionRecipeId) return "needs_companion";
  // Protein-less main with no AI signal → invent a protein companion.
  if (!mainHasProtein) return "needs_companion";
  // Protein main, no AI signal → do not invent a side dish.
  return "complete";
}

/**
 * Structural fallback when the model asked for a companion but omitted the id.
 * Prefer unused candidates; never the main; avoid same-day / breakfast mains.
 * When requireProtein, prefer a protein add-on over another carb/veg side.
 * When forbidHeavyAnimal, never pick a second meat/fish dish (clear instead).
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
    const proteinCompanions = proteins.filter((c) => c.plateRole === "companion");
    const preferList =
      proteinCompanions.length > 0 ? proteinCompanions : proteins;
    return (prefer(preferList) ?? prefer(pool))?.recipeId ?? null;
  }

  const companions = pool.filter((c) => c.plateRole === "companion");
  const preferList = companions.length > 0 ? companions : pool;
  return prefer(preferList)?.recipeId ?? null;
}

export function parsePlateKind(raw: unknown): PlateKind | null {
  if (raw === "complete" || raw === "needs_companion") return raw;
  return null;
}

export function mealNeedsPlateKind(meal: MealSlot): boolean {
  return mealAllowsCompanion(meal);
}
