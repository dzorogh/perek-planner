import Link from "next/link";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/history", label: "История" },
  { href: "/settings", label: "Настройки" },
] as const;

type PrimaryNavProps = {
  activeHref?: "/history" | "/settings";
};

export function PrimaryNav({ activeHref }: PrimaryNavProps) {
  return (
    <nav aria-label="Основная навигация" className="flex items-center gap-5">
      {LINKS.map((link) => {
        const isActive = link.href === activeHref;

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "text-[13px] transition-colors",
              isActive
                ? "font-semibold text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
