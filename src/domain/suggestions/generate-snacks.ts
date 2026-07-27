import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isValidFeedbackComment,
  normalizeFeedbackComment,
} from "@/domain/history/constants";
import {
  isValidDayCount,
  menuDayPairForDay,
  menuDayPairsForCount,
} from "@/domain/menu/constants";
import {
  ensureSnackSlots,
  replaceMenuSnackDishes,
  snackDraftNutrition,
  upsertSnackDish,
} from "@/domain/menu/menu-dishes";
import { inventPriceToKopecks } from "@/domain/suggestions/invent-recipes";
import {
  RECENT_SNACK_MENUS_COOLDOWN,
  SUGGESTIONS_RU,
} from "@/domain/suggestions/constants";
import { loadRecentSnackLabels } from "@/domain/suggestions/history";
import {
  formatSnackLabel,
  normalizeSnackLabel,
} from "@/domain/suggestions/snack-pool";
import { recordTasteBanFromFeedback } from "@/domain/settings/taste-preferences";
import {
  loadTasteNotes,
  tasteNotesForPrompt,
  type TasteNote,
} from "@/domain/suggestions/taste-notes";
import {
  getOpenRouterApiKey,
  openRouterChatCompletions,
  OpenRouterError,
  type ChatCompletionsFn,
} from "@/lib/openrouter/client";
import { slog, slogError } from "@/lib/server-log";

export type GenerateSnacksResult =
  | { ok: true; labels: string[] }
  | { ok: false; error: string };

export type SnackDraft = {
  label: string;
  priceCentsPerServing: number | null;
  caloriesKcalPerServing: number | null;
  proteinGPerServing: number | null;
  fatGPerServing: number | null;
  carbsGPerServing: number | null;
};

const SNACK_SYSTEM = `You invent simple no-cook Russian grocery snacks (перекусы) for a household meal planner.
Respond with a single JSON object:
{"snacks":[{"name":"...","price_rub_per_serving":N,"nutrition_per_serving":{"kcal":N,"protein_g":N,"fat_g":N,"carbs_g":N}},...]}.
Rules:
- Exactly the requested count of distinct snacks.
- name: Russian, 1–4 words, sentence case (first letter capital), ready-to-eat / no cooking only (dairy, fruit, nuts, crackers, vegetables, bars, etc.).
- Everyday supermarket labels only — what a person would put on a shopping list (йогурт, творожок, яблоко, банан, горсть миндаля, хлебцы с сыром, морковь с хумусом, кефир). Prefer concrete food ± simple pairing («Крекеры с авокадо», «Творог с ягодами»).
- HARD ban on fantasy / poetic / marketing / brand-like titles: never «солнечные…», «волшебные…», «райские…», «энергетические…», «бомба», invented product names, cute metaphors.
- Invent varied everyday options — do not copy a fixed catalog; invent fresh labels each time.
- Never repeat items from avoid. Never invent cooked dishes (no soups, no hot meals).
- Honor operatorTasteNotes: constraint is PRIMARY (generalize the rule); exampleDish is secondary only; ban = hard never; wish = soft prefer.
- Consecutive menus must feel different: avoid recentlyUsed snacks and near-duplicates of them.
- price_rub_per_serving: integer RUBLES for 1 adult portion (supermarket). Typical: fruit 30–80, dairy 40–100, nuts/cheese 80–180. NEVER above 250. NEVER send kopecks.
- nutrition_per_serving: kcal (integer) and protein_g / fat_g / carbs_g for 1 adult snack portion (not a full meal / not a whole package). Typical snack ~100–350 kcal.
- OMIT price_rub_per_serving and/or any nutrition field when uncertain — do NOT send zeros as fillers.`;

/** Replace path: leap away from the rejected snack (mirrors dish replacedDishes). */
const SNACK_REPLACE_SYSTEM = `You invent replacement no-cook Russian grocery snacks (перекусы) for a household meal planner.
The operator rejected replacedSnacks — invent snacks THEY WOULD NOT SEE AS "the same idea with a tweak".

Respond with a single JSON object:
{"snacks":[{"name":"...","price_rub_per_serving":N,"nutrition_per_serving":{"kcal":N,"protein_g":N,"fat_g":N,"carbs_g":N}},...]}.

Rules:
- Return exactly the requested count of DISTINCT snacks (candidates; the app picks one).
- name: Russian, 1–4 words, sentence case, ready-to-eat / no cooking only.
- Everyday supermarket labels only — shopping-list style, not fantasy/poetic/marketing names.
- HARD form leap vs replacedSnacks: each NEW name MUST use a clearly DIFFERENT food form/base from every replacedSnacks entry. Same form with another topping/brand/fat% is FORBIDDEN.
  Fail: яблоко→яблоко; йогурт→йогурт питьевой; творог→творожок; банан→банан с арахисовой пастой as the same banana idea; хлебцы с сыром→хлебцы с творогом.
  Pass: яблоко→кефир; йогурт→хумус с морковью; творог→горсть миндаля; банан→сырные кубики / хумус с хлебцами / груша.
- NEVER echo or near-duplicate avoid, recentlyUsed, or replacedSnacks (including word-order / diminutive swaps).
- Do NOT only reshuffle a tiny fixed set (yogurt/apple/banana/cottage cheese). Invent fresh everyday labels each call.
- Never invent cooked dishes.
- Honor operatorTasteNotes (constraint PRIMARY). price/nutrition rules same as usual; OMIT when uncertain.`;

