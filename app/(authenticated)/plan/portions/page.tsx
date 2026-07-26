import { redirect } from "next/navigation";

import { planShoppingListPath } from "@/components/layout/plan-paths";

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
    redirect(planShoppingListPath(menuId));
  }
  redirect("/history");
}
