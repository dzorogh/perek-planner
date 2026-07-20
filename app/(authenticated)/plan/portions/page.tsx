import { redirect } from "next/navigation";

type PlanPortionsPageProps = {
  searchParams: Promise<{ menuId?: string }>;
};

/** Legacy route: portion grid removed — people count is set at menu create. */
export default async function PlanPortionsPage({
  searchParams,
}: PlanPortionsPageProps) {
  const { menuId: rawMenuId } = await searchParams;
  const menuId = rawMenuId?.trim() ?? "";
  if (menuId) {
    redirect(`/plan/shopping-list?menuId=${encodeURIComponent(menuId)}`);
  }
  redirect("/history");
}