const SNACK_REPLACE_CANDIDATE_COUNT = 5;

type SnackPreferences = {
  recent: Set<string>;
};

async function loadSnackPreferences(
  supabase: SupabaseClient,
  userId: string,
  excludeMenuId?: string,
): Promise<SnackPreferences | null> {
  const recent = await loadRecentSnackLabels(supabase, userId, {
    excludeMenuId,
    menuLimit: RECENT_SNACK_MENUS_COOLDOWN,
  });
  if (!recent) return null;
  return { recent };
}

async function proposeSnacksViaOpenRouter(
  count: number,
  prefs: SnackPreferences,
  chat: ChatCompletionsFn,
  tasteNotes: TasteNote[] = [],
  extraAvoid: Set<string> = new Set(),
): Promise<SnackDraft[]> {
  const avoid = new Set([...prefs.recent, ...extraAvoid]);

  const content = await chat({
    messages: [
      { role: "system", content: SNACK_SYSTEM },
      {
        role: "user",
        content: JSON.stringify({
          count,
          avoid: [...avoid],
          recentlyUsed: [...prefs.recent],
          operatorTasteNotes: tasteNotesForPrompt(tasteNotes),
          instruction:
            "Invent that many distinct no-cook snacks (each snack is eaten on two consecutive menu days). Everyday grocery labels only — no fantasy/poetic/marketing names. Include price and nutrition when confident. Respect avoid and operatorTasteNotes (constraint PRIMARY, exampleDish secondary). Do not reuse recentlyUsed. Capitalize the first letter of each name.",
        }),
      },
    ],
    responseFormatJson: true,
    // Higher than default OpenRouter 0.4 — low temp collapses to a tiny yogurt/apple set.
    temperature: 0.75,
    maxTokens: 1024,
  });

  return parseSnacksJson(content, count, avoid);
}

async function proposeReplacementSnacksViaOpenRouter(
  count: number,
  prefs: SnackPreferences,
  chat: ChatCompletionsFn,
  tasteNotes: TasteNote[],
  replacedSnacks: string[],
  extraAvoid: Set<string>,
  temperature: number,
): Promise<SnackDraft[]> {
  const avoid = new Set([
    ...prefs.recent,
    ...extraAvoid,
    ...replacedSnacks.map(normalizeSnackLabel),
  ]);

  const content = await chat({
    messages: [
      { role: "system", content: SNACK_REPLACE_SYSTEM },
      {
        role: "user",
        content: JSON.stringify({
          count,
          replacedSnacks,
          avoid: [...avoid],
          recentlyUsed: [...prefs.recent],
          operatorTasteNotes: tasteNotesForPrompt(tasteNotes),
          instruction:
            "Return that many DISTINCT replacement snack candidates. HARD: leap to a different food form/base than every replacedSnacks entry — not the same snack with a tweak. Forbidden: every avoid entry. Invent fresh everyday grocery labels; do not reshuffle a tiny catalog. Include price and nutrition when confident.",
        }),
      },
    ],
    responseFormatJson: true,
    temperature,
    maxTokens: 1024,
  });

  return parseSnacksJson(content, count, avoid);
}

/** Pure parser for snack JSON (objects preferred; legacy string labels accepted). */
export function parseSnacksJson(
  content: string,
  count: number,
  avoid: Set<string>,
): SnackDraft[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(content));
  } catch {
    return [];
  }
  const root = parsed as { snacks?: unknown };
  if (!Array.isArray(root.snacks)) return [];

  const out: SnackDraft[] = [];
  const seen = new Set<string>();
  for (const item of root.snacks) {
    const draft = parseSnackItem(item);
    if (!draft) continue;
    const key = normalizeSnackLabel(draft.label);
    if (avoid.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(draft);
    if (out.length >= count) break;
  }
  return out;
}

