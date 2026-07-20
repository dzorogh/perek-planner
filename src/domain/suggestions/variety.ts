import { MEAL_SLOTS, type MealSlot } from "@/domain/menu/constants";
import type { SuggestionCandidate } from "@/domain/suggestions/candidates";
import { pickUnusedCandidate } from "@/domain/suggestions/dish-similarity";
import {
  isBreakfastMeal,
  isLunchDinnerMeal,
  isSuitableAsBreakfastMain,
  looksLikeBreakfastDish,
  looksLikeHeavyAnimalProteinDish,
  mainsForMeal,
} from "@/domain/suggestions/meal-fit";
import type {
  ProposedAssignment,
  SlotPrompt,
} from "@/domain/suggestions/openrouter-generate";

/** Share of cookable slots whose recipe appears on 2+ distinct days. */
export const MIN_BATCH_SLOT_RATIO = 0.5;

/**
 * True when every multi-day meal type uses the same recipe on every day
 * (full window clone). Single-day menus are never uniform.
 */
export function isMenuUniformAcrossDays(
  slots: SlotPrompt[],
  proposals: ProposedAssignment[],
): boolean {
  const bySlot = new Map(proposals.map((p) => [p.slotId, p.recipeId]));
  const days = sortedDayIndexes(slots);
  if (days.length < 2) return false;

  const byMeal = groupSlotsByMeal(slots);
  let sawMultiDayMeal = false;

  for (const mealSlots of byMeal.values()) {
    if (mealSlots.length < 2) continue;
    sawMultiDayMeal = true;
    const ids = mealSlots.map((s) => bySlot.get(s.slotId));
    if (ids.some((id) => id == null)) return false;
    const first = ids[0];
    if (ids.some((id) => id !== first)) return false;
  }

  return sawMultiDayMeal;
}

/** True when any two calendar days share the same meal→recipe map. */
export function hasDuplicateDayMenus(
  slots: SlotPrompt[],
  proposals: ProposedAssignment[],
): boolean {
  return findDuplicateDayPairFromMap(
    slots,
    new Map(proposals.map((p) => [p.slotId, p.recipeId])),
  ) != null;
}

/** True when the same main recipe appears in two meals of one calendar day. */
export function hasSameDayMainReuse(
  slots: SlotPrompt[],
  proposals: ProposedAssignment[],
): boolean {
  return findSameDayMainConflict(
    slots,
    new Map(proposals.map((p) => [p.slotId, p.recipeId])),
  ) != null;
}

/**
 * Fraction of assigned slots whose recipe spans 2+ distinct days.
 * Returns 1 when there are no assignments or only one calendar day.
 */
export function batchSlotRatio(
  slots: SlotPrompt[],
  proposals: ProposedAssignment[],
): number {
  const days = sortedDayIndexes(slots);
  if (days.length < 2) return 1;

  const bySlot = new Map(proposals.map((p) => [p.slotId, p.recipeId]));
  const recipeDays = new Map<string, Set<number>>();

  for (const slot of slots) {
    const recipeId = bySlot.get(slot.slotId);
    if (!recipeId) continue;
    const set = recipeDays.get(recipeId) ?? new Set<number>();
    set.add(slot.dayIndex);
    recipeDays.set(recipeId, set);
  }

  let total = 0;
  let batched = 0;
  for (const slot of slots) {
    const recipeId = bySlot.get(slot.slotId);
    if (!recipeId) continue;
    total += 1;
    if ((recipeDays.get(recipeId)?.size ?? 0) >= 2) batched += 1;
  }

  return total === 0 ? 1 : batched / total;
}

/**
 * Staggered batch fill: ~2/3 of slots are multi-day repeats, day signatures
 * stay distinct when 2+ candidates exist.
 */
