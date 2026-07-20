import {
  MEAL_SLOTS,
  mealAllowsCompanion,
  type MealSlot,
} from "@/domain/menu/constants";
import type { SuggestionCandidate } from "@/domain/suggestions/candidates";
import { isBreakfastMeal } from "@/domain/suggestions/meal-fit";
import type {
  ProposedAssignment,
  SlotPrompt,
} from "@/domain/suggestions/openrouter-generate";

export type PlateKind = "complete" | "needs_companion";

export type PlateAssignment = ProposedAssignment & {
  plateKind?: PlateKind | null;
};

/**
 * Apply AI plateKind to lunch/dinner/late_dinner:
 * - complete → no companion (trust the model; strip accidental companion ids)
 * - needs_companion → keep AI companion when valid; fill only if missing
 * - no plateKind and no companion → leave alone (do not invent a side)
 * Structural only: same-day / breakfast-main reuse for companions.
 * Breakfast-family: companion always cleared.
 */
export function normalizePlateAssignments(
  slots: SlotPrompt[],
  proposals: PlateAssignment[],
  candidates: SuggestionCandidate[],
): ProposedAssignment[] {
  const mealBySlot = new Map(slots.map((s) => [s.slotId, s.meal]));
  const dayBySlot = new Map(slots.map((s) => [s.slotId, s.dayIndex]));

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

    const kind = resolvePlateKind(proposal);

    if (kind === "complete") {
      outBySlot.set(proposal.slotId, {
        slotId: proposal.slotId,
        recipeId: proposal.recipeId,
        companionRecipeId: null,
      });
      continue;
    }

    const day = dayBySlot.get(proposal.slotId);
    const dayUsed =
      day != null ? (usedOnDay.get(day) ?? new Set<string>()) : new Set<string>();
    const avoidAsCompanion = new Set<string>([
      ...breakfastMains,
      ...dayUsed,
    ]);

    let companion =
      proposal.companionRecipeId &&
        proposal.companionRecipeId !== proposal.recipeId &&
        !avoidAsCompanion.has(proposal.companionRecipeId) &&
        candidates.some((c) => c.recipeId === proposal.companionRecipeId)
        ? proposal.companionRecipeId
        : null;

    if (!companion) {
      companion = pickCompanionCandidate(
        candidates,
        proposal.recipeId,
        usedCompanionIds,
        avoidAsCompanion,
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

/** Culinary judgment is the model's — code only applies the declared plateKind. */
function resolvePlateKind(proposal: PlateAssignment): PlateKind {
  if (proposal.plateKind === "complete") return "complete";
  if (proposal.plateKind === "needs_companion") return "needs_companion";
  // Explicit companion without plateKind → honor the pairing.
  if (proposal.companionRecipeId) return "needs_companion";
  // No AI signal → do not invent a side dish.
  return "complete";
}

/**
 * Structural fallback when the model asked for a companion but omitted the id.
 * Prefer unused candidates; never the main; avoid same-day / breakfast mains.
 * No name-keyword culinary filters — pairing judgment stays with the AI.
 */
export function pickCompanionCandidate(
  candidates: SuggestionCandidate[],
  mainRecipeId: string,
  alreadyUsed: ReadonlySet<string> = new Set(),
  avoidIds: ReadonlySet<string> = new Set(),
): string | null {
  const others = candidates.filter(
    (c) => c.recipeId !== mainRecipeId && !avoidIds.has(c.recipeId),
  );
  const pool =
    others.length > 0
      ? others
      : candidates.filter((c) => c.recipeId !== mainRecipeId);
  if (pool.length === 0) return null;

  const unused = pool.find((c) => !alreadyUsed.has(c.recipeId));
  return (unused ?? pool[0])?.recipeId ?? null;
}

export function parsePlateKind(raw: unknown): PlateKind | null {
  if (raw === "complete" || raw === "needs_companion") return raw;
  return null;
}

export function mealNeedsPlateKind(meal: MealSlot): boolean {
  return mealAllowsCompanion(meal);
}
