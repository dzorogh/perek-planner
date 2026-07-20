import Link from "next/link";
import { redirect } from "next/navigation";

import { RecipeTextPanel } from "@/components/recipes/recipe-text-panel";
import { MenuTotalsBar } from "@/components/recipes/recipe-value-line";
import { ShoppingListClient } from "@/components/shopping/shopping-list-view";
import { loadMenuSkeleton } from "@/domain/menu/load-menu";
import { hasSlotEditPassed } from "@/domain/menu/uj1-gate";
import { recipeBatchScale } from "@/domain/recipes/batch-scale";
import type { RecipeIngredientView } from "@/domain/recipes/load-recipe";
import {
  EMPTY_PER_SERVING,
  sumMenuTotals,
  type RecipePerServingValue,
} from "@/domain/recipes/scale-totals";
import { buildShoppingList } from "@/domain/shopping/build-list";
import { createClient } from "@/lib/supabase/server";

type PlanShoppingListPageProps = {
  searchParams: Promise<{ menuId?: string }>;
};

export default async function PlanShoppingListPage({
  searchParams,
}: PlanShoppingListPageProps) {
  const { menuId: rawMenuId } = await searchParams;
  const menuId = rawMenuId?.trim() ?? "";

  if (!menuId) {
    return (
      <div className="max-w-xl">
        <h1 className="page-title">Список покупок</h1>
        <p className="mt-2 text-sm text-muted-foreground" role="status">
          Выберите меню или создайте новое — затем перейдите к списку из состава.
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
  const passed = await hasSlotEditPassed(supabase, menuId);
  if (!passed) {
    redirect(`/plan/menu?menuId=${encodeURIComponent(menuId)}`);
  }

  const [built, menuLoaded] = await Promise.all([
    buildShoppingList(supabase, menuId),
    loadMenuSkeleton(supabase, menuId),
  ]);
  if (!built.ok) {
    return (
      <div className="max-w-xl">
        <h1 className="page-title">Список покупок</h1>
        <p className="mt-2 text-sm text-warning-fg" role="alert">
          {built.error}
        </p>
        <Link
          href={`/plan/menu?menuId=${encodeURIComponent(menuId)}`}
          className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          К меню
        </Link>
      </div>
    );
  }

  const slots = menuLoaded.menu?.slots ?? [];
  const recipeMap = new Map<
    string,
    {
      id: string;
      name: string;
      bodyText: string;
      ingredients: RecipeIngredientView[];
      value: RecipePerServingValue;
    }
  >();
  for (const slot of slots) {
    if (slot.recipeId && slot.recipeName && !recipeMap.has(slot.recipeId)) {
      recipeMap.set(slot.recipeId, {
        id: slot.recipeId,
        name: slot.recipeName,
        bodyText: slot.recipeBodyText ?? "",
        ingredients: slot.recipeIngredients,
        value: slot.recipeValue ?? { ...EMPTY_PER_SERVING },
      });
    }
    if (
      slot.companionRecipeId &&
      slot.companionRecipeName &&
      !recipeMap.has(slot.companionRecipeId)
    ) {
      recipeMap.set(slot.companionRecipeId, {
        id: slot.companionRecipeId,
        name: slot.companionRecipeName,
        bodyText: slot.companionRecipeBodyText ?? "",
        ingredients: slot.companionRecipeIngredients,
        value: slot.companionRecipeValue ?? { ...EMPTY_PER_SERVING },
      });
    }
  }
  const recipes = [...recipeMap.values()].map((r) => ({
    ...r,
    batch: recipeBatchScale(slots, r.id),
  }));

  return (
    <div className="w-full">
      <div className="mb-6 max-w-xl">
        <h1 className="page-title">Список покупок</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Один список на меню с количеством и весом (по числу человек из
          создания меню). Копия всегда доступна.
        </p>
      </div>
      <MenuTotalsBar totals={sumMenuTotals(slots)} className="mb-6 max-w-xl" />
      <ShoppingListClient list={built.list} />
      {recipes.length > 0 ? (
        <section className="mt-8 max-w-xl">
          <h2 className="text-sm font-semibold text-accent">Рецепты меню</h2>
          <ul className="mt-2 space-y-1.5">
            {recipes.map((r) => (
              <li key={r.id}>
                <RecipeTextPanel
                  recipeId={r.id}
                  recipeName={r.name}
                  bodyText={r.bodyText}
                  ingredients={r.ingredients}
                  value={r.value}
                  totalServings={r.batch.totalServings}
                  peoplePerMeal={r.batch.peoplePerMeal}
                  dayCount={r.batch.dayCount}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <Link
        href={`/plan/menu?menuId=${encodeURIComponent(menuId)}`}
        className="mt-8 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        ← К меню
      </Link>
    </div>
  );
}