export function assignWithBatchVariety(
  slots: SlotPrompt[],
  candidates: SuggestionCandidate[],
): ProposedAssignment[] {
  if (candidates.length === 0) return [];

  const byMeal = groupSlotsByMeal(slots);
  const mealOrder = [...byMeal.keys()];
  const out: ProposedAssignment[] = [];
  const usedIds = new Set<string>();
  const named = candidates.map((c) => ({
    recipeId: c.recipeId,
    name: c.name,
  }));

  const pickForMeal = (
    pool: { recipeId: string; name: string }[],
  ): { primary: string; secondary: string } => {
    const primary = pickUnusedCandidate(pool, usedIds) ?? pool[0]!;
    usedIds.add(primary.recipeId);

    const secondary =
      pickUnusedCandidate(pool, usedIds) ??
      pool.find((c) => c.recipeId !== primary.recipeId) ??
      pickUnusedCandidate(named, usedIds) ??
      named.find((c) => c.recipeId !== primary.recipeId) ??
      primary;
    if (secondary.recipeId !== primary.recipeId) {
      usedIds.add(secondary.recipeId);
    }
    return { primary: primary.recipeId, secondary: secondary.recipeId };
  };

  mealOrder.forEach((meal, mealIndex) => {
    assignMealBatch(
      byMeal.get(meal)!,
      meal,
      mealIndex,
      candidates.length,
      named,
      pickForMeal,
      out,
    );
  });

  return out;
}

function assignMealBatch(
  mealSlots: SlotPrompt[],
  meal: MealSlot,
  mealIndex: number,
  candidateCount: number,
  named: Array<{ recipeId: string; name: string }>,
  pickForMeal: (
    pool: { recipeId: string; name: string }[],
  ) => { primary: string; secondary: string },
  out: ProposedAssignment[],
): void {
  const pool = mainsForMeal(meal, named);
  if (pool.length === 0) return;
  const { primary, secondary } = pickForMeal(pool);
  for (let index = 0; index < mealSlots.length; index += 1) {
    const slot = mealSlots[index]!;
    out.push({
      slotId: slot.slotId,
      recipeId: selectBatchRecipeId(
        index, mealSlots.length, mealIndex, candidateCount, primary, secondary,
      ),
    });
  }
}

function selectBatchRecipeId(
  index: number,
  slotCount: number,
  mealIndex: number,
  candidateCount: number,
  primary: string,
  secondary: string,
): string {
  if (candidateCount < 2 || slotCount < 2) return primary;
  if (mealIndex % 2 === 0) return index === slotCount - 1 ? secondary : primary;
  return index === 0 ? primary : secondary;
}

/**
 * 1) Break identical calendar days.
 * 2) Raise multi-day batch coverage to MIN_BATCH_SLOT_RATIO when possible.
 * Falls back to deterministic batch pattern if LLM plan cannot meet the floor.
 */
