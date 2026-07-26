/**
 * Cooking-method variety for name plans (Story Epic 6 follow-up).
 * Not a parse reject — used only to request targeted name repairs.
 */

import type { MealSlot, MenuDayPair } from "@/domain/menu/constants";
import type { PlateRole } from "@/domain/menu/meal-templates";
import { normalizeDishName } from "@/domain/suggestions/dish-similarity";

export type CookingMethodKey =
  | "bake"
  | "fry"
  | "stew"
  | "boil"
  | "grill"
  | "steam";

export type MethodSpamTarget = {
  meal: MealSlot;
  dayPair: MenuDayPair;
  plateRole: PlateRole;
  reason: string;
};

type NamedRoleDish = {
  meal: MealSlot;
  dayPair: MenuDayPair;
  plateRole: PlateRole;
  name: string;
};

/** Dominant cooking-method token in a Russian dish name, if any. */
export function cookingMethodKey(name: string): CookingMethodKey | null {
  const n = normalizeDishName(name);
  if (!n) return null;
  if (/запеч|в\s+духовк|гратен/.test(n)) return "bake";
  if (/на\s+гриле|гриль/.test(n)) return "grill";
  if (/жар[её]н|жарк|обжар/.test(n)) return "fry";
  if (/туш[её]н/.test(n)) return "stew";
  if (/на\s+пару|паровик/.test(n)) return "steam";
  if (/вар[её]н|отварн|в\s+бульон/.test(n)) return "boil";
  return null;
}

const METHOD_LABEL_RU: Record<CookingMethodKey, string> = {
  bake: "запекание",
  fry: "жарка",
  stew: "тушение",
  boil: "варка",
  grill: "гриль",
  steam: "пар",
};

/** Prefer reinventing sides before proteins; later day-pairs first. */
function replacePriority(d: NamedRoleDish): number {
  const roleRank: Record<PlateRole, number> = {
    fruit: 0,
    veg: 1,
    carb: 2,
    soup: 3,
    snack: 4,
    protein: 5,
    main: 6,
  };
  return (roleRank[d.plateRole] ?? 9) * 10 - d.dayPair[0];
}

/**
 * If one cooking method appears more than `maxPerMethod` times across the plan,
 * return extras to reinvent (same shape as variety-audit replace targets).
 */
export function cookingMethodSpamReplaceTargets(
  dishes: readonly NamedRoleDish[],
  maxPerMethod = 2,
): MethodSpamTarget[] {
  const byMethod = new Map<CookingMethodKey, NamedRoleDish[]>();
  for (const d of dishes) {
    const method = cookingMethodKey(d.name);
    if (!method) continue;
    const list = byMethod.get(method) ?? [];
    list.push(d);
    byMethod.set(method, list);
  }

  const targets: MethodSpamTarget[] = [];
  for (const [method, list] of byMethod) {
    if (list.length <= maxPerMethod) continue;
    // Keep proteins/mains; reinvent disposable sides first.
    const sorted = [...list].sort(
      (a, b) => replacePriority(b) - replacePriority(a),
    );
    const extras = sorted.slice(maxPerMethod);
    const label = METHOD_LABEL_RU[method];
    for (const d of extras) {
      targets.push({
        meal: d.meal,
        dayPair: d.dayPair,
        plateRole: d.plateRole,
        reason: `Слишком много блюд методом «${label}» (в т.ч. «запечённ…»). Придумай другое название с иным способом готовки (тушение, жарка, варка, сырой салат, плов и т.п.), не запекание.`,
      });
    }
  }
  return targets.slice(0, 6);
}
