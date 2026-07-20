/**
 * Fridge-keep gate: Recipe eligible only if fridge_keep_days >= menu day_count.
 */
export function passesFridgeKeep(
  fridgeKeepDays: number,
  menuDayCount: number,
): boolean {
  return fridgeKeepDays >= menuDayCount;
}

/**
 * FR12: shortest selected fridge-keep caps allowable Menu length.
 */
export function shortestFridgeKeepCapsLength(
  fridgeKeepDaysList: number[],
): number | null {
  if (fridgeKeepDaysList.length === 0) return null;
  return Math.min(...fridgeKeepDaysList);
}

export function maxMenuDaysForRecipes(fridgeKeepDaysList: number[]): number {
  const capped = shortestFridgeKeepCapsLength(fridgeKeepDaysList);
  if (capped === null) return 4;
  return Math.min(4, Math.max(1, capped));
}
