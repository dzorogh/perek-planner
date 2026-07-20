import type { MealSlot } from "@/domain/menu/constants";
import { normalizeDishName } from "@/domain/suggestions/dish-similarity";

/** Meals that expect morning food. */
export function isBreakfastMeal(meal: MealSlot): boolean {
  return meal === "breakfast" || meal === "second_breakfast";
}

/**
 * Detect no-cook snack labels that belong in `menu_snacks`, not cookable slots.
 * Cooked breakfast (каша, сырники, яичница) must not be rejected.
 */
export function looksLikeNoCookSnack(name: string): boolean {
  const n = normalizeDishName(name);
  if (!n) return false;
  if (n.includes("перекус")) return true;
  if (/(^|\s)(снек|snack)(ы|а|ов)?(\s|$)/.test(n)) return true;
  return false;
}

/**
 * Positive morning-food signals (каша, яичница, сырники, …).
 * Used to prefer real breakfast dishes when assigning breakfast slots.
 */
export function looksLikeBreakfastDish(name: string): boolean {
  const n = normalizeDishName(name);
  if (!n) return false;
  if (
    /(^|\s)(каш[аиуе]|овсян|овсянк|гречнев\w*\s+каш|пшенн\w*\s+каш|пш[её]нн)/.test(
      n,
    )
  ) {
    return true;
  }
  if (/(^|\s)(яичниц|омлет|скрэмбл|шакшук)/.test(n)) return true;
  if (/(^|\s)(сырник|оладь|блинчик|блин(?!н)|драник|панкейк)/.test(n)) {
    return true;
  }
  if (/(^|\s)(творож|творог)/.test(n)) return true;
  if (/(^|\s)(тост|гранол|мюсли|круассан|вафл|бутерброд)/.test(n)) return true;
  // Cottage-cheese / egg / grain casseroles — not meat-heavy dinner bakes.
  if (/(творож|яичн|манн|рисовая|пшенн|овсян)\w*\s+запеканк/.test(n)) {
    return true;
  }
  if (/запеканк\w*\s+(из\s+)?(творог|яиц|манк)/.test(n)) return true;
  return false;
}

/**
 * Lunch/dinner mains that must not fill breakfast slots
 * (roast chicken, soups, plov, cutlets, steaks, …).
 * Breakfast-looking names win even if they mention meat (омлет с беконом).
 */
export function looksLikeLunchDinnerOnlyMain(name: string): boolean {
  const n = normalizeDishName(name);
  if (!n) return false;
  if (looksLikeBreakfastDish(n)) return false;

  // Soups / broths.
  if (
    /(^|\s)(борщ|щи|солянка|харчо|уха|бульон|суп|похлебк|окрошк|свекольник)/.test(
      n,
    )
  ) {
    return true;
  }
  // Classic dinner one-pots / grills.
  if (
    /(^|\s)(плов|лазань|гуляш|бефстроган|шашлык|стейк|рагу|жаркое|голубц|пельмен|манты)/.test(
      n,
    )
  ) {
    return true;
  }
  // Cutlets / meatballs / schnitzel style.
  if (
    /(^|\s)(котлет|тефтел|фрикадель|отбивн|шницел|бифштекс|зразы|люля)/.test(
      n,
    )
  ) {
    return true;
  }
  // Whole roast / fried bird or large meat pieces as the dish.
  if (
    /(запеч[её]нн|жар[её]нн|туш[её]нн)\w*\s+(курица|куриц|цыпл|утка|гусь|индейк)/.test(
      n,
    )
  ) {
    return true;
  }
  if (
    /(^|\s)(курица|куриц|цыпл)\w*.*(запеч|жар|тушен|лимон|трав|чеснок)/.test(
      n,
    )
  ) {
    return true;
  }
  // Bare protein cuts as the main label (грудка / филе / окорочка).
  if (
    /(^|\s)(куриная|куриное|куриный|индюшин)\w*\s+(грудк|филе|окороч)/.test(
      n,
    )
  ) {
    return true;
  }
  if (/(^|\s)(грудк|филе|окороч|стейк)\w*\s/.test(n)) return true;
  // Pasta / noodles as a cooked main (not breakfast porridge).
  if (/(^|\s)(паста|спагетти|лапша|макарон)/.test(n)) return true;
  // Fish mains (baked / fried) — dinner territory.
  if (
    /(запеч[её]нн|жар[её]нн|туш[её]нн)\w*\s+(рыб|лосос|форел|треск|минтай)/.test(
      n,
    )
  ) {
    return true;
  }
  return false;
}

/**
 * True when a cookable main may fill a breakfast / second_breakfast slot.
 * Prefers morning food; blocks clear lunch/dinner mains and companions/snacks.
 */
