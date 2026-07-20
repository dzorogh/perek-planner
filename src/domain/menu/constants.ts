export const MIN_DAY_COUNT = 1;
export const MAX_DAY_COUNT = 4;
/** Create Menu always plans this many days (pairs 1–2 and 3–4). */
export const FIXED_MENU_DAY_COUNT = 4 as const;
export const DEFAULT_DAY_COUNT = FIXED_MENU_DAY_COUNT;
export const DEFAULT_SERVINGS_PER_MEAL = 2;

/** Hard cook/snack batches within a 4-day menu. */
export const MENU_DAY_PAIRS = [
  [1, 2],
  [3, 4],
] as const;

export type MenuDayPair = (typeof MENU_DAY_PAIRS)[number];

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

/** Ordered meal slots (eat view). Snacks are separate (`menu_snacks`). */
export const MEAL_SLOTS = [
  "breakfast",
  "second_breakfast",
  "lunch",
  "afternoon_snack",
  "dinner",
  "late_dinner",
] as const;

export type MealSlot = (typeof MEAL_SLOTS)[number];

export const MEAL_LABELS_RU: Record<MealSlot, string> = {
  breakfast: "Завтрак",
  second_breakfast: "Второй завтрак",
  lunch: "Обед",
  afternoon_snack: "Полдник",
  dinner: "Ужин",
  late_dinner: "Поздний ужин",
};

/** Defaults for the create-menu meal picker (snacks is not a meal slot). */
export const DEFAULT_MEAL_SELECTION: Record<MealSlot, boolean> = {
  breakfast: true,
  second_breakfast: false,
  lunch: true,
  afternoon_snack: false,
  dinner: true,
  late_dinner: false,
};

export const DEFAULT_INCLUDE_SNACKS = true;

export const DAY_OPTION_LABELS = [
  { value: 1, label: "день" },
  { value: 2, label: "дня" },
  { value: 3, label: "дня" },
  { value: 4, label: "дня" },
] as const;

export function isValidDayCount(value: number): value is 1 | 2 | 3 | 4 {
  return (
    Number.isInteger(value) &&
    value >= MIN_DAY_COUNT &&
    value <= MAX_DAY_COUNT
  );
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

/** Parse selected meals from form (order preserved as MEAL_SLOTS). */
export function parseSelectedMeals(raw: FormDataEntryValue | null): MealSlot[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  const seen = new Set<MealSlot>();
  for (const part of raw.split(",")) {
    const key = part.trim();
    if (isMealSlot(key)) seen.add(key);
  }
  return MEAL_SLOTS.filter((m) => seen.has(m));
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
