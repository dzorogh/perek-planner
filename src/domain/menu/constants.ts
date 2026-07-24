export const MIN_DAY_COUNT = 2;
export const MAX_DAY_COUNT = 6;
/** Create Menu default length (one pair batch of two days × 2). */
export const DEFAULT_DAY_COUNT = 4;
export const DEFAULT_SERVINGS_PER_MEAL = 2;

/** Allowed create-menu lengths: hard 2-day cook batches. */
export const CREATE_MENU_DAY_COUNTS = [2, 4, 6] as const;
export type CreateMenuDayCount = (typeof CREATE_MENU_DAY_COUNTS)[number];

/** All hard cook/snack batches (subset used by menuDayPairsForCount). */
export const MENU_DAY_PAIRS = [
  [1, 2],
  [3, 4],
  [5, 6],
] as const;

export type MenuDayPair = (typeof MENU_DAY_PAIRS)[number];

/** Pairs that fit inside a menu of `dayCount` days (2 → one pair, 4 → two, 6 → three). */
export function menuDayPairsForCount(dayCount: number): MenuDayPair[] {
  return MENU_DAY_PAIRS.filter((pair) => pair[1] <= dayCount);
}

/** Resolve the hard 2-day batch that contains `dayIndex`, or null if out of range. */
export function menuDayPairForDay(dayIndex: number): MenuDayPair | null {
  for (const pair of MENU_DAY_PAIRS) {
    if (pair[0] === dayIndex || pair[1] === dayIndex) return pair;
  }
  return null;
}

export const MIN_PEOPLE_COUNT = 1;
export const MAX_PEOPLE_COUNT = 8;

export const PEOPLE_OPTION_LABELS = [
  { value: 1, label: "чел." },
  { value: 2, label: "чел." },
  { value: 3, label: "чел." },
  { value: 4, label: "чел." },
  { value: 5, label: "чел." },
  { value: 6, label: "чел." },
] as const;

export function isValidPeopleCount(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= MIN_PEOPLE_COUNT &&
    value <= MAX_PEOPLE_COUNT
  );
}

/**
 * Ordered meal slots (eat view).
 * `snack` = Перекус (no-cook); `afternoon_snack` = Полдник (cookable).
 * Create-menu picker uses COOKABLE_MEAL_SLOTS; snack comes from includeSnacks.
 */
export const MEAL_SLOTS = [
  "breakfast",
  "second_breakfast",
  "lunch",
  "afternoon_snack",
  "dinner",
  "late_dinner",
  "snack",
] as const;

export type MealSlot = (typeof MEAL_SLOTS)[number];

/** Meals shown in meal-types-picker (excludes Перекус — use includeSnacks). */
export const COOKABLE_MEAL_SLOTS = MEAL_SLOTS.filter(
  (m): m is Exclude<MealSlot, "snack"> => m !== "snack",
);

export const MEAL_LABELS_RU: Record<MealSlot, string> = {
  breakfast: "Завтрак",
  second_breakfast: "Второй завтрак",
  lunch: "Обед",
  afternoon_snack: "Полдник",
  dinner: "Ужин",
  late_dinner: "Поздний ужин",
  snack: "Перекус",
};

/** Defaults for the create-menu meal picker (Перекус via includeSnacks). */
export const DEFAULT_MEAL_SELECTION: Record<
  Exclude<MealSlot, "snack">,
  boolean
> = {
  breakfast: true,
  second_breakfast: false,
  lunch: true,
  afternoon_snack: false,
  dinner: true,
  late_dinner: false,
};

export const DEFAULT_INCLUDE_SNACKS = true;

export const DAY_OPTION_LABELS = [
  { value: 2, label: "дня" },
  { value: 4, label: "дня" },
  { value: 6, label: "дней" },
] as const;

export function isValidDayCount(value: number): value is CreateMenuDayCount {
  return (CREATE_MENU_DAY_COUNTS as readonly number[]).includes(value);
}

export function isMealSlot(value: string): value is MealSlot {
  return (MEAL_SLOTS as readonly string[]).includes(value);
}

/** Meals that may get an optional companion (гарнир / protein). */
export const COMPANION_MEALS = ["lunch", "dinner", "late_dinner"] as const;

export type CompanionMeal = (typeof COMPANION_MEALS)[number];

export function mealAllowsCompanion(meal: MealSlot): boolean {
  return (COMPANION_MEALS as readonly string[]).includes(meal);
}

/** Parse selected cookable meals from form (never includes snack). */
export function parseSelectedMeals(raw: FormDataEntryValue | null): MealSlot[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  const seen = new Set<MealSlot>();
  for (const part of raw.split(",")) {
    const key = part.trim();
    if (isMealSlot(key) && key !== "snack") seen.add(key);
  }
  return COOKABLE_MEAL_SLOTS.filter((m) => seen.has(m));
}

/** Meals to pass to create_menu_skeleton (adds snack when includeSnacks). */
export function mealsForSkeleton(
  meals: readonly MealSlot[],
  includeSnacks: boolean,
): MealSlot[] {
  const base = COOKABLE_MEAL_SLOTS.filter((m) => meals.includes(m));
  return includeSnacks ? [...base, "snack"] : [...base];
}

export function expectedSlotCount(
  dayCount: number,
  meals: readonly MealSlot[] = MEAL_SLOTS,
): number {
  return dayCount * meals.length;
}

export function maxSlotCount(dayCount: number): number {
  return dayCount * MEAL_SLOTS.length;
}
