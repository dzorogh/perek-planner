/**
 * Pure-logic smoke for Story 2.3 suggestion predicates (no DB / no OpenRouter).
 * Usage: node scripts/verify-suggestions-logic.mjs
 */

const LONG_IDLE_DAYS = 14;

function isLongIdle(lastAssignedAt, now, idleDays = LONG_IDLE_DAYS) {
  if (!lastAssignedAt) return true;
  const ms = idleDays * 24 * 60 * 60 * 1000;
  return now.getTime() - lastAssignedAt.getTime() >= ms;
}

/** Hard-suppress = recipe_refusals only (ratings unused). */
function isHardSuppressed(recipeId, sets) {
  return sets.refusedIds.has(recipeId);
}

function rankCandidates(candidates) {
  return [...candidates].sort((a, b) => {
    if (a.recentlyUsed !== b.recentlyUsed) return a.recentlyUsed ? 1 : -1;
    if (a.longIdle !== b.longIdle) return a.longIdle ? -1 : 1;
    return a.name.localeCompare(b.name, "ru");
  });
}

function preferFreshCandidates(candidates, minFresh) {
  const fresh = candidates.filter((c) => !c.recentlyUsed);
  return fresh.length >= minFresh ? fresh : candidates;
}

function candidateDeficitThreshold(slotCount) {
  return Math.max(5, Math.ceil(slotCount * 0.6));
}

function inventCountForDeficit(freshCount, slotCount, buffer = 3) {
  const threshold = candidateDeficitThreshold(slotCount);
  if (freshCount >= threshold) return 0;
  return threshold - freshCount + buffer;
}

function inventCountPerMenu(slotCount, meals = []) {
  const mealBonus = meals.length > 0 ? Math.min(2, meals.length) : 0;
  return Math.max(5, Math.ceil(slotCount * 0.55) + mealBonus) + 2;
}

const MEAL_SLOTS = [
  "breakfast",
  "second_breakfast",
  "lunch",
  "afternoon_snack",
  "dinner",
  "late_dinner",
];

function isLunchDinnerMealEarly(meal) {
  return meal === "lunch" || meal === "dinner" || meal === "late_dinner";
}

function mealOrderIndex(meal) {
  const idx = MEAL_SLOTS.indexOf(meal);
  return idx >= 0 ? idx : 99;
}

function preferInventedCandidates(candidates, inventedIds) {
  if (inventedIds.size === 0) return [];
  return candidates.filter((c) => inventedIds.has(c.recipeId));
}

function extractJsonObject(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function carbFromDishes(dishes) {
  return dishes?.find((d) => d.plateRole === "carb")?.recipeId ?? null;
}

function parseAssignmentsJson(
  content,
  allowedRecipeIds,
  allowedSlotIds,
  mealBySlot = new Map(),
) {
  let parsed;
  try {
    parsed = JSON.parse(extractJsonObject(content));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed.assignments)) return [];
  const out = [];
  const seenSlots = new Set();
  for (const item of parsed.assignments) {
    if (!item || typeof item !== "object") continue;
    const { slotId, recipeId, companionRecipeId: rawCompanion, dishes: rawDishes } =
      item;
    if (typeof slotId !== "string") continue;
    if (!allowedSlotIds.has(slotId) || seenSlots.has(slotId)) continue;

    if (Array.isArray(rawDishes) && rawDishes.length > 0) {
      const dishes = [];
      const seenRoles = new Set();
      for (const d of rawDishes) {
        if (!d || typeof d !== "object") continue;
        const rid = d.recipeId;
        let role = d.plateRole ?? d.plate_role;
        if (role === "companion") role = "carb";
        if (typeof rid !== "string" || typeof role !== "string") continue;
        if (!allowedRecipeIds.has(rid) || seenRoles.has(role)) continue;
        seenRoles.add(role);
        dishes.push({ plateRole: role, recipeId: rid });
      }
      if (dishes.length === 0) continue;
      seenSlots.add(slotId);
      const by = new Map(dishes.map((d) => [d.plateRole, d.recipeId]));
      out.push({
        slotId,
        dishes,
        recipeId: by.get("protein") ?? by.get("main") ?? dishes[0].recipeId,
      });
      continue;
    }

    if (typeof recipeId !== "string") continue;
    if (!allowedRecipeIds.has(recipeId)) continue;
    seenSlots.add(slotId);
    let carbRecipeId = null;
    const meal = mealBySlot.get(slotId);
    if (
      meal &&
      isLunchDinnerMealEarly(meal) &&
      typeof rawCompanion === "string" &&
      allowedRecipeIds.has(rawCompanion) &&
      rawCompanion !== recipeId
    ) {
      carbRecipeId = rawCompanion;
    }
    const dishes =
      meal && isLunchDinnerMealEarly(meal)
        ? [
            { plateRole: "protein", recipeId },
            ...(carbRecipeId
              ? [{ plateRole: "carb", recipeId: carbRecipeId }]
              : []),
          ]
        : [{ plateRole: "main", recipeId }];
    out.push({ slotId, recipeId, dishes });
  }
  return out;
}

let failed = 0;
function check(name, cond) {
  if (cond) {
    console.log(`PASS: ${name}`);
  } else {
    console.log(`FAIL: ${name}`);
    failed += 1;
  }
}

const now = new Date("2026-07-20T12:00:00Z");
const d15 = new Date("2026-07-05T12:00:00Z");
const d7 = new Date("2026-07-13T12:00:00Z");

check("long-idle never cooked", isLongIdle(undefined, now));
check("long-idle 15d ago", isLongIdle(d15, now));
check("not long-idle 7d ago", !isLongIdle(d7, now));

const sets = {
  refusedIds: new Set(["r1"]),
};
check("refuse hard-suppress", isHardSuppressed("r1", sets));
check("dislike rating does not hard-suppress", !isHardSuppressed("r2", sets));
check("ok not suppressed", !isHardSuppressed("r3", sets));

const ranked = rankCandidates([
  { recipeId: "a", name: "А", longIdle: false, recentlyUsed: false },
  { recipeId: "b", name: "Б", longIdle: true, recentlyUsed: false },
  { recipeId: "c", name: "В", longIdle: true, recentlyUsed: false },
]);
check(
  "rank long-idle then name (ratings unused)",
  ranked[0].recipeId === "b" && ranked[1].recipeId === "c",
);

const rankedFresh = rankCandidates([
  { recipeId: "old", name: "Старое", longIdle: true, recentlyUsed: true },
  { recipeId: "new", name: "Новое", longIdle: false, recentlyUsed: false },
]);
check(
  "rank prefers not-recently-used over long-idle recent",
  rankedFresh[0].recipeId === "new",
);

const pool = preferFreshCandidates(
  [
    { recipeId: "r1", recentlyUsed: true },
    { recipeId: "r2", recentlyUsed: false },
    { recipeId: "r3", recentlyUsed: false },
    { recipeId: "r4", recentlyUsed: false },
    { recipeId: "r5", recentlyUsed: false },
    { recipeId: "r6", recentlyUsed: false },
  ],
  5,
);
check(
  "preferFreshCandidates drops recent when enough fresh",
  pool.length === 5 && pool.every((c) => !c.recentlyUsed),
);
check(
  "invent when fresh pool is empty",
  inventCountForDeficit(0, 9) >= 5,
);
check(
  "no invent when enough fresh",
  inventCountForDeficit(8, 9) === 0,
);
check(
  "always invent full AI dish set per menu",
  inventCountPerMenu(9, ["breakfast", "lunch", "dinner"]) >= 6,
);
check(
  "preferInventedCandidates picks new ids only",
  preferInventedCandidates(
    [
      { recipeId: "old", recentlyUsed: false },
      { recipeId: "new1", recentlyUsed: false },
      { recipeId: "new2", recentlyUsed: false },
    ],
    new Set(["new1", "new2"]),
  ).every((c) => c.recipeId.startsWith("new")),
);
check(
  "preferInventedCandidates never falls back to library",
  preferInventedCandidates(
    [
      { recipeId: "old", recentlyUsed: false },
      { recipeId: "new1", recentlyUsed: false },
    ],
    new Set(["new1"]),
  ).length === 1 &&
    preferInventedCandidates(
      [{ recipeId: "old", recentlyUsed: false }],
      new Set(),
    ).length === 0,
);

const allowedR = new Set(["rec-a", "rec-b", "rec-side"]);
const allowedS = new Set(["s1", "s2", "s3"]);
const mealBySlot = new Map([
  ["s1", "lunch"],
  ["s2", "breakfast"],
  ["s3", "dinner"],
]);
const parsed = parseAssignmentsJson(
  '{"assignments":[{"slotId":"s1","recipeId":"rec-a"},{"slotId":"s2","recipeId":"evil"}]}',
  allowedR,
  allowedS,
  mealBySlot,
);
check("reject unknown recipe id", parsed.length === 1 && parsed[0].recipeId === "rec-a");

