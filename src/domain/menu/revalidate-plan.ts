import { revalidatePath } from "next/cache";

import {
  planMenuPath,
  planShoppingListPath,
} from "@/components/layout/plan-paths";

export function revalidatePlanForMenu(menuId: string): void {
  revalidatePath(planMenuPath(menuId));
  revalidatePath(planShoppingListPath(menuId));
}
