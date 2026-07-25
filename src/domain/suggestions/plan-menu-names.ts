import {
  MEAL_LABELS_RU,
  isMealSlot,
  menuDayPairsForCount,
  type MealSlot,
  type MenuDayPair,
} from "@/domain/menu/constants";
import {
  isPlateRole,
  isTemplateMeal,
  rolesForMeal,
  type PlateRole,
} from "@/domain/menu/meal-templates";
import {
  namesEqual,
  uniqueExactNames,
} from "@/domain/suggestions/dish-similarity";
import {
  isLunchDinnerMeal,
  stripHardcodedPairing,
} from "@/domain/suggestions/meal-fit";
import {
  emitRoleSlots,
  isCookableTemplateMeal,
  parseCoversRolesForMeal,
  remainingOpenRoles,
} from "@/domain/suggestions/role-slots";
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
  plateRole: PlateRole;
  name: string;
  coversRoles?: PlateRole[] | null;
};

export type PlanMenuNamesResult =
  | { ok: true; plan: PlannedDish[] }
  | { ok: false; reason: "openrouter" | "parse" };

const PLAN_SYSTEM = `You design a Russian household batch-cook MENU as dish NAMES only (no recipes yet).
Structure: menu days are hard pairs from the request (e.g. [1,2], [3,4], [5,6]). Each dish is cooked once and eaten on both days of its pair.
Plate roles are FIXED by the app — invent a Russian dish name for each listed position. You do NOT invent meal architecture.

Respond with a single JSON object (minified — no pretty-print, no markdown fences):
{"dishes":[{"meal":"breakfast"|"lunch"|"dinner"|...,"dayPair":[1,2]|[3,4]|[5,6],"plate_role":"main"|"soup"|"protein"|"veg"|"carb","name":"...","covers_roles":["protein","carb"]?}]}.

Rules:
- Include a dish for EVERY requested position (meal×dayPair×plate_role), OR cover a role via covers_roles on another dish for the same meal×dayPair. Never stop mid-array — the dishes list must be complete and valid JSON.
- NEVER use plate_kind, companion, needs_companion, or role=companion. Roles are plate_role only.
- Lunch positions: soup + protein + veg + carb. Dinner / late_dinner: protein + veg + carb (NO soup). Breakfast / second_breakfast / afternoon_snack: only main. NEVER invent snack / перекус here.
- One-pots may set covers_roles (e.g. плов as protein with covers_roles:["protein","carb"]) — then do NOT invent a separate dish for covered roles. Lunch still needs soup+veg if those are uncovered.
- Breakfast / second_breakfast / afternoon_snack: morning food names only.
- Lunch/dinner protein/soup/veg/carb: savory dinner food. Prefer meat/fish for protein. NEVER morning forms (сырники, оладьи, творожная запеканка, каша, омлет as L/D protein).
- HARD variety: every protein/main must be a clearly different culinary form+base from the others. Word-order/topping swaps are duplicates (FORBIDDEN).
- Same dayPair lunch vs dinner MUST use different forms.
- At most TWO proteins/mains of the same culinary form across the whole menu.
- HARD cooking-method variety: do NOT spam one method across the menu. Especially avoid repeating «запечённ… / запечённые… / в духовке» on many lines (protein+veg+carb). Mix methods: тушение, жарка/сковорода, варка/отваривание, сырой салат, плов/однокастрюльные, на пару. At most TWO dishes whose name signals the same method (e.g. запекание) in the whole menu.
- Within one meal×dayPair, protein/veg/carb should usually use DIFFERENT methods (not three «запечённ…» on the same dinner).
- Names in Russian, sentence case. No recipe steps. Honor operatorTasteNotes (constraint PRIMARY).
- When availableEquipment is set: ONLY name dishes cookable with that closed set. HARD: never put unavailable appliances in the name.
- Never invent snacks / перекусы here.`;