export function enforceDayVariety(
  slots: SlotPrompt[],
  proposals: ProposedAssignment[],
  candidates: SuggestionCandidate[],
): ProposedAssignment[] {
  if (slots.length === 0) return proposals;

  const originalMain = new Map(proposals.map((p) => [p.slotId, p.recipeId]));
  const companions = new Map(
    proposals.map((p) => [p.slotId, p.companionRecipeId ?? null] as const),
  );
  const plateKinds = new Map(
    proposals.map((p) => [p.slotId, p.plateKind ?? null] as const),
  );

  const bySlot = new Map(proposals.map((p) => [p.slotId, p.recipeId]));
  const byMeal = groupSlotsByMeal(slots);
  const candidateIds = candidates.map((c) => c.recipeId);
  const nameById = new Map(candidates.map((c) => [c.recipeId, c.name]));

  breakDuplicateDays(slots, bySlot, byMeal, candidateIds, nameById);
  breakSameDayMainReuse(slots, bySlot, candidateIds, nameById);

  if (sortedDayIndexes(slots).length >= 2 && candidates.length >= 1) {
    raiseBatchRatio(slots, bySlot, byMeal);
    // Batching across days must not reintroduce same-day main clones.
    breakSameDayMainReuse(slots, bySlot, candidateIds, nameById);

    const current = toProposals(slots, bySlot);
    if (batchSlotRatio(slots, current) < MIN_BATCH_SLOT_RATIO) {
      const fallback = assignWithBatchVariety(slots, candidates);
      if (
        batchSlotRatio(slots, fallback) >= MIN_BATCH_SLOT_RATIO &&
        !hasDuplicateDayMenus(slots, fallback) &&
        !hasSameDayMainReuse(slots, fallback)
      ) {
        // Mains only — plate pairing stays with the AI assign step.
        return fallback.map((p) => ({
          ...p,
          companionRecipeId: null,
          plateKind: "complete" as const,
        }));
      }
    }
  }

  return toProposals(slots, bySlot).map((p) => {
    const mainUnchanged = originalMain.get(p.slotId) === p.recipeId;
    const companion = mainUnchanged
      ? (companions.get(p.slotId) ?? null)
      : null;
    const companionRecipeId =
      companion && companion !== p.recipeId ? companion : null;
    const plateKind = mainUnchanged
      ? (plateKinds.get(p.slotId) ?? null)
      : ("complete" as const);
    return { ...p, companionRecipeId, plateKind };
  });
}

/**
 * When meals include lunch/dinner and the pool has a heavy-animal main,
 * ensure at least one L/D slot uses it (variety may leave meat unused).
 */
export function ensureHeavyAnimalOnLunchDinner(
  slots: SlotPrompt[],
  proposals: ProposedAssignment[],
  candidates: SuggestionCandidate[],
): ProposedAssignment[] {
  const ldSlots = slots.filter((s) => isLunchDinnerMeal(s.meal));
  if (ldSlots.length === 0) return proposals;

  const nameById = new Map(candidates.map((c) => [c.recipeId, c.name]));
  const heavyPool = candidates.filter(
    (c) =>
      c.plateRole !== "companion" &&
      looksLikeHeavyAnimalProteinDish(c.name),
  );
  if (heavyPool.length === 0) return proposals;

  const alreadyPlaced = proposals.some((p) => {
    const slot = slots.find((s) => s.slotId === p.slotId);
    if (!slot || !isLunchDinnerMeal(slot.meal)) return false;
    return looksLikeHeavyAnimalProteinDish(nameById.get(p.recipeId) ?? "");
  });
  if (alreadyPlaced) return proposals;

  const bySlot = new Map(proposals.map((p) => [p.slotId, p.recipeId]));

  for (const heavy of heavyPool) {
    for (const slot of ldSlots) {
      const prev = bySlot.get(slot.slotId);
      bySlot.set(slot.slotId, heavy.recipeId);
      const trial = toProposals(slots, bySlot);
      if (
        !hasSameDayMainReuse(slots, trial) &&
        !hasDuplicateDayMenus(slots, trial)
      ) {
        return proposals.map((p) =>
          p.slotId === slot.slotId
            ? {
                ...p,
                recipeId: heavy.recipeId,
                companionRecipeId: null,
                plateKind: "complete" as const,
              }
            : p,
        );
      }
      if (prev == null) bySlot.delete(slot.slotId);
      else bySlot.set(slot.slotId, prev);
    }
  }

  // Last resort: place on first L/D slot even if day signature shifts.
  const fallbackSlot = ldSlots[0]!;
  const fallbackHeavy = heavyPool[0]!.recipeId;
  const forced = {
    slotId: fallbackSlot.slotId,
    recipeId: fallbackHeavy,
    companionRecipeId: null as string | null,
    plateKind: "complete" as const,
  };
  if (proposals.some((p) => p.slotId === fallbackSlot.slotId)) {
    return proposals.map((p) =>
      p.slotId === fallbackSlot.slotId ? { ...p, ...forced } : p,
    );
  }
  return [...proposals, forced];
}

