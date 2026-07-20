"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { CreateMenuDialog } from "@/components/menu/create-menu-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Header CTA — opens create-menu as a one-shot modal (not a wizard step). */
export function CreateMenuCta() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("create") !== "1") return;
    setOpen(true);
    const next = new URLSearchParams(searchParams.toString());
    next.delete("create");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  return (
    <>
      <Button
        type="button"
        size="sm"
        data-component="create-menu-cta"
        className={cn(open && "ring-2 ring-primary/25")}
        onClick={() => setOpen(true)}
      >
        Создать меню
      </Button>
      <CreateMenuDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
