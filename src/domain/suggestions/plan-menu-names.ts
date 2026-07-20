import {
  MEAL_LABELS_RU,
  mealAllowsCompanion,
  menuDayPairsForCount,
  type MealSlot,
  type MenuDayPair,
} from "@/domain/menu/constants";
import { uniqueExactNames } from "@/domain/suggestions/dish-similarity";
import {
  isBreakfastMeal,
  looksLikeBreakfastDish,
  looksLikeLunchDinnerOnlyMain,
  looksLikeNoCookSnack,
  stripHardcodedPairing,
} from "@/domain/suggestions/meal-fit";
import { parsePlateKind } from "@/domain/suggestions/plate-complete";
import {
  tasteNotesForPrompt,
  type TasteNote,
} from "@/domain/suggestions/taste-notes";
import {
  openRouterChatCompletions,
  OpenRouterError,
  type ChatCompletionsFn,
} from "@/lib/openrouter/client";

export type PlannedDish = {
  meal: MealSlot;
  dayPair: MenuDayPair;
  role: "main" | "companion";
  name: string;
  /** Set on mains for companion meals. */
  plateKind: "complete" | "needs_companion" | null;
  /** Present when role=companion. */
  mainName?: string;
};

export type PlanMenuNamesResult =
  | { ok: true; plan: PlannedDish[] }
  | { ok: false; reason: "openrouter" | "parse" };

const PLAN_SYSTEM = `You design a Russian household batch-cook MENU as dish NAMES only (no recipes yet).
Structure: menu days are hard pairs from the request (e.g. [1,2], [3,4], [5,6]). Each dish is cooked once and eaten on both days of its pair.
Respond with a single JSON object:
{"dishes":[{"meal":"breakfast"|"lunch"|"dinner"|...,"dayPair":[1,2]|[3,4]|[5,6],"role":"main"|"companion","name":"...","plate_kind":"complete"|"needs_companion"|null}]}.

Rules:
- Include exactly the requested positions. For each meal×dayPair: one main. For lunch/dinner/late_dinner mains also set plate_kind.
- If plate_kind="needs_companion", ALSO include a companion dish for that same meal×dayPair (role=companion, plate_kind=null). If plate_kind="complete", do NOT invent a companion for that position.
- Breakfast / second_breakfast / afternoon_snack: morning food names only; plate_kind=null (or complete). No companion.
- Lunch/dinner/late_dinner mains: savory dinner food. Prefer meat/fish. NEVER morning forms (сырники, оладьи, творожная запеканка, каша, омлет as L/D main).
- HARD variety: every main must be a clearly different culinary form+base from the others. Word-order/topping swaps are duplicates (FORBIDDEN).
  Too close: куриные рулеты с сыром ≈ куриные рулетики со шпинатом; котлеты из курицы ≈ куриные котлеты.
- Same dayPair lunch vs dinner MUST use different forms (never two rolls/cutlets/casseroles of the same family on one pair).
- At most TWO mains of the same culinary form across the whole menu (рулеты, котлеты, запеканка, …).
- Companion names: simple sides/sauces/protein add-ons; NEVER «к пасте»/«к мясу»; never a second meat/fish main beside a meat/fish main.
- Names in Russian, sentence case. No recipe steps. Honor operatorTasteNotes (constraint PRIMARY).
- Never invent snacks / перекусы here.`;

/**
 * One AI call: invent dish names (+ plate_kind / companions) for all cookable positions.
 */
