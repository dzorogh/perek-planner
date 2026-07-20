"use client";

import { useActionState, useEffect, useState } from "react";

import { DayLengthPicker } from "@/components/menu/day-length-picker";
import {
  DEFAULT_MEAL_TYPES_SELECTION,
  MealTypesPicker,
  selectedMealSlots,
  type MealTypesSelection,
} from "@/components/menu/meal-types-picker";
import { PeopleCountPicker } from "@/components/menu/people-count-picker";
import { Button } from "@/components/ui/button";
import {
  createMenuSkeletonAction,
  type CreateMenuSkeletonActionState,
} from "@/domain/menu/create-menu-actions";
import {
  DEFAULT_DAY_COUNT,
  DEFAULT_SERVINGS_PER_MEAL,
} from "@/domain/menu/constants";

type CreateMenuFormProps = {
  onPendingChange?: (pending: boolean) => void;
};

export function CreateMenuForm({ onPendingChange }: CreateMenuFormProps = {}) {
  const [dayCount, setDayCount] = useState(DEFAULT_DAY_COUNT);
  const [peopleCount, setPeopleCount] = useState(DEFAULT_SERVINGS_PER_MEAL);
  const [mealTypes, setMealTypes] = useState<MealTypesSelection>(
    DEFAULT_MEAL_TYPES_SELECTION,
  );
  // Stable per form instance; lazy init keeps render pure (no Date.now / Math.random).
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [state, formAction, isPending] = useActionState<
    CreateMenuSkeletonActionState,
    FormData
  >(createMenuSkeletonAction, null);

  useEffect(() => {
    onPendingChange?.(isPending);
  }, [isPending, onPendingChange]);

  const mealsCsv = selectedMealSlots(mealTypes).join(",");

  return (
    <form action={formAction} className="w-full">
      <input type="hidden" name="dayCount" value={dayCount} />
      <input type="hidden" name="peopleCount" value={peopleCount} />
      <input type="hidden" name="meals" value={mealsCsv} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input
        type="hidden"
        name="includeSnacks"
        value={mealTypes.includeSnacks ? "1" : "0"}
      />

      <div className="mt-1 grid grid-cols-1 gap-4 text-left min-[520px]:grid-cols-2 min-[520px]:gap-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-slot-label">
            Сколько дней
          </p>
          <DayLengthPicker
            value={dayCount}
            onChange={setDayCount}
            disabled={isPending}
          />
          <p className="mt-1.5 text-xs text-slot-label">
            Макс. 4 — по сроку хранения
          </p>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-slot-label">
            Сколько человек
          </p>
          <PeopleCountPicker
            value={peopleCount}
            onChange={setPeopleCount}
            disabled={isPending}
          />
          <p className="mt-1.5 text-xs text-slot-label">
            Порций на каждый приём
          </p>
        </div>
      </div>

      <div className="mt-5 text-left">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-slot-label">
          Какие приёмы пищи
        </p>
        <MealTypesPicker
          value={mealTypes}
          onChange={setMealTypes}
          disabled={isPending}
        />
        <p className="mb-5 mt-1.5 text-xs text-slot-label">
          Снимите лишнее — сгенерируем только выбранное
        </p>
      </div>

      <Button
        type="submit"
        className="w-full rounded-sm"
        disabled={isPending}
        aria-disabled={isPending}
        aria-busy={isPending}
      >
        {isPending ? "Генерируем…" : "Сгенерировать"}
      </Button>

      {state && !state.ok ? (
        <p className="mt-3 text-center text-sm text-warning-fg" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
