/**
 * Code-owned meal templates (AD-12 / Story 6.1).
 * AI invent fills these roles — it does not invent meal architecture.
 */

export const PLATE_ROLES = [
  "main",
  "soup",
  "protein",
  "veg",
  "carb",
  "snack",
] as const;

export type PlateRole = (typeof PLATE_ROLES)[number];

/** Meal keys that have a template (incl. Перекус snack). */
export const TEMPLATE_MEALS = [
  "breakfast",
  "second_breakfast",
  "lunch",
  "afternoon_snack",
  "dinner",
  "late_dinner",
  "snack",
] as const;

export type TemplateMeal = (typeof TEMPLATE_MEALS)[number];

export const MEAL_TEMPLATES: Record<TemplateMeal, readonly PlateRole[]> = {
  breakfast: ["main"],
  second_breakfast: ["main"],
  afternoon_snack: ["main"],
  lunch: ["soup", "protein", "veg", "carb"],
  dinner: ["protein", "veg", "carb"],
  late_dinner: ["protein", "veg", "carb"],
  snack: ["snack"],
};

export function isPlateRole(value: string): value is PlateRole {
  return (PLATE_ROLES as readonly string[]).includes(value);
}

export function isTemplateMeal(value: string): value is TemplateMeal {
  return (TEMPLATE_MEALS as readonly string[]).includes(value);
}

export function rolesForMeal(meal: TemplateMeal): readonly PlateRole[] {
  return MEAL_TEMPLATES[meal];
}

/**
 * Roles still needing a Slot dish after a multi-role recipe covers some.
 * Covered roles are removed from the template order; order of remaining is preserved.
 */
export function openRolesAfterCovers(
  templateRoles: readonly PlateRole[],
  coversRoles: readonly PlateRole[] | null | undefined,
): PlateRole[] {
  if (!coversRoles?.length) return [...templateRoles];
  const covered = new Set(coversRoles);
  return templateRoles.filter((r) => !covered.has(r));
}

/** Sort index for a role within a meal template (−1 if not in template). */
export function sortOrderForRole(
  meal: TemplateMeal,
  role: PlateRole,
): number {
  return MEAL_TEMPLATES[meal].indexOf(role);
}