function parseSnackItem(item: unknown): SnackDraft | null {
  if (typeof item === "string") {
    const label = formatSnackLabel(item);
    if (!label || label.length > 80) return null;
    return {
      label,
      priceCentsPerServing: null,
      caloriesKcalPerServing: null,
      proteinGPerServing: null,
      fatGPerServing: null,
      carbsGPerServing: null,
    };
  }
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  const rawName = row.name ?? row.label;
  if (typeof rawName !== "string") return null;
  const label = formatSnackLabel(rawName);
  if (!label || label.length > 80) return null;

  const nutritionRaw =
    row.nutrition_per_serving ?? row.nutritionPerServing;
  const nutrition =
    nutritionRaw && typeof nutritionRaw === "object"
      ? (nutritionRaw as Record<string, unknown>)
      : null;

  return {
    label,
    priceCentsPerServing: inventPriceToKopecks(row),
    caloriesKcalPerServing: parseOptionalNonNegInt(
      nutrition?.kcal ??
      row.calories_kcal_per_serving ??
      row.caloriesKcalPerServing,
    ),
    proteinGPerServing: parseOptionalNonNegNumber(
      nutrition?.protein_g ?? nutrition?.proteinG ?? row.protein_g_per_serving,
    ),
    fatGPerServing: parseOptionalNonNegNumber(
      nutrition?.fat_g ?? nutrition?.fatG ?? row.fat_g_per_serving,
    ),
    carbsGPerServing: parseOptionalNonNegNumber(
      nutrition?.carbs_g ?? nutrition?.carbsG ?? row.carbs_g_per_serving,
    ),
  };
}

function parseOptionalNonNegInt(raw: unknown): number | null {
  const n = coerceNumber(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n === 0) return null;
  return Math.trunc(n);
}

function parseOptionalNonNegNumber(raw: unknown): number | null {
  const n = coerceNumber(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n === 0) return null;
  return n;
}

