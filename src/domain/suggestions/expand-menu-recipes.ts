import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_DAY_COUNT, MEAL_LABELS_RU } from "@/domain/menu/constants";
import {
  DEFAULT_AVAILABLE_EQUIPMENT,
  clampRequiredEquipmentToAvailable,
  normalizeEquipmentList,
  recipeFitsAvailableEquipment,
  type EquipmentId,
} from "@/domain/menu/equipment";
import { normalizeRecipeBodyText } from "@/domain/recipes/format-body";
import {
  parseInventRecipesJson,
  persistInventedRecipe,
  type InventRecipeDraft,
} from "@/domain/suggestions/invent-recipes";
import {
  normalizeDishName,
  namesEqual,
} from "@/domain/suggestions/dish-similarity";
import type { PlannedDish } from "@/domain/suggestions/plan-menu-names";
import { planKey } from "@/domain/suggestions/plan-menu-names";
import {
  parseCoversRoles,
  parseCoversRolesForMeal,
} from "@/domain/suggestions/role-slots";
import { isTemplateMeal } from "@/domain/menu/meal-templates";
import {
  tasteNotesForPrompt,
  type TasteNote,
} from "@/domain/suggestions/taste-notes";
import {
  openRouterChatCompletions,
  OpenRouterError,
  type ChatCompletionsFn,
} from "@/lib/openrouter/client";
import { slog, slogError } from "@/lib/server-log";

export type ExpandedDish = PlannedDish & {
  recipeId: string;
};

export type ExpandMenuRecipesResult =
  | { ok: true; dishes: ExpandedDish[] }
  | { ok: false; reason: "openrouter" | "parse" | "persist" };

const EXPAND_SYSTEM = `You write full Russian home-cooking recipes for LOCKED dish names on a household meal planner.
Names are final — do NOT rename, swap, or invent different dishes.
Plate roles are FIXED by the app — write content for the given plate_role.
Respond with a single JSON object (minified — no pretty-print, no markdown fences):
{"recipes":[{"key":"meal:1-2:protein","name":"...","body_text":"...","fridge_keep_days":N,"plate_role":"main"|"fruit"|"soup"|"protein"|"veg"|"carb","covers_roles":["protein","carb"]?,"required_equipment":["stove"|"oven"|"air_fryer"|"grill"|"multicooker"|"pressure_cooker"|"microwave",...],"price_rub_per_serving":N,"nutrition_per_serving":{"kcal":N,"protein_g":N,"fat_g":N,"carbs_g":N},"critical_ingredients":[{"name":"...","kind":"critical"|"pantry","amount":N,"unit":"g"|"ml"|"pcs"|"tsp"|"tbsp"},...]}]}.

Rules:
- One recipe object per input dish. key MUST match the input key exactly. name MUST match the locked name (same dish). Never stop mid-array — recipes must be complete valid JSON.
- plate_role from input (PlateRole). Optional covers_roles for one-pots on lunch/dinner protein only — prefer the plan's covers_roles when provided. NEVER set covers_roles on breakfast/main. NEVER invent covers that duplicate a separate dish for the same role.
- fridge_keep_days integer 1..7, MUST be >= menuDayCount from the request.
- required_equipment: only stove|oven|air_fryer|grill|multicooker|pressure_cooker|microwave; MUST be ⊆ availableEquipment. Use [] when the dish needs no appliances (raw salad / no-heat).
- body_text: VERY SHORT Russian steps, numbered "1. ", "2. ", … — max 3 steps (sides/fruit 1–2). One short sentence per step. Cooking/heating required except raw fruit/salad.
- HARD shopping-list completeness: every buyable food in name or body_text MUST be in critical_ingredients with amount+unit per 1 adult serving.
- At least one kind=critical. Prefer 2–5 ingredients (sides/fruit 1–3). Keep JSON compact.
- price_rub_per_serving: integer RUBLES, never above 400; omit if uncertain (no zeros).
- Omit nutrition_per_serving unless confident (saves tokens).
- Honor operatorTasteNotes for ingredients/technique when relevant, but keep the locked name.
- When modificationWish is set: adapt ingredients/technique to the wish; prefer adapting sourceRecipe when provided; still keep each locked name.
- NEVER plate_kind / companion.`;

