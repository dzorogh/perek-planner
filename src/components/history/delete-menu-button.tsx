"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { deleteMenuAction } from "@/domain/history/delete-actions";

type DeleteMenuButtonProps = {
  menuId: string;
};

export function DeleteMenuButton({ menuId }: DeleteMenuButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (
      !window.confirm(
        "Удалить это меню? Слоты и список покупок тоже исчезнут.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteMenuAction(menuId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        data-component="delete-menu"
        className="h-auto px-0 text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-warning-fg"
        disabled={pending}
        aria-busy={pending}
        onClick={handleClick}
      >
        {pending ? "Удаляем…" : "Удалить"}
      </Button>
      {error ? (
        <p className="text-xs text-warning-fg" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
