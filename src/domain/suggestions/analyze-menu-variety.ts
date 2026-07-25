import type { MealSlot, MenuDayPair } from "@/domain/menu/constants";
import { MEAL_LABELS_RU } from "@/domain/menu/constants";
import { isPlateRole, type PlateRole } from "@/domain/menu/meal-templates";
import { resolvePositionPlateRole } from "@/domain/suggestions/plan-menu-names";
import {
  openRouterChatCompletions,
  OpenRouterError,
  type ChatCompletionsFn,
} from "@/lib/openrouter/client";

export type MenuPlanDish = {
  meal: MealSlot;
  dayPair: MenuDayPair;
  plateRole: PlateRole;
  name: string;
  /** Stable id or plan key — used only for correlation, not culinary judgment. */
  recipeId: string;
};

export type MenuVarietyReplace = {
  meal: MealSlot;
  dayPair: MenuDayPair;
  plateRole: PlateRole;
  reason: string;
};

export type AnalyzeMenuVarietyResult =
  | { ok: true; replace: [] }
  | { ok: true; replace: MenuVarietyReplace[] }
  | { ok: false; reason: "openrouter" | "parse" };

const ANALYZE_SYSTEM = `You audit a Russian household batch-cook menu for culinary variety failures.
The menu is already built as fixed day-pairs (days 1–2 and 3–4). Each dish spans its pair.
Plate roles are FIXED (soup/protein/veg/carb/main) — audit culinary variety, not architecture.
Respond with a single JSON object:
{"ok":true,"replace":[]}
OR
{"ok":false,"replace":[{"meal":"lunch"|"dinner"|"breakfast"|...,"dayPair":[1,2]|[3,4],"plate_role":"protein"|"soup"|"veg"|"carb"|"main","reason":"short Russian why"}]}.

Audit HARD rules (flag a position to replace when broken):
1) Same-day clash: on the same calendar days (same dayPair), lunch and dinner proteins must NOT be culinary near-duplicates (form+base). Word-order / topping swaps count as duplicates.
   Too close (FAIL): «Куриные рулеты с сыром и шпинатом» ≈ «Куриные рулетики с шпинатом и сыром»; котлеты из курицы ≈ куриные котлеты.
2) Form spam: the same culinary form (рулеты/рулетики, котлеты, запеканка, плов, …) must not dominate the menu — at most TWO proteins/mains of the same form across the whole plan. Flag extras beyond two.
3) Same protein+form twice on one dayPair across lunch+dinner is always a FAIL for dinner (prefer replacing dinner when lunch/dinner collide).
4) Carb/veg sides: never a second meat/fish dish disguised as a side next to a meat/fish protein; never a near-duplicate of its own protein.
5) Cooking-method spam: the same method word family (запечённ/в духовке, жаренн, тушённ, …) on MORE THAN TWO dishes anywhere in the plan is a FAIL — flag extras (prefer veg/carb). Three «запечённ…» names on one dinner (protein+veg+carb) is always a FAIL for veg and/or carb.
6) Breakfast may reuse morning forms (омлет/сырники) across pairs — do NOT flag that. Do NOT flag Model C reuse of the exact same recipe across the two days of its pair.

When ok=false, list ONLY positions that must be reinvented (max 4). Prefer dinner over lunch when both of a same-day clash would work. Be strict on rolls/cutlets/casserole form spam and «запечённ…» method spam.`;

/**
 * AI variety audit of the drafted cookable menu. Returns positions to reinvent.
 */
export async function analyzeMenuVariety(
  dishes: MenuPlanDish[],
  options: { chat?: ChatCompletionsFn } = {},
): Promise<AnalyzeMenuVarietyResult> {
  if (dishes.length === 0) {
    return { ok: true, replace: [] };
  }

  const chat = options.chat ?? openRouterChatCompletions;
  const payload = {
    dishes: dishes.map((d) => ({
      meal: d.meal,
      mealLabelRu: MEAL_LABELS_RU[d.meal],
      dayPair: [...d.dayPair],
      plate_role: d.plateRole,
      name: d.name,
    })),
    instruction:
      "Audit this menu. Flag near-duplicates and form spam per rules. Prefer replacing dinner when lunch/dinner clash on the same dayPair.",
  };

  let content: string;
  try {
    content = await chat({
      messages: [
        { role: "system", content: ANALYZE_SYSTEM },
        { role: "user", content: JSON.stringify(payload) },
      ],
      responseFormatJson: true,
      temperature: 0.2,
    });
  } catch (err) {
    if (err instanceof OpenRouterError) {
      return { ok: false, reason: "openrouter" };
    }
    throw err;
  }

  return parseAnalyzeMenuVarietyJson(content);
}

/** Pure parser for analyzer JSON. */
export function parseAnalyzeMenuVarietyJson(
  content: string,
): AnalyzeMenuVarietyResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(content));
  } catch {
    return { ok: false, reason: "parse" };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, reason: "parse" };
  }
  const root = parsed as { ok?: unknown; replace?: unknown };
  if (!Array.isArray(root.replace)) {
    if (root.ok === true) return { ok: true, replace: [] };
    return { ok: false, reason: "parse" };
  }

  const replace = root.replace
    .map(parseReplaceItem)
    .filter((item): item is MenuVarietyReplace => item != null)
    .slice(0, 4);

  if (root.ok === true && replace.length === 0) {
    return { ok: true, replace: [] };
  }
  return { ok: true, replace };
}

function parseReplaceItem(item: unknown): MenuVarietyReplace | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  const meal = typeof row.meal === "string" ? row.meal : "";
  const pair = parseDayPair(row.dayPair);
  if (!isMealSlotLoose(meal) || !pair) return null;
  const reason =
    typeof row.reason === "string" ? row.reason.trim().slice(0, 200) : "";
  const plateRole = parseReplacePlateRole(
    meal,
    row.plate_role ?? row.plateRole ?? row.role,
  );
  if (!plateRole || plateRole === "snack") return null;
  return {
    meal,
    dayPair: pair,
    plateRole,
    reason: reason || "variety",
  };
}

function parseReplacePlateRole(
  meal: MealSlot,
  rawRole: unknown,
): PlateRole | null {
  if (typeof rawRole !== "string") return null;
  const resolved = resolvePositionPlateRole(meal, rawRole);
  if (resolved) return resolved;
  return isPlateRole(rawRole) ? rawRole : null;
}

function parseDayPair(raw: unknown): MenuDayPair | null {
  if (!Array.isArray(raw) || raw.length !== 2) return null;
  const a = Number(raw[0]);
  const b = Number(raw[1]);
  if (a === 1 && b === 2) return [1, 2];
  if (a === 3 && b === 4) return [3, 4];
  return null;
}

function isMealSlotLoose(value: string): value is MealSlot {
  return (
    value === "breakfast" ||
    value === "second_breakfast" ||
    value === "lunch" ||
    value === "afternoon_snack" ||
    value === "dinner" ||
    value === "late_dinner"
  );
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}
