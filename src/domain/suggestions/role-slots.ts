/**
 * Code-emitted Plate role slots for invent/assign (Story 6.2 / AD-12).
 * AI fills recipe content for these roles — it does not invent meal architecture.
 */

import type { MealSlot, MenuDayPair } from "@/domain/menu/constants";
import {
  isPlateRole,
  isTemplateMeal,
  openRolesAfterCovers,
  rolesForMeal,
  type PlateRole,
  type TemplateMeal,
} from "@/domain/menu/meal-templates";

export type RoleSlot = {
  meal: TemplateMeal;
  dayPair: MenuDayPair;
  plateRole: PlateRole;
};

export type SlotDishAssignment = {
  plateRole: PlateRole;
  recipeId: string;
};

/** Emit invent targets for cookable template meals (never snack / Перекус). */
export function emitRoleSlots(
  meals: readonly string[],
  dayPairs: readonly MenuDayPair[],
  priorCoversByKey?: ReadonlyMap<string, readonly PlateRole[]>,
): RoleSlot[] {
  const out: RoleSlot[] = [];
  for (const dayPair of dayPairs) {
    for (const meal of meals) {
      if (!isTemplateMeal(meal) || meal === "snack") continue;
      const key = mealDayPairKey(meal, dayPair);
      const open = openRolesAfterCovers(
        rolesForMeal(meal),
        priorCoversByKey?.get(key),
      );
      for (const plateRole of open) {
        out.push({ meal, dayPair, plateRole });
      }
    }
  }
  return out;
}

export function mealDayPairKey(
  meal: string,
  dayPair: MenuDayPair,
): string {
  return `${meal}:${dayPair[0]}-${dayPair[1]}`;
}

export function roleSlotKey(
  s: Pick<RoleSlot, "meal" | "dayPair" | "plateRole">,
): string {
  return `${s.meal}:${s.dayPair[0]}-${s.dayPair[1]}:${s.plateRole}`;
}

/** Parse covers_roles from invent/plan JSON. */
export function parseCoversRoles(raw: unknown): PlateRole[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: PlateRole[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !isPlateRole(item)) continue;
    if (item === "snack") continue;
    if (!out.includes(item)) out.push(item);
  }
  return out.length > 0 ? out : null;
}

/** Keep only covers that exist on the meal template. */
export function filterCoversToMeal(
  meal: TemplateMeal,
  covers: readonly PlateRole[] | null | undefined,
): PlateRole[] | null {
  if (!covers?.length) return null;
  const template = new Set(rolesForMeal(meal));
  const out = covers.filter((r) => template.has(r));
  return out.length > 0 ? out : null;
}

export function parseCoversRolesForMeal(
  meal: TemplateMeal,
  raw: unknown,
): PlateRole[] | null {
  return filterCoversToMeal(meal, parseCoversRoles(raw));
}

/**
 * After dishes declare coversRoles, roles still needing a separate invent entry.
 * Primary plateRole of each dish is treated as filled even if not listed in covers.
 * Out-of-template cover claims are ignored.
 */
export function remainingOpenRoles(
  meal: TemplateMeal,
  dishes: ReadonlyArray<{ plateRole: PlateRole; coversRoles?: PlateRole[] | null }>,
): PlateRole[] {
  const template = new Set(rolesForMeal(meal));
  const covered = new Set<PlateRole>();
  for (const d of dishes) {
    if (template.has(d.plateRole)) covered.add(d.plateRole);
    for (const r of filterCoversToMeal(meal, d.coversRoles) ?? []) {
      covered.add(r);
    }
  }
  return openRolesAfterCovers(rolesForMeal(meal), [...covered]);
}

/** Merge invent/replace rows with existing slot dishes (incoming roles win). */
export function mergeDishAssignments(
  existing: ReadonlyArray<SlotDishAssignment>,
  incoming: ReadonlyArray<SlotDishAssignment>,
): SlotDishAssignment[] {
  const incomingRoles = new Set(incoming.map((d) => d.plateRole));
  const kept = existing.filter((d) => !incomingRoles.has(d.plateRole));
  return [...kept, ...incoming];
}

/** Legacy menu_slots FK shim until Story 6.3 UI reads dishes only. */
export function legacyFksFromDishes(dishes: ReadonlyArray<SlotDishAssignment>): {
  recipeId: string | null;
  companionRecipeId: string | null;
} {
  const by = new Map(dishes.map((d) => [d.plateRole, d.recipeId]));
  const recipeId =
    by.get("protein") ?? by.get("main") ?? dishes[0]?.recipeId ?? null;
  const carbId = by.get("carb") ?? null;
  // One-pot covers protein+carb with the same recipe — DB forbids companion=main.
  const companionRecipeId =
    carbId && recipeId && carbId !== recipeId ? carbId : null;
  return { recipeId, companionRecipeId };
}

/** Expand one recipe id across its primary role + covers into dish rows. */
export function expandDishAssignments(
  plateRole: PlateRole,
  recipeId: string,
  coversRoles: readonly PlateRole[] | null | undefined,
): SlotDishAssignment[] {
  const roles = new Set<PlateRole>([plateRole, ...(coversRoles ?? [])]);
  return [...roles].map((r) => ({ plateRole: r, recipeId }));
}

/**
 * Expand covers into dish rows, keeping only roles that exist on the meal template.
 * Drops hallucinated breakfast covers like protein/veg/carb on plate_role=main.
 */
export function expandDishAssignmentsForMeal(
  meal: TemplateMeal,
  plateRole: PlateRole,
  recipeId: string,
  coversRoles: readonly PlateRole[] | null | undefined,
): SlotDishAssignment[] {
  const template = new Set(rolesForMeal(meal));
  if (!template.has(plateRole)) return [];
  const covers = filterCoversToMeal(meal, coversRoles);
  return expandDishAssignments(plateRole, recipeId, covers).filter((row) =>
    template.has(row.plateRole),
  );
}

export function isCookableTemplateMeal(meal: MealSlot): meal is TemplateMeal {
  return isTemplateMeal(meal) && meal !== "snack";
}