const POSITION_REPLACE_SYSTEM = `You invent dish NAME(s) for ONE replace slot on a Russian batch-cook menu (names only, no recipes).
Days are hard pairs ([1,2], [3,4], [5,6]); the dish is eaten on both days of replacePosition.dayPair.
Plate roles are FIXED — invent content for the given plate_role only.

Respond with a single JSON object. dishes MUST contain ONLY the new dish(es) for replacePosition — never copy keepDishes.
{"dishes":[{"meal":"lunch","dayPair":[3,4],"plate_role":"protein"|"soup"|"veg"|"carb"|"main","name":"...","covers_roles":["protein","carb"]?}]}

Rules:
- meal MUST equal replacePosition.meal exactly (English enum). NEVER put the dish name or Russian label in meal.
- Return exactly ONE dish for replacePosition.plate_role (optional covers_roles for one-pots on protein).
- NEW name(s) MUST NOT match or near-duplicate any string in avoidNames or keepDishes.
- Lunch/dinner protein: savory; never morning forms.
- Names in Russian, sentence case. Honor operatorTasteNotes (constraint PRIMARY).
- Never invent snacks / перекусы. NEVER plate_kind / companion.`;

const POSITION_MODIFY_SYSTEM = `You invent a VARIANT dish NAME for ONE modify slot on a Russian batch-cook menu (names only, no recipes).
Days are hard pairs; the dish is eaten on both days of modifyPosition.dayPair.
Plate roles are FIXED — invent a variant for the given plate_role.

Respond with a single JSON object. dishes MUST contain ONLY the modified dish(es) for modifyPosition.
{"dishes":[{"meal":"lunch","dayPair":[3,4],"plate_role":"protein"|"soup"|"veg"|"carb"|"main","name":"...","covers_roles":["protein","carb"]?}]}

Rules:
- meal MUST equal modifyPosition.meal exactly. Name goes ONLY in "name".
- Start from sourceDish: keep the same culinary form/base. Apply userWish.
- Name may stay the same as sourceDish.name OR shift lightly to reflect the wish.
- Return EXACTLY one dish for modifyPosition.plate_role.
- If keepExistingCarb=true: do NOT invent a carb dish and do NOT cover carb via covers_roles.
- MUST NOT match or near-duplicate avoidNames or keepDishes (other menu dishes). Matching sourceDish.name is ALLOWED.
- Names in Russian, sentence case. Honor operatorTasteNotes and userWish.
- Never invent snacks. NEVER plate_kind / companion.`;

/**
 * One AI call: invent dish names for all code-emitted role positions.
 */
export async function proposeMenuNamePlan(
  meals: readonly MealSlot[],
  context: {
    dayCount: number;
    previousMenusDishes?: string[];
    avoidNames?: string[];
    peoplePerMeal?: number;
    availableEquipment?: readonly string[];
    tasteNotes: TasteNote[];
    chat?: ChatCompletionsFn;
  },
): Promise<PlanMenuNamesResult> {
  const dayPairs = menuDayPairsForCount(context.dayCount);
  const positions = describePositions(meals, dayPairs);
  const chat = context.chat ?? openRouterChatCompletions;

  const baseUser = {
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
    availableEquipment: context.availableEquipment,
    operatorTasteNotes: tasteNotesForPrompt(context.tasteNotes),
  };
  const baseInstruction =
    "Invent dish NAMES for every listed plate_role position. Roles are FIXED by the app. Optional covers_roles for one-pots only. Strong variety: no near-duplicates; lunch≠dinner form on the same dayPair. Mix cooking methods — do not fill the menu with «запечённ…» names. Return complete minified JSON covering ALL positions.";

  for (let attempt = 0; attempt < 2; attempt++) {
    const instruction =
      attempt === 0
        ? baseInstruction
        : `${baseInstruction} Previous answer was truncated or incomplete — emit ONE complete minified JSON object with a dish for every position.`;
    let content: string;
    try {
      content = await chat({
        messages: [
          { role: "system", content: PLAN_SYSTEM },
          {
            role: "user",
            content: JSON.stringify({ ...baseUser, instruction }),
          },
        ],
        responseFormatJson: true,
        temperature: attempt === 0 ? 0.7 : 0.45,
      });
    } catch (err) {
      if (err instanceof OpenRouterError) {
        return { ok: false, reason: "openrouter" };
      }
      throw err;
    }

    const plan = parseMenuNamePlanJson(content, meals, dayPairs);
    if (plan) return { ok: true, plan };
  }

  return { ok: false, reason: "parse" };
}