export type ExpandModificationContext = {
  wish: string;
  sourceRecipe?: { name: string; bodyText: string };
};

/**
 * Recipes per OpenRouter call. Size 1 with concurrency 2 made a 4-day menu
 * (~18 dishes) take 9 sequential waves — felt hung (~2+ min on slow providers).
 * Chunks of 3 cut round-trips; keep small enough to avoid truncation.
 */
export const EXPAND_CHUNK_SIZE = 3;

/**
 * Max in-flight expand calls. Cap avoids OpenRouter stampede; 4 is enough for
 * a typical menu to finish in ~2 waves after chunking.
 */
export const EXPAND_CONCURRENCY = 4;

/** Completion budget for a chunk of recipes (short steps + ingredients). */
const EXPAND_MAX_TOKENS = 4096;

/**
 * Expand locked menu names into full persisted recipes (chunked AI calls).
 */
export async function expandMenuRecipes(
  supabase: SupabaseClient,
  plan: PlannedDish[],
  context: {
    menuDayCount: number;
    peoplePerMeal?: number;
    tasteNotes: TasteNote[];
    chat?: ChatCompletionsFn;
    modification?: ExpandModificationContext;
    availableEquipment?: readonly EquipmentId[];
  },
): Promise<ExpandMenuRecipesResult> {
  if (plan.length === 0) return { ok: true, dishes: [] };

  const menuDayCount = context.menuDayCount;
  const availableEquipment =
    normalizeEquipmentList(context.availableEquipment) ?? [
      ...DEFAULT_AVAILABLE_EQUIPMENT,
    ];
  const chat = context.chat ?? openRouterChatCompletions;
  const started = Date.now();
  const chunkCount = Math.ceil(plan.length / EXPAND_CHUNK_SIZE);
  slog("expand", "start", {
    dishes: plan.length,
    chunkSize: EXPAND_CHUNK_SIZE,
    chunkCount,
    concurrency: EXPAND_CONCURRENCY,
    maxTokens: EXPAND_MAX_TOKENS,
    menuDayCount,
    keys: plan.map((d) => planKey(d)),
  });

  const fetched = await fetchExpandDrafts(plan, {
    chat,
    menuDayCount,
    peoplePerMeal: context.peoplePerMeal ?? 2,
    availableEquipment,
    tasteNotes: context.tasteNotes,
    modification: context.modification,
  });
  if (!fetched.ok) {
    slogError("expand", "fetch:fail", {
      reason: fetched.reason,
      ms: Date.now() - started,
    });
    return fetched;
  }
  slog("expand", "fetch:ok", {
    drafts: fetched.draftsByKey.size,
    ms: Date.now() - started,
  });

  const persisted = await persistExpandedPlan(
    supabase,
    plan,
    fetched.draftsByKey,
    menuDayCount,
    availableEquipment,
  );
  if (!persisted.ok) {
    slogError("expand", "persist:fail", {
      reason: persisted.reason,
      ms: Date.now() - started,
    });
    return persisted;
  }
  slog("expand", "ok", {
    recipes: persisted.dishes.length,
    ms: Date.now() - started,
  });
  return persisted;
}

async function fetchExpandDrafts(
  plan: PlannedDish[],
  args: {
    chat: ChatCompletionsFn;
    menuDayCount: number;
    peoplePerMeal: number;
    availableEquipment: readonly EquipmentId[];
    tasteNotes: TasteNote[];
    modification?: ExpandModificationContext;
  },
): Promise<
  | { ok: true; draftsByKey: Map<string, InventRecipeDraft> }
  | { ok: false; reason: "openrouter" | "parse" }
