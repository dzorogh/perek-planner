/**
 * Russian Plate role labels for Menu UI (UX-DR17 / Story 6.3).
 */

import {
  isPlateRole,
  type PlateRole,
} from "@/domain/menu/meal-templates";

export const PLATE_ROLE_LABELS_RU: Record<PlateRole, string> = {
  soup: "Суп",
  protein: "Белок",
  veg: "Овощи",
  carb: "Углеводы",
  main: "Основное",
  snack: "Перекус",
};

export function plateRoleLabelRu(role: PlateRole): string {
  return PLATE_ROLE_LABELS_RU[role];
}

/**
 * Multi-role coverage string, template order preferred when provided.
 * e.g. ["protein","carb"] → «Белок · Углеводы»
 */
export function formatRoleCoverage(
  roles: readonly PlateRole[],
  orderHint?: readonly PlateRole[],
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
  return unique.map(plateRoleLabelRu).join(" · ");
}

/** Label for a dish line: primary role, or coverage when covers multiple. */
export function dishLineRoleLabel(
  plateRole: PlateRole,
  coversRoles: readonly PlateRole[] | null | undefined,
  templateOrder?: readonly PlateRole[],
): string {
  const covered = new Set<PlateRole>([plateRole, ...(coversRoles ?? [])]);
  if (covered.size <= 1) return plateRoleLabelRu(plateRole);
  return formatRoleCoverage([...covered], templateOrder);
}
