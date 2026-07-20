import {
  MEAL_SLOTS,
  mealAllowsCompanion,
  type MealSlot,
} from "@/domain/menu/constants";
import type { SuggestionCandidate } from "@/domain/suggestions/candidates";
import {
  isBreakfastMeal,
  looksLikeCompanionOnly,
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

/**
 * Ensure lunch/dinner/late_dinner plates are never "bare" and never protein-less:
 * - plateKind=complete only if the main itself looks like it has protein
 * - otherwise companion is filled; if main lacks protein, companion must supply it
 * - a recipe must not reappear as companion on a day where it is already used
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
    const meal = mealBySlot.get(proposal.slotId);
    if (!meal || !mealAllowsCompanion(meal)) {
      outBySlot.set(proposal.slotId, {
        slotId: proposal.slotId,
        recipeId: proposal.recipeId,
        companionRecipeId: null,
      });
      continue;
    }

    const day = dayBySlot.get(proposal.slotId);
    const dayUsed = day != null ? (usedOnDay.get(day) ?? new Set()) : new Set();
    const avoidAsCompanion = new Set<string>([
      ...breakfastMains,
      ...dayUsed,
    ]);

    const mainName = nameById.get(proposal.recipeId) ?? "";
    const mainHasProtein = looksLikeProteinDish(mainName);
    const kind = resolvePlateKind(proposal, mainHasProtein);

    if (kind === "complete") {
      outBySlot.set(proposal.slotId, {
        slotId: proposal.slotId,
        recipeId: proposal.recipeId,
        companionRecipeId: null,
      });
      continue;
    }

    let companion =
      proposal.companionRecipeId &&
        proposal.companionRecipeId !== proposal.recipeId &&
        !avoidAsCompanion.has(proposal.companionRecipeId) &&
        candidates.some((c) => c.recipeId === proposal.companionRecipeId)
        ? proposal.companionRecipeId
        : null;

    // Veg/carb main + veg/carb side (carrot cutlets + potatoes) is invalid.
    if (
      companion &&
      !mainHasProtein &&
      !looksLikeProteinDish(nameById.get(companion) ?? "")
    ) {
      companion = null;
    }

    if (!companion) {
      companion = pickCompanionCandidate(
        candidates,
        proposal.recipeId,
        usedCompanionIds,
        avoidAsCompanion,
        { requireProtein: !mainHasProtein },
      );
    }

    if (companion) {
      usedCompanionIds.add(companion);
      if (day != null) {
        const set = usedOnDay.get(day) ?? new Set<string>();
        set.add(companion);
        usedOnDay.set(day, set);
      }
    }

    outBySlot.set(proposal.slotId, {
      slotId: proposal.slotId,
      recipeId: proposal.recipeId,
      companionRecipeId: companion,
    });
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

function mealOrderIndex(meal: MealSlot | undefined): number {
  if (!meal) return 99;
  const idx = MEAL_SLOTS.indexOf(meal);
  return idx >= 0 ? idx : 99;
}

function resolvePlateKind(
  proposal: PlateAssignment,
  mainHasProtein: boolean,
): PlateKind {
  // Protein-less "complete" (овощные котлеты, картофель alone) is not a meal.
  if (proposal.plateKind === "complete" && mainHasProtein) return "complete";
  if (proposal.plateKind === "needs_companion") return "needs_companion";
  if (proposal.companionRecipeId) return "needs_companion";
  return "needs_companion";
}

export type PickCompanionOptions = {
  /** When true, prefer (and require when possible) a protein add-on. */
  requireProtein?: boolean;
};

/**
 * Prefer side/sauce-looking candidates, then unused ones.
 * When requireProtein, prefer protein dishes and never pick a non-protein side
 * if a protein candidate exists.
 * Never the main recipe itself; avoid breakfast mains / same-day dishes when provided.
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
  const pool =
    others.length > 0
      ? others
      : candidates.filter((c) => c.recipeId !== mainRecipeId);
  if (pool.length === 0) return null;

  const prefer = (list: SuggestionCandidate[]) => {
    if (list.length === 0) return null;
    const unused = list.find((c) => !alreadyUsed.has(c.recipeId));
    return unused ?? list[0] ?? null;
  };

  if (options.requireProtein) {
    const proteins = pool.filter((c) => looksLikeProteinDish(c.name));
    const picked = prefer(proteins) ?? prefer(pool);
    return picked?.recipeId ?? null;
  }

  const sides = pool.filter((c) => looksLikeCompanionOnly(c.name));
  return (prefer(sides) ?? prefer(pool))!.recipeId;
}

export function parsePlateKind(raw: unknown): PlateKind | null {
  if (raw === "complete" || raw === "needs_companion") return raw;
  return null;
}

export function mealNeedsPlateKind(meal: MealSlot): boolean {
  return mealAllowsCompanion(meal);
}