> {
  const chunks = chunkPlan(plan, EXPAND_CHUNK_SIZE);
  slog("expand", "chunks:ready", {
    chunks: chunks.length,
    concurrency: EXPAND_CONCURRENCY,
  });
  const results = await mapPool(chunks, EXPAND_CONCURRENCY, (chunk, index) =>
    fetchExpandDraftsForChunk(chunk, args, index),
  );

  const draftsByKey = new Map<string, InventRecipeDraft>();
  for (let i = 0; i < results.length; i++) {
    const result = results[i]!;
    if (!result.ok) {
      slogError("expand", "chunk:aggregate-fail", {
        chunkIndex: i,
        reason: result.reason,
      });
      return result;
    }
    for (const [key, draft] of result.draftsByKey) {
      draftsByKey.set(key, draft);
    }
  }
  return { ok: true, draftsByKey };
}

/** Exported for logic verify. */
export function chunkPlan<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) return [items.slice()];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/** Run async work with a fixed concurrency cap (order preserved). */
export async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    for (; ;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index]!, index);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

async function fetchExpandDraftsForChunk(
  plan: PlannedDish[],
  args: {
    chat: ChatCompletionsFn;
    menuDayCount: number;
    peoplePerMeal: number;
    availableEquipment: readonly EquipmentId[];
    tasteNotes: TasteNote[];
    modification?: ExpandModificationContext;
  },
  chunkIndex: number,
): Promise<
  | { ok: true; draftsByKey: Map<string, InventRecipeDraft> }
  | { ok: false; reason: "openrouter" | "parse" }
> {
  const keys = plan.map((d) => planKey(d));
  const locked = plan.map((d) => ({
    key: planKey(d),
    meal: d.meal,
    mealLabelRu: MEAL_LABELS_RU[d.meal],
    dayPair: [...d.dayPair],
    plate_role: d.plateRole,
    covers_roles: d.coversRoles ?? undefined,
    name: d.name,
  }));
  const wish = args.modification?.wish.trim();
  const sourceRecipe = args.modification?.sourceRecipe;
  const baseUser = {
    dishes: locked,
    menuDayCount: args.menuDayCount,
    peoplePerMeal: args.peoplePerMeal,
    availableEquipment: args.availableEquipment,
    modificationWish: wish || undefined,
    sourceRecipe: sourceRecipe
      ? {
        name: sourceRecipe.name,
        body_text: sourceRecipe.bodyText.slice(0, 1200),
      }
      : undefined,
    operatorTasteNotes: tasteNotesForPrompt(args.tasteNotes),
  };
  const baseInstruction = wish
    ? `Write a full recipe for EVERY locked dish. Keep names exactly. key must match. fridge_keep_days>=${args.menuDayCount}. required_equipment ⊆ availableEquipment. Apply modificationWish to ingredients/technique (PRIMARY). Prefer adapting sourceRecipe when provided.`
    : `Write a full recipe for EVERY locked dish. Keep names exactly. key must match. fridge_keep_days>=${args.menuDayCount}. required_equipment ⊆ availableEquipment.`;

  slog("expand", "chunk:start", {
    chunkIndex,
    keys,
    names: plan.map((d) => d.name),
  });
  const started = Date.now();

  // One shot — equipment is clamped at persist; no retry loops.
  const result = await requestExpandDrafts(
    args.chat,
    baseUser,
    baseInstruction,
    0.5,
    plan,
  );
  if (!result.ok) {
    slogError("expand", "chunk:fail", {
      chunkIndex,
      keys,
      reason: result.reason,
      ms: Date.now() - started,
    });
    return result;
  }
  slog("expand", "chunk:ok", {
    chunkIndex,
    keys,
    ms: Date.now() - started,
  });
  return result;
}

async function requestExpandDrafts(
  chat: ChatCompletionsFn,
  baseUser: Record<string, unknown>,
  instruction: string,
  temperature: number,
  plan: PlannedDish[],
): Promise<
  | { ok: true; draftsByKey: Map<string, InventRecipeDraft> }
  | { ok: false; reason: "openrouter" | "parse" }