type PositionReplaceTarget = {
  meal: MealSlot;
  dayPair: MenuDayPair;
  plateRole: PlateRole;
};

/** Map legacy main|companion (or plate role) onto PlateRole for a meal. */
export function resolvePositionPlateRole(
  meal: MealSlot,
  roleOrPlate: string,
): PlateRole | null {
  if (roleOrPlate === "companion") return "carb";
  if (roleOrPlate === "main") {
    return isLunchDinnerMeal(meal) ? "protein" : "main";
  }
  if (isPlateRole(roleOrPlate) && roleOrPlate !== "snack") return roleOrPlate;
  return null;
}

function plateRoleFromPosition(position: {
  meal: MealSlot;
  plateRole?: PlateRole;
  role?: "main" | "companion";
}): PlateRole | null {
  if (position.plateRole) return position.plateRole;
  return resolvePositionPlateRole(position.meal, position.role ?? "main");
}

function plateRoleFromKeepDish(d: {
  meal: MealSlot;
  plateRole?: PlateRole;
  role?: "main" | "companion";
}): PlateRole {
  return (
    d.plateRole ??
    resolvePositionPlateRole(d.meal, d.role ?? "main") ??
    "main"
  );
}

/**
 * Names-only invent for one meal×dayPair×plateRole.
 */
export async function proposePositionNamePlan(
  position: PositionReplaceTarget | {
    meal: MealSlot;
    dayPair: MenuDayPair;
    role: "main" | "companion";
    mainName?: string;
    plateRole?: PlateRole;
  },
  context: {
    keepDishes?: Array<{
      meal: MealSlot;
      dayPair: MenuDayPair;
      plateRole?: PlateRole;
      role?: "main" | "companion";
      name: string;
    }>;
    previousMenusDishes?: string[];
    avoidNames?: string[];
    peoplePerMeal?: number;
    tasteNotes: TasteNote[];
    chat?: ChatCompletionsFn;
  },
): Promise<PlanMenuNamesResult> {
  const plateRole = plateRoleFromPosition(position);
  if (!plateRole) return { ok: false, reason: "parse" };
  const normalized: PositionReplaceTarget = {
    meal: position.meal,
    dayPair: position.dayPair,
    plateRole,
  };

  return runPositionReplaceAttempts(normalized, {
    chat: context.chat ?? openRouterChatCompletions,
    keepDishes: (context.keepDishes ?? []).map((d) => ({
      meal: d.meal,
      dayPair: [...d.dayPair] as number[],
      plateRole: plateRoleFromKeepDish(d),
      name: d.name,
    })),
    keepNames: (context.keepDishes ?? []).map((d) => d.name),
    previousMenusDishes: uniqueExactNames(
      context.previousMenusDishes ?? [],
    ).slice(0, 60),
    avoidNames: uniqueExactNames(context.avoidNames ?? []).slice(0, 50),
    peoplePerMeal: context.peoplePerMeal ?? 2,
    tasteNotes: tasteNotesForPrompt(context.tasteNotes),
  });
}

export type PositionModifySource = {
  name: string;
  bodyText?: string;
};

/**
 * Names-only VARIANT for one meal×dayPair×plateRole guided by sourceDish + userWish.
 */
