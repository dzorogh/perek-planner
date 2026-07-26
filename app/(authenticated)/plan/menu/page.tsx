import Link from "next/link";

/** Empty gate when no menu is selected — scoped menus live at `/plan/[menuId]/menu`. */
export default function PlanMenuGatePage() {
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
