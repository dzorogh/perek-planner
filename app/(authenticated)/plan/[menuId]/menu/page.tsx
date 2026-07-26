import Link from "next/link";

import { MenuSettingsChips } from "@/components/menu/menu-settings-chips";
import { MenuSheetGrid } from "@/components/menu/menu-sheet-grid";
import { MenuTotalsBar } from "@/components/recipes/recipe-value-line";
import { MEAL_SLOTS, type MealSlot } from "@/domain/menu/constants";
import { loadMenuSkeleton } from "@/domain/menu/load-menu";
import { sumMenuTotals } from "@/domain/recipes/scale-totals";
import { createClient } from "@/lib/supabase/server";

type PlanMenuPageProps = {
  params: Promise<{ menuId: string }>;
};

function mealsFromSlots(slots: { meal: string }[]): MealSlot[] {
  const present = new Set(slots.map((s) => s.meal));
  return MEAL_SLOTS.filter((m) => present.has(m));
}

export default async function PlanMenuPage({ params }: PlanMenuPageProps) {
  const { menuId: rawMenuId } = await params;
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

  const people = menu.slots.find((s) => s.servings > 0)?.servings ?? 2;
  const chipMeals: MealSlot[] = [
    ...mealsFromSlots(menu.slots),
    ...(menu.snacks.length > 0 ? (["snack"] as const) : []),
  ];

  return (
    <div className="w-full">
      <div className="mb-2">
        <h1 className="page-title">Меню</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Проверьте блюда и при необходимости замените. Список — в шагах выше.
        </p>
        <MenuSettingsChips
          dayCount={menu.dayCount}
          people={people}
          meals={chipMeals}
          equipment={menu.availableEquipment}
        />
      </div>

      <MenuSheetGrid
        menuId={menu.id}
        dayCount={menu.dayCount}
        slots={menu.slots}
        snacks={menu.snacks}
      />

      <MenuTotalsBar
        className="mt-5 rounded-lg border border-border bg-surface px-5 py-4"
        dayCount={menu.dayCount}
        people={people}
        totals={sumMenuTotals(menu.slots, {
          snacks: menu.snacks,
          snackServings: people,
        })}
      />
    </div>
  );
}