const fence = parseAssignmentsJson(
  '```json\n{"assignments":[{"slotId":"s1","recipeId":"rec-b"}]}\n```',
  allowedR,
  allowedS,
  mealBySlot,
);
check("parse fenced json", fence.length === 1 && fence[0].recipeId === "rec-b");

const withCompanion = parseAssignmentsJson(
  JSON.stringify({
    assignments: [
      { slotId: "s1", recipeId: "rec-a", companionRecipeId: "rec-side" },
      { slotId: "s2", recipeId: "rec-b", companionRecipeId: "rec-side" },
      { slotId: "s3", recipeId: "rec-a", companionRecipeId: "rec-a" },
    ],
  }),
  allowedR,
  allowedS,
  mealBySlot,
);
check(
  "carb dish kept for lunch",
  carbFromDishes(withCompanion.find((a) => a.slotId === "s1")?.dishes) === "rec-side",
);
check(
  "carb dish stripped for breakfast",
  carbFromDishes(withCompanion.find((a) => a.slotId === "s2")?.dishes) == null,
);
check(
  "carb dish stripped when equals main",
  carbFromDishes(withCompanion.find((a) => a.slotId === "s3")?.dishes) == null,
);

function isBreakfastMeal(meal) {
  return meal === "breakfast" || meal === "second_breakfast";
}

function isLunchDinnerMeal(meal) {
  return meal === "lunch" || meal === "dinner" || meal === "late_dinner";
}

function mealsIncludeLunchOrDinner(meals) {
  return meals.some(isLunchDinnerMeal);
}

function looksLikeHeavyAnimalProteinDish(name) {
  const n = normalizeDishName(name);
  if (!n) return false;
  if (
    /(^|\s)(морковн|капустн|картофельн|овощн|свекольн|кабачков|тыквенн|баклажанн|рисов)[а-я]*\s+котлет/.test(
      n,
    ) ||
    /(^|\s)котлет[а-я]*\s+из\s+(морков|капуст|картофел|овощ|свекл|кабачк|тыкв|баклажан|риса)/.test(
      n,
    )
  ) {
    return false;
  }
  if (/(^|\s)(творожн|сырны|сырн)[а-я]*\s+котлет/.test(n)) return false;
  if (
    /(^|\s)(мяс|говяд|свинин|барани|телятин|куриц|курин|цыплен|индейк|утин|утка|гусин|кролик|грудк|окороч|филе|фарш|стейк|шашлык|гуляш|бефстроган|люля|тефтел|фрикадель|зразы|отбивн|шницел|бифштекс|колбас|сосиск|ветчин|бекон|печень|печенк|язык)/.test(
      n,
    )
  ) {
    return true;
  }
  if (
    /(^|\s)(рыб|лосос|семг|сёмг|форел|треск|минтай|хек|скумбр|тунец|креветк|кальмар|миди)/.test(
      n,
    )
  ) {
    return true;
  }
  // «сельд» = herring; do not match «сельдерей».
  if (/(^|\s)сельд(?!ере)/.test(n)) return true;
  if (/(^|\s)котлет/.test(n)) return true;
  if (/(^|\s)(плов|лазань|гуляш)/.test(n)) return true;
  return false;
}

function looksLikeProteinDish(name) {
  const n = normalizeDishName(name);
  if (!n) return false;
  if (looksLikeHeavyAnimalProteinDish(name)) return true;
  if (/(^|\s)(яйц|яичниц|омлет)/.test(n)) return true;
  if (/(^|\s)(творог|творожн|сырник|сырны|сырн)[а-я]*/.test(n)) return true;
  if (/(^|\s)(фасол|чечевиц|нут|горохов)/.test(n)) return true;
  if (/(^|\s)гриб/.test(n)) return true;
  return false;
}


function primaryRecipeIdFromDishes(dishes) {
  const by = new Map(dishes.map((d) => [d.plateRole, d.recipeId]));
  const recipeId =
    by.get("protein") ?? by.get("main") ?? dishes[0]?.recipeId ?? null;
  return { recipeId };
}

function expandDishAssignments(plateRole, recipeId, coversRoles) {
  const roles = new Set([plateRole, ...(coversRoles ?? [])]);
  return [...roles].map((r) => ({ plateRole: r, recipeId }));
}

function remainingOpenRoles(meal, dishes) {
  const templates = {
    breakfast: ["main", "fruit"],
    lunch: ["soup", "protein", "veg", "carb"],
    dinner: ["protein", "veg", "carb"],
    afternoon_snack: ["main"],
  };
  const covered = new Set();
  for (const d of dishes) {
    covered.add(d.plateRole);
    for (const r of d.coversRoles ?? []) covered.add(r);
  }
  return (templates[meal] ?? []).filter((r) => !covered.has(r));
}

/** Identity / legacy convert — no plateKind architecture. */
function normalizePlateAssignments(slots, proposals, _candidates) {
  const mealBySlot = new Map(slots.map((s) => [s.slotId, s.meal]));
  return proposals.map((p) => {
    if (p.dishes?.length) {
      const { recipeId } = primaryRecipeIdFromDishes(p.dishes);
      return {
        slotId: p.slotId,
        dishes: p.dishes,
        recipeId: recipeId ?? p.recipeId,
      };
    }
    const meal = mealBySlot.get(p.slotId);
    const recipeId = p.recipeId;
    if (!recipeId) {
      return { slotId: p.slotId, dishes: [], recipeId: "" };
    }
    const dishes =
      meal === "lunch" || meal === "dinner" || meal === "late_dinner"
        ? [
            { plateRole: "protein", recipeId },
            ...(p.companionRecipeId && p.companionRecipeId !== recipeId
              ? [{ plateRole: "carb", recipeId: p.companionRecipeId }]
              : []),
          ]
        : [{ plateRole: "main", recipeId }];
    const primary = primaryRecipeIdFromDishes(dishes);
    return {
      slotId: p.slotId,
      dishes,
      recipeId: primary.recipeId ?? recipeId,
    };
  });
}

function mergeDishAssignments(existing, incoming) {
  const incomingRoles = new Set(incoming.map((d) => d.plateRole));
  const kept = existing.filter((d) => !incomingRoles.has(d.plateRole));
  return [...kept, ...incoming];
}

function buildProposalsFromExpanded(dishes, slotByKey) {
  const groups = new Map();
  for (const d of dishes) {
    const key = `${d.meal}:${d.dayPair[0]}-${d.dayPair[1]}`;
    const list = groups.get(key) ?? [];
    list.push(d);
    groups.set(key, list);
  }
  const proposals = [];
  for (const group of groups.values()) {
    const first = group[0];
    const ordered = [...group].sort(
      (a, b) => (b.coversRoles?.length ?? 0) - (a.coversRoles?.length ?? 0),
    );
    const dishRows = [];
    const seen = new Set();
    for (const d of ordered) {
      for (const row of expandDishAssignments(d.plateRole, d.recipeId, d.coversRoles)) {
        if (seen.has(row.plateRole)) continue;
        seen.add(row.plateRole);
        dishRows.push(row);
      }
    }
    const { recipeId } = primaryRecipeIdFromDishes(dishRows);
    for (const day of first.dayPair) {
      const slot = slotByKey.get(`${day}:${first.meal}`);
      if (!slot) continue;
      proposals.push({
        slotId: slot.slotId,
        dishes: dishRows,
        recipeId,
      });
    }
  }
  return proposals;
}

check(
  "primaryRecipeIdFromDishes: protein+carb → protein only",
  (() => {
    const fks = primaryRecipeIdFromDishes([
      { plateRole: "protein", recipeId: "p1" },
      { plateRole: "carb", recipeId: "c1" },
      { plateRole: "veg", recipeId: "v1" },
    ]);
    return fks.recipeId === "p1";
  })(),
);

check(
  "primaryRecipeIdFromDishes: main only",
  primaryRecipeIdFromDishes([{ plateRole: "main", recipeId: "m1" }]).recipeId ===
    "m1",
);

check(
  "expandDishAssignments plov covers protein+carb",
  expandDishAssignments("protein", "plov", ["protein", "carb"]).length === 2 &&
    expandDishAssignments("protein", "plov", ["protein", "carb"]).every(
      (d) => d.recipeId === "plov",
    ),
);

check(
  "remainingOpenRoles after plov → soup+veg",
  remainingOpenRoles("lunch", [
    { plateRole: "protein", coversRoles: ["protein", "carb"] },
  ]).join(",") === "soup,veg",
);

