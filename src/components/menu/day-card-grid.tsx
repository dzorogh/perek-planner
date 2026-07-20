import { SlotCardActions } from "@/components/menu/slot-card-actions";
import { SnackSlotCard } from "@/components/menu/snack-slot-card";
import { RecipeTextPanel } from "@/components/recipes/recipe-text-panel";
import { RecipeValueLine } from "@/components/recipes/recipe-value-line";
import { MEAL_LABELS_RU, MEAL_SLOTS, type MealSlot } from "@/domain/menu/constants";
import type { MenuSlotView, MenuSnackView } from "@/domain/menu/load-menu";
import {
  recipeBatchScale,
  type RecipeBatchScale,
} from "@/domain/recipes/batch-scale";
import type { RecipeIngredientView } from "@/domain/recipes/load-recipe";
import type { RecipePerServingValue } from "@/domain/recipes/scale-totals";

type DayCardGridProps = {
  menuId: string;
  dayCount: number;
  slots: MenuSlotView[];
  snacks: MenuSnackView[];
};

function DishLine({
  menuId,
  slotId,
  recipeId,
  recipeName,
  recipeBodyText,
  recipeIngredients,
  recipeValue,
  slotServings,
  batch,
  recipeOccurrenceCount,
  target,
  canClear,
}: {
  menuId: string;
  slotId: string;
  recipeId: string;
  recipeName: string;
  recipeBodyText: string | null;
  recipeIngredients: RecipeIngredientView[];
  recipeValue: RecipePerServingValue;
  slotServings: number;
  batch: RecipeBatchScale;
  recipeOccurrenceCount: number;
  target: "main" | "companion";
  canClear?: boolean;
}) {
  return (
    <div
      data-component="slot-dish"
      data-target={target}
      className="relative min-h-10 rounded-md bg-empty-slot px-3.5 py-3"
    >
      <div className="pr-8">
        <RecipeTextPanel
          recipeId={recipeId}
          recipeName={recipeName}
          bodyText={recipeBodyText ?? ""}
          ingredients={recipeIngredients}
          value={recipeValue}
          totalServings={batch.totalServings}
          peoplePerMeal={batch.peoplePerMeal}
          dayCount={batch.dayCount}
          triggerClassName="text-left text-sm font-semibold text-foreground underline decoration-border underline-offset-2 hover:text-primary"
        />
        <RecipeValueLine value={recipeValue} servings={slotServings} />
      </div>
      <SlotCardActions
        menuId={menuId}
        slotId={slotId}
        hasRecipe
        target={target}
        recipeOccurrenceCount={recipeOccurrenceCount}
        canClear={canClear}
      />
    </div>
  );
}

function SlotCell({
  menuId,
  slot,
  allSlots,
  recipeOccurrences,
}: {
  menuId: string;
  slot: MenuSlotView;
  allSlots: MenuSlotView[];
  recipeOccurrences: Map<string, number>;
}) {
  if (!slot.recipeId) {
    return (
      <div
        data-component="slot-cell"
        data-empty="true"
        className="relative min-h-14 rounded-md bg-empty-slot px-3.5 py-3"
      >
        <div className="pr-8">
          <p className="text-sm text-slot-label">Пустой слот</p>
        </div>
        <SlotCardActions
          menuId={menuId}
          slotId={slot.id}
          hasRecipe={false}
          target="main"
          recipeOccurrenceCount={1}
        />
      </div>
    );
  }

  return (
    <div data-component="slot-cell" data-empty="false" className="space-y-2">
      {slot.recipeId ? (
        <DishLine
          menuId={menuId}
          slotId={slot.id}
          recipeId={slot.recipeId}
          recipeName={slot.recipeName ?? "Рецепт недоступен"}
          recipeBodyText={slot.recipeBodyText}
          recipeIngredients={slot.recipeIngredients}
          recipeValue={slot.recipeValue}
          slotServings={slot.servings}
          batch={recipeBatchScale(allSlots, slot.recipeId)}
          recipeOccurrenceCount={recipeOccurrences.get(slot.recipeId) ?? 1}
          target="main"
        />
      ) : null}
      {slot.companionRecipeId ? (
        <DishLine
          menuId={menuId}
          slotId={slot.id}
          recipeId={slot.companionRecipeId}
          recipeName={slot.companionRecipeName ?? "Компаньон недоступен"}
          recipeBodyText={slot.companionRecipeBodyText}
          recipeIngredients={slot.companionRecipeIngredients}
          recipeValue={slot.companionRecipeValue}
          slotServings={slot.servings}
          batch={recipeBatchScale(allSlots, slot.companionRecipeId)}
          recipeOccurrenceCount={
            recipeOccurrences.get(slot.companionRecipeId) ?? 1
          }
          target="companion"
          canClear
        />
      ) : null}
    </div>
  );
}

function countRecipeOccurrences(slots: MenuSlotView[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const slot of slots) {
    for (const id of [slot.recipeId, slot.companionRecipeId]) {
      if (!id) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
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
  const recipeOccurrences = countRecipeOccurrences(slots);
  const meals = mealsPresent(slots);
  const snackServings =
    slots.find((s) => s.servings > 0)?.servings ?? 1;
  const gridStyle = {
    gridTemplateColumns: `108px repeat(${dayCount}, minmax(0, 1fr))`,
  } as const;

  return (
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
                recipeOccurrences={recipeOccurrences}
              />
            );
          })}
        </div>
      ))}

      {menuHasSnacks ? (
        <div
          data-component="meal-lane"
          data-meal="snack"
          className="grid gap-4 border-b border-[#F1F5F9] py-4 last:border-b-0"
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
    </div>
  );
}
