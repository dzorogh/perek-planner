"use client";

import {
  DEFAULT_INCLUDE_SNACKS,
  DEFAULT_MEAL_SELECTION,
  MEAL_LABELS_RU,
  MEAL_SLOTS,
  type MealSlot,
} from "@/domain/menu/constants";
import { cn } from "@/lib/utils";

export type MealTypesSelection = {
  meals: Record<MealSlot, boolean>;
  includeSnacks: boolean;
};

export const DEFAULT_MEAL_TYPES_SELECTION: MealTypesSelection = {
  meals: { ...DEFAULT_MEAL_SELECTION },
  includeSnacks: DEFAULT_INCLUDE_SNACKS,
};

type MealTypesPickerProps = {
  value: MealTypesSelection;
  onChange: (next: MealTypesSelection) => void;
  disabled?: boolean;
};

type MealChip = {
  key: string;
  label: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
};

export function MealTypesPicker({
  value,
  onChange,
  disabled = false,
}: MealTypesPickerProps) {
  const selectedCount =
    MEAL_SLOTS.filter((m) => value.meals[m]).length +
    (value.includeSnacks ? 1 : 0);

  function toggleMeal(meal: MealSlot, checked: boolean) {
    const nextMeals = { ...value.meals, [meal]: checked };
    const nextCount =
      MEAL_SLOTS.filter((m) => nextMeals[m]).length +
      (value.includeSnacks ? 1 : 0);
    if (nextCount === 0) return;
    onChange({ ...value, meals: nextMeals });
  }

  function toggleSnacks(checked: boolean) {
    const nextCount =
      MEAL_SLOTS.filter((m) => value.meals[m]).length + (checked ? 1 : 0);
    if (nextCount === 0) return;
    onChange({ ...value, includeSnacks: checked });
  }

  const chips: MealChip[] = [
    ...MEAL_SLOTS.map((meal) => ({
      key: meal,
      label: MEAL_LABELS_RU[meal],
      checked: value.meals[meal],
      onToggle: (checked: boolean) => toggleMeal(meal, checked),
    })),
    {
      key: "snacks",
      label: "Снеки",
      checked: value.includeSnacks,
      onToggle: toggleSnacks,
    },
  ];

  return (
    <div
      data-component="meal-types-picker"
      className="mb-2 flex flex-wrap gap-2"
      role="group"
      aria-label="Приёмы пищи"
      aria-disabled={disabled || undefined}
    >
      {chips.map((chip) => {
        const lockedOn = chip.checked && selectedCount === 1;
        return (
          <button
            key={chip.key}
            type="button"
            role="checkbox"
            aria-checked={chip.checked}
            disabled={disabled || lockedOn}
            onClick={() => chip.onToggle(!chip.checked)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              chip.checked
                ? "border-primary/25 bg-secondary font-medium text-primary shadow-sm"
                : "border-transparent bg-background text-muted-foreground hover:text-foreground",
              (disabled || lockedOn) && "cursor-not-allowed opacity-60",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border text-[10px] leading-none",
                chip.checked
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface",
              )}
            >
              {chip.checked ? "✓" : ""}
            </span>
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}

export function selectedMealSlots(selection: MealTypesSelection): MealSlot[] {
  return MEAL_SLOTS.filter((m) => selection.meals[m]);
}

export function mealSelectionSummary(selection: MealTypesSelection): string {
  const parts = [
    ...selectedMealSlots(selection).map((m) =>
      MEAL_LABELS_RU[m].toLowerCase(),
    ),
    ...(selection.includeSnacks ? ["снеки"] : []),
  ];
  return parts.join(" / ");
}
