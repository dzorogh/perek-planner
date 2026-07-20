"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ShoppingListView } from "@/domain/shopping/build-list";
import { formatShoppingListCopy } from "@/domain/shopping/build-list";

type ShoppingListViewProps = {
  list: ShoppingListView;
};

const KIND_LABEL: Record<ShoppingListView["lines"][number]["lineKind"], string> =
{
  ingredient: "Блюда",
  pantry: "Базовые продукты",
  snack: "Перекусы",
};

export function ShoppingListClient({ list }: ShoppingListViewProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  async function onCopy() {
    const text = formatShoppingListCopy(list);
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
      setCopyError("Не удалось скопировать список. Скопируйте вручную.");
    }
  }

  const byKind = {
    ingredient: list.lines.filter((l) => l.lineKind === "ingredient"),
    pantry: list.lines.filter((l) => l.lineKind === "pantry"),
    snack: list.lines.filter((l) => l.lineKind === "snack"),
  };

  return (
    <div className="max-w-xl">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          data-component="shopping-list-cta"
          className="rounded-sm"
          onClick={() => void onCopy()}
        >
          Копировать список
        </Button>
      </div>

      {copied ? (
        <p className="mt-3 text-sm text-primary" role="status">
          Список скопирован.
        </p>
      ) : null}
      {copyError ? (
        <p className="mt-3 text-sm text-warning-fg" role="alert">
          {copyError}
        </p>
      ) : null}

      {list.lines.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Список пуст — добавьте блюда или перекусы в меню.
        </p>
      ) : (
        <div className="mt-6 space-y-5">
          {(["ingredient", "pantry", "snack"] as const).map((kind) => {
            const lines = byKind[kind];
            if (lines.length === 0) return null;
            return (
              <section key={kind}>
                <h2 className="text-sm font-semibold text-accent">
                  {KIND_LABEL[kind]}
                </h2>
                {kind === "pantry" ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Базовые продукты — отфильтруйте при покупке при необходимости.
                  </p>
                ) : null}
                <ul className="mt-2 space-y-1.5">
                  {lines.map((line) => (
                    <li
                      key={line.id}
                      className="flex items-baseline justify-between gap-4 text-sm text-foreground"
                    >
                      <span>{line.ingredientName}</span>
                      {line.quantityLabel ? (
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {line.quantityLabel}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
