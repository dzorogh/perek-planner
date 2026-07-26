"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  parsePlanMenuId,
  planMenuPath,
  planShoppingListPath,
} from "@/components/layout/plan-paths";
import { cn } from "@/lib/utils";

const STEPS = [
  { step: "menu", label: "Состав", id: "menu" },
  { step: "list", label: "Список", id: "list" },
] as const;

type PillNavProps = {
  activeHref?: "/plan/menu" | "/plan/shopping-list";
};

export function PillNav({ activeHref = "/plan/menu" }: PillNavProps) {
  const pathname = usePathname();
  const menuId = parsePlanMenuId(pathname);

  return (
    <nav
      aria-label="Шаги планирования"
      className="flex gap-1.5 rounded-full bg-background p-1"
    >
      {STEPS.map((step) => {
        const gateHref =
          step.step === "menu" ? "/plan/menu" : "/plan/shopping-list";
        const isActive = gateHref === activeHref;
        const href = menuId
          ? step.step === "menu"
            ? planMenuPath(menuId)
            : planShoppingListPath(menuId)
          : gateHref;

        if (!menuId && step.id === "list") {
          return (
            <span
              key={step.id}
              role="link"
              tabIndex={0}
              aria-disabled="true"
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "cursor-not-allowed rounded-full px-3.5 py-1.5 text-[13px] text-muted-foreground/50",
                isActive && "bg-surface text-primary shadow-sm",
              )}
              title="Сначала выберите или создайте меню"
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                }
              }}
            >
              {step.label}
            </span>
          );
        }

        return (
          <Link
            key={step.id}
            href={href}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[13px] transition-colors",
              isActive
                ? "bg-surface text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {step.label}
          </Link>
        );
      })}
    </nav>
  );
}
