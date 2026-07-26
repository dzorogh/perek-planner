import type { MenuSkeletonView } from "@/domain/menu/load-menu";
import { recipeBatchScale } from "@/domain/recipes/batch-scale";
import type { RecipeIngredientView } from "@/domain/recipes/load-recipe";
import { normalizeDishName } from "@/domain/suggestions/dish-similarity";
import {
  formatLineLabel,
  formatQuantity,
  type IngredientUnit,
} from "@/domain/shopping/quantity";

export type ShoppingSourceProduct = {
  /** Merge key across dishes: normalizeDishName(name) + unit. */
  productKey: string;
  name: string;
  quantityAmount: number | null;
  quantityUnit: IngredientUnit | null;
  quantityLabel: string | null;
};

export type ShoppingSourceDish = {
  id: string;
  name: string;
  products: ShoppingSourceProduct[];
};

export type ShoppingSourceView = {
  menuId: string;
  dishes: ShoppingSourceDish[];
};

export type CuratedShoppingLine = {
  productKey: string;
  ingredientName: string;
  quantityAmount: number | null;
  quantityUnit: IngredientUnit | null;
};

/** Stable key so the same product merges across dishes. */
export function shoppingProductKey(
  name: string,
  unit: IngredientUnit | null,
): string {
  return `${normalizeDishName(name)}|${unit ?? ""}`;
}

export function contributionKey(dishId: string, productKey: string): string {
  return `${dishId}::${productKey}`;
}

function scaleIngredient(
  ing: RecipeIngredientView,
  servings: number,
): ShoppingSourceProduct | null {
  const name = ing.name.trim();
  if (!name) return null;
  const scaled =
    ing.unit &&
      ing.amountPerServing != null &&
      Number.isFinite(ing.amountPerServing) &&
      ing.amountPerServing > 0
      ? ing.amountPerServing * servings
      : null;
  const unit = scaled != null ? ing.unit : null;
  return {
    productKey: shoppingProductKey(name, unit),
    name,
    quantityAmount: scaled,
    quantityUnit: unit,
    quantityLabel: formatQuantity(scaled, unit),
  };
}

function productsFromRecipe(
  ingredients: readonly RecipeIngredientView[],
  servings: number,
): ShoppingSourceProduct[] {
  const byKey = new Map<string, ShoppingSourceProduct>();
  for (const ing of ingredients) {
    const product = scaleIngredient(ing, servings);
    if (!product) continue;
    const existing = byKey.get(product.productKey);
    if (!existing) {
      byKey.set(product.productKey, product);
      continue;
    }
    if (
      existing.quantityAmount != null &&
      product.quantityAmount != null &&
      existing.quantityUnit === product.quantityUnit
    ) {
      existing.quantityAmount += product.quantityAmount;
      existing.quantityLabel = formatQuantity(
        existing.quantityAmount,
        existing.quantityUnit,
      );
    }
  }
  return [...byKey.values()];
}

/**
 * Dish-grouped shopping SOURCE for the curation UI.
 * One group per unique recipe (servings summed across slots) + snack labels.
 * No dishes / staples / snacks section split.
 */
export function buildShoppingSourceFromMenu(
  menu: MenuSkeletonView,
): ShoppingSourceView {
  const recipeOrder: string[] = [];
  const recipeMeta = new Map<
    string,
    { name: string; ingredients: RecipeIngredientView[] }
  >();

  for (const slot of menu.slots) {
    for (const dish of slot.dishes) {
      if (
        typeof dish.recipeId === "string" &&
        typeof dish.recipeName === "string" &&
        dish.recipeName.trim()
      ) {
        if (!recipeMeta.has(dish.recipeId)) {
          recipeOrder.push(dish.recipeId);
          recipeMeta.set(dish.recipeId, {
            name: dish.recipeName.trim(),
            ingredients: dish.recipeIngredients,
          });
        }
      }
    }
    if (
      typeof slot.recipeId === "string" &&
      typeof slot.recipeName === "string" &&
      slot.recipeName.trim() &&
      !recipeMeta.has(slot.recipeId)
    ) {
      recipeOrder.push(slot.recipeId);
      recipeMeta.set(slot.recipeId, {
        name: slot.recipeName.trim(),
        ingredients: slot.recipeIngredients,
      });
    }
  }

  const dishes: ShoppingSourceDish[] = [];

  for (const recipeId of recipeOrder) {
    const meta = recipeMeta.get(recipeId);
    if (!meta) continue;
    const batch = recipeBatchScale(menu.slots, recipeId);
    const products = productsFromRecipe(meta.ingredients, batch.totalServings);
    if (products.length === 0) continue;
    dishes.push({
      id: `recipe:${recipeId}`,
      name: meta.name,
      products,
    });
  }

  const seenSnacks = new Set<string>();
  for (const slot of menu.slots) {
    for (const dish of slot.dishes) {
      const label =
        typeof dish.snackLabel === "string" ? dish.snackLabel.trim() : "";
      if (!label) continue;
      const key = label.toLocaleLowerCase("ru");
      if (seenSnacks.has(key)) continue;
      seenSnacks.add(key);
      dishes.push({
        id: `snack-dish:${key}`,
        name: label,
        products: [
          {
            productKey: shoppingProductKey(label, null),
            name: label,
            quantityAmount: null,
            quantityUnit: null,
            quantityLabel: null,
          },
        ],
      });
    }
  }
  for (const snack of menu.snacks) {
    const label = snack.label.trim();
    if (!label) continue;
    const key = label.toLocaleLowerCase("ru");
    if (seenSnacks.has(key)) continue;
    seenSnacks.add(key);
    dishes.push({
      id: `snack:${snack.id}`,
      name: label,
      products: [
        {
          productKey: shoppingProductKey(label, null),
          name: label,
          quantityAmount: null,
          quantityUnit: null,
          quantityLabel: null,
        },
      ],
    });
  }

  return { menuId: menu.id, dishes };
}

