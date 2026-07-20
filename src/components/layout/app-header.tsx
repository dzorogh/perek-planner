"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { BrandMark } from "@/components/layout/brand-mark";
import { PillNav } from "@/components/layout/pill-nav";
import {
  isPlanRoute,
  resolvePrimaryActiveHref,
  resolveWizardActiveHref,
} from "@/components/layout/plan-chrome";
import { PrimaryNav } from "@/components/layout/primary-nav";
import { LogoutButton } from "@/components/logout-button";
import { CreateMenuCta } from "@/components/menu/create-menu-cta";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const chromeInner =
  "mx-auto flex w-full max-w-[1180px] items-center px-7 xl:px-10";

export function AppHeader() {
  const pathname = usePathname();
  const showWizard = isPlanRoute(pathname);
  const wizardActiveHref = resolveWizardActiveHref(pathname);
  const primaryActiveHref = resolvePrimaryActiveHref(pathname);

  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className={cn(chromeInner, "justify-between gap-6 py-[14px]")}>
          <Link
            href="/history"
            className="flex min-w-0 items-center gap-2.5"
            aria-label="Keplo — на главную"
          >
            <BrandMark className="size-8 shrink-0" />
            <span className="section-title tracking-[-0.03em] text-accent">
              Keplo
            </span>
          </Link>

          <div className="flex flex-wrap items-center justify-end gap-4">
            <Suspense
              fallback={
                <Button size="sm" disabled>
                  Создать меню
                </Button>
              }
            >
              <CreateMenuCta />
            </Suspense>
            <PrimaryNav activeHref={primaryActiveHref} />
            <LogoutButton />
          </div>
        </div>
      </header>

      {showWizard ? (
        <div className="border-b border-border bg-[#F8FAFC]">
          <div className={cn(chromeInner, "flex-wrap gap-2 py-2.5")}>
            <Suspense
              fallback={
                <nav
                  aria-label="Шаги планирования"
                  className="flex gap-1.5 rounded-full bg-background p-1"
                />
              }
            >
              <PillNav activeHref={wizardActiveHref} />
            </Suspense>
          </div>
        </div>
      ) : null}
    </>
  );
}