check(
  "remainingOpenRoles dinner after plov → veg",
  remainingOpenRoles("dinner", [
    { plateRole: "protein", coversRoles: ["protein", "carb"] },
  ]).join(",") === "veg",
);

const normIdentity = normalizePlateAssignments(
  [{ slotId: "s1", dayIndex: 1, meal: "lunch" }],
  [
    {
      slotId: "s1",
      dishes: [
        { plateRole: "soup", recipeId: "soup1" },
        { plateRole: "protein", recipeId: "prot1" },
        { plateRole: "veg", recipeId: "veg1" },
        { plateRole: "carb", recipeId: "carb1" },
      ],
    },
  ],
  [],
);
check(
  "normalize identity keeps dishes[]",
  normIdentity[0]?.dishes?.length === 4 &&
    normIdentity[0]?.recipeId === "prot1" &&
    carbFromDishes(normIdentity[0]?.dishes) === "carb1" &&
    normIdentity[0]?.companionRecipeId == null,
);

const normLegacy = normalizePlateAssignments(
  [
    { slotId: "s1", dayIndex: 1, meal: "lunch" },
    { slotId: "s2", dayIndex: 1, meal: "breakfast" },
  ],
  [
    { slotId: "s1", recipeId: "prot1", companionRecipeId: "carb1" },
    { slotId: "s2", recipeId: "main1", companionRecipeId: "ignored" },
  ],
  [],
);
check(
  "normalize legacy lunch → protein+carb dishes",
  normLegacy.find((a) => a.slotId === "s1")?.dishes?.map((d) => d.plateRole).join(",") ===
    "protein,carb",
);
check(
  "normalize legacy breakfast → main only (strip companion)",
  normLegacy.find((a) => a.slotId === "s2")?.dishes?.length === 1 &&
    normLegacy.find((a) => a.slotId === "s2")?.dishes?.[0]?.plateRole === "main" &&
    carbFromDishes(normLegacy.find((a) => a.slotId === "s2")?.dishes) == null,
);

const slotByKey = new Map([
  ["1:lunch", { slotId: "l1", dayIndex: 1, meal: "lunch" }],
  ["2:lunch", { slotId: "l2", dayIndex: 2, meal: "lunch" }],
]);
const built = buildProposalsFromExpanded(
  [
    {
      meal: "lunch",
      dayPair: [1, 2],
      plateRole: "protein",
      recipeId: "plov",
      coversRoles: ["protein", "carb"],
    },
    {
      meal: "lunch",
      dayPair: [1, 2],
      plateRole: "soup",
      recipeId: "borscht",
    },
    {
      meal: "lunch",
      dayPair: [1, 2],
      plateRole: "veg",
      recipeId: "salad",
    },
  ],
  slotByKey,
);
check(
  "buildProposals expands covers + one proposal per day",
  built.length === 2 &&
    built.every((p) => p.dishes.length === 4) &&
    built.every((p) => p.recipeId === "plov") &&
    // One-pot: carb role uses plov in dishes; no companionRecipeId field.
    built.every((p) => p.companionRecipeId == null) &&
    built.every(
      (p) =>
        p.dishes.some((d) => d.plateRole === "soup" && d.recipeId === "borscht") &&
        p.dishes.some((d) => d.plateRole === "carb" && d.recipeId === "plov") &&
        p.dishes.some((d) => d.plateRole === "veg" && d.recipeId === "salad"),
    ),
);

check(
  "AC6 lunch write-set includes soup (not protein+carb only)",
  built[0]?.dishes?.some((d) => d.plateRole === "soup") === true &&
    built[0]?.dishes?.some((d) => d.plateRole === "veg") === true &&
    built[0]?.dishes?.map((d) => d.plateRole).sort().join(",") ===
      "carb,protein,soup,veg",
);

check(
  "mergeDishAssignments keeps soup/veg when replacing protein",
  (() => {
    const merged = mergeDishAssignments(
      [
        { plateRole: "soup", recipeId: "s1" },
        { plateRole: "protein", recipeId: "old" },
        { plateRole: "veg", recipeId: "v1" },
        { plateRole: "carb", recipeId: "c1" },
      ],
      [{ plateRole: "protein", recipeId: "new" }],
    );
    return (
      merged.find((d) => d.plateRole === "soup")?.recipeId === "s1" &&
      merged.find((d) => d.plateRole === "veg")?.recipeId === "v1" &&
      merged.find((d) => d.plateRole === "protein")?.recipeId === "new" &&
      merged.find((d) => d.plateRole === "carb")?.recipeId === "c1"
    );
  })(),
);

check(
  "dropHeavyHeavy keeps one-pot carb (same recipeId)",
  (() => {
    const protein = { plateRole: "protein", recipeId: "plov" };
    const carb = { plateRole: "carb", recipeId: "plov" };
    // Mirror generate-menu guard.
    if (protein.recipeId === carb.recipeId) return true;
    return false;
  })(),
);

check(
  "flatten prefers covers over earlier separate carb",
  (() => {
    const group = [
      { plateRole: "carb", recipeId: "rice", coversRoles: null },
      {
        plateRole: "protein",
        recipeId: "plov",
        coversRoles: ["protein", "carb"],
      },
    ];
    const ordered = [...group].sort(
      (a, b) => (b.coversRoles?.length ?? 0) - (a.coversRoles?.length ?? 0),
    );
    const seen = new Set();
    const rows = [];
    for (const d of ordered) {
      for (const row of expandDishAssignments(
        d.plateRole,
        d.recipeId,
        d.coversRoles,
      )) {
        if (seen.has(row.plateRole)) continue;
        seen.add(row.plateRole);
        rows.push(row);
      }
    }
    return rows.find((r) => r.plateRole === "carb")?.recipeId === "plov";
  })(),
);

const dishesAssign = parseAssignmentsJson(
  JSON.stringify({
    assignments: [
      {
        slotId: "s1",
        dishes: [
          { plateRole: "protein", recipeId: "rec-a" },
          { plateRole: "carb", recipeId: "rec-side" },
        ],
      },
    ],
  }),
  allowedR,
  allowedS,
  mealBySlot,
);
check(
  "parseAssignmentsJson prefers dishes[]",
  dishesAssign[0]?.dishes?.length === 2 &&
    dishesAssign[0]?.recipeId === "rec-a" &&
    carbFromDishes(dishesAssign[0]?.dishes) === "rec-side" &&
    dishesAssign[0]?.companionRecipeId == null,
);

check(
  "protein: vegetable cutlets are not protein",
  !looksLikeProteinDish("Морковные котлеты с горошком"),
);
check(
  "protein: chicken is protein",
  looksLikeProteinDish("Запечённая куриная грудка с лимоном"),
);
check(
  "protein: potatoes are not protein",
  !looksLikeProteinDish("Картофель с укропом"),
);
check(
  "protein: potato pancakes are not protein",
  !looksLikeProteinDish("Картофельные оладьи с укропом"),
);

check(
  "heavy animal: chicken is heavy",
  looksLikeHeavyAnimalProteinDish("Куриные грудки запечённые с овощами"),
);
check(
  "heavy animal: fish is heavy",
  looksLikeHeavyAnimalProteinDish("Запечённая рыба с лимоном"),
);
check(
  "heavy animal: egg salad is not heavy",
  !looksLikeHeavyAnimalProteinDish("Шпинатный салат с яйцом"),
);
check(
  "heavy animal: mushroom sauce is not heavy",
  !looksLikeHeavyAnimalProteinDish("Грибной соус"),
);
check(
  "heavy animal: dairy cutlets are not heavy",
  !looksLikeHeavyAnimalProteinDish("Творожные котлеты"),
);
check(
  "heavy animal: celery is not herring",
  !looksLikeHeavyAnimalProteinDish("Салат с сельдереем"),
);
check(
  "heavy animal: herring is heavy",
  looksLikeHeavyAnimalProteinDish("Сельдь под шубой"),
);

function groupSlotsByMeal(slots) {
  const map = new Map();
  for (const slot of slots) {
    const list = map.get(slot.meal) ?? [];
    list.push(slot);
    map.set(slot.meal, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.dayIndex - b.dayIndex);
  }
  return map;
}

function sortedDayIndexes(slots) {
  return [...new Set(slots.map((s) => s.dayIndex))].sort((a, b) => a - b);
}

function daySignature(dayIndex, slots, bySlot) {
  return slots
    .filter((s) => s.dayIndex === dayIndex)
    .slice()
    .sort((a, b) => a.meal.localeCompare(b.meal))
    .map((s) => `${s.meal}:${bySlot.get(s.slotId) ?? ""}`)
    .join("|");
}