export function isSuitableAsBreakfastMain(name: string): boolean {
  if (looksLikeCompanionOnly(name) || looksLikeNoCookSnack(name)) return false;
  if (looksLikeLunchDinnerOnlyMain(name)) return false;
  return true;
}

/**
 * Pick mains for a meal: breakfast gets morning food first, then non-dinner
 * leftovers; lunch/dinner use any non-companion main.
 */
export function mainsForMeal<T extends { name: string }>(
  meal: MealSlot,
  named: readonly T[],
): T[] {
  const mains = named.filter((c) => !looksLikeCompanionOnly(c.name));
  const base = mains.length > 0 ? mains : [...named];
  if (!isBreakfastMeal(meal)) return base;

  const morning = base.filter((c) => looksLikeBreakfastDish(c.name));
  if (morning.length > 0) return morning;

  const ok = base.filter((c) => isSuitableAsBreakfastMain(c.name));
  if (ok.length > 0) return ok;

  return base;
}

/**
 * Side / sauce style labels that must not be breakfast mains.
 * Pairing happens at plate assign time — a sauce is a companion, not morning food.
 */
export function looksLikeCompanionOnly(name: string): boolean {
  const n = normalizeDishName(name);
  if (!n) return false;
  // \b is ASCII-only in JS — use explicit edges for Cyrillic tokens.
  if (/(^|\s)соус(ы|а|ом|ами)?(\s|$)/.test(n)) return true;
  if (/(^|\s)заправк/.test(n)) return true;
  if (/(^|\s)подлив/.test(n)) return true;
  if (/(^|\s)гарнир(\s|$)/.test(n)) return true;
  // Hardcoded pairing: «… к пасте», «… к мясу» — accompaniment, not a main.
  if (
    /(^|\s)к\s+(пасте|макаронам|мясу|рыбе|курице|грудке|стейку|котлетам|гарниру)(\s|$)/.test(
      n,
    )
  ) {
    return true;
  }
  return false;
}

/**
 * True when the dish name signals a real protein component for a lunch/dinner plate.
 * Vegetable «котлеты» (carrot/cabbage/…) do not count — they need a protein companion.
 * Note: JS `\b` is ASCII-only — use (^|\s) edges for Cyrillic.
 */
export function looksLikeProteinDish(name: string): boolean {
  const n = normalizeDishName(name);
  if (!n) return false;
  if (looksLikeVegetableCutlet(n)) return false;

  // Animal / seafood / egg / dairy-protein / legumes / mushrooms (simple add-on).
  // Stems are chosen to avoid cookie/bakery false positives (печенье, баранки).
  if (
    /(^|\s)(мяс|говяд|свинин|барани|телятин|куриц|курин|индейк|утин|утка|гусин|грудк|окороч|филе|фарш|стейк|шашлык|гуляш|бефстроган|люля|тефтел|фрикадель|зразы|отбивн|шницел|бифштекс|колбас|сосиск|ветчин|бекон|печень|печенк|язык)/.test(
      n,
    )
  ) {
    return true;
  }
  if (
    /(^|\s)(рыб|лосос|форел|треск|минтай|хек|скумбр|сельд|тунец|креветк|кальмар|миди)/.test(
      n,
    )
  ) {
    return true;
  }
  if (/(^|\s)(яйц|яичниц|омлет)/.test(n)) return true;
  if (/(^|\s)(творог|сырник)/.test(n)) return true;
  if (/(^|\s)(фасол|чечевиц|нут|горохов)/.test(n)) return true;
  if (/(^|\s)гриб/.test(n)) return true;
  // Meat/fish cutlets (not vegetable — those returned false above).
  if (/(^|\s)котлет/.test(n)) return true;
  // Classic one-pots that imply protein in Russian home cooking.
  if (/(^|\s)(плов|лазань|гуляш)/.test(n)) return true;
  return false;
}

/** Carrot/cabbage/potato/… cutlets — carb/veg shape, not a protein main. */
function looksLikeVegetableCutlet(n: string): boolean {
  if (
    /(^|\s)(морковн|капустн|картофельн|овощн|свекольн|кабачков|тыквенн|баклажанн|рисов)[а-я]*\s+котлет/.test(
      n,
    )
  ) {
    return true;
  }
  if (
    /(^|\s)котлет[а-я]*\s+из\s+(морков|капуст|картофел|овощ|свекл|кабачк|тыкв|баклажан|риса)/.test(
      n,
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Drop trailing hardcoded pairings from invent names so the same side can
 * sit with chicken or pasta without lying in the label.
 * «Грибной соус к пасте» → «Грибной соус».
 */
export function stripHardcodedPairing(name: string): string {
  const cleaned = name
    .replace(
      /\s+к\s+(пасте|макаронам|мясу|рыбе|курице|грудке|стейку|котлетам|гарниру)\s*$/iu,
      "",
    )
    .trim();
  return cleaned.length > 0 ? cleaned : name.trim();
}
