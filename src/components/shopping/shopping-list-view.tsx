"use client";

import { Check, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ShoppingLiveSync } from "@/components/shopping/shopping-live-sync";
import { Button } from "@/components/ui/button";
import { setShoppingSelectionAction } from "@/domain/shopping/shopping-actions";
import { formatQuantity } from "@/domain/shopping/quantity";
import {
  addAllDishProducts,
  addProductAcrossAllDishes,
  contributionKey,
  formatCuratedShoppingCopy,
  hydrateCuratedCartFromKeys,
  removeCuratedProduct,
  type CuratedShoppingLine,
  type ShoppingSourceDish,
  type ShoppingSourceView,
} from "@/domain/shopping/source";

type ShoppingListViewProps = {
  source: ShoppingSourceView;
  initialProductKeys: readonly string[];
  slotIds: readonly string[];
  loadError?: string | null;
};

function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function cartKeys(cart: Map<string, CuratedShoppingLine>): string[] {
  return [...cart.keys()];
}

export function ShoppingListClient({
  source,
  initialProductKeys,
  slotIds,
  loadError = null,
}: ShoppingListViewProps) {
  const initialHydrated = hydrateCuratedCartFromKeys(
    source.dishes,
    initialProductKeys,
  );
  const [cart, setCart] = useState<Map<string, CuratedShoppingLine>>(
    () => initialHydrated.cart,
  );
  const [contributed, setContributed] = useState<Set<string>>(
    () => initialHydrated.contributed,
  );
  const [copied, setCopied] = useState(false);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const cartRef = useRef(cart);
  const contributedRef = useRef(contributed);
  const persistQueueRef = useRef(Promise.resolve());
  const pendingCountRef = useRef(0);
  const dirtyRef = useRef(false);
  const aliveRef = useRef(true);
  const selectionBlocked = Boolean(loadError);

  const initialKeysKey = initialProductKeys.join("\0");
  const sourceKey = useMemo(() => {
    return source.dishes
      .map((d) => {
        const products = d.products
          .map((p) => [p.productKey, p.quantityAmount ?? ""].join(":"))
          .join(",");
        return [d.id, products].join(":");
      })
      .join("|");
  }, [source.dishes]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Do not clobber in-flight edits or unsaved dirty state after a failed persist.
    if (pendingCountRef.current > 0 || dirtyRef.current) {
      return;
    }
    const hydrated = hydrateCuratedCartFromKeys(
      source.dishes,
      initialProductKeys,
    );
    cartRef.current = hydrated.cart;
    contributedRef.current = hydrated.contributed;
    setCart(new Map(hydrated.cart));
    setContributed(new Set(hydrated.contributed));
  }, [initialKeysKey, sourceKey, initialProductKeys, source.dishes]);

  const dishById = useMemo(() => {
    const map = new Map<string, ShoppingSourceDish>();
    for (const dish of source.dishes) map.set(dish.id, dish);
    return map;
  }, [source.dishes]);

  const curatedLines = useMemo(() => [...cart.values()], [cart]);

  function enqueuePersist() {
    pendingCountRef.current += 1;
    setIsPending(true);
    persistQueueRef.current = persistQueueRef.current
      .then(async () => {
        const keys = cartKeys(cartRef.current);
        const result = await setShoppingSelectionAction(source.menuId, keys);
        if (!aliveRef.current) return;
        if (!result.ok) {
          dirtyRef.current = true;
          setIsDirty(true);
          setPersistError(result.error);
          return;
        }
        dirtyRef.current = false;
        setIsDirty(false);
        setPersistError(null);
      })
      .catch(() => {
        if (!aliveRef.current) return;
        dirtyRef.current = true;
        setIsDirty(true);
        setPersistError("Не удалось сохранить список покупок.");
      })
      .finally(() => {
        pendingCountRef.current -= 1;
        if (pendingCountRef.current === 0 && aliveRef.current) {
          setIsPending(false);
        }
      });
  }

  function commit(
    nextCart: Map<string, CuratedShoppingLine>,
    nextContributed: Set<string>,
  ) {
    if (selectionBlocked) return;
    cartRef.current = nextCart;
    contributedRef.current = nextContributed;
    setCart(new Map(nextCart));
    setContributed(new Set(nextContributed));
    setCopied(false);
    setCopyHint(null);
    setPersistError(null);
    enqueuePersist();
  }

  function onToggleProduct(productKey: string) {
    const nextCart = new Map(cartRef.current);
    const nextContributed = new Set(contributedRef.current);
    if (nextCart.has(productKey)) {
      removeCuratedProduct(nextCart, nextContributed, productKey);
    } else {
      addProductAcrossAllDishes(
        nextCart,
        nextContributed,
        source.dishes,
        productKey,
      );
    }
    commit(nextCart, nextContributed);
  }

  function onAddAll(dishId: string) {
    const dish = dishById.get(dishId);
    if (!dish) return;
    const nextCart = new Map(cartRef.current);
    const nextContributed = new Set(contributedRef.current);
    addAllDishProducts(nextCart, nextContributed, source.dishes, dish);
    commit(nextCart, nextContributed);
  }

  function onRemove(productKey: string) {
    const nextCart = new Map(cartRef.current);
    const nextContributed = new Set(contributedRef.current);
    removeCuratedProduct(nextCart, nextContributed, productKey);
    commit(nextCart, nextContributed);
  }

  async function onCopy() {
    if (curatedLines.length === 0) {
      setCopyHint("Сначала добавьте продукты в список.");
      setCopied(false);
      return;
    }
    const text = formatCuratedShoppingCopy(curatedLines);
    setCopyHint(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
      setCopyHint("Не удалось скопировать список. Скопируйте вручную.");
    }
  }

  return (
    <div>
      <ShoppingLiveSync
        menuId={source.menuId}
        slotIds={slotIds}
        isPending={isPending || isDirty}
      />
      {loadError ? (
        <p className="mb-4 text-sm text-warning-fg" role="status">
          {loadError}
        </p>
      ) : null}
      {persistError ? (
        <p className="mb-4 text-sm text-warning-fg" role="status">
          {persistError}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <section
          data-component="shopping-source-panel"
          className="min-w-0 rounded-md border border-border bg-card p-4 sm:p-5"
        >
          <h2 className="text-sm font-semibold text-accent">
            Продукты по блюдам
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Добавляйте «+» или всё блюдо сразу — список справа.
          </p>

          {source.dishes.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              Список пуст — добавьте блюда или перекусы в меню.
            </p>
          ) : (
            <div className="mt-4 space-y-5">
              {source.dishes.map((dish) => {
                const allIn = dish.products.every((p) =>
                  contributed.has(contributionKey(dish.id, p.productKey)),
                );
                return (
                  <div key={dish.id} data-dish-id={dish.id}>
                    <div className="mb-2 flex items-baseline justify-between gap-3">
                      <h3 className="text-sm font-semibold text-foreground">
                        {dish.name}
                      </h3>
                      <button
                        type="button"
                        data-component="dish-add-all"
                        disabled={allIn || selectionBlocked}
                        onClick={() => onAddAll(dish.id)}
                        className="shrink-0 text-xs font-medium text-primary underline-offset-4 hover:underline disabled:cursor-default disabled:text-muted-foreground disabled:no-underline"
                      >
                        {allIn ? "Всё добавлено" : "Добавить всё"}
                      </button>
                    </div>
                    <ul className="space-y-1">
                      {dish.products.map((product) => {
                        const selected = cart.has(product.productKey);
                        return (
                          <li
                            key={`${dish.id}:${product.productKey}`}
                            className={`flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm ${selected
                                ? "bg-primary/5 text-foreground"
                                : "text-foreground"
                              }`}
                          >
                            <span className="min-w-0 flex-1">
                              {product.name}
                            </span>
                            {product.quantityLabel ? (
                              <span className="shrink-0 tabular-nums text-muted-foreground">
                                {product.quantityLabel}
                              </span>
                            ) : null}
                            <button
                              type="button"
                              data-component="product-add"
                              disabled={selectionBlocked}
                              onClick={() =>
                                onToggleProduct(product.productKey)
                              }
                              aria-label={
                                selected
                                  ? `Убрать из списка: ${product.name}`
                                  : `Добавить: ${product.name}`
                              }
                              className={`inline-flex size-7 shrink-0 items-center justify-center rounded-sm border transition-colors disabled:opacity-50 ${selected
                                  ? "border-primary/30 bg-primary/10 text-primary hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
                                  : "border-border bg-card text-primary hover:border-primary/40 hover:bg-background"
                                }`}
                            >
                              {selected ? (
                                <Check className="size-3.5" aria-hidden />
                              ) : (
                                <Plus className="size-3.5" aria-hidden />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section
          data-component="shopping-list-panel"
          className="min-w-0 rounded-md border border-border bg-card p-4 sm:p-5 lg:sticky lg:top-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-accent">
                Список покупок
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {curatedLines.length === 0
                  ? "Пока пусто"
                  : `${curatedLines.length} ${pluralRu(curatedLines.length, "позиция", "позиции", "позиций")}`}
              </p>
            </div>
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
          {copyHint ? (
            <p className="mt-3 text-sm text-warning-fg" role="status">
              {copyHint}
            </p>
          ) : null}

          {curatedLines.length === 0 ? (
            <div className="mt-8 rounded-sm border border-dashed border-border bg-background px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">
                Список пока пуст
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Нажимайте «+» у продуктов слева — они появятся здесь.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-1">
              {curatedLines.map((line) => {
                const qty = formatQuantity(
                  line.quantityAmount,
                  line.quantityUnit,
                );
                return (
                  <li
                    key={line.productKey}
                    className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
                  >
                    <span className="min-w-0 flex-1">{line.ingredientName}</span>
                    {qty ? (
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {qty}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      data-component="product-remove"
                      disabled={selectionBlocked}
                      onClick={() => onRemove(line.productKey)}
                      aria-label={`Убрать: ${line.ingredientName}`}
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-sm border border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive disabled:opacity-50"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