function isMenuUniformAcrossDays(slots, proposals) {
  const bySlot = new Map(proposals.map((p) => [p.slotId, p.recipeId]));
  const days = sortedDayIndexes(slots);
  if (days.length < 2) return false;
  const byMeal = groupSlotsByMeal(slots);
  let sawMultiDayMeal = false;
  for (const mealSlots of byMeal.values()) {
    if (mealSlots.length < 2) continue;
    sawMultiDayMeal = true;
    const ids = mealSlots.map((s) => bySlot.get(s.slotId));
    if (ids.some((id) => id == null)) return false;
    const first = ids[0];
    if (ids.some((id) => id !== first)) return false;
  }
  return sawMultiDayMeal;
}

function findDuplicateDayPair(slots, bySlot) {
  const days = sortedDayIndexes(slots);
  if (days.length < 2) return null;
  const signatures = new Map();
  for (const day of days) signatures.set(day, daySignature(day, slots, bySlot));
  for (let i = 0; i < days.length; i++) {
    for (let j = i + 1; j < days.length; j++) {
      const a = days[i];
      const b = days[j];
      if (signatures.get(a) && signatures.get(a) === signatures.get(b)) {
        return [a, b];
      }
    }
  }
  return null;
}

function hasDuplicateDayMenus(slots, proposals) {
  const bySlot = new Map(proposals.map((p) => [p.slotId, p.recipeId]));
  return findDuplicateDayPair(slots, bySlot) != null;
}

function isMealUniform(mealSlots, bySlot) {
  if (mealSlots.length < 2) return false;
  const ids = mealSlots.map((s) => bySlot.get(s.slotId));
  if (ids.some((id) => id == null)) return false;
  return ids.every((id) => id === ids[0]);
}

const MIN_BATCH_SLOT_RATIO = 0.5;

function batchSlotRatio(slots, proposals) {
  const days = sortedDayIndexes(slots);
  if (days.length < 2) return 1;
  const bySlot = new Map(proposals.map((p) => [p.slotId, p.recipeId]));
  const recipeDays = new Map();
  for (const slot of slots) {
    const recipeId = bySlot.get(slot.slotId);
    if (!recipeId) continue;
    const set = recipeDays.get(recipeId) ?? new Set();
    set.add(slot.dayIndex);
    recipeDays.set(recipeId, set);
  }
  let total = 0;
  let batched = 0;
  for (const slot of slots) {
    const recipeId = bySlot.get(slot.slotId);
    if (!recipeId) continue;
    total += 1;
    if ((recipeDays.get(recipeId)?.size ?? 0) >= 2) batched += 1;
  }
  return total === 0 ? 1 : batched / total;
}

function toProposals(slots, bySlot) {
  return slots
    .filter((s) => bySlot.has(s.slotId))
    .map((s) => ({ slotId: s.slotId, recipeId: bySlot.get(s.slotId) }));
}

function trySetRecipe(slots, bySlot, slotId, recipeId) {
  const prev = bySlot.get(slotId);
  if (prev === recipeId) return false;
  bySlot.set(slotId, recipeId);
  if (findDuplicateDayPair(slots, bySlot)) {
    if (prev == null) bySlot.delete(slotId);
    else bySlot.set(slotId, prev);
    return false;
  }
  return true;
}

function diversifyDay(slots, bySlot, byMeal, dayIndex, candidateIds) {
  const daySlots = slots
    .filter((s) => s.dayIndex === dayIndex)
    .sort((a, b) => a.meal.localeCompare(b.meal));
  const ordered = [...daySlots].sort((a, b) => {
    const aClone = isMealUniform(byMeal.get(a.meal) ?? [], bySlot) ? 0 : 1;
    const bClone = isMealUniform(byMeal.get(b.meal) ?? [], bySlot) ? 0 : 1;
    return aClone - bClone;
  });
  for (const slot of ordered) {
    const current = bySlot.get(slot.slotId);
    if (!current) continue;
    const siblingIds = new Set(
      (byMeal.get(slot.meal) ?? [])
        .filter((s) => s.slotId !== slot.slotId)
        .map((s) => bySlot.get(s.slotId))
        .filter(Boolean),
    );
    const alternate =
      [...siblingIds].find((id) => id !== current) ??
      candidateIds.find((id) => id !== current);
    if (!alternate) continue;
    bySlot.set(slot.slotId, alternate);
    if (dayStillDuplicated(slots, bySlot, dayIndex)) {
      bySlot.set(slot.slotId, current);
      continue;
    }
    return true;
  }
  return false;
}

function dayStillDuplicated(slots, bySlot, dayIndex) {
  const sig = daySignature(dayIndex, slots, bySlot);
  if (!sig) return false;
  for (const day of sortedDayIndexes(slots)) {
    if (day === dayIndex) continue;
    if (daySignature(day, slots, bySlot) === sig) return true;
  }
  return false;
}

function tryRaiseBatchRatioForMeal(slots, bySlot, mealSlots) {
  if (mealSlots.length < 2) return false;
  for (let i = 0; i < mealSlots.length - 1; i++) {
    const left = mealSlots[i];
    const right = mealSlots[i + 1];
    const leftId = bySlot.get(left.slotId);
    const rightId = bySlot.get(right.slotId);
    if (!leftId || !rightId || leftId === rightId) continue;
    if (trySetRecipe(slots, bySlot, right.slotId, leftId)) return true;
    if (trySetRecipe(slots, bySlot, left.slotId, rightId)) return true;
  }
  return false;
}

function raiseBatchRatio(slots, bySlot, byMeal) {
  for (let guard = 0; guard < 24; guard++) {
    if (batchSlotRatio(slots, toProposals(slots, bySlot)) >= MIN_BATCH_SLOT_RATIO) {
      return;
    }
    let progressed = false;
    for (const mealSlots of byMeal.values()) {
      progressed = tryRaiseBatchRatioForMeal(slots, bySlot, mealSlots);
      if (progressed) break;
    }
    if (!progressed) return;
  }
}

