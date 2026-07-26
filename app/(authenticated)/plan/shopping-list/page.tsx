import Link from "next/link";

/** Empty gate when no menu is selected — scoped lists live at `/plan/[menuId]/shopping-list`. */
export default function PlanShoppingListGatePage() {
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