function breakDuplicateDays(
  slots: SlotPrompt[],
  bySlot: Map<string, string>,
  byMeal: Map<MealSlot, SlotPrompt[]>,
  candidateIds: string[],
  nameById: ReadonlyMap<string, string>,
): void {
  if (candidateIds.length < 2) return;

  for (let guard = 0; guard < 12; guard++) {
    const pair = findDuplicateDayPairFromMap(slots, bySlot);
    if (!pair) break;

    const [, laterDay] = pair;
    const changed = diversifyDay(
      slots,
      bySlot,
      byMeal,
      laterDay,
      candidateIds,
      nameById,
    );
    if (!changed) break;
  }
}

/**
 * Same recipe as lunch and dinner on one day feels like a mistake.
 * Batching across days stays allowed; only within-day main clones are broken.
 */
function breakSameDayMainReuse(
  slots: SlotPrompt[],
  bySlot: Map<string, string>,
  candidateIds: string[],
  nameById: ReadonlyMap<string, string>,
): void {
  if (candidateIds.length < 2) return;

  for (let guard = 0; guard < 24; guard++) {
    const conflict = findSameDayMainConflict(slots, bySlot);
    if (!conflict) return;
    if (!resolveSameDayConflict(slots, bySlot, candidateIds, nameById, conflict)) {
      return;
    }
  }
}

function resolveSameDayConflict(
  slots: SlotPrompt[],
  bySlot: Map<string, string>,
  candidateIds: string[],
  nameById: ReadonlyMap<string, string>,
  conflict: { dayIndex: number; slotId: string },
): boolean {
  const current = bySlot.get(conflict.slotId);
  if (!current) return false;
  const used = idsUsedOnDay(slots, bySlot, conflict);
  const alternates = candidateIds.filter((id) => id !== current && !used.has(id));
  const options = alternates.length > 0
    ? alternates
    : candidateIds.filter((id) => id !== current);
  const meal = slots.find((slot) => slot.slotId === conflict.slotId)?.meal;
  for (const alternate of orderIdsForMeal(meal, options, nameById)) {
    bySlot.set(conflict.slotId, alternate);
    if (!findDuplicateDayPairFromMap(slots, bySlot) &&
      !dayHasSameDayMainReuse(slots, bySlot, conflict.dayIndex)) return true;
    bySlot.set(conflict.slotId, current);
  }
  return false;
}

function idsUsedOnDay(
  slots: SlotPrompt[],
  bySlot: Map<string, string>,
  conflict: { dayIndex: number; slotId: string },
): Set<string> {
  return new Set(
    slots
      .filter((slot) => slot.dayIndex === conflict.dayIndex && slot.slotId !== conflict.slotId)
      .map((slot) => bySlot.get(slot.slotId))
      .filter((id): id is string => Boolean(id)),
  );
}

/** Prefer breakfast-fit recipe ids when swapping a breakfast slot. */
function orderIdsForMeal(
  meal: MealSlot | undefined,
  ids: string[],
  nameById: ReadonlyMap<string, string>,
): string[] {
  if (!meal || !isBreakfastMeal(meal)) return ids;
  const score = (id: string): number => {
    const name = nameById.get(id) ?? "";
    if (looksLikeBreakfastDish(name)) return 0;
    if (isSuitableAsBreakfastMain(name)) return 1;
    return 2;
  };
  return [...ids].sort((a, b) => score(a) - score(b));
}

function findSameDayMainConflict(
  slots: SlotPrompt[],
  bySlot: Map<string, string>,
): { dayIndex: number; slotId: string } | null {
  for (const day of sortedDayIndexes(slots)) {
    const conflictSlotId = sameDayReuseSlotId(slots, bySlot, day);
    if (conflictSlotId) {
      return { dayIndex: day, slotId: conflictSlotId };
    }
  }
  return null;
}

