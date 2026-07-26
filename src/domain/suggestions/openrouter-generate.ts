import { type MealSlot } from "@/domain/menu/constants";
import {
  isPlateRole,
  isTemplateMeal,
  rolesForMeal,
  type PlateRole,
} from "@/domain/menu/meal-templates";
import type { SuggestionCandidate } from "@/domain/suggestions/candidates";
import {
  normalizePlateAssignments,
  pickCompanionCandidate,
  type PlateAssignment,
} from "@/domain/suggestions/plate-complete";
import { primaryRecipeIdFromDishes } from "@/domain/suggestions/role-slots";
import { isLunchDinnerMeal } from "@/domain/suggestions/meal-fit";
import {
  tasteNotesForPrompt,
  type TasteNote,
} from "@/domain/suggestions/taste-notes";
import { assignWithBatchVariety } from "@/domain/suggestions/variety";
import {
  openRouterChatCompletions,
  type ChatCompletionsFn,
} from "@/lib/openrouter/client";

export type SlotPrompt = {
  slotId: string;
  dayIndex: number;
  meal: MealSlot;
};

export type ProposedAssignment = {
  slotId: string;
  dishes: Array<{ plateRole: PlateRole; recipeId: string }>;
  /** @deprecated shim — if present without dishes, convert via protein/main (+ optional carb from companionRecipeId) */
  recipeId?: string;
  /** @deprecated parse-only — never written to menu_slots; mapped into dishes[].carb */
  companionRecipeId?: string | null;
  plateKind?: "complete" | "needs_companion" | null;
};

const SYSTEM_PROMPT = `You are a home-cooking menu planner for a Russian household.
Bias: simple home batch food. Batch cooking reuses dishes across days *within this menu*.
Plate roles are FIXED by the app for each slot — assign persisted recipe ids into those roles.
Hard rules when dayCount >= 2 and candidates allow:
- At least 50% of cookable slots must reuse a recipe that appears on 2+ days (staggered 2-day batches are ideal).
- No two calendar days may have the identical full set of recipes (compare primary protein/main recipes).
- Within one calendar day, never reuse the same recipe across meals.
- Prefer candidates with freshlyInvented=true or recentlyUsed=false.
- You alone judge culinary near-duplicates (no keyword filter in code). Be strict.
- When currentMenuDishes is non-empty (slot replace): do not assign a near-variant of those names.
- Breakfast: cooked morning with plate_role=main and fruit with plate_role=fruit when openRoles lists them. Second_breakfast / afternoon_snack: plate_role=main only. Never assign lunch/dinner plates or snacks. Never set companion.
- Lunch: roles soup+protein+veg+carb when openRoles lists them. Dinner/late_dinner: protein+veg+carb — NO soup.
- Prefer dishes[] in the response. You may use legacy recipeId + companionRecipeId (carb) for protein+carb only.
- NEVER invent plateKind / needs_companion architecture. NEVER invent recipe ids.
- One-pots already cover multiple roles via covers_roles in the library — do not assign a second recipe for covered roles.
Respect operatorTasteNotes: constraint PRIMARY; exampleDish secondary; ban=hard; wish=soft.
Respond with a single JSON object:
{"assignments":[{"slotId":"...","dishes":[{"plateRole":"protein","recipeId":"..."},{"plateRole":"carb","recipeId":"..."}]},...]}.
Legacy also accepted: {"slotId","recipeId","companionRecipeId"?}.
You may leave some slots unassigned by omitting them if candidates are scarce.`;

/**
 * Ask OpenRouter to assign candidates to slots.
 * Ids must already exist in the (possibly invent-extended) library.
 */
export async function proposeAssignmentsViaOpenRouter(
  slots: SlotPrompt[],
  candidates: SuggestionCandidate[],
  chat: ChatCompletionsFn = openRouterChatCompletions,
  tasteNotes: TasteNote[] = [],
  freshlyInventedIds: ReadonlySet<string> = new Set(),
  previousMenusDishes: string[] = [],
  currentMenuDishes: string[] = [],
): Promise<ProposedAssignment[]> {
  const candidatePayload = candidates.map((c) => ({
    id: c.recipeId,
    name: c.name,
    longIdle: c.longIdle,
    recentlyUsed: c.recentlyUsed,
    freshlyInvented: freshlyInventedIds.has(c.recipeId),
    rating: c.rating,
    plateRole: c.plateRole,
  }));

  const slotPayload = slots.map((s) => ({
    slotId: s.slotId,
    dayIndex: s.dayIndex,
    meal: s.meal,
    openRoles:
      isTemplateMeal(s.meal) && s.meal !== "snack"
        ? [...rolesForMeal(s.meal)]
        : (["main"] as PlateRole[]),
    isLunchDinner: isLunchDinnerMeal(s.meal),
  }));

  const userContent = JSON.stringify({
    instruction:
      "Fill meal slots by assigning recipe ids into code-owned plate roles. Prefer freshlyInvented=true. Prefer dishes[]. Honor operatorTasteNotes. Batch across days without cloning full day signatures. Breakfast-family: plate_role=main only. Lunch/dinner: assign into open Harvard roles — never invent plateKind.",
    slots: slotPayload,
    candidates: candidatePayload,
    previousMenusDishes: previousMenusDishes.slice(0, 60),
    currentMenuDishes: currentMenuDishes.slice(0, 40),
    operatorTasteNotes: tasteNotesForPrompt(tasteNotes),
  });

  const content = await chat({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    responseFormatJson: true,
    temperature: 0.6,
  });

  const mealBySlot = new Map(slots.map((s) => [s.slotId, s.meal]));
  const parsed = parseAssignmentsJson(
    content,
    new Set(candidates.map((c) => c.recipeId)),
    new Set(slots.map((s) => s.slotId)),
    mealBySlot,
  );
  return normalizePlateAssignments(slots, parsed);
}