export async function proposeMenuNamePlan(
  meals: readonly MealSlot[],
  context: {
    dayCount: number;
    previousMenusDishes?: string[];
    avoidNames?: string[];
    peoplePerMeal?: number;
    tasteNotes: TasteNote[];
    chat?: ChatCompletionsFn;
  },
): Promise<PlanMenuNamesResult> {
  const dayPairs = menuDayPairsForCount(context.dayCount);
  const positions = describePositions(meals, dayPairs);
  const chat = context.chat ?? openRouterChatCompletions;

  const userContent = JSON.stringify({
    meals: [...meals],
    dayCount: context.dayCount,
    dayPairs: dayPairs.map((p) => [...p]),
    positions,
    previousMenusDishes: uniqueExactNames(context.previousMenusDishes ?? []).slice(
      0,
      60,
    ),
    avoidNames: uniqueExactNames(context.avoidNames ?? []).slice(0, 50),
    peoplePerMeal: context.peoplePerMeal ?? 2,
    instruction:
      "Invent dish NAMES for every listed position. Strong variety: no near-duplicates; lunch≠dinner form on the same dayPair; at most two of any culinary form. Set plate_kind for lunch/dinner mains and add companions only when needs_companion.",
    operatorTasteNotes: tasteNotesForPrompt(context.tasteNotes),
  });

  let content: string;
  try {
    content = await chat({
      messages: [
        { role: "system", content: PLAN_SYSTEM },
        { role: "user", content: userContent },
      ],
      responseFormatJson: true,
      temperature: 0.7,
    });
  } catch (err) {
    if (err instanceof OpenRouterError) {
      return { ok: false, reason: "openrouter" };
    }
    throw err;
  }

  const plan = parseMenuNamePlanJson(content, meals, dayPairs);
  if (!plan) return { ok: false, reason: "parse" };
  return { ok: true, plan };
}

/**
 * Names-only invent for one meal×dayPair (main±companion, or companion alone).
 * Used by resuggest — same scheme as full menu plan, smaller payload.
 */
export async function proposePositionNamePlan(
  position: {
    meal: MealSlot;
    dayPair: MenuDayPair;
    role: "main" | "companion";
    /** Required when role=companion — locked main name. */
    mainName?: string;
  },
  context: {
    keepDishes?: Array<{
      meal: MealSlot;
      dayPair: MenuDayPair;
      role: "main" | "companion";
      name: string;
    }>;
    previousMenusDishes?: string[];
    avoidNames?: string[];
    peoplePerMeal?: number;
    tasteNotes: TasteNote[];
    chat?: ChatCompletionsFn;
  },
): Promise<PlanMenuNamesResult> {
  if (position.role === "companion" && !position.mainName?.trim()) {
    return { ok: false, reason: "parse" };
  }

  const chat = context.chat ?? openRouterChatCompletions;
  const userContent = JSON.stringify({
    replacePosition: {
      meal: position.meal,
      mealLabelRu: MEAL_LABELS_RU[position.meal],
      dayPair: [...position.dayPair],
      role: position.role,
      needsPlateKind:
        position.role === "main" && mealAllowsCompanion(position.meal),
      mainName: position.mainName?.trim() || undefined,
    },
    keepDishes: (context.keepDishes ?? []).map((d) => ({
      meal: d.meal,
      dayPair: [...d.dayPair],
      role: d.role,
      name: d.name,
    })),
    previousMenusDishes: uniqueExactNames(context.previousMenusDishes ?? []).slice(
      0,
      60,
    ),
    avoidNames: uniqueExactNames(context.avoidNames ?? []).slice(0, 50),
    peoplePerMeal: context.peoplePerMeal ?? 2,
    instruction:
      position.role === "companion"
        ? "Invent ONE companion NAME for replacePosition (role=companion). Do not invent a main. Name must not near-duplicate keepDishes or avoidNames. plate_kind=null."
        : "Invent dish NAMES for replacePosition only: one main (+ companion if plate_kind=needs_companion). Do not invent other meals/pairs. New names must not near-duplicate keepDishes or avoidNames; lunch≠dinner form vs keepDishes on the same dayPair.",
    operatorTasteNotes: tasteNotesForPrompt(context.tasteNotes),
  });

  let content: string;
  try {
    content = await chat({
      messages: [
        { role: "system", content: PLAN_SYSTEM },
        { role: "user", content: userContent },
      ],
      responseFormatJson: true,
      temperature: 0.75,
    });
  } catch (err) {
    if (err instanceof OpenRouterError) {
      return { ok: false, reason: "openrouter" };
    }
    throw err;
  }

  const plan = parsePositionNamePlanJson(content, position);
  if (!plan) return { ok: false, reason: "parse" };
  return { ok: true, plan };
}

/**
 * Repair flagged name positions in one AI call (names only).
 */