> {
  let content: string;
  try {
    content = await chat({
      messages: [
        { role: "system", content: EXPAND_SYSTEM },
        {
          role: "user",
          content: JSON.stringify({ ...baseUser, instruction }),
        },
      ],
      responseFormatJson: true,
      temperature,
      maxTokens: EXPAND_MAX_TOKENS,
    });
  } catch (err) {
    if (err instanceof OpenRouterError) {
      slogError("expand", "chat:openrouter", {
        keys: plan.map((d) => planKey(d)),
        message: err.message,
        status: err.causeStatus,
      });
      return { ok: false, reason: "openrouter" };
    }
    throw err;
  }
  const draftsByKey = parseExpandRecipesJson(content, plan);
  if (!draftsByKey) {
    slogError("expand", "chat:parse", {
      keys: plan.map((d) => planKey(d)),
      contentChars: content.length,
      contentPreview: content.slice(0, 240),
    });
    return { ok: false, reason: "parse" };
  }
  return { ok: true, draftsByKey };
}

async function persistExpandedPlan(
  supabase: SupabaseClient,
  plan: PlannedDish[],
  draftsByKey: Map<string, InventRecipeDraft>,
  menuDayCount: number,
  availableEquipment: readonly EquipmentId[],
): Promise<ExpandMenuRecipesResult> {
  const prepared: Array<{ dish: PlannedDish; draft: InventRecipeDraft }> = [];
  for (const dish of plan) {
    const draft = prepareExpandDraft(
      draftsByKey.get(planKey(dish)),
      dish,
      menuDayCount,
      availableEquipment,
    );
    if (!draft) {
      const raw = draftsByKey.get(planKey(dish));
      slogError("expand", "prepare:fail", {
        key: planKey(dish),
        name: dish.name,
        hadDraft: Boolean(raw),
        requiredEquipment: raw?.requiredEquipment ?? null,
        availableEquipment,
      });
      return { ok: false, reason: "parse" };
    }
    prepared.push({ dish, draft });
  }

  // Independent recipe inserts — overlap DB latency.
  slog("expand", "persist:start", { recipes: prepared.length });
  const results = await Promise.all(
    prepared.map(({ draft }) => persistInventedRecipe(supabase, draft)),
  );
  const inventedIds = results
    .filter((r): r is { ok: true; recipeId: string } => r.ok)
    .map((r) => r.recipeId);
  if (results.some((r) => !r.ok)) {
    const failedAt = results.findIndex((r) => !r.ok);
    slogError("expand", "persist:insert-fail", {
      failedAt,
      key: failedAt >= 0 ? planKey(prepared[failedAt]!.dish) : null,
      okCount: inventedIds.length,
    });
    await cleanup(supabase, inventedIds);
    return { ok: false, reason: "persist" };
  }

  const expanded: ExpandedDish[] = prepared.map(({ dish, draft }, i) => ({
    ...dish,
    coversRoles: draft.coversRoles ?? dish.coversRoles ?? null,
    recipeId: (results[i] as { ok: true; recipeId: string }).recipeId,
  }));

  return { ok: true, dishes: expanded };
}

/** Exported for logic verify. */
export function prepareExpandDraft(
  draft: InventRecipeDraft | undefined,
  dish: PlannedDish,
  menuDayCount: number,
  availableEquipment: readonly EquipmentId[],
): InventRecipeDraft | null {
  if (!draft) return null;
  draft.name = dish.name.slice(0, 120);
  draft.plateRole = dish.plateRole;
  // Prefer plan covers when AI omits; drop roles outside this meal's template
  // (Gemini often invents protein/veg/carb covers on breakfast main).
  const rawCovers =
    dish.coversRoles ?? draft.coversRoles ?? parseCoversRoles(null);
  draft.coversRoles = isTemplateMeal(dish.meal)
    ? parseCoversRolesForMeal(dish.meal, rawCovers)
    : null;
  if (draft.fridgeKeepDays < menuDayCount) {
    draft.fridgeKeepDays = menuDayCount;
  }
  draft.bodyText = normalizeRecipeBodyText(draft.bodyText);
  draft.requiredEquipment = clampRequiredEquipmentToAvailable(
    draft.requiredEquipment,
    availableEquipment,
  );
  if (
    !recipeFitsAvailableEquipment(draft.requiredEquipment, availableEquipment)
  ) {
    return null;
  }
  return draft;
}

