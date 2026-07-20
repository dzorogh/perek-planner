import {
  mealAllowsCompanion,
  type MealSlot,
} from "@/domain/menu/constants";
import type { SuggestionCandidate } from "@/domain/suggestions/candidates";
import {
  normalizePlateAssignments,
  parsePlateKind,
  pickCompanionCandidate,
  type PlateAssignment,
} from "@/domain/suggestions/plate-complete";
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
  recipeId: string;
  /** Optional side / protein; only for lunch, dinner, late_dinner. */
  companionRecipeId?: string | null;
  /** AI judgment for lunch/dinner plates; omitted on breakfast. */
  plateKind?: "complete" | "needs_companion" | null;
};

const SYSTEM_PROMPT = `You are a home-cooking menu planner for a Russian household.
Bias: simple home batch food. Batch cooking reuses dishes across days *within this menu*.
Hard rules when dayCount >= 2 and candidates allow:
- At least 50% of cookable slots must reuse a recipe that appears on 2+ days (staggered 2-day batches are ideal).
- No two calendar days may have the identical full set of recipes (compare main recipes; companions may also batch).
- Within one calendar day, never reuse the same recipe across meals — not as main, not as companion, and not swapped (lunch potatoes+chicken / dinner chicken+potatoes is forbidden). Batching across different days is fine.
- Prefer patterns like breakfast days 1–2 same / lunch days 2–3 same / dinner days 1–2 same.
- Prefer candidates with freshlyInvented=true or recentlyUsed=false.
- You alone judge culinary near-duplicates (no keyword filter in code). Be strict.
  Reusing the *exact same* recipe id across days for batching is good and preferred.
  Assigning a *different* recipe that is a near-variant of another dish already chosen in this menu (or listed in currentMenuDishes) is FORBIDDEN.
  Too close: оладьи≈панкейки; творожная запеканка с ягодами≈творожные запеканки с изюмом; сырники с изюмом≈сырники с ягодами; овсяная каша с яблоком≈овсянка с грушей.
  Distinct enough: запеканка vs сырники; оладьи vs яичница; каша vs омлет.
  A topping/mix-in swap on the same form+base is NOT variety — pick a different culinary form instead.
- When currentMenuDishes is non-empty (slot replace): do not assign a near-variant of those names; prefer freshlyInvented candidates that feel clearly different.
- Avoid rebuilding previousMenusDishes — consecutive menus must not feel identical.
- Breakfast / second_breakfast / afternoon_snack: choose cooked morning dishes ONLY (каша, яичница, омлет, сырники, оладьи, творожная запеканка). Never assign roast/fried chicken, soups, plov, cutlets, steaks, pasta mains, or other lunch/dinner plates to breakfast. Never assign snacks / перекусы / no-cook ready-to-eat plates to cookable slots. Never assign sauces, dressings, or bare garnishes as breakfast mains. Never set companionRecipeId or plateKind for these meals.

For lunch, dinner, late_dinner YOU alone judge the plate. EVERY assignment MUST include plateKind.
Code does not classify dishes by keywords — your plateKind is authoritative.

- HARD RULE: every lunch/dinner plate MUST include a real protein (мясо/птица/рыба/яйца/бобовые/грибы as add-on). Never serve two carb/veg dishes together (e.g. морковные котлеты + картофель, капустные котлеты + гречка).

- plateKind="complete": the main is already a full meal by itself. Omit companionRecipeId entirely.
  Use complete when the dish already combines protein with its carb/veg (or is a stuffed/dumpling/pasta one-pot).
  Textbook examples: плов (rice is inside — NEVER add картофель/рис/гречка), лазанья, голубцы, пельмени, манты, паста with protein, рагу/жаркое that already has meat+veg/grain, hearty soup as the whole dinner.
  Wrong: плов + картофельные дольки. Wrong: лазанья + рис. Wrong: пельмени + гречка.

- plateKind="needs_companion": the main alone is NOT a full meal — you MUST also set companionRecipeId.
  Examples: котлеты, зразы, отбивные, куриное/рыбное филе or грудка (even with marinade/spices), жареная курица without a side, овощное соте, vegetable cutlets, «голый» стейк.
  Companion = simple гарнир (крупа/картофель/овощи) if the main already has protein; OR simple protein add-on (курица/рыба/яйца/грибы) if the main is veg/carb-only.
  Never a second complex main. Never a second non-protein side when the main lacks protein.
  Prefer pairing a sauce/side with a main that needs it; do not reuse a breakfast main as a lunch/dinner companion.

- NEVER mark a self-contained one-pot as needs_companion. NEVER leave a needs_companion slot without companionRecipeId.
- NEVER assign a companion-only plate as recipeId.
- companionRecipeId must differ from recipeId and must come from the candidate list.

You MUST only use recipe ids from the provided candidate list.
Respect operatorTasteNotes always:
- constraint is PRIMARY (the operator's rule). Generalize it: «не люблю каши» / «Не предлагай каши» forbids ALL porridges/каши, not one title.
- exampleDish is secondary context only (a dish that triggered the note). Never limit a ban to that exact name.
- kind=ban is hard never for the constraint meaning; kind=wish is soft prefer.
Respond with a single JSON object:
{"assignments":[{"slotId":"...","recipeId":"...","plateKind":"complete"|"needs_companion","companionRecipeId":"...?"},...]}.
You may leave some slots unassigned by omitting them if candidates are scarce.
Never invent recipe ids.`;

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
  }));

  const slotPayload = slots.map((s) => ({
    slotId: s.slotId,
    dayIndex: s.dayIndex,
    meal: s.meal,
    allowsCompanion: mealAllowsCompanion(s.meal),
  }));

  const userContent = JSON.stringify({
    instruction:
      "Fill meal slots. Prefer freshlyInvented=true, then recentlyUsed=false. Honor operatorTasteNotes: constraint is PRIMARY (generalize — «не люблю каши» forbids all каши); exampleDish is secondary only. Batch across days (>=50% multi-day reuse of the *exact same* recipe id) without cloning full day signatures. HARD variety: never assign a different recipe that is a culinary near-variant of currentMenuDishes or of another distinct recipe already used in this plan (topping swaps forbidden: творожная запеканка с ягодами ≈ с изюмом; оладьи≈панкейки). When currentMenuDishes is set (slot replace), pick a clearly different form. Never reuse the same recipe twice within one calendar day (main or companion; no lunch/dinner swaps of the same pair). Breakfast-family: cooked dishes only, no plateKind/companion. For lunch/dinner/late_dinner: YOU judge plateKind — code trusts it. ALWAYS set plateKind. ALWAYS include protein on the plate (in main or companion). plateKind=complete → omit companion (плов/лазанья/голубцы/пельмени and other self-contained one-pots — NEVER add a гарнир). plateKind=needs_companion → MUST set companionRecipeId (котлеты/филе/стейк need a side; veg/carb-only mains need a protein companion, never another side). Wrong example to avoid: плов + картофельные дольки.",
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
  return normalizePlateAssignments(slots, parsed, candidates);
}

/** Pure parser — rejects unknown recipe/slot ids; strips invalid companions. */
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
  const recipeId = row.recipeId;
  if (typeof slotId !== "string" || typeof recipeId !== "string") return null;
  if (!allowedSlotIds.has(slotId) || !allowedRecipeIds.has(recipeId) || seenSlots.has(slotId)) {
    return null;
  }
  seenSlots.add(slotId);
  const meal = mealBySlot.get(slotId);
  const allowsCompanion = Boolean(meal && mealAllowsCompanion(meal));
  const rawCompanion = row.companionRecipeId;
  const companionRecipeId = allowsCompanion &&
    typeof rawCompanion === "string" &&
    rawCompanion !== recipeId &&
    allowedRecipeIds.has(rawCompanion)
    ? rawCompanion
    : null;
  return {
    slotId,
    recipeId,
    companionRecipeId,
    plateKind: allowsCompanion ? parsePlateKind(row.plateKind) : null,
  };
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
 * Pairs lunch/dinner with invent companions (plate_role) when available.
 */
export function deterministicAssignments(
  slots: SlotPrompt[],
  candidates: SuggestionCandidate[],
): ProposedAssignment[] {
  const mainPool = candidates.filter((c) => c.plateRole !== "companion");
  const assignPool = mainPool.length > 0 ? mainPool : candidates;
  const usedCompanions = new Set<string>();

  const base = assignWithBatchVariety(slots, assignPool).map((p) => {
    const meal =
      slots.find((s) => s.slotId === p.slotId)?.meal ?? "breakfast";
    if (!mealAllowsCompanion(meal)) {
      return {
        ...p,
        companionRecipeId: null as string | null,
        plateKind: null,
      };
    }
    const companionId = pickCompanionCandidate(
      candidates,
      p.recipeId,
      usedCompanions,
    );
    if (companionId) usedCompanions.add(companionId);
    return {
      ...p,
      companionRecipeId: companionId,
      plateKind: companionId
        ? ("needs_companion" as const)
        : ("complete" as const),
    };
  });
  return normalizePlateAssignments(slots, base, candidates);
}