export async function repairMenuNamePlan(
  plan: PlannedDish[],
  replace: Array<{
    meal: MealSlot;
    dayPair: MenuDayPair;
    role: "main" | "companion";
    reason: string;
  }>,
  context: {
    dayCount: number;
    tasteNotes: TasteNote[];
    chat?: ChatCompletionsFn;
  },
): Promise<PlanMenuNamesResult> {
  if (replace.length === 0) return { ok: true, plan };

  const dayPairs = menuDayPairsForCount(context.dayCount);
  const chat = context.chat ?? openRouterChatCompletions;
  const keep = plan.filter(
    (d) =>
      !replace.some(
        (r) =>
          r.meal === d.meal &&
          r.dayPair[0] === d.dayPair[0] &&
          r.dayPair[1] === d.dayPair[1] &&
          r.role === d.role,
      ),
  );

  const userContent = JSON.stringify({
    dayCount: context.dayCount,
    dayPairs: dayPairs.map((p) => [...p]),
    keepDishes: keep.map((d) => ({
      meal: d.meal,
      dayPair: [...d.dayPair],
      role: d.role,
      name: d.name,
      plate_kind: d.plateKind,
    })),
    replace,
    instruction:
      "Return a FULL dishes array for the whole menu: keepDishes unchanged + NEW names for every replace target. When replacing a main with plate_kind change, add/remove companion accordingly. HARD: new names must not near-duplicate keepDishes.",
    operatorTasteNotes: tasteNotesForPrompt(context.tasteNotes),
  });

  let content: string;
  try {
    content = await chat({
      messages: [
        { role: "system", content: PLAN_SYSTEM },
        { role: "user", content: userContent },
      ],
      responseFormatJson: true,
      temperature: 0.75,
    });
  } catch (err) {
    if (err instanceof OpenRouterError) {
      return { ok: false, reason: "openrouter" };
    }
    throw err;
  }

  const meals = uniqueMeals(plan);
  const next = parseMenuNamePlanJson(content, meals, dayPairs);
  if (!next) return { ok: false, reason: "parse" };
  return { ok: true, plan: next };
}

export function parseMenuNamePlanJson(
  content: string,
  meals: readonly MealSlot[],
  dayPairs: readonly MenuDayPair[],
): PlannedDish[] | null {
  const out = parsePlannedDishesArray(content, meals, dayPairs);
  if (!out) return null;
  return planLooksComplete(out, meals, dayPairs) ? out : null;
}

/** Parser for single-position resuggest plans (main±companion or companion only). */
export function parsePositionNamePlanJson(
  content: string,
  position: {
    meal: MealSlot;
    dayPair: MenuDayPair;
    role: "main" | "companion";
    mainName?: string;
  },
): PlannedDish[] | null {
  const out = parsePlannedDishesArray(content, [position.meal], [
    position.dayPair,
  ]);
  if (!out) return null;

  const atPosition = out.filter(
    (d) =>
      d.meal === position.meal &&
      d.dayPair[0] === position.dayPair[0] &&
      d.dayPair[1] === position.dayPair[1],
  );
  if (atPosition.length === 0) return null;

  if (position.role === "companion") {
    const companion = atPosition.find((d) => d.role === "companion");
    if (!companion) return null;
    return [
      {
        ...companion,
        mainName: position.mainName?.trim() || companion.mainName,
        plateKind: null,
      },
    ];
  }

  const main = atPosition.find((d) => d.role === "main");
  if (!main) return null;
  if (
    mealAllowsCompanion(position.meal) &&
    main.plateKind === "needs_companion"
  ) {
    const companion = atPosition.find((d) => d.role === "companion");
    if (!companion) return null;
    return [main, { ...companion, mainName: main.name, plateKind: null }];
  }
  return [{ ...main, plateKind: mealAllowsCompanion(position.meal) ? main.plateKind ?? "complete" : null }];
}

