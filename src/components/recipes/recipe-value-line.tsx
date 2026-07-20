import {
  formatCompactValueLine,
  formatKbjuLine,
  formatPriceRub,
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
  totalServings: number;
};

/** Yield-adjacent detail: per-serving + batch price/KBJU. */
export function RecipeValueDetail({
  value,
  totalServings,
}: RecipeValueDetailProps) {
  const perServing = scalePerServing(value, 1);
  const batch = scalePerServing(value, totalServings);
  const pricePer = formatPriceRub(perServing.priceCents);
  const priceBatch = formatPriceRub(batch.priceCents);
  const kbjuPer = formatKbjuLine(perServing);
  const kbjuBatch = formatKbjuLine(batch);

  let priceLine: string | null = null;
  if (pricePer) {
    priceLine = `${pricePer} на порцию`;
    if (priceBatch && totalServings > 1) {
      priceLine = `${priceLine} · ${priceBatch} на ${totalServings}`;
    }
  }

  if (!priceLine && !kbjuPer) return null;

  return (
    <div className="space-y-1 text-sm text-muted-foreground">
      {priceLine ? <p className="tabular-nums">{priceLine}</p> : null}
      {kbjuPer ? (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.04em] text-accent">
            КБЖУ
          </p>
          <p className="tabular-nums">
            {kbjuPer}
            {kbjuBatch && totalServings > 1
              ? ` · на ${totalServings}: ${kbjuBatch}`
              : ""}
          </p>
        </div>
      ) : null}
    </div>
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
  const price = formatPriceRub(totals.priceCents);
  const kbju = formatKbjuLine(totals);
  if (!price && !kbju) return null;

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
        {price ? <p>{price}</p> : null}
        {kbju ? <p>{kbju}</p> : null}
      </div>
    </section>
  );
}
