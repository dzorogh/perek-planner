"use client";

import type { ReactNode } from "react";

import { SlotCardActions } from "@/components/menu/slot-card-actions";
import { RecipeTextPanel } from "@/components/recipes/recipe-text-panel";
import { RecipeValueLine } from "@/components/recipes/recipe-value-line";
import type { MenuSlotDishView } from "@/domain/menu/load-menu";
import type { PlateRole } from "@/domain/menu/meal-templates";
import { dishLineRoleLabel } from "@/domain/menu/plate-role-labels";
import type { RecipeBatchScale } from "@/domain/recipes/batch-scale";
import type { RecipePerServingValue } from "@/domain/recipes/scale-totals";

type SlotDishLineProps = {
  menuId: string;
  slotId: string;
  plateRole: PlateRole;
  /** Meal key — scopes `main` label (Завтрак only on breakfast). */
  meal?: string | null;
  templateOrder?: readonly PlateRole[];
  dish?: MenuSlotDishView | null;
  /** Non-recipe filled line (e.g. Перекус label). Ignored when dish has recipeId. */
  plainName?: string | null;
  plainValue?: RecipePerServingValue | null;
  slotServings: number;
  /** When set, value line uses portion meta (N порции · unit ₽ · unit ккал). */
  portionCount?: number;
  batch: RecipeBatchScale;
  emptyLabel?: string;
  canClear?: boolean;
  /** Sheet row: colored rail + role beside name (v5). */
  sheetLayout?: boolean;
  /** Override default SlotCardActions (snack-specific overflow). */
  actions?: ReactNode;
};

const ROLE_ACCENT: Record<PlateRole, string> = {
  main: "#6366F1",
  fruit: "#E11D48",
  soup: "#64748B",
  protein: "#EA580C",
  veg: "#16A34A",
  carb: "#A16207",
  snack: "#818CF8",
};

function SlotDishLineBody({
  hasRecipe,
  recipeId,
  dish,
  batch,
  slotServings,
  portionCount,
  filledPlain,
  plainName,
  plainValue,
  emptyLabel,
}: {
  hasRecipe: boolean;
  recipeId: string | null;
  dish: MenuSlotDishView | null;
  batch: RecipeBatchScale;
  slotServings: number;
  portionCount?: number;
  filledPlain: boolean;
  plainName: string | null;
  plainValue: RecipePerServingValue | null;
  emptyLabel: string;
}) {
  if (hasRecipe && recipeId && dish) {
    return (
      <>
        <RecipeTextPanel
          recipeId={recipeId}
          recipeName={dish.recipeName ?? "Рецепт недоступен"}
          bodyText={dish.recipeBodyText ?? ""}
          ingredients={dish.recipeIngredients}
          value={dish.recipeValue}
          totalServings={batch.totalServings}
          peoplePerMeal={batch.peoplePerMeal}
          dayCount={batch.dayCount}
          triggerClassName="text-left text-sm font-semibold text-foreground underline decoration-border underline-offset-2 hover:text-primary"
        />
        <RecipeValueLine
          value={dish.recipeValue}
          servings={slotServings}
          portionCount={portionCount}
        />
      </>
    );
  }
  if (filledPlain && plainName) {
    return (
      <>
        <p className="text-sm font-semibold text-foreground">{plainName}</p>
        {plainValue ? (
          <RecipeValueLine
            value={plainValue}
            servings={slotServings}
            portionCount={portionCount}
          />
        ) : null}
      </>
    );
  }
  return <p className="text-sm text-slot-label">{emptyLabel}</p>;
}

export function SlotDishLine({
  menuId,
  slotId,
  plateRole,
  meal = null,
  templateOrder,
  dish = null,
  plainName = null,
  plainValue = null,
  slotServings,
  portionCount,
  batch,
  emptyLabel = "Пусто",
  canClear = false,
  sheetLayout = false,
  actions,
}: SlotDishLineProps) {
  const recipeId = dish?.recipeId ?? null;
  const hasRecipe = Boolean(recipeId);
  const filledPlain = !hasRecipe && Boolean(plainName);
  const filled = hasRecipe || filledPlain;
  const roleCaption = dishLineRoleLabel(
    plateRole,
    dish?.coversRoles,
    templateOrder,
    meal,
  );
  const accent = ROLE_ACCENT[plateRole] ?? "#94A3B8";

  if (sheetLayout) {
    return (
      <div
        data-component="slot-dish-line"
        data-plate-role={plateRole}
        data-empty={filled ? "false" : "true"}
        data-layout="sheet"
        className="relative grid grid-cols-[4px_5.75rem_minmax(0,1fr)_auto] items-stretch gap-x-2.5 rounded-md px-0 py-1.5 hover:bg-empty-slot"
      >
        <span
          aria-hidden
          className="min-h-[2.5rem] self-stretch rounded-full"
          style={{ backgroundColor: accent }}
        />
        <span
          className="self-start pt-0.5 text-[11px] font-semibold leading-snug"
          style={{ color: accent }}
        >
          {roleCaption}
        </span>
        <div className="min-w-0 pr-1">
          <SlotDishLineBody
            hasRecipe={hasRecipe}
            recipeId={recipeId}
            dish={dish}
            batch={batch}
            slotServings={slotServings}
            portionCount={portionCount}
            filledPlain={filledPlain}
            plainName={plainName}
            plainValue={plainValue}
            emptyLabel={emptyLabel}
          />
        </div>
        {actions ?? (
          <SlotCardActions
            menuId={menuId}
            slotId={slotId}
            hasRecipe={hasRecipe}
            recipeId={recipeId}
            target={plateRole}
            canClear={canClear && hasRecipe}
          />
        )}
      </div>
    );
  }

  return (
    <div
      data-component="slot-dish-line"
      data-plate-role={plateRole}
      data-empty={filled ? "false" : "true"}
      className="relative min-h-10 rounded-md bg-empty-slot px-3.5 py-3"
    >
      <div className="pr-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slot-label">
          {roleCaption}
        </p>
        <SlotDishLineBody
          hasRecipe={hasRecipe}
          recipeId={recipeId}
          dish={dish}
          batch={batch}
          slotServings={slotServings}
          portionCount={portionCount}
          filledPlain={filledPlain}
          plainName={plainName}
          plainValue={plainValue}
          emptyLabel={emptyLabel}
        />
      </div>
      {actions ?? (
        <SlotCardActions
          menuId={menuId}
          slotId={slotId}
          hasRecipe={hasRecipe}
          recipeId={recipeId}
          target={plateRole}
          canClear={canClear && hasRecipe}
        />
      )}
    </div>
  );
}