export async function proposePositionModifyPlan(
  position: PositionReplaceTarget | {
    meal: MealSlot;
    dayPair: MenuDayPair;
    role: "main" | "companion";
    mainName?: string;
    plateRole?: PlateRole;
  },
  context: {
    sourceDish: PositionModifySource;
    userWish: string;
    /** When true, invent protein/main only — existing carb stays. */
    keepExistingCarb?: boolean;
    /** @deprecated alias for keepExistingCarb */
    keepExistingCompanion?: boolean;
    keepDishes?: Array<{
      meal: MealSlot;
      dayPair: MenuDayPair;
      plateRole?: PlateRole;
      role?: "main" | "companion";
      name: string;
    }>;
    previousMenusDishes?: string[];
    avoidNames?: string[];
    peoplePerMeal?: number;
    tasteNotes: TasteNote[];
    chat?: ChatCompletionsFn;
  },
): Promise<PlanMenuNamesResult> {
  const plateRole = plateRoleFromPosition(position);
  if (!plateRole) return { ok: false, reason: "parse" };
  const normalized: PositionReplaceTarget = {
    meal: position.meal,
    dayPair: position.dayPair,
    plateRole,
  };
  const sourceName = context.sourceDish.name.trim();
  const userWish = context.userWish.trim();
  if (!sourceName || !userWish) return { ok: false, reason: "parse" };

  const avoidNames = uniqueExactNames(context.avoidNames ?? [])
    .filter((n) => !namesEqual(n, sourceName))
    .slice(0, 50);

  return runPositionModifyAttempts(normalized, {
    chat: context.chat ?? openRouterChatCompletions,
    sourceDish: {
      name: sourceName.slice(0, 120),
      bodyText: context.sourceDish.bodyText?.trim().slice(0, 1200) || undefined,
    },
    userWish: userWish.slice(0, 500),
    keepExistingCarb: Boolean(
      context.keepExistingCarb ?? context.keepExistingCompanion,
    ),
    keepDishes: (context.keepDishes ?? []).map((d) => ({
      meal: d.meal,
      dayPair: [...d.dayPair] as number[],
      plateRole: plateRoleFromKeepDish(d),
      name: d.name,
    })),
    keepNames: (context.keepDishes ?? [])
      .map((d) => d.name)
      .filter((n) => !namesEqual(n, sourceName)),
    previousMenusDishes: uniqueExactNames(
      context.previousMenusDishes ?? [],
    ).slice(0, 60),
    avoidNames,
    peoplePerMeal: context.peoplePerMeal ?? 2,
    tasteNotes: tasteNotesForPrompt(context.tasteNotes),
  });
}

async function runPositionReplaceAttempts(
  position: PositionReplaceTarget,
  args: {
    chat: ChatCompletionsFn;
    keepDishes: Array<{
      meal: MealSlot;
      dayPair: number[];
      plateRole: PlateRole;
      name: string;
    }>;
    keepNames: string[];
    previousMenusDishes: string[];
    avoidNames: string[];
    peoplePerMeal: number;
    tasteNotes: ReturnType<typeof tasteNotesForPrompt>;
  },
): Promise<PlanMenuNamesResult> {
  let avoidNames = args.avoidNames;
  const baseInstruction = `Return dishes with EXACTLY one NEW name for replacePosition.plate_role=${position.plateRole}. Do not echo keepDishes. Forbidden: every avoidNames entry.`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await requestPositionReplacePlan(
      position,
      { ...args, avoidNames },
      attempt === 0
        ? baseInstruction
        : `${baseInstruction} Previous answer reused a forbidden name — invent a clearly different one.`,
    );
    if (!result.ok) {
      if (result.reason === "openrouter") return result;
      continue;
    }
    const collisions = result.plan.filter((d) =>
      [...avoidNames, ...args.keepNames].some((b) => namesEqual(b, d.name)),
    );
    if (collisions.length === 0) return result;
    avoidNames = uniqueExactNames([
      ...avoidNames,
      ...collisions.map((d) => d.name),
    ]).slice(0, 50);
  }
  return { ok: false, reason: "parse" };
}

