import Link from "next/link";

import { ContinueToShoppingButton } from "@/components/menu/continue-to-shopping-button";
import { DayCardGrid } from "@/components/menu/day-card-grid";
import { MenuDishList } from "@/components/menu/menu-dish-list";
import { MenuTotalsBar } from "@/components/recipes/recipe-value-line";
import { summarizeMenuDishes } from "@/domain/menu/dish-summary";
import { loadMenuSkeleton } from "@/domain/menu/load-menu";
import { sumMenuTotals } from "@/domain/recipes/scale-totals";
import { createClient } from "@/lib/supabase/server";

type PlanMenuPageProps = {
  searchParams: Promise<{ menuId?: string; error?: string }>;
};

export default async function PlanMenuPage({ searchParams }: PlanMenuPageProps) {
  const { menuId: rawMenuId, error: errorParam } = await searchParams;
  const menuId = rawMenuId?.trim() ?? "";

  if (!menuId) {
    return (
      <div className="max-w-xl">
        <h1 className="page-title">Меню</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Создайте меню — появится состав по дням.
        </p>
        <Link
          href="/history?create=1"
          className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Создать меню
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const { menu, error } = await loadMenuSkeleton(supabase, menuId);

  if (error || !menu) {
    return (
      <div className="max-w-xl">
        <h1 className="page-title">Меню</h1>
        <p className="mt-2 text-sm text-warning-fg" role="alert">
          {error ?? "Меню не найдено."}
        </p>
        <Link
          href="/history?create=1"
          className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Создать меню
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-8 max-w-xl">
        <h1 className="page-title">Меню</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Меню на {menu.dayCount}{" "}
          {menu.dayCount === 1
            ? "день"
            : menu.dayCount >= 2 && menu.dayCount <= 4
              ? "дня"
              : "дней"}
          ,{" "}
          {menu.slots[0]?.servings ?? 2} чел. на приём — проверьте слоты, при
          необходимости замените.
        </p>
        {errorParam === "continue" ? (
          <p className="mt-2 text-sm text-warning-fg" role="alert">
            Не удалось продолжить. Попробуйте снова.
          </p>
        ) : null}
      </div>

      <DayCardGrid
        menuId={menu.id}
        dayCount={menu.dayCount}
        slots={menu.slots}
        snacks={menu.snacks}
      />

      <MenuTotalsBar totals={sumMenuTotals(menu.slots)} />

      <MenuDishList dishes={summarizeMenuDishes(menu.slots)} />

      <ContinueToShoppingButton menuId={menu.id} />
    </div>
  );
}
