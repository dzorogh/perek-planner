"use client";

import type { ReactNode } from "react";
import { Check, ThumbsDown, ThumbsUp } from "lucide-react";

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { MenuDishRating } from "@/domain/menu/load-menu";
import { isPlanningLocked } from "@/domain/menu/planning-lock";

export function planningLocked(
  prepared: boolean,
  rating: MenuDishRating | null,
): boolean {
  return isPlanningLocked(prepared, rating);
}

type CookFeedbackMenuItemsProps = {
  prepared: boolean;
  rating: MenuDishRating | null;
  busy: boolean;
  onTogglePrepared: () => void;
  onRate: (rating: "like" | "dislike") => void;
};

/** Separator + Приготовлено / Нравится / Не нравится for a filled Menu dish. */
export function CookFeedbackMenuItems({
  prepared,
  rating,
  busy,
  onTogglePrepared,
  onRate,
}: CookFeedbackMenuItemsProps): ReactNode {
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        disabled={busy}
        className="focus:bg-background focus:text-primary"
        onSelect={onTogglePrepared}
        data-component="cook-feedback-prepared"
      >
        {prepared ? "Не приготовлено" : "Приготовлено"}
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={busy}
        className="focus:bg-background focus:text-primary"
        onSelect={() => onRate("like")}
        data-component="cook-feedback-like"
      >
        {rating === "like" ? "Убрать «Нравится»" : "Нравится"}
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={busy}
        className="focus:bg-background focus:text-primary"
        onSelect={() => onRate("dislike")}
        data-component="cook-feedback-dislike"
      >
        {rating === "dislike" ? "Убрать «Не нравится»" : "Не нравится"}
      </DropdownMenuItem>
    </>
  );
}

/**
 * Inline status marks beside the dish title — icons only, no extra row height.
 */
export function CookFeedbackCues({
  prepared,
  rating,
}: {
  prepared: boolean;
  rating: MenuDishRating | null;
}): ReactNode {
  if (!prepared && !rating) return null;
  const labels: string[] = [];
  if (prepared) labels.push("Приготовлено");
  if (rating === "like") labels.push("Нравится");
  if (rating === "dislike") labels.push("Не нравится");
  return (
    <span
      data-component="cook-feedback-cues"
      className="inline-flex shrink-0 items-center gap-0.5 text-muted-foreground"
      title={labels.join(" · ")}
      aria-label={labels.join(", ")}
    >
      {prepared ? <Check className="size-3.5 stroke-[2.25]" aria-hidden /> : null}
      {rating === "like" ? (
        <ThumbsUp className="size-3.5 stroke-[2.25]" aria-hidden />
      ) : null}
      {rating === "dislike" ? (
        <ThumbsDown className="size-3.5 stroke-[2.25]" aria-hidden />
      ) : null}
    </span>
  );
}
