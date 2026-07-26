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

function DishMeta({
  hasRecipe,
  dish,
  slotServings,
  portionCount,
  filledPlain,
  plainValue,
}: {
  hasRecipe: boolean;
  dish: MenuSlotDishView | null;
  slotServings: number;
  portionCount?: number;
  filledPlain: boolean;
  plainValue: RecipePerServingValue | null;
}) {
  if (hasRecipe && dish?.recipeValue) {
    return (
      <RecipeValueLine
        value={dish.recipeValue}
        servings={slotServings}
        portionCount={portionCount}
      />
    );
  }
  if (filledPlain && plainValue) {
    return (
      <RecipeValueLine
        value={plainValue}
        servings={slotServings}
        portionCount={portionCount}
      />
    );
  }
  return null;
}

function RoleCaptionParts({ caption }: { caption: string }) {
  const parts = caption.split(" · ");
  if (parts.length <= 1) return <>{caption}</>;
  return (
    <span className="flex flex-col gap-0.5">
      {parts.map((part) => (
        <span key={part}>{part}</span>
      ))}
    </span>
  );
}

function SheetRowBody({
  roleCaption,
  accent,
  title,
  empty,
  meta,
}: {
  roleCaption: string;
  accent: string;
  title: ReactNode;
  empty: boolean;
  meta: ReactNode;
}) {
  return (
    <>
      <span
        aria-hidden
        className="mt-0.5 w-1 min-h-[2.5rem] shrink-0 self-stretch rounded-full"
        style={{ backgroundColor: accent }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-x-2.5">
          <span
            className="w-[5.75rem] shrink-0 text-[11px] font-semibold leading-5"
            style={{ color: accent }}
          >
            <RoleCaptionParts caption={roleCaption} />
          </span>
          <div className="min-w-0 flex-1">
            {empty ? (
              <p className="m-0 text-sm leading-5 text-slot-label">{title}</p>
            ) : (
              <p className="m-0 text-sm font-semibold leading-5 text-foreground">
                {title}
              </p>
            )}
          </div>
        </div>
        <div className="pl-[calc(5.75rem+0.625rem)]">{meta}</div>
      </div>
    </>
  );
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
  const meta = (
    <DishMeta
      hasRecipe={hasRecipe}
      dish={dish}
      slotServings={slotServings}
      portionCount={portionCount}
      filledPlain={filledPlain}
      plainValue={plainValue}
    />
  );
  const overflow =
    actions ??
    (sheetLayout ? (
      <SlotCardActions
        menuId={menuId}
        slotId={slotId}
        hasRecipe={hasRecipe}
        recipeId={recipeId}
        target={plateRole}
        canClear={canClear && hasRecipe}
        placement="inline"
      />
    ) : (
      <SlotCardActions
        menuId={menuId}
        slotId={slotId}
        hasRecipe={hasRecipe}
        recipeId={recipeId}
        target={plateRole}
        canClear={canClear && hasRecipe}
      />
    ));

  if (sheetLayout) {
    const title = hasRecipe
      ? (dish?.recipeName ?? "Рецепт недоступен")
      : filledPlain
        ? plainName
        : emptyLabel;

    const rowClass =
      "relative flex w-full min-w-0 flex-1 items-start gap-x-2.5 rounded-md px-0 py-1.5 text-left hover:bg-empty-slot";

    return (
      <div
        data-component="slot-dish-line"
        data-plate-role={plateRole}
        data-empty={filled ? "false" : "true"}
        data-layout="sheet"
        className="relative flex items-start gap-x-1 rounded-md"
      >
        {hasRecipe && recipeId && dish ? (
          <RecipeTextPanel
            recipeId={recipeId}
            recipeName={dish.recipeName ?? "Рецепт недоступен"}
            bodyText={dish.recipeBodyText ?? ""}
            ingredients={dish.recipeIngredients}
            value={dish.recipeValue}
            totalServings={batch.totalServings}
            peoplePerMeal={batch.peoplePerMeal}
            dayCount={batch.dayCount}
          >
            <button
              type="button"
              data-component="recipe-text-trigger"
              className={`${rowClass} border-0 bg-transparent`}
            >
              <SheetRowBody
                roleCaption={roleCaption}
                accent={accent}
                title={title}
                empty={false}
                meta={meta}
              />
            </button>
          </RecipeTextPanel>
        ) : (
          <div className={rowClass}>
            <SheetRowBody
              roleCaption={roleCaption}
              accent={accent}
              title={title}
              empty={!filled}
              meta={meta}
            />
          </div>
        )}
        {overflow}
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
        {hasRecipe && recipeId && dish ? (
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
        ) : filledPlain && plainName ? (
          <p className="text-sm font-semibold text-foreground">{plainName}</p>
        ) : (
          <p className="text-sm text-slot-label">{emptyLabel}</p>
        )}
        {meta}
      </div>
      {overflow}
    </div>
  );
}
