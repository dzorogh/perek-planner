import {
  formatDishDayCount,
  type MenuDishSummary,
} from "@/domain/menu/dish-summary";
import { formatCompactValueLine } from "@/domain/recipes/scale-totals";

type MenuDishListProps = {
  dishes: MenuDishSummary[];
};

export function MenuDishList({ dishes }: MenuDishListProps) {
  if (dishes.length === 0) return null;

  return (
    <section
      data-component="menu-dish-list"
      className="mt-8 mb-2 max-w-xl"
      aria-labelledby="menu-dish-list-title"
    >
      <h2
        id="menu-dish-list-title"
        className="text-sm font-semibold text-foreground"
      >
        Блюда в меню
      </h2>
      <ul className="mt-3 divide-y divide-border border-y border-border">
        {dishes.map((dish) => {
          const valueLine = formatCompactValueLine(dish.batchTotals);
          return (
            <li
              key={dish.recipeId}
              className="flex items-baseline justify-between gap-4 py-2.5"
            >
              <div className="min-w-0">
                <span className="text-sm text-foreground">{dish.name}</span>
                {valueLine ? (
                  <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                    {valueLine}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                {formatDishDayCount(dish.dayCount)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
