/**
 * Pure plate-composition helpers for Harvard / soup templates (Story 6.1).
 */

import {
  MEAL_TEMPLATES,
  openRolesAfterCovers,
  type PlateRole,
  type TemplateMeal,
  rolesForMeal,
} from "@/domain/menu/meal-templates";

const HARVARD_SECOND: readonly PlateRole[] = ["protein", "veg", "carb"];

export function lunchRequiresSoup(meal: TemplateMeal): boolean {
  return meal === "lunch";
}

export function isHarvardSecondCourseMeal(meal: TemplateMeal): boolean {
  return meal === "lunch" || meal === "dinner" || meal === "late_dinner";
}

/** Template includes soup + Harvard roles for lunch; Harvard only for dinner. */
export function assertTemplateShape(meal: TemplateMeal): {
  ok: boolean;
  roles: readonly PlateRole[];
} {
  const roles = rolesForMeal(meal);
  if (meal === "lunch") {
    const hasSoup = roles[0] === "soup";
    const harvard = roles.slice(1);
    const ok =
      hasSoup &&
      harvard.length === HARVARD_SECOND.length &&
      HARVARD_SECOND.every((r, i) => harvard[i] === r);
    return { ok, roles };
  }
  if (meal === "dinner" || meal === "late_dinner") {
    const ok =
      !roles.includes("soup") &&
      roles.length === HARVARD_SECOND.length &&
      HARVARD_SECOND.every((r, i) => roles[i] === r);
    return { ok, roles };
  }
  if (meal === "breakfast" || meal === "second_breakfast" || meal === "afternoon_snack") {
    return { ok: roles.length === 1 && roles[0] === "main", roles };
  }
  if (meal === "snack") {
    return { ok: roles.length === 1 && roles[0] === "snack", roles };
  }
  return { ok: false, roles };
}

/**
 * Roles that still need dishes given assigned covers (e.g. plov covers protein+carb).
 */
export function requiredOpenRoles(
  meal: TemplateMeal,
  coversRoles: readonly PlateRole[] | null | undefined,
): PlateRole[] {
  return openRolesAfterCovers(MEAL_TEMPLATES[meal], coversRoles);
}

/** Whether a filled set of roles satisfies required open roles (extras OK). */
export function rolesCoverRequirements(
  meal: TemplateMeal,
  filledRoles: readonly PlateRole[],
  coversFromRecipes: readonly PlateRole[] = [],
): boolean {
  const open = requiredOpenRoles(meal, coversFromRecipes);
  const have = new Set([...filledRoles, ...coversFromRecipes]);
  return open.every((r) => have.has(r));
}