function coerceNumber(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return Number(raw);
  return NaN;
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

/**
 * Generate one snack per day-pair and write the same label to both days
 * in the pair (2 → [1,2]; 4 → +[3,4]; 6 → +[5,6]).
 */
export async function generateSnacksForMenu(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  dayCount: number,
  options: { chat?: ChatCompletionsFn } = {},
): Promise<GenerateSnacksResult> {
  const started = Date.now();
  slog("snacks", "start", { menuId, dayCount });

  if (!isValidDayCount(dayCount)) {
    slogError("snacks", "fail", { reason: "invalid-day-count", dayCount });
    return { ok: false, error: "Некорректная длина меню." };
  }

  if (!getOpenRouterApiKey() && !options.chat) {
    slogError("snacks", "fail", { reason: "no-api-key" });
    return {
      ok: false,
      error: "AI-генерация не настроена. Добавьте OPENROUTER_API_KEY на сервере.",
    };
  }

  const [prefs, tasteNotes] = await Promise.all([
    loadSnackPreferences(supabase, userId, menuId),
    loadTasteNotes(supabase, userId),
  ]);
  if (!prefs) {
    slogError("snacks", "fail", { reason: "prefs-load", menuId });
    return { ok: false, error: "Не удалось загрузить предпочтения по перекусам." };
  }
  if (!tasteNotes) {
    slogError("snacks", "fail", { reason: "taste-notes-load", menuId });
    return { ok: false, error: SUGGESTIONS_RU.tasteNotesFail };
  }
  const chat = options.chat ?? openRouterChatCompletions;
  const dayPairs = menuDayPairsForCount(dayCount);
  const pairCount = dayPairs.length;

  let drafts: SnackDraft[];
  try {
    slog("snacks", "chat:start", { pairCount });
    drafts = await generateSnackDrafts(pairCount, prefs, chat, tasteNotes);
  } catch (err) {
    if (err instanceof OpenRouterError) {
      slogError("snacks", "chat:fail", {
        message: err.message,
        status: err.causeStatus,
        ms: Date.now() - started,
      });
      return {
        ok: false,
        error: "Не удалось сгенерировать перекусы. Попробуйте ещё раз.",
      };
    }
    throw err;
  }
  if (drafts.length < pairCount) {
    slogError("snacks", "fail", {
      reason: "underfill",
      got: drafts.length,
      need: pairCount,
      ms: Date.now() - started,
    });
    return {
      ok: false,
      error: "Не удалось придумать достаточно перекусов с учётом предпочтений.",
    };
  }

  const pairDrafts = drafts.slice(0, pairCount);
  const { data: menuRow } = await supabase
    .from("menus")
    .select("default_servings_per_meal")
    .eq("id", menuId)
    .maybeSingle();
  const servings =
    typeof menuRow?.default_servings_per_meal === "number"
      ? menuRow.default_servings_per_meal
      : 2;

  const byDay = new Map<number, SnackDraft>();
  for (let pairIndex = 0; pairIndex < dayPairs.length; pairIndex += 1) {
    const draft = pairDrafts[pairIndex]!;
    for (const dayIndex of dayPairs[pairIndex]!) {
      byDay.set(dayIndex, draft);
    }
  }

  const ok = await replaceMenuSnackDishes(
    supabase,
    menuId,
    dayCount,
    servings,
    byDay,
  );
  if (!ok) {
    slogError("snacks", "fail", {
      reason: "insert",
      ms: Date.now() - started,
    });
    return { ok: false, error: "Не удалось сохранить перекусы." };
  }

  const labels = pairDrafts.map((d) => d.label);
  slog("snacks", "ok", { menuId, labels, ms: Date.now() - started });
  return { ok: true, labels };
}

async function generateSnackDrafts(
  dayCount: number,
  prefs: SnackPreferences,
  chat: ChatCompletionsFn,
  tasteNotes: TasteNote[],
): Promise<SnackDraft[]> {
  return proposeSnacksViaOpenRouter(dayCount, prefs, chat, tasteNotes);
}

function pickReplacementDraft(
  candidates: SnackDraft[],
  replacedKey: string,
): SnackDraft | null {
  for (const draft of candidates) {
    if (normalizeSnackLabel(draft.label) !== replacedKey) return draft;
  }
  return null;
}

async function proposeReplacementSnackDraft(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  replacedLabel: string,
  chat: ChatCompletionsFn,
): Promise<
  | { ok: true; draft: SnackDraft }
  | { ok: false; error: string }
> {
  const prefs = await loadSnackPreferences(supabase, userId, menuId);
  if (!prefs) {
    return { ok: false, error: "Не удалось загрузить предпочтения по перекусам." };
  }

  const { data: siblingSlots } = await supabase
    .from("menu_slots")
    .select("menu_dishes(snack_label)")
    .eq("menu_id", menuId)
    .eq("meal", "snack");

  const extraAvoid = new Set<string>();
  for (const row of siblingSlots ?? []) {
    const dishes = (
      row as { menu_dishes?: Array<{ snack_label?: unknown }> | null }
    ).menu_dishes;
    for (const d of dishes ?? []) {
      if (typeof d.snack_label === "string") {
        extraAvoid.add(normalizeSnackLabel(d.snack_label));
      }
    }
  }
  const replacedKey = normalizeSnackLabel(replacedLabel);
  if (replacedKey) extraAvoid.add(replacedKey);

  const tasteNotes = await loadTasteNotes(supabase, userId);
  if (!tasteNotes) {
    return { ok: false, error: SUGGESTIONS_RU.tasteNotesFail };
  }

  const replacedSnacks = replacedLabel.trim() ? [replacedLabel.trim()] : [];

  try {
    let proposed = await proposeReplacementSnacksViaOpenRouter(
      SNACK_REPLACE_CANDIDATE_COUNT,
      prefs,
      chat,
      tasteNotes,
      replacedSnacks,
      extraAvoid,
      0.9,
    );
    let draft = pickReplacementDraft(proposed, replacedKey);

    // Soft prompt can still echo / underfill — one repair with rejected names banned.
    if (!draft) {
      const rejected = new Set(extraAvoid);
      for (const d of proposed) rejected.add(normalizeSnackLabel(d.label));
      proposed = await proposeReplacementSnacksViaOpenRouter(
        SNACK_REPLACE_CANDIDATE_COUNT,
        prefs,
        chat,
        tasteNotes,
        [...replacedSnacks, ...proposed.map((d) => d.label)],
        rejected,
        1.0,
      );
      draft = pickReplacementDraft(proposed, replacedKey);
    }

    if (!draft) {
      return { ok: false, error: "Не удалось предложить другой перекус." };
    }
    return { ok: true, draft };
  } catch (err) {
    if (err instanceof OpenRouterError) {
      return {
        ok: false,
        error: "Не удалось предложить другой перекус. Попробуйте ещё раз.",
      };
    }
    throw err;
  }
}

/**
 * Replace a snack for its whole day-pair (1–2 or 3–4) with one AI suggestion.
 */
export async function resuggestSnackForMenu(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  snackId: string,
  options: { chat?: ChatCompletionsFn } = {},
): Promise<{ ok: true; label: string } | { ok: false; error: string }> {
  if (!getOpenRouterApiKey() && !options.chat) {
    return {
      ok: false,
      error: "AI-генерация не настроена. Добавьте OPENROUTER_API_KEY на сервере.",
    };
  }

  const snack = await loadOwnedSnackDish(supabase, menuId, snackId);
  if (!snack) {
    return { ok: false, error: "Перекус не найден." };
  }

  const dayPair = menuDayPairForDay(snack.dayIndex);
  if (!dayPair) {
    return { ok: false, error: "Перекус не найден." };
  }

  const replacedLabel = snack.label;
  const chat = options.chat ?? openRouterChatCompletions;
  const proposed = await proposeReplacementSnackDraft(
    supabase,
    userId,
    menuId,
    replacedLabel,
    chat,
  );
  if (!proposed.ok) return proposed;

  // Belt-and-suspenders: never persist an exact echo of the replaced label.
  if (
    replacedLabel &&
    normalizeSnackLabel(proposed.draft.label) ===
      normalizeSnackLabel(replacedLabel)
  ) {
    return { ok: false, error: "Не удалось предложить другой перекус." };
  }

  const { data: menuRow } = await supabase
    .from("menus")
    .select("day_count, default_servings_per_meal")
    .eq("id", menuId)
    .maybeSingle();
  const dayCount =
    typeof menuRow?.day_count === "number" ? menuRow.day_count : 0;
  const servings =
    typeof menuRow?.default_servings_per_meal === "number"
      ? menuRow.default_servings_per_meal
      : 2;
  if (dayCount < 1) {
    return { ok: false, error: "Меню не найдено." };
  }

  const slots = await ensureSnackSlots(supabase, menuId, dayCount, servings);
  for (const dayIndex of dayPair) {
    const slotId = slots.get(dayIndex);
    if (!slotId) {
      return { ok: false, error: "Не удалось заменить перекус." };
    }
    const ok = await upsertSnackDish(
      supabase,
      slotId,
      proposed.draft.label,
      snackDraftNutrition(proposed.draft),
    );
    if (!ok) {
      return { ok: false, error: "Не удалось заменить перекус." };
    }
  }

  return { ok: true, label: proposed.draft.label };
}

type OwnedSnackDish = {
  id: string;
  label: string;
  dayIndex: number;
};

async function loadOwnedSnackDish(
  supabase: SupabaseClient,
  menuId: string,
  dishId: string,
): Promise<OwnedSnackDish | null> {
  const { data, error } = await supabase
    .from("menu_dishes")
    .select(
      `id, snack_label,
       menu_slots!inner(id, menu_id, day_index, meal)`,
    )
    .eq("id", dishId)
    .eq("plate_role", "snack")
    .eq("menu_slots.menu_id", menuId)
    .eq("menu_slots.meal", "snack")
    .maybeSingle();

  if (error || !data) return null;
  const slot = Array.isArray(data.menu_slots)
    ? data.menu_slots[0]
    : data.menu_slots;
  if (!slot || typeof slot.day_index !== "number") return null;
  const label =
    typeof data.snack_label === "string" ? data.snack_label.trim() : "";
  if (!label) return null;
  return { id: data.id, label, dayIndex: slot.day_index };
}

/**
 * Hard-dislike a snack label, then replace it on this Menu via AI.
 */
export async function refuseAndReplaceSnackAcrossMenu(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  snackId: string,
  options: { chat?: ChatCompletionsFn; comment?: string } = {},
): Promise<{ ok: true; label: string } | { ok: false; error: string }> {
  const comment = normalizeFeedbackComment(options.comment ?? "");
  if (!isValidFeedbackComment(comment)) {
    return {
      ok: false,
      error: "Укажите причину — без комментария отказ не принимаем.",
    };
  }

  const snack = await loadOwnedSnackDish(supabase, menuId, snackId);
  if (!snack) {
    return { ok: false, error: "Перекус не найден." };
  }

  const refusedLabel = snack.label;
  // History table only — ratings do not steer future snack AI.
  const { error: refuseError } = await supabase.from("snack_ratings").upsert(
    {
      user_id: userId,
      label: refusedLabel,
      rating: "dislike",
      reason: comment,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,label" },
  );
  if (refuseError) {
    return { ok: false, error: "Не удалось запомнить отказ." };
  }

  await recordTasteBanFromFeedback(supabase, userId, {
    subject: refusedLabel,
    comment,
  });

  return resuggestSnackForMenu(supabase, userId, menuId, snackId, {
    chat: options.chat,
  });
}