/** Add one dish's product qty into the curated cart (idempotent per dish+product). */
export function addProductContribution(
  cart: Map<string, CuratedShoppingLine>,
  contributed: Set<string>,
  dishId: string,
  product: ShoppingSourceProduct,
): void {
  const cKey = contributionKey(dishId, product.productKey);
  if (contributed.has(cKey)) return;

  const existing = cart.get(product.productKey);
  if (!existing) {
    cart.set(product.productKey, {
      productKey: product.productKey,
      ingredientName: product.name,
      quantityAmount: product.quantityAmount,
      quantityUnit: product.quantityUnit,
    });
  } else if (
    existing.quantityAmount != null &&
    product.quantityAmount != null &&
    existing.quantityUnit === product.quantityUnit
  ) {
    existing.quantityAmount += product.quantityAmount;
  } else if (existing.quantityAmount == null && product.quantityAmount != null) {
    existing.quantityAmount = product.quantityAmount;
    existing.quantityUnit = product.quantityUnit;
  }

  contributed.add(cKey);
}

/**
 * Add a product once → pull qty from every dish that has it, mark all selected.
 */
export function addProductAcrossAllDishes(
  cart: Map<string, CuratedShoppingLine>,
  contributed: Set<string>,
  dishes: readonly ShoppingSourceDish[],
  productKey: string,
): void {
  for (const dish of dishes) {
    const product = dish.products.find((p) => p.productKey === productKey);
    if (!product) continue;
    addProductContribution(cart, contributed, dish.id, product);
  }
}

export function addAllDishProducts(
  cart: Map<string, CuratedShoppingLine>,
  contributed: Set<string>,
  dishes: readonly ShoppingSourceDish[],
  dish: ShoppingSourceDish,
): void {
  for (const product of dish.products) {
    addProductAcrossAllDishes(cart, contributed, dishes, product.productKey);
  }
}

export function removeCuratedProduct(
  cart: Map<string, CuratedShoppingLine>,
  contributed: Set<string>,
  productKey: string,
): void {
  cart.delete(productKey);
  for (const key of [...contributed]) {
    if (key.endsWith(`::${productKey}`)) contributed.delete(key);
  }
}

/** Product keys that still appear in at least one SOURCE dish. */
export function pruneOrphanProductKeys(
  dishes: readonly ShoppingSourceDish[],
  productKeys: readonly string[] | null | undefined,
): string[] {
  const present = new Set<string>();
  for (const dish of dishes) {
    for (const product of dish.products) {
      present.add(product.productKey);
    }
  }
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const key of productKeys ?? []) {
    if (!present.has(key) || seen.has(key)) continue;
    seen.add(key);
    kept.push(key);
  }
  return kept;
}

/**
 * Rebuild curated cart + contribution set by replaying keys against live SOURCE.
 * Orphan keys (no matching dish product) are skipped.
 */
export function hydrateCuratedCartFromKeys(
  dishes: readonly ShoppingSourceDish[],
  productKeys: readonly string[] | null | undefined,
): {
  cart: Map<string, CuratedShoppingLine>;
  contributed: Set<string>;
  appliedKeys: string[];
} {
  const cart = new Map<string, CuratedShoppingLine>();
  const contributed = new Set<string>();
  const appliedKeys: string[] = [];
  for (const key of pruneOrphanProductKeys(dishes, productKeys)) {
    addProductAcrossAllDishes(cart, contributed, dishes, key);
    if (cart.has(key)) appliedKeys.push(key);
  }
  return { cart, contributed, appliedKeys };
}

export function formatCuratedShoppingCopy(
  lines: readonly CuratedShoppingLine[],
): string {
  if (lines.length === 0) {
    return "Список покупок пуст.";
  }
  const body = lines.map(
    (line) =>
      `• ${formatLineLabel(line.ingredientName, line.quantityAmount, line.quantityUnit)}`,
  );
  return ["Список покупок", "", ...body].join("\n");
}
