"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { getSlotEditPassedAction } from "@/domain/menu/uj1-actions";
import { cn } from "@/lib/utils";

const STEPS = [
  { href: "/plan/menu", label: "Состав", id: "menu" },
  { href: "/plan/shopping-list", label: "Список", id: "list" },
] as const;

const UJ1_TITLE = "Сначала проверьте меню и перейдите к списку покупок";

type PillNavProps = {
  activeHref?: string;
};

export function PillNav({ activeHref = "/plan/menu" }: PillNavProps) {
  const searchParams = useSearchParams();
  const menuId = searchParams.get("menuId");
  const [fetched, setFetched] = useState<{
    menuId: string;
    passed: boolean;
  } | null>(null);

  useEffect(() => {
    if (!menuId) return;
    let cancelled = false;
    void getSlotEditPassedAction(menuId)
      .then((passed) => {
        if (!cancelled) setFetched({ menuId, passed });
      })
      .catch(() => {
        if (!cancelled) setFetched({ menuId, passed: false });
      });
    return () => {
      cancelled = true;
    };
  }, [menuId]);

  const slotEditPassed =
    menuId && fetched?.menuId === menuId ? fetched.passed : null;

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

        const needsPass = step.id === "list";
        const blocked = needsPass && (!menuId || slotEditPassed !== true);

        if (blocked) {
          return (
            <span
              key={step.href}
              role="link"
              tabIndex={0}
              aria-disabled="true"
              aria-current={isActive ? "page" : undefined}
              aria-describedby="plan-wizard-list-blocked"
              className={cn(
                "cursor-not-allowed rounded-full px-3.5 py-1.5 text-[13px] text-muted-foreground/50",
                isActive && "bg-surface font-semibold text-primary shadow-sm",
              )}
              title={UJ1_TITLE}
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
                ? "bg-surface font-semibold text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {step.label}
          </Link>
        );
      })}
      <span id="plan-wizard-list-blocked" className="sr-only">
        {UJ1_TITLE}
      </span>
    </nav>
  );
}
