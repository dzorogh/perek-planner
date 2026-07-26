"use client";

import { MenuSlotBusyProvider } from "@/components/menu/menu-slot-busy";
import { SlotDishLine } from "@/components/menu/slot-dish-line";
import { SnackSlotCard } from "@/components/menu/snack-slot-card";
import {
  MEAL_LABELS_RU,
  MEAL_SLOTS,
  menuDayPairsForCount,
  type MealSlot,
  type MenuDayPair,
} from "@/domain/menu/constants";
import type {
  MenuSlotDishView,
  MenuSlotView,
  MenuSnackView,
} from "@/domain/menu/load-menu";
import {
  isTemplateMeal,
  rolesForMeal,
  type PlateRole,
} from "@/domain/menu/meal-templates";
import {
  recipeBatchScale,
  type RecipeBatchScale,
} from "@/domain/recipes/batch-scale";

type MenuSheetGridProps = {
  menuId: string;
  dayCount: number;
  slots: MenuSlotView[];
  snacks: MenuSnackView[];
};

const EMPTY_BATCH: RecipeBatchScale = {
  totalServings: 1,
  peoplePerMeal: 1,
  dayCount: 1,
};

function shimDish(
  slot: MenuSlotView,
  plateRole: PlateRole,
  sortOrder: number,
): MenuSlotDishView {
  return {
    id: `${slot.id}-legacy-${plateRole}`,
    plateRole,
    sortOrder,
    recipeId: slot.recipeId,
    recipeName: slot.recipeName,
    recipeBodyText: slot.recipeBodyText,
    recipeIngredients: slot.recipeIngredients,
    recipeValue: slot.recipeValue,
    coversRoles: null,
    snackLabel: null,
  };
}

function primaryShimDishes(
  slot: MenuSlotView,
  template: readonly PlateRole[],
): MenuSlotDishView[] {
  if (!slot.recipeId) return [];
  const primaryRole: PlateRole = template.includes("protein")
    ? "protein"
    : (template[0] ?? "main");
  return [shimDish(slot, primaryRole, template.indexOf(primaryRole))];
}

function primaryDishByRole(
  dishes: readonly MenuSlotDishView[],
): Map<PlateRole, MenuSlotDishView> {
  const byRole = new Map<PlateRole, MenuSlotDishView>();
  for (const dish of dishes) {
    const prev = byRole.get(dish.plateRole);
    if (!prev || (!prev.recipeId && dish.recipeId)) {
      byRole.set(dish.plateRole, dish);
    }
  }
  return byRole;
}

