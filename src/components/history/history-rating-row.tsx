"use client";

import { startTransition, useActionState, useEffect, useState } from "react";

import { CommentDialog } from "@/components/feedback/comment-dialog";
import { RecipeTextPanel } from "@/components/recipes/recipe-text-panel";
import { Button } from "@/components/ui/button";
import {
  RATING_VALUE_LABELS_RU,
  type HistoryRatingValue,
  type RatingValue,
} from "@/domain/history/constants";
import {
  upsertRecipeRatingAction,
  upsertSnackRatingAction,
  type RatingActionState,
} from "@/domain/history/rating-actions";
import type { RecipeIngredientView } from "@/domain/recipes/load-recipe";

type RecipeProps = {
  kind: "recipe";
  recipeId: string;
  name: string;
  bodyText: string;
  ingredients: RecipeIngredientView[];
  totalServings: number;
  peoplePerMeal: number;
  dayCount: number;
  rating: RatingValue | null;
  reason: string | null;
};

type SnackProps = {
  kind: "snack";
  label: string;
  name: string;
  rating: RatingValue | null;
  reason: string | null;
};

function asHistoryRating(v: RatingValue | null): HistoryRatingValue | null {
  if (v === "like" || v === "dislike") return v;
  return null;
}

export function HistoryRatingRow(props: RecipeProps | SnackProps) {
  const action =
    props.kind === "recipe"
      ? upsertRecipeRatingAction
      : upsertSnackRatingAction;
  const [state, formAction, pending] = useActionState<
    RatingActionState,
    FormData
  >(action, null);
  const [dislikeOpen, setDislikeOpen] = useState(false);
  const current = asHistoryRating(props.rating);

  useEffect(() => {
    if (state?.ok) setDislikeOpen(false);
  }, [state]);

  function submitLike() {
    const fd = new FormData();
    if (props.kind === "recipe") {
      fd.set("recipeId", props.recipeId);
    } else {
      fd.set("label", props.label);
    }
    fd.set("rating", "like");
    startTransition(() => {
      formAction(fd);
    });
  }

  function submitDislike(comment: string) {
    const fd = new FormData();
    if (props.kind === "recipe") {
      fd.set("recipeId", props.recipeId);
    } else {
      fd.set("label", props.label);
    }
    fd.set("rating", "dislike");
    fd.set("comment", comment);
    startTransition(() => {
      formAction(fd);
    });
  }

  return (
    <div
      data-component="history-rating-row"
      className="rounded-lg border border-border bg-surface px-3 py-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {props.kind === "recipe" ? (
          <RecipeTextPanel
            recipeId={props.recipeId}
            recipeName={props.name}
            bodyText={props.bodyText}
            ingredients={props.ingredients}
            totalServings={props.totalServings}
            peoplePerMeal={props.peoplePerMeal}
            dayCount={props.dayCount}
          />
        ) : (
          <p className="text-sm font-medium text-foreground">{props.name}</p>
        )}
        <span className="text-xs text-muted-foreground">
          {props.kind === "recipe" ? "Рецепт" : "Snack"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={current === "like" ? "default" : "outline"}
          className="rounded-sm"
          disabled={pending}
          aria-pressed={current === "like"}
          onClick={() => submitLike()}
        >
          {RATING_VALUE_LABELS_RU.like}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={current === "dislike" ? "default" : "outline"}
          className="rounded-sm"
          disabled={pending}
          aria-pressed={current === "dislike"}
          onClick={() => setDislikeOpen(true)}
        >
          {RATING_VALUE_LABELS_RU.dislike}
        </Button>
      </div>

      {current === "dislike" && props.reason ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Причина: {props.reason}
        </p>
      ) : null}

      {state && !state.ok ? (
        <p className="mt-2 text-xs text-warning-fg" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="mt-2 text-xs text-primary" role="status">
          Оценка сохранена.
        </p>
      ) : null}

      <CommentDialog
        open={dislikeOpen}
        onOpenChange={setDislikeOpen}
        title="Не нравится"
        description="Без причины дизлайк не сохраняем. Комментарий учтём при следующих генерациях."
        placeholder="Например: не люблю тушёную капусту"
        submitLabel="Сохранить дизлайк"
        pending={pending}
        error={state && !state.ok ? state.error : null}
        onSubmit={submitDislike}
      />
    </div>
  );
}