function dayHasSameDayMainReuse(
  slots: SlotPrompt[],
  bySlot: Map<string, string>,
  dayIndex: number,
): boolean {
  return sameDayReuseSlotId(slots, bySlot, dayIndex) != null;
}

/** Later meal slot that repeats a main already used earlier that day. */
function sameDayReuseSlotId(
  slots: SlotPrompt[],
  bySlot: Map<string, string>,
  dayIndex: number,
): string | null {
  const daySlots = slots
    .filter((s) => s.dayIndex === dayIndex)
    .slice()
    .sort((a, b) => mealOrderIndex(a.meal) - mealOrderIndex(b.meal));

  const seen = new Set<string>();
  for (const slot of daySlots) {
    const recipeId = bySlot.get(slot.slotId);
    if (!recipeId) continue;
    if (seen.has(recipeId)) return slot.slotId;
    seen.add(recipeId);
  }
  return null;
}
function mealOrderIndex(meal: MealSlot): number {
  const idx = MEAL_SLOTS.indexOf(meal);
  return idx >= 0 ? idx : 99;
}

/**
 * Extend recipes across adjacent days within the same meal until batch ratio
 * reaches the floor, without creating duplicate calendar days.
 */
function raiseBatchRatio(
  slots: SlotPrompt[],
  bySlot: Map<string, string>,
  byMeal: Map<MealSlot, SlotPrompt[]>,
): void {
  for (let guard = 0; guard < 24; guard++) {
    const current = toProposals(slots, bySlot);
    if (batchSlotRatio(slots, current) >= MIN_BATCH_SLOT_RATIO) return;
    if (!extendOneBatch(slots, bySlot, byMeal)) return;
  }
}

function extendOneBatch(
  slots: SlotPrompt[],
  bySlot: Map<string, string>,
  byMeal: Map<MealSlot, SlotPrompt[]>,
): boolean {
  for (const mealSlots of byMeal.values()) {
    if (tryExtendMealBatch(slots, bySlot, mealSlots)) return true;
  }
  return false;
}

function tryExtendMealBatch(
  slots: SlotPrompt[],
  bySlot: Map<string, string>,
  mealSlots: SlotPrompt[],
): boolean {
  for (let index = 0; index < mealSlots.length - 1; index += 1) {
    const left = mealSlots[index]!;
    const right = mealSlots[index + 1]!;
    const leftId = bySlot.get(left.slotId);
    const rightId = bySlot.get(right.slotId);
    if (!leftId || !rightId || leftId === rightId) continue;
    if (trySetRecipe(slots, bySlot, right.slotId, leftId)) return true;
    if (trySetRecipe(slots, bySlot, left.slotId, rightId)) return true;
  }
  return false;
}

function trySetRecipe(
  slots: SlotPrompt[],
  bySlot: Map<string, string>,
  slotId: string,
  recipeId: string,
): boolean {
  const prev = bySlot.get(slotId);
  if (prev === recipeId) return false;
  bySlot.set(slotId, recipeId);
  if (findDuplicateDayPairFromMap(slots, bySlot)) {
    if (prev == null) bySlot.delete(slotId);
    else bySlot.set(slotId, prev);
    return false;
  }
  return true;
}

