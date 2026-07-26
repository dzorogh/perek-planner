import {
  formatCompactValueLine,
  formatMenuTotalsDisplay,
  formatPerServingDetailLine,
  formatPortionValueLine,
  scalePerServing,
  type RecipePerServingValue,
  type ScaledRecipeTotals,
} from "@/domain/recipes/scale-totals";

type RecipeValueLineProps = {
  value: RecipePerServingValue;
  /** Scale factor (slot servings or batch totalServings). Default 1 = per serving. */
  servings?: number;
  /**
   * When set, render «N порции · unit₽ · unit ккал» instead of scaled compact line.
   * `servings` is ignored for the numeric scale in this mode.
   */
  portionCount?: number;
  className?: string;
};

/** Compact «360 ₽ · 900 ккал» or portion «4 порции · 70 ₽ · 350 ккал». */
export function RecipeValueLine({
  value,
  servings = 1,
  portionCount,
  className = "text-xs tabular-nums text-muted-foreground",
}: RecipeValueLineProps) {
  const line =
    portionCount != null && portionCount >= 1
      ? formatPortionValueLine(value, portionCount)
      : formatCompactValueLine(scalePerServing(value, servings));
  if (!line) return null;
  return <p className={className}>{line}</p>;
}

type RecipeValueDetailProps = {
  value: RecipePerServingValue;
};

/** Quiet per-serving price + KBJU under dish-dialog yield chips. */
export function RecipeValueDetail({ value }: RecipeValueDetailProps) {
  const line = formatPerServingDetailLine(value);
  if (!line) return null;
  return (
    <p className="text-xs tabular-nums text-muted-foreground">{line}</p>
  );
}

type MenuTotalsBarProps = {
  totals: ScaledRecipeTotals;
  dayCount: number;
  people: number;
  className?: string;
};

/** Menu-level total block; hidden when nothing known. */
export function MenuTotalsBar({
  totals,
  dayCount,
  people,
  className = "mt-6",
}: MenuTotalsBarProps) {
  const { primary, perCapita } = formatMenuTotalsDisplay(totals, {
    dayCount,
    people,
  });
  if (!primary && !perCapita) return null;

  return (
    <section
      data-component="menu-totals"
      className={className}
      aria-labelledby="menu-totals-title"
    >
      <h2
        id="menu-totals-title"
        className="text-sm font-semibold text-accent"
      >
        Итого по меню
      </h2>
      <div className="mt-2 space-y-1.5 text-sm tabular-nums">
        {primary ? (
          <p className="font-semibold text-foreground">{primary}</p>
        ) : null}
        {perCapita ? (
          <p className="text-muted-foreground">{perCapita}</p>
        ) : null}
      </div>
    </section>
  );
}