async function requestPositionReplacePlan(
  position: PositionReplaceTarget,
  args: {
    chat: ChatCompletionsFn;
    keepDishes: Array<{
      meal: MealSlot;
      dayPair: number[];
      plateRole: PlateRole;
      name: string;
    }>;
    previousMenusDishes: string[];
    avoidNames: string[];
    peoplePerMeal: number;
    tasteNotes: ReturnType<typeof tasteNotesForPrompt>;
  },
  instruction: string,
): Promise<PlanMenuNamesResult> {
  let content: string;
  try {
    content = await args.chat({
      messages: [
        { role: "system", content: POSITION_REPLACE_SYSTEM },
        {
          role: "user",
          content: JSON.stringify({
            replacePosition: {
              meal: position.meal,
              mealLabelRu: MEAL_LABELS_RU[position.meal],
              dayPair: [...position.dayPair],
              plate_role: position.plateRole,
            },
            keepDishes: args.keepDishes,
            previousMenusDishes: args.previousMenusDishes,
            avoidNames: args.avoidNames,
            peoplePerMeal: args.peoplePerMeal,
            instruction,
            operatorTasteNotes: args.tasteNotes,
          }),
        },
      ],
      responseFormatJson: true,
      temperature: 0.85,
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

function modifyNameInstruction(
  plateRole: PlateRole,
  keepExistingCarb: boolean,
): string {
  if (keepExistingCarb) {
    return `Return dishes with EXACTLY one VARIANT for modifyPosition.plate_role=${plateRole}. keepExistingCarb=true: do NOT cover carb via covers_roles. Matching source name is OK.`;
  }
  return `Return dishes with EXACTLY one VARIANT for modifyPosition.plate_role=${plateRole} from sourceDish + userWish. Same culinary form as source. Matching source name is OK.`;
}

async function runPositionModifyAttempts(
  position: PositionReplaceTarget,
  args: {
    chat: ChatCompletionsFn;
    sourceDish: PositionModifySource;
    userWish: string;
    keepExistingCarb: boolean;
    keepDishes: Array<{
      meal: MealSlot;
      dayPair: number[];
      plateRole: PlateRole;
      name: string;
    }>;
    keepNames: string[];
    previousMenusDishes: string[];
    avoidNames: string[];
    peoplePerMeal: number;
    tasteNotes: ReturnType<typeof tasteNotesForPrompt>;
  },
): Promise<PlanMenuNamesResult> {
  let avoidNames = args.avoidNames;
  const baseInstruction = modifyNameInstruction(
    position.plateRole,
    args.keepExistingCarb,
  );

  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await requestPositionModifyPlan(
      position,
      { ...args, avoidNames },
      attempt === 0
        ? baseInstruction
        : `${baseInstruction} Previous answer collided with another menu dish — keep the variant of sourceDish but use a name that avoids avoidNames/keepDishes.`,
    );
    if (!result.ok) {
      if (result.reason === "openrouter") return result;
      continue;
    }
    const collisions = result.plan.filter((d) =>
      [...avoidNames, ...args.keepNames].some((b) => namesEqual(b, d.name)),
    );
    if (collisions.length === 0) return result;
    avoidNames = uniqueExactNames([
      ...avoidNames,
      ...collisions.map((d) => d.name),
    ]).slice(0, 50);
  }
  return { ok: false, reason: "parse" };
}

async function requestPositionModifyPlan(
  position: PositionReplaceTarget,
  args: {
    chat: ChatCompletionsFn;
    sourceDish: PositionModifySource;
    userWish: string;
    keepExistingCarb: boolean;
    keepDishes: Array<{
      meal: MealSlot;
      dayPair: number[];
      plateRole: PlateRole;
      name: string;
    }>;
    previousMenusDishes: string[];
    avoidNames: string[];
    peoplePerMeal: number;
    tasteNotes: ReturnType<typeof tasteNotesForPrompt>;
  },
  instruction: string,
): Promise<PlanMenuNamesResult> {
  let content: string;
  try {
    content = await args.chat({
      messages: [
        { role: "system", content: POSITION_MODIFY_SYSTEM },
        {
          role: "user",
          content: JSON.stringify({
            modifyPosition: {
              meal: position.meal,
              mealLabelRu: MEAL_LABELS_RU[position.meal],
              dayPair: [...position.dayPair],
              plate_role: position.plateRole,
            },
            keepExistingCarb: args.keepExistingCarb || undefined,
            sourceDish: args.sourceDish,
            userWish: args.userWish,
            keepDishes: args.keepDishes,
            previousMenusDishes: args.previousMenusDishes,
            avoidNames: args.avoidNames,
            peoplePerMeal: args.peoplePerMeal,
            instruction,
            operatorTasteNotes: args.tasteNotes,
          }),
        },
      ],
      responseFormatJson: true,
      temperature: 0.55,
    });
  } catch (err) {
    if (err instanceof OpenRouterError) {
      return { ok: false, reason: "openrouter" };
    }
    throw err;
  }

  const plan = parsePositionNamePlanJson(content, position, {
    stripCarbCover: args.keepExistingCarb,
  });
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
    plateRole?: PlateRole;
    role?: "main" | "companion";
    reason: string;
  }>,
  context: {
    dayCount: number;
    tasteNotes: TasteNote[];
    availableEquipment?: readonly string[];
    chat?: ChatCompletionsFn;
  },
): Promise<PlanMenuNamesResult> {
  if (replace.length === 0) return { ok: true, plan };

  const dayPairs = menuDayPairsForCount(context.dayCount);
  const chat = context.chat ?? openRouterChatCompletions;
  const replaceNorm = replace.map((r) => ({
    meal: r.meal,
    dayPair: r.dayPair,
    plateRole:
      r.plateRole ??
      resolvePositionPlateRole(r.meal, r.role ?? "main") ??
      "main",
    reason: r.reason,
  }));

  const keep = plan.filter(
    (d) =>
      !replaceNorm.some(
        (r) =>
          r.meal === d.meal &&
          r.dayPair[0] === d.dayPair[0] &&
          r.dayPair[1] === d.dayPair[1] &&
          r.plateRole === d.plateRole,
      ),
  );

  const userContent = JSON.stringify({
    dayCount: context.dayCount,
    dayPairs: dayPairs.map((p) => [...p]),
    keepDishes: keep.map((d) => ({
      meal: d.meal,
      dayPair: [...d.dayPair],
      plate_role: d.plateRole,
      name: d.name,
      covers_roles: d.coversRoles ?? undefined,
    })),
    replace: replaceNorm.map((r) => ({
      meal: r.meal,
      dayPair: [...r.dayPair],
      plate_role: r.plateRole,
      reason: r.reason,
    })),
    availableEquipment: context.availableEquipment,
    instruction:
      "Return a FULL dishes array for the whole menu: keepDishes unchanged + NEW names for every replace target (by plate_role). HARD: new names must not near-duplicate keepDishes. When availableEquipment is set, new names must be cookable with only that set.",
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

/** Parser for single-position resuggest/modify plans. */
export function parsePositionNamePlanJson(
  content: string,
  position: {
    meal: MealSlot;
    dayPair: MenuDayPair;
    plateRole?: PlateRole;
    role?: "main" | "companion";
  },
  options: { stripCarbCover?: boolean } = {},
): PlannedDish[] | null {
  const plateRole =
    position.plateRole ??
    resolvePositionPlateRole(position.meal, position.role ?? "main");
  if (!plateRole) return null;

  const out = parsePositionPlannedDishes(content, {
    meal: position.meal,
    dayPair: position.dayPair,
    plateRole,
  });
  if (!out) return null;

  const atPosition = out.filter(
    (d) =>
      d.meal === position.meal &&
      d.dayPair[0] === position.dayPair[0] &&
      d.dayPair[1] === position.dayPair[1],
  );
  const hit = atPosition.find((d) => d.plateRole === plateRole);
  if (!hit) return null;

  let coversRoles = hit.coversRoles ?? null;
  if (options.stripCarbCover && coversRoles) {
    coversRoles = coversRoles.filter((r) => r !== "carb");
    if (coversRoles.length === 0) coversRoles = null;
  }
  if (isTemplateMeal(position.meal) && position.meal !== "snack") {
    coversRoles = parseCoversRolesForMeal(
      position.meal,
      coversRoles ?? [],
    );
  }

  return [
    {
      meal: position.meal,
      dayPair: position.dayPair,
      plateRole,
      name: hit.name,
      coversRoles,
    },
  ];
}

/**
 * Pure: coerce invalid meal/dayPair to the locked position (model puts name in meal).
 */
export function coercePositionMeal(
  rawMeal: unknown,
  lockedMeal: MealSlot,
): MealSlot {
  if (typeof rawMeal === "string" && isMealSlot(rawMeal)) return rawMeal;
  return lockedMeal;
}

function parsePositionPlannedDishes(
  content: string,
  position: {
    meal: MealSlot;
    dayPair: MenuDayPair;
    plateRole: PlateRole;
  },
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
    const dish = parsePositionDishRow(item, position);
    if (dish) out.push(dish);
  }
  return out.length > 0 ? out : null;
}

function parsePositionDishRow(
  item: unknown,
  position: {
    meal: MealSlot;
    dayPair: MenuDayPair;
    plateRole: PlateRole;
  },
): PlannedDish | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  const meal = coercePositionMeal(row.meal, position.meal);
  const dayPair =
    parseDayPair(row.dayPair ?? row.day_pair, [position.dayPair]) ??
    position.dayPair;
  const rawName = typeof row.name === "string" ? row.name.trim() : "";
  const name = rawName ? stripHardcodedPairing(rawName).slice(0, 120) : "";
  if (!name) return null;

  const plateRole =
    parsePlateRoleField(row, meal) ?? position.plateRole;
  if (!plateRoleAllowedForMeal(meal, plateRole)) return null;

  return {
    meal,
    dayPair,
    plateRole,
    name,
    coversRoles: coversForMeal(meal, row.covers_roles ?? row.coversRoles),
  };
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
  if (!name) return null;
  const mealSlot = meal as MealSlot;

  const plateRole = parsePlateRoleField(row, mealSlot);
  if (!plateRoleAllowedForMeal(mealSlot, plateRole)) return null;

  return {
    meal: mealSlot,
    dayPair,
    plateRole,
    name,
    coversRoles: coversForMeal(mealSlot, row.covers_roles ?? row.coversRoles),
  };
}

function coversForMeal(
  meal: MealSlot,
  raw: unknown,
): PlateRole[] | null {
  if (!isTemplateMeal(meal) || meal === "snack") return null;
  return parseCoversRolesForMeal(meal, raw);
}

function parsePlateRoleField(
  row: Record<string, unknown>,
  meal: MealSlot,
): PlateRole | null {
  const raw = row.plate_role ?? row.plateRole ?? row.role;
  if (typeof raw !== "string") return null;
  return resolvePositionPlateRole(meal, raw);
}

/**
 * Structural role check only — no name heuristics.
 * Name-shape filters belong in assign ranking / prompts, not plan parse
 * (false rejects turn a complete AI plan into «некорректный план»).
 */
function plateRoleAllowedForMeal(
  meal: MealSlot,
  plateRole: PlateRole | null,
): plateRole is PlateRole {
  if (!plateRole || plateRole === "snack") return false;
  if (!isTemplateMeal(meal) || meal === "snack") {
    return plateRole === "main";
  }
  return rolesForMeal(meal).includes(plateRole);
}

function describePositions(
  meals: readonly MealSlot[],
  dayPairs: readonly MenuDayPair[],
) {
  return emitRoleSlots(meals, dayPairs).map((s) => ({
    meal: s.meal,
    mealLabelRu: MEAL_LABELS_RU[s.meal],
    dayPair: [...s.dayPair],
    plate_role: s.plateRole,
  }));
}

function planLooksComplete(
  plan: PlannedDish[],
  meals: readonly MealSlot[],
  dayPairs: readonly MenuDayPair[],
): boolean {
  for (const dayPair of dayPairs) {
    for (const meal of meals) {
      if (!isCookableTemplateMeal(meal) || !isTemplateMeal(meal)) continue;
      const dishes = plan.filter(
        (d) =>
          d.meal === meal &&
          d.dayPair[0] === dayPair[0] &&
          d.dayPair[1] === dayPair[1],
      );
      if (remainingOpenRoles(meal, dishes).length > 0) return false;
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

export function planKey(
  d: Pick<PlannedDish, "meal" | "dayPair" | "plateRole">,
): string {
  return `${d.meal}:${d.dayPair[0]}-${d.dayPair[1]}:${d.plateRole}`;
}
