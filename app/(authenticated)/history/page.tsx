import Link from "next/link";
import { redirect } from "next/navigation";

import { DeleteMenuButton } from "@/components/history/delete-menu-button";
import { HistoryRatingRow } from "@/components/history/history-rating-row";
import { loadHistory } from "@/domain/history/load-history";
import { createClient } from "@/lib/supabase/server";

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { menus, error } = await loadHistory(supabase, user.id);

  if (error) {
    return (
      <div className="max-w-xl">
        <h1 className="page-title">История</h1>
        <p className="mt-2 text-sm text-warning-fg" role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (menus.length === 0) {
    return (
      <div className="max-w-xl">
        <h1 className="page-title">История</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Пока нет прошлых меню. Создайте первое — оценки появятся здесь после
          готовки.
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
    <div className="w-full max-w-2xl">
      <div className="mb-8 max-w-xl">
        <h1 className="page-title">История</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Прошлые меню и рецепты. Оценки можно менять — без принудительного
          экрана после готовки.
        </p>
      </div>

      <div className="space-y-8">
        {menus.map((menu) => {
          const date = new Date(menu.createdAt);
          const label = Number.isNaN(date.getTime())
            ? menu.createdAt
            : date.toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            });

          return (
            <section
              key={menu.menuId}
              className="rounded-lg border border-border bg-background"
            >
              <header className="border-b border-border px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-accent">
                      Меню · {menu.dayCount}{" "}
                      {menu.dayCount === 1 ? "день" : "дня"}
                    </h2>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <Link
                      href={`/plan/menu?menuId=${encodeURIComponent(menu.menuId)}`}
                      className="mt-1 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Открыть меню
                    </Link>
                  </div>
                  <DeleteMenuButton menuId={menu.menuId} />
                </div>
              </header>
              <div className="space-y-2 p-3">
                {menu.recipes.length === 0 && menu.snacks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Пустые слоты — блюд и Snacks нет.
                  </p>
                ) : null}
                {menu.recipes.map((r) => (
                  <HistoryRatingRow
                    key={`${menu.menuId}-${r.recipeId}`}
                    kind="recipe"
                    recipeId={r.recipeId}
                    name={r.recipeName}
                    bodyText={r.bodyText}
                    ingredients={r.ingredients}
                    totalServings={r.totalServings}
                    peoplePerMeal={r.peoplePerMeal}
                    dayCount={r.dayCount}
                    rating={r.rating}
                    reason={r.reason}
                  />
                ))}
                {menu.snacks.map((s) => (
                  <HistoryRatingRow
                    key={`${menu.menuId}-${s.label}`}
                    kind="snack"
                    label={s.label}
                    name={s.label}
                    rating={s.rating}
                    reason={s.reason}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
