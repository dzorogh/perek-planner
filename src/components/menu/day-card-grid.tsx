"use client";

import { MenuSlotBusyProvider } from "@/components/menu/menu-slot-busy";
import { SlotDishLine } from "@/components/menu/slot-dish-line";
import { SnackSlotCard } from "@/components/menu/snack-slot-card";
import {
  MEAL_LABELS_RU,
  MEAL_SLOTS,
  type MealSlot,
} from "@/domain/menu/constants";
import type { MenuSlotDishView, MenuSlotView, MenuSnackView } from "@/domain/menu/load-menu";
import {
  isTemplateMeal,
  rolesForMeal,
  type PlateRole,
} from "@/domain/menu/meal-templates";
import {
  recipeBatchScale,
  type RecipeBatchScale,
} from "@/domain/recipes/batch-scale";
import {
  formatCompactValueLine,
  sumDayTotals,
} from "@/domain/recipes/scale-totals";

type DayCardGridProps = {
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
  recipeId: string,
  recipeName: string | null,
  recipeBodyText: string | null,
  recipeIngredients: MenuSlotView["recipeIngredients"],
  recipeValue: MenuSlotView["recipeValue"],
): MenuSlotDishView {
  return {
    id: `${slot.id}-legacy-${plateRole}`,
    plateRole,
    sortOrder,
    recipeId,
    recipeName,
    recipeBodyText,
    recipeIngredients,
    recipeValue,
    coversRoles: null,
    snackLabel: null,
  };
}

function legacyDishesFromFks(
  slot: MenuSlotView,
  template: readonly PlateRole[],
): MenuSlotDishView[] {
  const dishes: MenuSlotDishView[] = [];
  const primaryRole: PlateRole = template.includes("protein")
    ? "protein"
    : (template[0] ?? "main");
  if (slot.recipeId) {
    dishes.push(
      shimDish(
        slot,
        primaryRole,
        template.indexOf(primaryRole),
        slot.recipeId,
        slot.recipeName,
        slot.recipeBodyText,
        slot.recipeIngredients,
        slot.recipeValue,
      ),
    );
  }
  if (slot.companionRecipeId && template.includes("carb")) {
    dishes.push(
      shimDish(
        slot,
        "carb",
        template.indexOf("carb"),
        slot.companionRecipeId,
        slot.companionRecipeName,
        slot.companionRecipeBodyText,
        slot.companionRecipeIngredients,
        slot.companionRecipeValue,
      ),
    );
  }
  return dishes;
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
    slot.dishes.length > 0 ? slot.dishes : legacyDishesFromFks(slot, template);
  const primaryByRole = primaryDishByRole(sourceDishes);
  const rolesFilledByCover = rolesCoveredByOnePots(sourceDishes);

  return template.flatMap((role) => {
    const dish = primaryByRole.get(role) ?? null;
    // One-pot coverage: skip empty covered roles (filled cover host stays).
    if (rolesFilledByCover.has(role) && !dish?.recipeId) return [];
    return [{ role, dish, template }];
  });
}

function SlotCell({
  menuId,
  slot,
  allSlots,
}: {
  menuId: string;
  slot: MenuSlotView;
  allSlots: MenuSlotView[];
}) {
  const lines = roleLinesForSlot(slot);
  const anyFilled = lines.some((l) => Boolean(l.dish?.recipeId));

  return (
    <div
      data-component="slot-cell"
      data-empty={anyFilled ? "false" : "true"}
      className="space-y-2"
    >
      {lines.map(({ role, dish, template }) => (
        <SlotDishLine
          key={role}
          menuId={menuId}
          slotId={slot.id}
          plateRole={role}
          templateOrder={template}
          dish={dish}
          slotServings={slot.servings}
          batch={
            dish?.recipeId
              ? recipeBatchScale(allSlots, dish.recipeId)
              : EMPTY_BATCH
          }
          canClear={role === "carb" && Boolean(dish?.recipeId)}
        />
      ))}
    </div>
  );
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

export function DayCardGrid({
  menuId,
  dayCount,
  slots,
  snacks,
}: DayCardGridProps) {
  const days = Array.from({ length: dayCount }, (_, i) => i + 1);
  const menuHasSnacks = snacks.length > 0;
  const meals = mealsPresent(slots);
  const snackServings =
    slots.find((s) => s.servings > 0)?.servings ?? 1;
  const gridStyle = {
    gridTemplateColumns: `108px repeat(${dayCount}, minmax(0, 1fr))`,
  } as const;

  return (
    <MenuSlotBusyProvider>
      <div
        data-component="meal-lane-grid"
        className="rounded-lg border border-border bg-surface px-5 py-5 md:px-6 md:py-6"
      >
        <div
          className="mb-1 grid gap-4 border-b border-border pb-2.5"
          style={gridStyle}
          aria-hidden="true"
        >
          <div />
          {days.map((dayIndex) => (
            <div
              key={dayIndex}
              className="text-center text-[13px] font-semibold text-accent"
            >
              День {dayIndex}
            </div>
          ))}
        </div>

        {meals.map((meal) => (
          <div
            key={meal}
            data-component="meal-lane"
            data-meal={meal}
            className="grid gap-4 border-b border-[#F1F5F9] py-4 last:border-b-0"
            style={gridStyle}
          >
            <div className="pt-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-slot-label">
              {MEAL_LABELS_RU[meal]}
            </div>
            {days.map((dayIndex) => {
              const slot = slotFor(slots, dayIndex, meal);
              if (!slot) {
                return <div key={`${meal}-${dayIndex}`} className="min-h-14" />;
              }
              return (
                <SlotCell
                  key={slot.id}
                  menuId={menuId}
                  slot={slot}
                  allSlots={slots}
                />
              );
            })}
          </div>
        ))}

        {menuHasSnacks ? (
          <div
            data-component="meal-lane"
            data-meal="snack"
            className="grid gap-4 border-b border-[#F1F5F9] py-4"
            style={gridStyle}
          >
            <div className="pt-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-slot-label">
              Перекус
            </div>
            {days.map((dayIndex) => {
              const daySnack =
                snacks.find((s) => s.dayIndex === dayIndex) ?? null;
              return (
                <SnackSlotCard
                  key={`snack-${dayIndex}`}
                  menuId={menuId}
                  dayIndex={dayIndex}
                  snack={daySnack}
                  servings={snackServings}
                />
              );
            })}
          </div>
        ) : null}

        <div
          data-component="day-totals"
          className="grid gap-4 border-t border-border pt-4"
          style={gridStyle}
        >
          <div className="pt-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-slot-label">
            Итого
          </div>
          {days.map((dayIndex) => {
            const line = formatCompactValueLine(
              sumDayTotals(slots, dayIndex, {
                snacks,
                snackServings,
              }),
            );
            return (
              <div
                key={`day-total-${dayIndex}`}
                data-day-index={dayIndex}
                className="text-sm font-semibold tabular-nums text-foreground"
              >
                {line ?? "—"}
              </div>
            );
          })}
        </div>
      </div>
    </MenuSlotBusyProvider>
  );
}
