"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

const STEPS = [
  { href: "/plan/menu", label: "Состав", id: "menu" },
  { href: "/plan/shopping-list", label: "Список", id: "list" },
] as const;

type PillNavProps = {
  activeHref?: string;
};

export function PillNav({ activeHref = "/plan/menu" }: PillNavProps) {
  const searchParams = useSearchParams();
  const menuId = searchParams.get("menuId");

  return (
    <nav
      aria-label="Шаги планирования"
      className="flex gap-1.5 rounded-full bg-background p-1"
    >
      {STEPS.map((step) => {
        const isActive = step.href === activeHref;
        const href = menuId
          ? `${step.href}?menuId=${encodeURIComponent(menuId)}`
          : step.href;

        if (!menuId && step.id === "list") {
          return (
            <span
              key={step.href}
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
            key={step.href}
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