function parsePlannedDishesArray(
  content: string,
  meals: readonly MealSlot[],
  dayPairs: readonly MenuDayPair[],
): PlannedDish[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(content));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const root = parsed as { dishes?: unknown };
  if (!Array.isArray(root.dishes)) return null;

  const out: PlannedDish[] = [];
  for (const item of root.dishes) {
    const dish = parsePlannedDishRow(item, meals, dayPairs);
    if (dish) out.push(dish);
  }
  return out;
}

function parsePlannedDishRow(
  item: unknown,
  meals: readonly MealSlot[],
  dayPairs: readonly MenuDayPair[],
): PlannedDish | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  const meal = typeof row.meal === "string" ? row.meal : "";
  if (!meals.includes(meal as MealSlot)) return null;
  const dayPair = parseDayPair(row.dayPair ?? row.day_pair, dayPairs);
  if (!dayPair) return null;
  const rawName = typeof row.name === "string" ? row.name.trim() : "";
  const name = rawName ? stripHardcodedPairing(rawName).slice(0, 120) : "";
  if (!name || looksLikeNoCookSnack(name)) return null;
  const mealSlot = meal as MealSlot;

  if (row.role === "companion") {
    if (!mealAllowsCompanion(mealSlot)) return null;
    return { meal: mealSlot, dayPair, role: "companion", name, plateKind: null };
  }

  return parsePlannedMainRow(mealSlot, dayPair, name, row);
}

function parsePlannedMainRow(
  meal: MealSlot,
  dayPair: MenuDayPair,
  name: string,
  row: Record<string, unknown>,
): PlannedDish | null {
  if (isBreakfastMeal(meal) || meal === "afternoon_snack") {
    if (looksLikeLunchDinnerOnlyMain(name)) return null;
    return { meal, dayPair, role: "main", name, plateKind: null };
  }
  if (looksLikeBreakfastDish(name)) return null;
  let plateKind = parsePlateKind(row.plate_kind ?? row.plateKind);
  if (!mealAllowsCompanion(meal)) plateKind = null;
  else if (!plateKind) plateKind = "needs_companion";
  return { meal, dayPair, role: "main", name, plateKind };
}

function describePositions(
  meals: readonly MealSlot[],
  dayPairs: readonly MenuDayPair[],
) {
  const positions: Array<{
    meal: MealSlot;
    mealLabelRu: string;
    dayPair: number[];
    needsPlateKind: boolean;
  }> = [];
  for (const dayPair of dayPairs) {
    for (const meal of meals) {
      positions.push({
        meal,
        mealLabelRu: MEAL_LABELS_RU[meal],
        dayPair: [...dayPair],
        needsPlateKind: mealAllowsCompanion(meal),
      });
    }
  }
  return positions;
}

function planLooksComplete(
  plan: PlannedDish[],
  meals: readonly MealSlot[],
  dayPairs: readonly MenuDayPair[],
): boolean {
  for (const dayPair of dayPairs) {
    for (const meal of meals) {
      const main = plan.find(
        (d) =>
          d.role === "main" &&
          d.meal === meal &&
          d.dayPair[0] === dayPair[0] &&
          d.dayPair[1] === dayPair[1],
      );
      if (!main) return false;
      if (mealAllowsCompanion(meal) && main.plateKind === "needs_companion") {
        const companion = plan.find(
          (d) =>
            d.role === "companion" &&
            d.meal === meal &&
            d.dayPair[0] === dayPair[0] &&
            d.dayPair[1] === dayPair[1],
        );
        if (!companion) return false;
      }
    }
  }
  return true;
}

function parseDayPair(
  raw: unknown,
  allowed: readonly MenuDayPair[],
): MenuDayPair | null {
  if (!Array.isArray(raw) || raw.length !== 2) return null;
  const a = Number(raw[0]);
  const b = Number(raw[1]);
  for (const pair of allowed) {
    if (a === pair[0] && b === pair[1]) return pair;
  }
  return null;
}

function uniqueMeals(plan: PlannedDish[]): MealSlot[] {
  const seen = new Set<MealSlot>();
  for (const d of plan) seen.add(d.meal);
  return [...seen];
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

export function planKey(d: Pick<PlannedDish, "meal" | "dayPair" | "role">): string {
  return `${d.meal}:${d.dayPair[0]}-${d.dayPair[1]}:${d.role}`;
}
