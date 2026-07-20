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
  const createFromUrl = searchParams.get("create") === "1";
  const [open, setOpen] = useState(false);
  const [latchedCreate, setLatchedCreate] = useState(false);

  // Latch open from ?create=1 during render (React "adjusting state when props change").
  if (createFromUrl && !latchedCreate) {
    setLatchedCreate(true);
    setOpen(true);
  } else if (!createFromUrl && latchedCreate) {
    setLatchedCreate(false);
  }

  // Strip the one-shot query after it has opened the dialog.
  useEffect(() => {
    if (!createFromUrl) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("create");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [createFromUrl, pathname, router, searchParams]);

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
