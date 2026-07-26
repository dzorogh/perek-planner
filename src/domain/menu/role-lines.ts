/**
 * Build visible Menu sheet dish lines from slot dishes.
 * Multi-role one-pots (expandDishAssignments) must appear once.
 */

import {
  isTemplateMeal,
  rolesForMeal,
  type PlateRole,
} from "@/domain/menu/meal-templates";

export type RoleLineDish = {
  plateRole: PlateRole;
  recipeId: string | null;
  coversRoles: readonly PlateRole[] | null | undefined;
};

export type RoleLine<T extends RoleLineDish = RoleLineDish> = {
  role: PlateRole;
  dish: T | null;
  template: readonly PlateRole[];
};

function primaryDishByRole<T extends RoleLineDish>(
  dishes: readonly T[],
): Map<PlateRole, T> {
  const byRole = new Map<PlateRole, T>();
  for (const dish of dishes) {
    const prev = byRole.get(dish.plateRole);
    if (!prev || (!prev.recipeId && dish.recipeId)) {
      byRole.set(dish.plateRole, dish);
    }
  }
  return byRole;
}

/** Roles claimed as secondary covers by a one-pot (not the dish's own plateRole). */
function rolesCoveredByOnePots(
  dishes: readonly RoleLineDish[],
): Set<PlateRole> {
  const covered = new Set<PlateRole>();
  for (const dish of dishes) {
    if (!dish.recipeId) continue;
    for (const r of dish.coversRoles ?? []) {
      if (r !== dish.plateRole) covered.add(r);
    }
  }
  return covered;
}

/**
 * One visible line per template role, except:
 * - empty roles filled only via another dish's covers_roles
 * - expanded cover rows of the same recipeId (already shown earlier)
 */
export function roleLinesForDishes<T extends RoleLineDish>(
  meal: string,
  dishes: readonly T[],
): RoleLine<T>[] {
  const template: readonly PlateRole[] = isTemplateMeal(meal)
    ? rolesForMeal(meal)
    : ["main"];

  const primaryByRole = primaryDishByRole(dishes);
  const rolesFilledByCover = rolesCoveredByOnePots(dishes);
  const seenRecipeIds = new Set<string>();

  const lines: RoleLine<T>[] = [];
  for (const role of template) {
    const dish = primaryByRole.get(role) ?? null;

    if (dish?.recipeId) {
      if (seenRecipeIds.has(dish.recipeId)) continue;
      seenRecipeIds.add(dish.recipeId);
    } else if (rolesFilledByCover.has(role)) {
      continue;
    }

    lines.push({ role, dish, template });
  }
  return lines;
}