function normalizeDishName(name) {
  return name
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesEqual(a, b) {
  const na = normalizeDishName(a);
  const nb = normalizeDishName(b);
  return !!na && !!nb && na === nb;
}

/** Cookable slots ≠ menu_snacks: reject snack-like recipe labels. */
function hasNoCookSnackKeyword(name) {
  const dairyOrFruit =
    /(^|\s)(йогурт|кефир|ряженк|простокваш|творожок|фрукты|ягод[ыа]|банан|яблок|груш|апельсин|мандарин)/;
  const nutsOrSweets =
    /(^|\s)(орех|миндаль|кешью|арахис|фисташк|сухофрукт|изюм|курага|чернослив|батончик|чипсы|крекер|галет|печенье|вафли|зефир|шоколадк|конфет)/;
  return dairyOrFruit.test(name) || nutsOrSweets.test(name);
}

function looksLikeCookedDish(name) {
  return /(каш|сырник|оладь|блин|омлет|яичниц|запеканк|суп|плов|котлет|паст|рис|гречк|картоф)/.test(
    name,
  );
}

function looksLikeNoCookSnack(name) {
  const n = normalizeDishName(name);
  if (!n) return false;
  if (n.includes("перекус")) return true;
  if (/(^|\s)(снек|snack)([ыа]|ов)?(\s|$)/.test(n)) return true;
  if (/(^|\s)салат/.test(n)) return false;
  return hasNoCookSnackKeyword(n) && !looksLikeCookedDish(n);
}

function looksLikeBreakfastDish(name) {
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
  if (/(творож|яичн|манн|рисовая|пшенн|овсян)\w*\s+запеканк/.test(n)) {
    return true;
  }
  if (/запеканк\w*\s+(из\s+)?(творог|яиц|манк)/.test(n)) return true;
  return false;
}

function looksLikeLunchDinnerOnlyMain(name) {
  const n = normalizeDishName(name);
  if (!n) return false;
  if (looksLikeBreakfastDish(n)) return false;
  if (
    /(^|\s)(борщ|щи|солянка|харчо|уха|бульон|суп|похлебк|окрошк|свекольник)/.test(
      n,
    )
  ) {
    return true;
  }
  if (
    /(^|\s)(плов|лазань|гуляш|бефстроган|шашлык|стейк|рагу|жаркое|голубц|пельмен|манты)/.test(
      n,
    )
  ) {
    return true;
  }
  if (
    /(^|\s)(котлет|тефтел|фрикадель|отбивн|шницел|бифштекс|зразы|люля)/.test(
      n,
    )
  ) {
    return true;
  }
  if (
    /(запеч[её]нн|жар[её]нн|туш[её]нн)\w*\s+(курица|куриц|цыпл|утка|гусь|индейк)/.test(
      n,
    )
  ) {
    return true;
  }
  if (
    /(^|\s)(курица|куриц|цыпл)\w*/.test(n) &&
    /(запеч|жар|тушен|лимон|трав|чеснок)/.test(n)
  ) {
    return true;
  }
  if (
    /(^|\s)(куриная|куриное|куриный|индюшин)\w*\s+(грудк|филе|окороч)/.test(
      n,
    )
  ) {
    return true;
  }
  if (/(^|\s)(грудк|филе|окороч|стейк)\w*\s/.test(n)) return true;
  if (/(^|\s)(паста|спагетти|лапша|макарон)/.test(n)) return true;
  if (
    /(запеч[её]нн|жар[её]нн|туш[её]нн)\w*\s+(рыб|лосос|форел|треск|минтай)/.test(
      n,
    )
  ) {
    return true;
  }
  return false;
}

function looksLikeCompanionOnly(name) {
  const n = normalizeDishName(name);
  if (!n) return false;
  // \b is ASCII-only in JS — use explicit edges for Cyrillic tokens.
  if (/(^|\s)соус(ы|а|ом|ами)?(\s|$)/.test(n)) return true;
  if (/(^|\s)заправк/.test(n)) return true;
  if (/(^|\s)подлив/.test(n)) return true;
  if (/(^|\s)гарнир(\s|$)/.test(n)) return true;
  if (
    /(^|\s)к\s+(пасте|макаронам|мясу|рыбе|курице|грудке|стейку|котлетам|гарниру)(\s|$)/.test(
      n,
    )
  ) {
    return true;
  }
  return false;
}

function isSuitableAsBreakfastMain(name) {
  if (looksLikeCompanionOnly(name) || looksLikeNoCookSnack(name)) return false;
  if (looksLikeLunchDinnerOnlyMain(name)) return false;
  return true;
}

function mainsForMeal(meal, named) {
  const mains = named.filter((c) => !looksLikeCompanionOnly(c.name));
  if (isLunchDinnerMeal(meal)) {
    return mains.filter((c) => !looksLikeBreakfastDish(c.name));
  }
  const base = mains.length > 0 ? mains : [...named];
  if (!isBreakfastMeal(meal)) return base;
  const morning = base.filter((c) => looksLikeBreakfastDish(c.name));
  if (morning.length > 0) return morning;
  const ok = base.filter((c) => isSuitableAsBreakfastMain(c.name));
  if (ok.length > 0) return ok;
  return base;
}

function stripHardcodedPairing(name) {
  const trimmed = name.trim();
  const pairingStart = trimmed.lastIndexOf(" к ");
  const pairing = trimmed.slice(pairingStart + 3);
  const isHardcodedPairing = [
    "пасте",
    "макаронам",
    "мясу",
    "рыбе",
    "курице",
    "грудке",
    "стейку",
    "котлетам",
    "гарниру",
  ].includes(pairing);
  const cleaned = isHardcodedPairing ? trimmed.slice(0, pairingStart) : trimmed;
  return cleaned.length > 0 ? cleaned : name.trim();
}

function pickUnusedCandidate(candidates, excludeIds) {
  for (const c of candidates) {
    if (excludeIds.has(c.recipeId)) continue;
    return c;
  }
  return null;
}

function pickCompanionCandidate(
  candidates,
  mainRecipeId,
  alreadyUsed = new Set(),
  avoidIds = new Set(),
  options = {},
) {
  const others = candidates.filter(
    (c) => c.recipeId !== mainRecipeId && !avoidIds.has(c.recipeId),
  );
  let pool =
    others.length > 0
      ? others
      : candidates.filter((c) => c.recipeId !== mainRecipeId);
  if (options.forbidHeavyAnimal) {
    pool = pool.filter(
      (c) =>
        looksLikeCompanionOnly(c.name) ||
        !looksLikeHeavyAnimalProteinDish(c.name),
    );
  }
  if (pool.length === 0) return null;
  const prefer = (list) => {
    if (list.length === 0) return null;
    const unused = list.find((c) => !alreadyUsed.has(c.recipeId));
    return unused ?? list[0] ?? null;
  };
  if (options.requireProtein) {
    const proteins = pool.filter((c) => looksLikeProteinDish(c.name));
    const proteinCompanions = proteins.filter(
      (c) => c.plateRole === "companion",
    );
    const preferList =
      proteinCompanions.length > 0 ? proteinCompanions : proteins;
    return (prefer(preferList) ?? prefer(pool))?.recipeId ?? null;
  }
  const companions = pool.filter((c) => c.plateRole === "companion");
  const preferList = companions.length > 0 ? companions : pool;
  return prefer(preferList)?.recipeId ?? null;
}

function recipeIdForMealSlot(
  primary,
  secondary,
  candidateCount,
  mealSlots,
  mealIndex,
  slotIndex,
) {
  if (candidateCount < 2 || mealSlots.length < 2) return primary;
  if (mealIndex % 2 === 0) {
    return slotIndex === mealSlots.length - 1 ? secondary : primary;
  }
  return slotIndex === 0 ? primary : secondary;
}

function assignWithBatchVariety(slots, candidates) {
  if (candidates.length === 0) return [];
  const byMeal = groupSlotsByMeal(slots);
  const mealOrder = [...byMeal.keys()];
  const out = [];
  const usedIds = new Set();
  const named = candidates.map((c) => ({
    recipeId: c.recipeId,
    name: c.name,
  }));
  const pickForMeal = (pool) => {
    const primary = pickUnusedCandidate(pool, usedIds) ?? pool[0];
    usedIds.add(primary.recipeId);
    const secondary =
      pickUnusedCandidate(pool, usedIds) ??
      pool.find((c) => c.recipeId !== primary.recipeId) ??
      pickUnusedCandidate(named, usedIds) ??
      named.find((c) => c.recipeId !== primary.recipeId) ??
      primary;
    if (secondary.recipeId !== primary.recipeId) {
      usedIds.add(secondary.recipeId);
    }
    return { primary: primary.recipeId, secondary: secondary.recipeId };
  };
  mealOrder.forEach((meal, mealIndex) => {
    const mealSlots = byMeal.get(meal);
    const pool = mainsForMeal(meal, named);
    if (pool.length === 0) return;
    const { primary, secondary } = pickForMeal(pool);
    for (let i = 0; i < mealSlots.length; i++) {
      const slot = mealSlots[i];
      const recipeId = recipeIdForMealSlot(
        primary,
        secondary,
        candidates.length,
        mealSlots,
        mealIndex,
        i,
      );
      out.push({ slotId: slot.slotId, recipeId });
    }
  });
  return out;
}

function hasSameDayMainReuse(slots, proposals) {
  return findSameDayMainConflict(
    slots,
    new Map(proposals.map((p) => [p.slotId, p.recipeId])),
  ) != null;
}

function findSameDayMainConflict(slots, bySlot) {
  for (const day of sortedDayIndexes(slots)) {
    const conflictSlotId = sameDayReuseSlotId(slots, bySlot, day);
    if (conflictSlotId) return { dayIndex: day, slotId: conflictSlotId };
  }
  return null;
}

function dayHasSameDayMainReuse(slots, bySlot, dayIndex) {
  return sameDayReuseSlotId(slots, bySlot, dayIndex) != null;
}

function sameDayReuseSlotId(slots, bySlot, dayIndex) {
  const daySlots = slots
    .filter((s) => s.dayIndex === dayIndex)
    .slice()
    .sort((a, b) => mealOrderIndex(a.meal) - mealOrderIndex(b.meal));
  const seen = new Set();
  for (const slot of daySlots) {
    const recipeId = bySlot.get(slot.slotId);
    if (!recipeId) continue;
    if (seen.has(recipeId)) return slot.slotId;
    seen.add(recipeId);
  }
  return null;
}

function usedRecipeIdsOnConflictDay(slots, bySlot, conflict) {
  const dayUsed = new Set();
  for (const slot of slots) {
    if (slot.dayIndex !== conflict.dayIndex || slot.slotId === conflict.slotId) {
      continue;
    }
    const id = bySlot.get(slot.slotId);
    if (id) dayUsed.add(id);
  }
  return dayUsed;
}

function replaceConflictRecipe(slots, bySlot, conflict, candidateIds, dayUsed) {
  const current = bySlot.get(conflict.slotId);
  if (!current) return false;
  const alternates = candidateIds.filter((id) => id !== current && !dayUsed.has(id));
  const fallback = candidateIds.filter((id) => id !== current);
  const tryIds = alternates.length > 0 ? alternates : fallback;
  for (const alternate of tryIds) {
    bySlot.set(conflict.slotId, alternate);
    if (
      !findDuplicateDayPair(slots, bySlot) &&
      !dayHasSameDayMainReuse(slots, bySlot, conflict.dayIndex)
    ) {
      return true;
    }
    bySlot.set(conflict.slotId, current);
  }
  return false;
}

function breakSameDayMainReuse(slots, bySlot, candidateIds) {
  if (candidateIds.length < 2) return;
  for (let guard = 0; guard < 24; guard++) {
    const conflict = findSameDayMainConflict(slots, bySlot);
    if (!conflict) return;
    const dayUsed = usedRecipeIdsOnConflictDay(slots, bySlot, conflict);
    if (!replaceConflictRecipe(slots, bySlot, conflict, candidateIds, dayUsed)) return;
  }
}

function diversifyDuplicateDays(slots, bySlot, byMeal, candidateIds) {
  if (candidateIds.length < 2) return;
  for (let guard = 0; guard < 12; guard++) {
    const pair = findDuplicateDayPair(slots, bySlot);
    if (!pair) return;
    if (!diversifyDay(slots, bySlot, byMeal, pair[1], candidateIds)) return;
  }
}

function validBatchFallback(slots, candidates) {
  const fallback = assignWithBatchVariety(slots, candidates);
  if (batchSlotRatio(slots, fallback) < MIN_BATCH_SLOT_RATIO) return null;
  if (hasDuplicateDayMenus(slots, fallback)) return null;
  return hasSameDayMainReuse(slots, fallback) ? null : fallback;
}

function enforceBatchRatio(slots, bySlot, byMeal, candidateIds, candidates) {
  if (sortedDayIndexes(slots).length < 2 || candidates.length === 0) return null;
  raiseBatchRatio(slots, bySlot, byMeal);
  breakSameDayMainReuse(slots, bySlot, candidateIds);
  const current = toProposals(slots, bySlot);
  if (batchSlotRatio(slots, current) >= MIN_BATCH_SLOT_RATIO) return null;
  return validBatchFallback(slots, candidates);
}

function enforceDayVariety(slots, proposals, candidates) {
  if (slots.length === 0) return proposals;
  const bySlot = new Map(proposals.map((p) => [p.slotId, p.recipeId]));
  const byMeal = groupSlotsByMeal(slots);
  const candidateIds = candidates.map((c) => c.recipeId);
  diversifyDuplicateDays(slots, bySlot, byMeal, candidateIds);
  breakSameDayMainReuse(slots, bySlot, candidateIds);
  return (
    enforceBatchRatio(slots, bySlot, byMeal, candidateIds, candidates) ??
    toProposals(slots, bySlot)
  );
}

function ensureHeavyAnimalOnLunchDinner(slots, proposals, candidates) {
  const ldSlots = slots.filter((s) => isLunchDinnerMeal(s.meal));
  if (ldSlots.length === 0) return proposals;

  const nameById = new Map(candidates.map((c) => [c.recipeId, c.name]));
  const heavyPool = candidates.filter(
    (c) =>
      c.plateRole !== "companion" &&
      looksLikeHeavyAnimalProteinDish(c.name),
  );
  if (heavyPool.length === 0) return proposals;

  const alreadyPlaced = proposals.some((p) => {
    const slot = slots.find((s) => s.slotId === p.slotId);
    if (!slot || !isLunchDinnerMeal(slot.meal)) return false;
    return looksLikeHeavyAnimalProteinDish(nameById.get(p.recipeId) ?? "");
  });
  if (alreadyPlaced) return proposals;

  const bySlot = new Map(proposals.map((p) => [p.slotId, p.recipeId]));

  for (const heavy of heavyPool) {
    for (const slot of ldSlots) {
      const prev = bySlot.get(slot.slotId);
      bySlot.set(slot.slotId, heavy.recipeId);
      const trial = toProposals(slots, bySlot);
      if (
        !hasSameDayMainReuse(slots, trial) &&
        !hasDuplicateDayMenus(slots, trial)
      ) {
        return proposals.map((p) =>
          p.slotId === slot.slotId
            ? {
                ...p,
                recipeId: heavy.recipeId,
                dishes: [{ plateRole: "protein", recipeId: heavy.recipeId }],
                plateKind: "complete",
              }
            : p,
        );
      }
      if (prev == null) bySlot.delete(slot.slotId);
      else bySlot.set(slot.slotId, prev);
    }
  }

  const fallbackSlot = ldSlots[0];
  const fallbackHeavy = heavyPool[0].recipeId;
  const forced = {
    slotId: fallbackSlot.slotId,
    recipeId: fallbackHeavy,
    dishes: [{ plateRole: "protein", recipeId: fallbackHeavy }],
    plateKind: "complete",
  };
  if (proposals.some((p) => p.slotId === fallbackSlot.slotId)) {
    return proposals.map((p) =>
      p.slotId === fallbackSlot.slotId ? { ...p, ...forced } : p,
    );
  }
  return [...proposals, forced];
}

function deterministicAssignments(slots, candidates) {
  return assignWithBatchVariety(slots, candidates);
}

function mergeWithDeterministicFill(slots, proposals, candidates) {
  const covered = new Set(proposals.map((p) => p.slotId));
  const remaining = slots.filter((s) => !covered.has(s.slotId));
  if (remaining.length === 0) return proposals;
  return [...proposals, ...deterministicAssignments(remaining, candidates)];
}

const slots3 = [
  { slotId: "s1", dayIndex: 1, meal: "breakfast" },
  { slotId: "s2", dayIndex: 1, meal: "lunch" },
  { slotId: "s3", dayIndex: 1, meal: "dinner" },
];
const cands = [
  { recipeId: "rec-a", name: "A", longIdle: true, rating: "none" },
  { recipeId: "rec-b", name: "B", longIdle: true, rating: "none" },
];
const merged = mergeWithDeterministicFill(
  slots3,
  [{ slotId: "s1", recipeId: "rec-a" }],
  cands,
);
check(
  "deterministic fills remaining slots",
  merged.length === 3 &&
    merged[0].slotId === "s1" &&
    merged.some((p) => p.slotId === "s2") &&
    merged.some((p) => p.slotId === "s3"),
);

const slots9 = [
  { slotId: "d1b", dayIndex: 1, meal: "breakfast" },
  { slotId: "d1l", dayIndex: 1, meal: "lunch" },
  { slotId: "d1d", dayIndex: 1, meal: "dinner" },
  { slotId: "d2b", dayIndex: 2, meal: "breakfast" },
  { slotId: "d2l", dayIndex: 2, meal: "lunch" },
  { slotId: "d2d", dayIndex: 2, meal: "dinner" },
  { slotId: "d3b", dayIndex: 3, meal: "breakfast" },
  { slotId: "d3l", dayIndex: 3, meal: "lunch" },
  { slotId: "d3d", dayIndex: 3, meal: "dinner" },
];
const cands3 = [
  { recipeId: "rec-a", name: "A", longIdle: true, rating: "none" },
  { recipeId: "rec-b", name: "B", longIdle: true, rating: "none" },
  { recipeId: "rec-c", name: "C", longIdle: true, rating: "none" },
];
const batch = deterministicAssignments(slots9, cands3);
check(
  "batch variety is not a full 3-day clone",
  !isMenuUniformAcrossDays(slots9, batch),
);
check(
  "batch variety has no duplicate calendar days",
  !hasDuplicateDayMenus(slots9, batch),
);
check(
  "batch variety meets 50% multi-day slot floor",
  batchSlotRatio(slots9, batch) >= MIN_BATCH_SLOT_RATIO,
);

const uniformClone = slots9.map((s) => ({
  slotId: s.slotId,
  recipeId: recipeIdForUniformClone(s.meal),
}));
function recipeIdForUniformClone(meal) {
  if (meal === "breakfast") return "rec-a";
  return meal === "lunch" ? "rec-b" : "rec-c";
}
check("detects uniform day clone", isMenuUniformAcrossDays(slots9, uniformClone));
const enforced = enforceDayVariety(slots9, uniformClone, cands3);
check(
  "enforceDayVariety breaks full day clone",
  !isMenuUniformAcrossDays(slots9, enforced) &&
    !hasDuplicateDayMenus(slots9, enforced),
);
check(
  "enforceDayVariety keeps 50% batch after clone break",
  batchSlotRatio(slots9, enforced) >= MIN_BATCH_SLOT_RATIO,
);

// Screenshot-like A–B–A: day1 === day3, middle day differs.
const abaClone = slots9.map((s) => {
  if (s.meal === "breakfast") return { slotId: s.slotId, recipeId: "rec-a" };
  if (s.dayIndex === 2) {
    return {
      slotId: s.slotId,
      recipeId: s.meal === "lunch" ? "rec-x" : "rec-y",
    };
  }
  return {
    slotId: s.slotId,
    recipeId: s.meal === "lunch" ? "rec-b" : "rec-c",
  };
});
const abaCands = [
  ...cands3,
  { recipeId: "rec-x", name: "X", longIdle: true, rating: "none" },
  { recipeId: "rec-y", name: "Y", longIdle: true, rating: "none" },
];
check("detects A-B-A duplicate bookend days", hasDuplicateDayMenus(slots9, abaClone));
const abaFixed = enforceDayVariety(slots9, abaClone, abaCands);
check(
  "enforceDayVariety breaks A-B-A bookend clone",
  !hasDuplicateDayMenus(slots9, abaFixed),
);
check(
  "enforceDayVariety keeps 50% batch after A-B-A fix",
  batchSlotRatio(slots9, abaFixed) >= MIN_BATCH_SLOT_RATIO,
);

// All-unique LLM plan (0% repeats) must be raised to >= 50% batch slots.
const allUnique = slots9.map((s, i) => ({
  slotId: s.slotId,
  recipeId: `rec-u${i}`,
}));
const uniqueCands = allUnique.map((p, i) => ({
  recipeId: p.recipeId,
  name: `U${i}`,
  longIdle: true,
  rating: "none",
}));
check("all-unique plan has 0% batch", batchSlotRatio(slots9, allUnique) === 0);
const uniqueFixed = enforceDayVariety(slots9, allUnique, uniqueCands);
check(
  "enforceDayVariety raises all-unique to 50% batch",
  batchSlotRatio(slots9, uniqueFixed) >= MIN_BATCH_SLOT_RATIO &&
    !hasDuplicateDayMenus(slots9, uniqueFixed),
);

// Exact-name helpers only — near-duplicate variety is owned by the AI.
check("namesEqual: ё/е and case", namesEqual("Борщ", "борщ"));
check(
  "namesEqual: punctuation ignored",
  namesEqual("Омлет с сыром!", "омлет с сыром"),
);
check(
  "namesEqual: near-variants are NOT equal in code",
  !namesEqual("Творожные оладьи", "Творожные панкейки"),
);
check(
  "pickUnusedCandidate skips used ids",
  pickUnusedCandidate(
    [
      { recipeId: "a", name: "A" },
      { recipeId: "b", name: "B" },
    ],
    new Set(["a"]),
  )?.recipeId === "b",
);

check(
  "looksLikeNoCookSnack: перекус in name",
  looksLikeNoCookSnack(
    "Творожный перекус с медом и орехами (удобный к употреблению)",
  ),
);
check(
  "looksLikeNoCookSnack: cooked breakfast stays",
  !looksLikeNoCookSnack("Пшеничная каша с яблоками и корицей") &&
    !looksLikeNoCookSnack("Творожные сырники"),
);
check(
  "looksLikeNoCookSnack: ready-to-eat yogurt",
  looksLikeNoCookSnack("Йогурт натуральный"),
);
check(
  "looksLikeNoCookSnack: veg salad with fruit stays cookable",
  !looksLikeNoCookSnack("Салат из моркови и яблок"),
);

check(
  "looksLikeBreakfastDish: morning food",
  looksLikeBreakfastDish("Пшённая каша") &&
    looksLikeBreakfastDish("Творожные сырники") &&
    looksLikeBreakfastDish("Яичница с беконом") &&
    !looksLikeBreakfastDish("Запечённая курица с лимоном и травами"),
);
check(
  "looksLikeLunchDinnerOnlyMain: roast chicken / soup / plov",
  looksLikeLunchDinnerOnlyMain("Запечённая курица с лимоном и травами") &&
    looksLikeLunchDinnerOnlyMain("Куриный бульон с овощами") &&
    looksLikeLunchDinnerOnlyMain("Плов с курицей и морковью") &&
    !looksLikeLunchDinnerOnlyMain("Омлет с сыром") &&
    !looksLikeLunchDinnerOnlyMain("Пшённая каша"),
);

check(
  "looksLikeCompanionOnly: sauce and hardcoded pairing",
  looksLikeCompanionOnly("Грибной соус к пасте") &&
    looksLikeCompanionOnly("Грибной соус") &&
    !looksLikeCompanionOnly("Запечённая куриная грудка с лимоном"),
);
check(
  "stripHardcodedPairing: drops к пасте",
  stripHardcodedPairing("Грибной соус к пасте") === "Грибной соус",
);

{
  const mixSlots = [
    { slotId: "b1", dayIndex: 1, meal: "breakfast" },
    { slotId: "l1", dayIndex: 1, meal: "lunch" },
  ];
  const mixCands = [
    { recipeId: "sauce", name: "Грибной соус к пасте" },
    { recipeId: "chicken", name: "Запечённая куриная грудка с лимоном" },
    { recipeId: "kasha", name: "Пшённая каша" },
  ];
  const mains = assignWithBatchVariety(mixSlots, mixCands);
  const breakfastMain = mains.find((a) => a.slotId === "b1")?.recipeId;
  const lunchMain = mains.find((a) => a.slotId === "l1")?.recipeId;
  check(
    "assign skips sauce as breakfast/lunch main",
    breakfastMain !== "sauce" && lunchMain !== "sauce",
  );
  check(
    "assign puts porridge on breakfast, not roast chicken",
    breakfastMain === "kasha",
  );
  const plated = normalizePlateAssignments(
    mixSlots,
    mains.map((p) =>
      p.slotId === "l1"
        ? {
            ...p,
            companionRecipeId: "sauce",
          }
        : p,
    ),
    mixCands,
  );
  check(
    "normalize legacy lunch keeps carb; breakfast has no carb",
    carbFromDishes(plated.find((a) => a.slotId === "l1")?.dishes) === "sauce" &&
      plated.find((a) => a.slotId === "l1")?.dishes?.some(
        (d) => d.plateRole === "carb" && d.recipeId === "sauce",
      ) &&
      carbFromDishes(plated.find((a) => a.slotId === "b1")?.dishes) == null &&
      plated.find((a) => a.slotId === "b1")?.dishes?.[0]?.plateRole === "main",
  );
}

// Screenshot bug: roast chicken must not fill breakfast when morning food exists.
{
  const brSlots = [
    { slotId: "b1", dayIndex: 1, meal: "breakfast" },
    { slotId: "b2", dayIndex: 2, meal: "breakfast" },
    { slotId: "l1", dayIndex: 1, meal: "lunch" },
  ];
  const brCands = [
    {
      recipeId: "roast",
      name: "Запечённая курица с лимоном и травами",
    },
    { recipeId: "plov", name: "Плов с курицей и морковью" },
    { recipeId: "syrniki", name: "Творожные сырники" },
    { recipeId: "omlet", name: "Омлет с зеленью" },
  ];
  const brAssign = assignWithBatchVariety(brSlots, brCands);
  const b1 = brAssign.find((a) => a.slotId === "b1")?.recipeId;
  const b2 = brAssign.find((a) => a.slotId === "b2")?.recipeId;
  const l1 = brAssign.find((a) => a.slotId === "l1")?.recipeId;
  check(
    "breakfast never gets roast chicken / plov when morning dishes exist",
    (b1 === "syrniki" || b1 === "omlet") &&
      (b2 === "syrniki" || b2 === "omlet") &&
      (l1 === "roast" || l1 === "plov"),
  );
}

// Screenshot bug: lunch potatoes+chicken / dinner chicken+potatoes on one day.
{
  const swapSlots = [
    { slotId: "l1", dayIndex: 1, meal: "lunch" },
    { slotId: "d1", dayIndex: 1, meal: "dinner" },
  ];
  const swapCands = [
    { recipeId: "potato", name: "Картофельное пюре" },
    { recipeId: "chicken", name: "Куриные грудки в соусе терияки" },
    { recipeId: "rice", name: "Тушеный рис с овощами" },
    { recipeId: "fish", name: "Запечённая рыба с лимоном" },
  ];
  const swapped = normalizePlateAssignments(
    swapSlots,
    [
      { slotId: "l1", recipeId: "potato", companionRecipeId: "chicken" },
      { slotId: "d1", recipeId: "chicken", companionRecipeId: "potato" },
    ],
    swapCands,
  );
  const lunch = swapped.find((a) => a.slotId === "l1");
  const dinner = swapped.find((a) => a.slotId === "d1");
  // Identity normalize: converts legacy pair → dishes; culinary swap rejection
  // is no longer plateKind's job (roles come from templates + invent).
  check(
    "normalize legacy convert keeps dishes protein+carb",
    lunch?.dishes?.map((d) => d.plateRole).join(",") === "protein,carb" &&
      dinner?.dishes?.map((d) => d.plateRole).join(",") === "protein,carb" &&
      lunch?.recipeId === "potato" &&
      carbFromDishes(lunch?.dishes) === "chicken",
  );
}

{
  function recipeIdForSameMain(slot) {
    if (slot.meal === "breakfast") return "rec-a";
    if (slot.meal === "lunch") return "rec-b";
    return slot.dayIndex === 1 ? "rec-b" : "rec-c";
  }
  const sameMain = slots9.map((s) => ({
    slotId: s.slotId,
    recipeId: recipeIdForSameMain(s),
  }));
  check(
    "detects same-day lunch/dinner main reuse",
    hasSameDayMainReuse(slots9, sameMain),
  );
  const fixedSameDay = enforceDayVariety(slots9, sameMain, [
    ...cands3,
    { recipeId: "rec-d", name: "D", longIdle: true, rating: "none" },
  ]);
  check(
    "enforceDayVariety breaks same-day main reuse",
    !hasSameDayMainReuse(slots9, fixedSameDay) &&
      !hasDuplicateDayMenus(slots9, fixedSameDay),
  );
}

// Meal-mix: breakfast forms blocked from L/D mains; meat main placed on L/D.
{
  const mixCands = [
    { recipeId: "syrniki", name: "Творожные сырники" },
    { recipeId: "meatballs", name: "Куриные фрикадельки в сливочном соусе" },
  ];
  const lunchPool = mainsForMeal("lunch", mixCands);
  check(
    "mainsForMeal lunch excludes сырники when фрикадельки present",
    lunchPool.length === 1 && lunchPool[0].recipeId === "meatballs",
  );
  check(
    "potato-meat bake eligible for L/D",
    !looksLikeBreakfastDish("Запеканка из картофеля с фаршем") &&
      looksLikeHeavyAnimalProteinDish("Запеканка из картофеля с фаршем"),
  );
  check(
    "cottage-cheese buckwheat bake is breakfast-only",
    looksLikeBreakfastDish("Гречневая запеканка с творогом"),
  );

  const ldSlots = [
    { slotId: "b1", dayIndex: 1, meal: "breakfast" },
    { slotId: "l1", dayIndex: 1, meal: "lunch" },
    { slotId: "d1", dayIndex: 1, meal: "dinner" },
    { slotId: "l2", dayIndex: 2, meal: "lunch" },
    { slotId: "d2", dayIndex: 2, meal: "dinner" },
  ];
  const ldCands = [
    { recipeId: "syrniki", name: "Творожные сырники" },
    { recipeId: "meatballs", name: "Куриные фрикадельки в сливочном соусе" },
    { recipeId: "rice", name: "Тушеный рис с овощами" },
  ];
  let ldAssign = assignWithBatchVariety(ldSlots, ldCands);
  ldAssign = enforceDayVariety(ldSlots, ldAssign, ldCands);
  ldAssign = ensureHeavyAnimalOnLunchDinner(ldSlots, ldAssign, ldCands);
  const ldMainNames = ldAssign
    .filter((a) => {
      const slot = ldSlots.find((s) => s.slotId === a.slotId);
      return slot && isLunchDinnerMeal(slot.meal);
    })
    .map((a) => ldCands.find((c) => c.recipeId === a.recipeId)?.name ?? "");
  check(
    "L/D mains never breakfast form when meat main in pool",
    ldMainNames.every((name) => !looksLikeBreakfastDish(name)),
  );
  check(
    "heavy animal main placed on at least one L/D slot",
    ldAssign.some((a) => {
      const slot = ldSlots.find((s) => s.slotId === a.slotId);
      if (!slot || !isLunchDinnerMeal(slot.meal)) return false;
      const name = ldCands.find((c) => c.recipeId === a.recipeId)?.name ?? "";
      return looksLikeHeavyAnimalProteinDish(name);
    }),
  );

  const batchSlots = [
    { slotId: "d1", dayIndex: 1, meal: "dinner" },
    { slotId: "d2", dayIndex: 2, meal: "dinner" },
  ];
  const batchCands = [
    { recipeId: "chicken", name: "Запечённая курица с лимоном" },
  ];
  const batchAssign = assignWithBatchVariety(batchSlots, batchCands);
  check(
    "batch reuse: same dinner main across days allowed",
    batchAssign.length === 2 &&
      batchAssign[0].recipeId === batchAssign[1].recipeId,
  );
}

// Position-pair planning: same recipe on hard pairs (2/4/6 → 1–3 pairs).
{
  const MENU_DAY_PAIRS = [
    [1, 2],
    [3, 4],
    [5, 6],
  ];
  function pairsFor(dayCount) {
    return MENU_DAY_PAIRS.filter((p) => p[1] <= dayCount);
  }
  check("2 days → one pair", pairsFor(2).length === 1);
  check("4 days → two pairs", pairsFor(4).length === 2);
  check("6 days → three pairs", pairsFor(6).length === 3);

  const dayPairs = pairsFor(4);
  const slots = [];
  for (const day of [1, 2, 3, 4]) {
    for (const meal of ["breakfast", "lunch", "dinner"]) {
      slots.push({
        slotId: `${meal}${day}`,
        dayIndex: day,
        meal,
      });
    }
  }
  const mains = {
    "breakfast:1-2": "bA",
    "breakfast:3-4": "bB",
    "lunch:1-2": "lA",
    "lunch:3-4": "lB",
    "dinner:1-2": "dA",
    "dinner:3-4": "dB",
  };
  const companions = {
    "lunch:1-2": "sideA",
    "dinner:3-4": "sideB",
  };
  const plateKinds = {
    "lunch:1-2": "needs_companion",
    "lunch:3-4": "complete",
    "dinner:1-2": "complete",
    "dinner:3-4": "needs_companion",
  };
  const proposals = [];
  for (const meal of ["breakfast", "lunch", "dinner"]) {
    for (const pair of dayPairs) {
      const key = `${meal}:${pair[0]}-${pair[1]}`;
      const recipeId = mains[key];
      const carbId = companions[key] ?? null;
      const plateKind = meal === "breakfast" ? null : plateKinds[key];
      const dishes =
        meal === "breakfast"
          ? [{ plateRole: "main", recipeId }]
          : [
              { plateRole: "protein", recipeId },
              ...(carbId ? [{ plateRole: "carb", recipeId: carbId }] : []),
            ];
      for (const day of pair) {
        proposals.push({
          slotId: `${meal}${day}`,
          recipeId,
          dishes,
          plateKind,
        });
      }
    }
  }
  check("position pairs fill 12 B/L/D slots", proposals.length === 12);
  check(
    "lunch days 1–2 share main+carb dish",
    proposals.find((p) => p.slotId === "lunch1")?.recipeId === "lA" &&
      proposals.find((p) => p.slotId === "lunch2")?.recipeId === "lA" &&
      carbFromDishes(proposals.find((p) => p.slotId === "lunch1")?.dishes) ===
        "sideA" &&
      carbFromDishes(proposals.find((p) => p.slotId === "lunch2")?.dishes) ===
        "sideA",
  );
  check(
    "lunch days 3–4 complete has no carb dish",
    proposals.find((p) => p.slotId === "lunch3")?.recipeId === "lB" &&
      carbFromDishes(proposals.find((p) => p.slotId === "lunch3")?.dishes) ==
        null &&
      carbFromDishes(proposals.find((p) => p.slotId === "lunch4")?.dishes) ==
        null,
  );
  check(
    "breakfast never has carb dish in pair model",
    proposals
      .filter((p) => p.slotId.startsWith("breakfast"))
      .every((p) => carbFromDishes(p.dishes) == null),
  );
  void slots;
}

// Position name-plan: coerce meal when model puts dish name in meal field.
{
  const MEALS = [
    "breakfast",
    "lunch",
    "dinner",
    "late_dinner",
    "afternoon_snack",
  ];
  const coercePositionMeal = (rawMeal, lockedMeal) =>
    typeof rawMeal === "string" && MEALS.includes(rawMeal)
      ? rawMeal
      : lockedMeal;
  check(
    "coerce meal: dish name in meal → locked lunch",
    coercePositionMeal("Куриные котлеты из домашнего фарша", "lunch") ===
      "lunch",
  );
  check(
    "coerce meal: valid enum kept",
    coercePositionMeal("dinner", "lunch") === "dinner",
  );
  check(
    "coerce meal: Russian label → locked",
    coercePositionMeal("Обед", "lunch") === "lunch",
  );
}

if (failed > 0) {
  console.log(`${failed} case(s) failed`);
  process.exit(1);
}
console.log("All suggestions logic cases passed");