function rolesCoveredByOnePots(
  dishes: readonly MenuSlotDishView[],
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

function roleLinesForSlot(slot: MenuSlotView): Array<{
  role: PlateRole;
  dish: MenuSlotDishView | null;
  template: readonly PlateRole[];
}> {
  const template: readonly PlateRole[] = isTemplateMeal(slot.meal)
    ? rolesForMeal(slot.meal)
    : ["main"];

  const sourceDishes =
    slot.dishes.length > 0 ? slot.dishes : primaryShimDishes(slot, template);
  const primaryByRole = primaryDishByRole(sourceDishes);
  const rolesFilledByCover = rolesCoveredByOnePots(sourceDishes);

  return template.flatMap((role) => {
    const dish = primaryByRole.get(role) ?? null;
    if (rolesFilledByCover.has(role) && !dish?.recipeId) return [];
    return [{ role, dish, template }];
  });
}

function mealsPresent(slots: MenuSlotView[]): MealSlot[] {
  const present = new Set(slots.map((s) => s.meal));
  return MEAL_SLOTS.filter((meal) => present.has(meal));
}

function slotFor(
  slots: MenuSlotView[],
  dayIndex: number,
  meal: MealSlot,
): MenuSlotView | undefined {
  return slots.find((s) => s.dayIndex === dayIndex && s.meal === meal);
}

function PairSheet({
  menuId,
  pair,
  slots,
  snacks,
  meals,
  snackServings,
}: {
  menuId: string;
  pair: MenuDayPair;
  slots: MenuSlotView[];
  snacks: MenuSnackView[];
  meals: MealSlot[];
  snackServings: number;
}) {
  const [dayA, dayB] = pair;

  return (
    <article
      data-component="menu-sheet"
      data-day-pair={`${dayA}-${dayB}`}
      aria-label={`Лист: дни ${dayA} и ${dayB}`}
      className="relative flex flex-col rounded border border-border bg-surface shadow-sm"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary to-accent opacity-60"
        aria-hidden
      />
      <header className="border-b border-border bg-gradient-to-b from-[#FAFBFF] to-surface px-5 pb-3.5 pt-4">
        <div className="flex items-baseline gap-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[28px] font-bold leading-none tracking-tight text-accent">
              {dayA}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground">
              день
            </span>
          </div>
          <span
            className="mx-3.5 inline-flex self-center text-primary/45"
            aria-hidden
          >
            <svg width="28" height="10" viewBox="0 0 28 10" fill="none">
              <path
                d="M1 5h26"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <circle cx="1" cy="5" r="1.6" fill="currentColor" />
              <circle cx="27" cy="5" r="1.6" fill="currentColor" />
            </svg>
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-[28px] font-bold leading-none tracking-tight text-accent">
              {dayB}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground">
              день
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col pb-3.5">
        {meals.map((meal) => {
          const slotA = slotFor(slots, dayA, meal);
          const slotB = slotFor(slots, dayB, meal);
          const slot = slotA ?? slotB;
          if (!slot) return null;
          const lines = roleLinesForSlot(slot);
          const assignedDays = [slotA, slotB].filter(Boolean).length;
          const portionCount =
            Math.max(1, assignedDays) * Math.max(1, slot.servings);

          return (
            <section
              key={meal}
              aria-label={MEAL_LABELS_RU[meal]}
              className="px-4 pt-3"
            >
              <div className="mb-1.5 flex items-center gap-2.5 px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-accent">
                  {MEAL_LABELS_RU[meal]}
                </h2>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-0.5">
                {lines.map(({ role, dish, template }) => (
                  <SlotDishLine
                    key={role}
                    menuId={menuId}
                    slotId={slot.id}
                    meal={meal}
                    plateRole={role}
                    templateOrder={template}
                    dish={dish}
                    slotServings={slot.servings}
                    portionCount={portionCount}
                    sheetLayout
                    batch={
                      dish?.recipeId
                        ? recipeBatchScale(slots, dish.recipeId)
                        : EMPTY_BATCH
                    }
                    canClear={false}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {(() => {
          const snackA = snacks.find((s) => s.dayIndex === dayA) ?? null;
          const snackB = snacks.find((s) => s.dayIndex === dayB) ?? null;
          const snack = snackA ?? snackB;
          if (!snack) return null;
          const snackDays = [snackA, snackB].filter(
            (s) => s != null && s.label === snack.label,
          ).length;
          return (
            <section aria-label="Перекус" className="px-4 pt-3">
              <div className="mb-1.5 flex items-center gap-2.5 px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-accent">
                  Перекус
                </h2>
                <div className="h-px flex-1 bg-border" />
              </div>
              <SnackSlotCard
                menuId={menuId}
                dayIndex={snackA ? dayA : dayB}
                snack={snack}
                servings={snackServings}
                portionCount={Math.max(1, snackDays) * snackServings}
                sheetLayout
              />
            </section>
          );
        })()}
      </div>
    </article>
  );
}

export function MenuSheetGrid({
  menuId,
  dayCount,
  slots,
  snacks,
}: MenuSheetGridProps) {
  const pairs = menuDayPairsForCount(dayCount);
  const meals = mealsPresent(slots);
  const snackServings = slots.find((s) => s.servings > 0)?.servings ?? 1;
  let sheetGridClass = "mt-4 grid max-w-xl items-stretch gap-4";
  if (pairs.length >= 3) {
    sheetGridClass =
      "mt-4 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3";
  } else if (pairs.length === 2) {
    sheetGridClass = "mt-4 grid items-stretch gap-4 md:grid-cols-2";
  }

  return (
    <MenuSlotBusyProvider>
      <div data-component="menu-sheet-grid" className={sheetGridClass}>
        {pairs.map((pair) => (
          <PairSheet
            key={`${pair[0]}-${pair[1]}`}
            menuId={menuId}
            pair={pair}
            slots={slots}
            snacks={snacks}
            meals={meals}
            snackServings={snackServings}
          />
        ))}
      </div>
    </MenuSlotBusyProvider>
  );
}