function diversifyDay(
  slots: SlotPrompt[],
  bySlot: Map<string, string>,
  byMeal: Map<MealSlot, SlotPrompt[]>,
  dayIndex: number,
  candidateIds: string[],
  nameById: ReadonlyMap<string, string>,
): boolean {
  const daySlots = slots
    .filter((s) => s.dayIndex === dayIndex)
    .sort((a, b) => a.meal.localeCompare(b.meal));

  // Prefer changing a meal that is currently a full-window clone, then any meal.
  const ordered = [...daySlots].sort((a, b) => {
    const aClone = isMealUniform(byMeal.get(a.meal) ?? [], bySlot) ? 0 : 1;
    const bClone = isMealUniform(byMeal.get(b.meal) ?? [], bySlot) ? 0 : 1;
    return aClone - bClone;
  });

  for (const slot of ordered) {
    const current = bySlot.get(slot.slotId);
    if (!current) continue;

    const siblingIds = new Set(
      (byMeal.get(slot.meal) ?? [])
        .filter((s) => s.slotId !== slot.slotId)
        .map((s) => bySlot.get(s.slotId))
        .filter((id): id is string => !!id),
    );

    // Prefer an already-used sibling recipe to preserve batching, else any other.
    // For breakfast, never jump to roast chicken / soup when a morning dish exists.
    const siblingAlt = orderIdsForMeal(
      slot.meal,
      [...siblingIds].filter((id) => id !== current),
      nameById,
    )[0];
    const poolAlt = orderIdsForMeal(
      slot.meal,
      candidateIds.filter((id) => id !== current),
      nameById,
    )[0];
    const alternate = siblingAlt ?? poolAlt;

    if (!alternate) continue;

    bySlot.set(slot.slotId, alternate);
    // Only reject if THIS day still mirrors another day (other pairs may remain).
    if (dayStillDuplicated(slots, bySlot, dayIndex)) {
      bySlot.set(slot.slotId, current);
      continue;
    }
    return true;
  }

  return false;
}

function dayStillDuplicated(
  slots: SlotPrompt[],
  bySlot: Map<string, string>,
  dayIndex: number,
): boolean {
  const sig = daySignature(dayIndex, slots, bySlot);
  if (!sig) return false;
  for (const day of sortedDayIndexes(slots)) {
    if (day === dayIndex) continue;
    if (daySignature(day, slots, bySlot) === sig) return true;
  }
  return false;
}

function isMealUniform(
  mealSlots: SlotPrompt[],
  bySlot: Map<string, string>,
): boolean {
  if (mealSlots.length < 2) return false;
  const ids = mealSlots.map((s) => bySlot.get(s.slotId));
  if (ids.some((id) => id == null)) return false;
  return ids.every((id) => id === ids[0]);
}

function findDuplicateDayPairFromMap(
  slots: SlotPrompt[],
  bySlot: Map<string, string>,
): [number, number] | null {
  const days = sortedDayIndexes(slots);
  if (days.length < 2) return null;

  const signatures = new Map<number, string>();
  for (const day of days) {
    signatures.set(day, daySignature(day, slots, bySlot));
  }

  for (let i = 0; i < days.length; i++) {
    for (let j = i + 1; j < days.length; j++) {
      const a = days[i]!;
      const b = days[j]!;
      const sigA = signatures.get(a);
      const sigB = signatures.get(b);
      if (sigA && sigB && sigA === sigB) return [a, b];
    }
  }
  return null;
}

function daySignature(
  dayIndex: number,
  slots: SlotPrompt[],
  bySlot: Map<string, string>,
): string {
  return slots
    .filter((s) => s.dayIndex === dayIndex)
    .slice()
    .sort((a, b) => a.meal.localeCompare(b.meal))
    .map((s) => `${s.meal}:${bySlot.get(s.slotId) ?? ""}`)
    .join("|");
}

function sortedDayIndexes(slots: SlotPrompt[]): number[] {
  return [...new Set(slots.map((s) => s.dayIndex))].sort((a, b) => a - b);
}

function groupSlotsByMeal(
  slots: SlotPrompt[],
): Map<MealSlot, SlotPrompt[]> {
  const map = new Map<MealSlot, SlotPrompt[]>();
  for (const slot of slots) {
    const list = map.get(slot.meal) ?? [];
    list.push(slot);
    map.set(slot.meal, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.dayIndex - b.dayIndex);
  }
  return map;
}

function toProposals(
  slots: SlotPrompt[],
  bySlot: Map<string, string>,
): ProposedAssignment[] {
  return slots
    .filter((s) => bySlot.has(s.slotId))
    .map((s) => ({ slotId: s.slotId, recipeId: bySlot.get(s.slotId)! }));
}
