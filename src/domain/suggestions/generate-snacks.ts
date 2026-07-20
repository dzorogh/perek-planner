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
- Invent varied everyday options — do not copy a fixed catalog; invent fresh labels each time.
- Never repeat items from avoid. Never invent cooked dishes (no soups, no hot meals).
- Honor likedSnacks (prefer that style) and operatorTasteNotes: constraint is PRIMARY (generalize the rule); exampleDish is secondary only; ban = hard never; wish = soft prefer.
- Consecutive menus must feel different: avoid recentlyUsed snacks and near-duplicates of them.
- price_rub_per_serving: integer RUBLES for 1 adult portion (supermarket). Typical: fruit 30–80, dairy 40–100, nuts/cheese 80–180. NEVER above 250. NEVER send kopecks.
- nutrition_per_serving: kcal (integer) and protein_g / fat_g / carbs_g for 1 adult portion. Realistic snack estimates.
- OMIT price_rub_per_serving and/or any nutrition field when uncertain — do NOT send zeros as fillers.`;

type SnackPreferences = {
  liked: string[];
  disliked: Set<string>;
  recent: Set<string>;
};

async function loadSnackPreferences(
  supabase: SupabaseClient,
  userId: string,
  excludeMenuId?: string,
): Promise<SnackPreferences | null> {
  const [ratingsRes, recent] = await Promise.all([
    supabase
      .from("snack_ratings")
      .select("label, rating")
      .eq("user_id", userId),
    loadRecentSnackLabels(supabase, userId, {
      excludeMenuId,
      menuLimit: RECENT_SNACK_MENUS_COOLDOWN,
    }),
  ]);

  if (ratingsRes.error || !recent) return null;

  const liked: string[] = [];
  const disliked = new Set<string>();
  for (const row of ratingsRes.data ?? []) {
    if (typeof row.label !== "string" || !row.label.trim()) continue;
    const key = normalizeSnackLabel(row.label);
    if (row.rating === "dislike") disliked.add(key);
    if (row.rating === "like") liked.push(row.label.trim());
  }

  return { liked, disliked, recent };
}

async function proposeSnacksViaOpenRouter(
  count: number,
  prefs: SnackPreferences,
  chat: ChatCompletionsFn,
  tasteNotes: TasteNote[] = [],
  extraAvoid: Set<string> = new Set(),
): Promise<SnackDraft[]> {
  const avoid = new Set([
    ...prefs.disliked,
    ...prefs.recent,
    ...extraAvoid,
  ]);

  const content = await chat({
    messages: [
      { role: "system", content: SNACK_SYSTEM },
      {
        role: "user",
        content: JSON.stringify({
          count,
          avoid: [...avoid],
          likedSnacks: prefs.liked.slice(0, 20),
          recentlyUsed: [...prefs.recent],
          operatorTasteNotes: tasteNotesForPrompt(tasteNotes),
          instruction:
            "Invent that many distinct no-cook snacks (each snack is eaten on two consecutive menu days). Include price and nutrition when confident. Respect avoid and operatorTasteNotes (constraint PRIMARY, exampleDish secondary). Lean toward the style of likedSnacks when present, but invent new labels — do not only repeat liked ones. Do not reuse recentlyUsed. Capitalize the first letter of each name.",
        }),
      },
    ],
    responseFormatJson: true,
    temperature: 0.9,
  });

  return parseSnacksJson(content, count, avoid);
}

function snackRowPayload(draft: SnackDraft) {
  return {
    label: draft.label,
    price_cents_per_serving: draft.priceCentsPerServing,
    calories_kcal_per_serving: draft.caloriesKcalPerServing,
    protein_g_per_serving: draft.proteinGPerServing,
    fat_g_per_serving: draft.fatGPerServing,
    carbs_g_per_serving: draft.carbsGPerServing,
  };
}

/** Pure parser for snack JSON (objects preferred; legacy string labels accepted). */
export function parseSnacksJson(
  content: string,
  count: number,
  disliked: Set<string>,
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
    if (disliked.has(key) || seen.has(key)) continue;
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
  if (!isValidDayCount(dayCount)) {
    return { ok: false, error: "Некорректная длина меню." };
  }

  if (!getOpenRouterApiKey() && !options.chat) {
    return {
      ok: false,
      error: "AI-генерация не настроена. Добавьте OPENROUTER_API_KEY на сервере.",
    };
  }

  const prefs = await loadSnackPreferences(supabase, userId, menuId);
  if (!prefs) {
    return { ok: false, error: "Не удалось загрузить предпочтения по перекусам." };
  }

  const tasteNotes = await loadTasteNotes(supabase, userId);
  if (!tasteNotes) {
    return { ok: false, error: SUGGESTIONS_RU.tasteNotesFail };
  }
  const chat = options.chat ?? openRouterChatCompletions;
  const dayPairs = menuDayPairsForCount(dayCount);
  const pairCount = dayPairs.length;

  let drafts: SnackDraft[];
  try {
    drafts = await generateSnackDrafts(pairCount, prefs, chat, tasteNotes);
  } catch (err) {
    if (err instanceof OpenRouterError) {
      return {
        ok: false,
        error: "Не удалось сгенерировать перекусы. Попробуйте ещё раз.",
      };
    }
    throw err;
  }
  if (drafts.length < pairCount) {
    return {
      ok: false,
      error: "Не удалось придумать достаточно перекусов с учётом предпочтений.",
    };
  }

  const pairDrafts = drafts.slice(0, pairCount);
  await supabase.from("menu_snacks").delete().eq("menu_id", menuId);

  const rows = dayPairs.flatMap((pair, pairIndex) => {
    const draft = pairDrafts[pairIndex]!;
    return pair.map((dayIndex) => ({
      menu_id: menuId,
      day_index: dayIndex,
      ...snackRowPayload(draft),
    }));
  });

  const { error: insertError } = await supabase.from("menu_snacks").insert(rows);

  if (insertError) {
    return { ok: false, error: "Не удалось сохранить перекусы." };
  }

  return { ok: true, labels: pairDrafts.map((d) => d.label) };
}

async function generateSnackDrafts(
  dayCount: number,
  prefs: SnackPreferences,
  chat: ChatCompletionsFn,
  tasteNotes: TasteNote[],
): Promise<SnackDraft[]> {
  let drafts: SnackDraft[] = [];
  drafts = await proposeSnacksViaOpenRouter(
    dayCount,
    prefs,
    chat,
    tasteNotes,
  );

  // One retry if the model returned too few after filtering avoid/dislike.
  if (drafts.length < dayCount) {
    const exclude = new Set(prefs.disliked);
    for (const d of drafts) exclude.add(normalizeSnackLabel(d.label));
    for (const r of prefs.recent) exclude.add(r);
    try {
      const more = await proposeSnacksViaOpenRouter(
        dayCount - drafts.length,
        prefs,
        chat,
        tasteNotes,
        exclude,
      );
      drafts = [...drafts, ...more];
    } catch (err) {
      if (!(err instanceof OpenRouterError)) throw err;
    }
  }

  return drafts;
}

async function proposeReplacementSnackDraft(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  chat: ChatCompletionsFn,
): Promise<
  | { ok: true; draft: SnackDraft }
  | { ok: false; error: string }
> {
  const prefs = await loadSnackPreferences(supabase, userId, menuId);
  if (!prefs) {
    return { ok: false, error: "Не удалось загрузить предпочтения по перекусам." };
  }

  const { data: siblings } = await supabase
    .from("menu_snacks")
    .select("label")
    .eq("menu_id", menuId);

  const extraAvoid = new Set<string>();
  for (const row of siblings ?? []) {
    if (typeof row.label === "string") {
      extraAvoid.add(normalizeSnackLabel(row.label));
    }
  }

  const tasteNotes = await loadTasteNotes(supabase, userId);
  if (!tasteNotes) {
    return { ok: false, error: SUGGESTIONS_RU.tasteNotesFail };
  }

  try {
    const proposed = await proposeSnacksViaOpenRouter(
      1,
      prefs,
      chat,
      tasteNotes,
      extraAvoid,
    );
    const draft = proposed[0] ?? null;
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

  const { data: snack, error: snackError } = await supabase
    .from("menu_snacks")
    .select("id, label, day_index")
    .eq("id", snackId)
    .eq("menu_id", menuId)
    .maybeSingle();

  if (snackError || !snack) {
    return { ok: false, error: "Перекус не найден." };
  }

  const dayPair = menuDayPairForDay(snack.day_index);
  if (!dayPair) {
    return { ok: false, error: "Перекус не найден." };
  }

  const chat = options.chat ?? openRouterChatCompletions;
  const proposed = await proposeReplacementSnackDraft(
    supabase,
    userId,
    menuId,
    chat,
  );
  if (!proposed.ok) return proposed;

  const { error: updateError } = await supabase
    .from("menu_snacks")
    .update(snackRowPayload(proposed.draft))
    .eq("menu_id", menuId)
    .in("day_index", [...dayPair]);

  if (updateError) {
    if (updateError.code === "23505") {
      return { ok: false, error: "Такой перекус уже есть в меню." };
    }
    return { ok: false, error: "Не удалось заменить перекус." };
  }

  return { ok: true, label: proposed.draft.label };
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

  const { data: snack, error: snackError } = await supabase
    .from("menu_snacks")
    .select("id, label")
    .eq("id", snackId)
    .eq("menu_id", menuId)
    .maybeSingle();

  if (snackError || !snack) {
    return { ok: false, error: "Перекус не найден." };
  }

  const refusedLabel = snack.label.trim();
  if (!refusedLabel) {
    return { ok: false, error: "У перекуса нет названия." };
  }

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