/** Pure parser — rejects unknown recipe/slot ids; prefers dishes[]. */
export function parseAssignmentsJson(
  content: string,
  allowedRecipeIds: Set<string>,
  allowedSlotIds: Set<string>,
  mealBySlot: ReadonlyMap<string, MealSlot> = new Map(),
): PlateAssignment[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(content));
  } catch {
    return [];
  }

  const root = parsed as { assignments?: unknown };
  if (!Array.isArray(root.assignments)) {
    return [];
  }

  const out: PlateAssignment[] = [];
  const seenSlots = new Set<string>();

  for (const item of root.assignments) {
    const assignment = parseAssignmentItem(
      item,
      allowedRecipeIds,
      allowedSlotIds,
      seenSlots,
      mealBySlot,
    );
    if (assignment) out.push(assignment);
  }

  return out;
}

function parseAssignmentItem(
  item: unknown,
  allowedRecipeIds: ReadonlySet<string>,
  allowedSlotIds: ReadonlySet<string>,
  seenSlots: Set<string>,
  mealBySlot: ReadonlyMap<string, MealSlot>,
): PlateAssignment | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  const slotId = row.slotId;
  if (typeof slotId !== "string") return null;
  if (!allowedSlotIds.has(slotId) || seenSlots.has(slotId)) return null;

  const meal = mealBySlot.get(slotId);
  const dishes = parseDishesField(row.dishes, allowedRecipeIds);
  if (dishes.length > 0) {
    seenSlots.add(slotId);
    const { recipeId } = primaryRecipeIdFromDishes(dishes);
    return {
      slotId,
      dishes,
      recipeId: recipeId ?? dishes[0]!.recipeId,
    };
  }

  const recipeId = row.recipeId;
  if (typeof recipeId !== "string") return null;
  if (!allowedRecipeIds.has(recipeId)) return null;
  seenSlots.add(slotId);

  const allowsCarb = Boolean(meal && isLunchDinnerMeal(meal));
  const rawCompanion = row.companionRecipeId;
  const carbRecipeId = allowsCarb &&
    typeof rawCompanion === "string" &&
    rawCompanion !== recipeId &&
    allowedRecipeIds.has(rawCompanion)
    ? rawCompanion
    : null;

  const legacyDishes: Array<{ plateRole: PlateRole; recipeId: string }> =
    meal && isLunchDinnerMeal(meal)
      ? [
        { plateRole: "protein", recipeId },
        ...(carbRecipeId
          ? [{ plateRole: "carb" as const, recipeId: carbRecipeId }]
          : []),
      ]
      : [{ plateRole: "main", recipeId }];

  return {
    slotId,
    dishes: legacyDishes,
    recipeId,
  };
}

function parseDishesField(
  raw: unknown,
  allowedRecipeIds: ReadonlySet<string>,
): Array<{ plateRole: PlateRole; recipeId: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ plateRole: PlateRole; recipeId: string }> = [];
  const seenRoles = new Set<PlateRole>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const recipeId = row.recipeId ?? row.recipe_id;
    let plateRoleRaw = row.plateRole ?? row.plate_role;
    if (plateRoleRaw === "companion") plateRoleRaw = "carb";
    if (typeof recipeId !== "string" || typeof plateRoleRaw !== "string") {
      continue;
    }
    if (!allowedRecipeIds.has(recipeId)) continue;
    if (!isPlateRole(plateRoleRaw) || plateRoleRaw === "snack") continue;
    if (seenRoles.has(plateRoleRaw)) continue;
    seenRoles.add(plateRoleRaw);
    out.push({ plateRole: plateRoleRaw, recipeId });
  }
  return out;
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return trimmed;
}

/**
 * Deterministic batch fill when LLM returns nothing usable but candidates exist.
 */
export function deterministicAssignments(
  slots: SlotPrompt[],
  candidates: SuggestionCandidate[],
): ProposedAssignment[] {
  const mainPool = candidates.filter(
    (c) =>
      c.plateRole !== "carb" &&
      c.plateRole !== "companion" &&
      c.plateRole !== "veg" &&
      c.plateRole !== "soup",
  );
  const assignPool = mainPool.length > 0 ? mainPool : candidates;
  const usedCompanions = new Set<string>();

  const base = assignWithBatchVariety(slots, assignPool).map((p) => {
    const meal =
      slots.find((s) => s.slotId === p.slotId)?.meal ?? "breakfast";
    const primaryRole: PlateRole = isLunchDinnerMeal(meal) ? "protein" : "main";
    if (!isLunchDinnerMeal(meal)) {
      return {
        slotId: p.slotId,
        dishes: [{ plateRole: primaryRole, recipeId: p.recipeId! }],
        recipeId: p.recipeId,
      };
    }
    const companionId = pickCompanionCandidate(
      candidates,
      p.recipeId!,
      usedCompanions,
    );
    if (companionId) usedCompanions.add(companionId);
    const dishes: Array<{ plateRole: PlateRole; recipeId: string }> = [
      { plateRole: "protein", recipeId: p.recipeId! },
    ];
    if (companionId) {
      dishes.push({ plateRole: "carb", recipeId: companionId });
    }
    return {
      slotId: p.slotId,
      dishes,
      recipeId: p.recipeId,
    };
  });
  return normalizePlateAssignments(slots, base);
}
