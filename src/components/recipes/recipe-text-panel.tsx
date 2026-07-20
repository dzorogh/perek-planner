"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RecipeValueDetail } from "@/components/recipes/recipe-value-line";
import {
  dayUnitWord,
  portionUnitWord,
  splitRecipeSteps,
} from "@/domain/recipes/format-body";
import type { RecipeIngredientView } from "@/domain/recipes/load-recipe";
import {
  EMPTY_PER_SERVING,
  type RecipePerServingValue,
} from "@/domain/recipes/scale-totals";
import { formatLineLabel } from "@/domain/shopping/quantity";

type RecipeTextPanelProps = {
  recipeId: string;
  recipeName: string;
  bodyText: string;
  ingredients?: RecipeIngredientView[];
  value?: RecipePerServingValue;
  /**
   * Total cook yield = sum of slot servings for this recipe on the menu
   * (people × meal occurrences / days). Defaults to 1.
   */
  totalServings?: number;
  /** Kept for callers; yield chips show portions + days only. */
  peoplePerMeal?: number;
  /** Distinct days this recipe appears; used in the yield chips. */
  dayCount?: number;
  triggerClassName?: string;
};

export function RecipeTextPanel({
  recipeName,
  bodyText,
  ingredients = [],
  value = EMPTY_PER_SERVING,
  totalServings = 1,
  dayCount = 1,
  triggerClassName,
}: RecipeTextPanelProps) {
  const hasBody = bodyText.trim().length > 0;
  const steps = hasBody ? splitRecipeSteps(bodyText) : [];
  const portionCount =
    Number.isFinite(totalServings) && totalServings >= 1
      ? Math.trunc(totalServings)
      : 1;
  const days =
    Number.isFinite(dayCount) && dayCount >= 1 ? Math.trunc(dayCount) : 1;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          data-component="recipe-text-trigger"
          className={
            triggerClassName ??
            "text-left text-sm font-medium text-primary underline-offset-4 hover:underline"
          }
        >
          {recipeName}
        </button>
      </DialogTrigger>
      <DialogContent
        data-component="recipe-text-panel"
        className="w-[min(100%,32rem)]"
      >
        <DialogHeader className="space-y-2.5">
          <DialogTitle>{recipeName}</DialogTitle>
          <div
            className="flex flex-wrap gap-2"
            aria-label="Выход"
            data-component="recipe-yield-chips"
          >
            <span className="inline-flex items-baseline gap-1.5 rounded-[10px] border border-border bg-empty-slot px-2.5 py-1.5 text-sm text-foreground">
              <span className="font-semibold tabular-nums">{portionCount}</span>
              <span className="text-xs text-muted-foreground">
                {portionUnitWord(portionCount)}
              </span>
            </span>
            <span className="inline-flex items-baseline gap-1.5 rounded-[10px] border border-border bg-empty-slot px-2.5 py-1.5 text-sm text-foreground">
              <span className="font-semibold tabular-nums">{days}</span>
              <span className="text-xs text-muted-foreground">
                {dayUnitWord(days)}
              </span>
            </span>
          </div>
          <RecipeValueDetail value={value} />
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto text-sm leading-relaxed text-foreground">
          {ingredients.length > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.04em] text-accent">
                Ингредиенты
              </h3>
              <ul className="space-y-1.5">
                {ingredients.map((ing) => {
                  const amount =
                    ing.amountPerServing != null
                      ? ing.amountPerServing * portionCount
                      : null;
                  return (
                    <li key={`${ing.kind}-${ing.name}`} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                      <span>
                        {formatLineLabel(ing.name, amount, ing.unit)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section>
            {ingredients.length > 0 ? (
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.04em] text-accent">
                Приготовление
              </h3>
            ) : null}
            {steps.length > 0 ? (
              <ol className="list-decimal space-y-2.5 pl-5 marker:text-muted-foreground">
                {steps.map((step, index) => (
                  <li key={index} className="pl-1">
                    {step}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-muted-foreground">
                Текст рецепта пока не заполнен.
              </p>
            )}
          </section>
        </div>

        <p className="text-xs text-muted-foreground">Esc — закрыть.</p>
      </DialogContent>
    </Dialog>
  );
}