/** Pure parser: map plan keys → drafts (name must match locked dish). */
export function parseExpandRecipesJson(
  content: string,
  plan: PlannedDish[],
): Map<string, InventRecipeDraft> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(content));
  } catch {
    slogError("expand", "parse:json-invalid", {
      contentChars: content.length,
    });
    return null;
  }
  if (!parsed || typeof parsed !== "object") {
    slogError("expand", "parse:not-object");
    return null;
  }
  const root = parsed as { recipes?: unknown };
  if (!Array.isArray(root.recipes)) {
    slogError("expand", "parse:no-recipes-array");
    return null;
  }

  const byKey = indexExpandRowsByKey(root.recipes);
  const draftsByName = parseInventRecipesJson(
    JSON.stringify({ recipes: normalizeExpandRecipeRows(root.recipes) }),
  );
  if (draftsByName.length === 0 && root.recipes.length > 0) {
    slogError("expand", "parse:invent-drafts-empty", {
      recipeRows: root.recipes.length,
      keyed: byKey.size,
    });
  }
  const used = new Set<InventRecipeDraft>();
  const out = new Map<string, InventRecipeDraft>();

  for (const dish of plan) {
    const key = planKey(dish);
    const draft =
      draftFromKeyedRow(byKey.get(key), dish) ??
      takeDraftByName(draftsByName, dish, used);
    if (!draft) {
      slogError("expand", "parse:dish-unmatched", {
        key,
        name: dish.name,
        hasKeyedRow: byKey.has(key),
        keyedKeys: [...byKey.keys()],
        draftCount: draftsByName.length,
      });
      return null;
    }
    used.add(draft);
    out.set(key, draft);
  }

  return out.size === plan.length ? out : null;
}

function indexExpandRowsByKey(
  recipes: unknown[],
): Map<string, Record<string, unknown>> {
  const byKey = new Map<string, Record<string, unknown>>();
  for (const item of recipes) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const key = typeof row.key === "string" ? row.key.trim() : "";
    if (key) byKey.set(key, row);
  }
  return byKey;
}

function normalizeExpandRecipeRows(recipes: unknown[]): unknown[] {
  return recipes.map((item) => {
    if (!item || typeof item !== "object") return item;
    const row = item as Record<string, unknown>;
    return {
      ...row,
      plate_role: row.plate_role ?? row.plateRole ?? "main",
    };
  });
}

function draftFromKeyedRow(
  row: Record<string, unknown> | undefined,
  dish: PlannedDish,
): InventRecipeDraft | null {
  if (!row) return null;
  const one = parseInventRecipesJson(
    JSON.stringify({
      recipes: [
        {
          ...row,
          name: dish.name,
          plate_role: dish.plateRole,
          covers_roles:
            row.covers_roles ?? row.coversRoles ?? dish.coversRoles ?? null,
          fridge_keep_days:
            row.fridge_keep_days ?? row.fridgeKeepDays ?? DEFAULT_DAY_COUNT,
        },
      ],
    }),
  )[0];
  if (!one) return null;
  one.name = dish.name;
  one.plateRole = dish.plateRole;
  one.coversRoles = dish.coversRoles ?? one.coversRoles;
  return one;
}

function takeDraftByName(
  drafts: InventRecipeDraft[],
  dish: PlannedDish,
  used: Set<InventRecipeDraft>,
): InventRecipeDraft | null {
  const match = drafts.find(
    (d) =>
      !used.has(d) &&
      (namesEqual(d.name, dish.name) ||
        normalizeDishName(d.name) === normalizeDishName(dish.name)),
  );
  if (!match) return null;
  match.name = dish.name;
  match.plateRole = dish.plateRole;
  match.coversRoles = dish.coversRoles ?? match.coversRoles;
  return match;
}

async function cleanup(supabase: SupabaseClient, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await supabase.from("recipes").delete().in("id", ids);
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}
