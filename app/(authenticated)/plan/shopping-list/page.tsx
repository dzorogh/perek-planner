import Link from "next/link";

import { ShoppingListClient } from "@/components/shopping/shopping-list-view";
import { loadMenuSkeleton } from "@/domain/menu/load-menu";
import { buildShoppingSourceFromMenu } from "@/domain/shopping/source";
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
  const menuLoaded = await loadMenuSkeleton(supabase, menuId);
  const menu = menuLoaded.menu;

  if (menuLoaded.error || !menu) {
    return (
      <div className="max-w-xl">
        <h1 className="page-title">Список покупок</h1>
        <p className="mt-2 text-sm text-warning-fg" role="alert">
          {menuLoaded.error ?? "Меню не найдено."}
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

  const source = buildShoppingSourceFromMenu(menu);

  return (
    <div className="w-full">
      <div className="mb-6 max-w-2xl">
        <h1 className="page-title">Список покупок</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Продукты по блюдам слева — соберите список справа и скопируйте для
          заказа.
        </p>
      </div>
      <ShoppingListClient source={source} />
      <Link
        href={`/plan/menu?menuId=${encodeURIComponent(menuId)}`}
        className="mt-8 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        ← К меню
      </Link>
    </div>
  );
}
