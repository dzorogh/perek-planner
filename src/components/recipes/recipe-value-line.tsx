import {
  formatCompactValueLine,
  formatKbjuLine,
  formatPerServingDetailLine,
  scalePerServing,
  type RecipePerServingValue,
  type ScaledRecipeTotals,
} from "@/domain/recipes/scale-totals";

type RecipeValueLineProps = {
  value: RecipePerServingValue;
  /** Scale factor (slot servings or batch totalServings). Default 1 = per serving. */
  servings?: number;
  className?: string;
};

/** Compact «360 ₽ · 900 ккал» for slot / list rows. */
export function RecipeValueLine({
  value,
  servings = 1,
  className = "text-xs tabular-nums text-muted-foreground",
}: RecipeValueLineProps) {
  const totals = scalePerServing(value, servings);
  const line = formatCompactValueLine(totals);
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
  className?: string;
};

/** Menu-level total block; hidden when nothing known. */
export function MenuTotalsBar({
  totals,
  className = "mt-6 max-w-xl",
}: MenuTotalsBarProps) {
  const compact = formatCompactValueLine(totals);
  const kbju = formatKbjuLine(totals);
  // Compact already has kcal; show macros-only remainder when present.
  const macrosOnly = (() => {
    if (!kbju) return null;
    const parts = kbju.split(" · ").filter((p) => !p.endsWith(" ккал"));
    return parts.length > 0 ? parts.join(" · ") : null;
  })();
  if (!compact && !macrosOnly) return null;

  return (
    <section
      data-component="menu-totals"
      className={className}
      aria-labelledby="menu-totals-title"
    >
      <h2
        id="menu-totals-title"
        className="text-sm font-semibold text-foreground"
      >
        Итого по меню
      </h2>
      <div className="mt-2 space-y-1 text-sm tabular-nums text-muted-foreground">
        {compact ? (
          <p className="font-semibold text-foreground">{compact}</p>
        ) : null}
        {macrosOnly ? <p>{macrosOnly}</p> : null}
      </div>
    </section>
  );
}
