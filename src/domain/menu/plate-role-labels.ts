/**
 * Russian Plate role labels for Menu UI (UX-DR17 / Story 6.3).
 */

import {
  isPlateRole,
  type PlateRole,
} from "@/domain/menu/meal-templates";

export const PLATE_ROLE_LABELS_RU: Record<PlateRole, string> = {
  soup: "Суп",
  protein: "Полезный белок",
  veg: "Овощи",
  carb: "Цельные злаки",
  fruit: "Фрукты",
  main: "Завтрак",
  snack: "Перекус",
};

/**
 * Role caption. `main` → «Завтрак» only on breakfast; other meals with
 * plate_role=main keep «Основное» so Полдник / Второй завтрак don't say Завтрак.
 */
export function plateRoleLabelRu(
  role: PlateRole,
  meal?: string | null,
): string {
  if (role === "main" && meal && meal !== "breakfast") {
    return "Основное";
  }
  return PLATE_ROLE_LABELS_RU[role];
}

/**
 * Multi-role coverage string, template order preferred when provided.
 * e.g. ["protein","carb"] → «Полезный белок · Цельные злаки»
 */
export function formatRoleCoverage(
  roles: readonly PlateRole[],
  orderHint?: readonly PlateRole[],
  meal?: string | null,
): string {
  const unique: PlateRole[] = [];
  for (const r of roles) {
    if (!isPlateRole(r) || unique.includes(r)) continue;
    unique.push(r);
  }
  if (unique.length === 0) return "";
  if (orderHint?.length) {
    const rank = new Map(orderHint.map((r, i) => [r, i]));
    unique.sort((a, b) => (rank.get(a) ?? 99) - (rank.get(b) ?? 99));
  }
  return unique.map((r) => plateRoleLabelRu(r, meal)).join(" · ");
}

/** Label for a dish line: primary role, or coverage when covers multiple. */
export function dishLineRoleLabel(
  plateRole: PlateRole,
  coversRoles: readonly PlateRole[] | null | undefined,
  templateOrder?: readonly PlateRole[],
  meal?: string | null,
): string {
  const covered = new Set<PlateRole>([plateRole, ...(coversRoles ?? [])]);
  if (covered.size <= 1) return plateRoleLabelRu(plateRole, meal);
  return formatRoleCoverage([...covered], templateOrder, meal);
}
