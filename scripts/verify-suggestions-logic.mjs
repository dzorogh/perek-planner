/**
 * Pure-logic smoke for Story 2.3 suggestion predicates (no DB / no OpenRouter).
 * Usage: node scripts/verify-suggestions-logic.mjs
 */

const LONG_IDLE_DAYS = 14;
const RATING_WEIGHT = { like: 3, medium: 2, none: 1, dislike: 0 };

function isLongIdle(lastAssignedAt, now, idleDays = LONG_IDLE_DAYS) {
  if (!lastAssignedAt) return true;
  const ms = idleDays * 24 * 60 * 60 * 1000;
  return now.getTime() - lastAssignedAt.getTime() >= ms;
}

function isHardSuppressed(recipeId, sets) {
  return sets.refusedIds.has(recipeId) || sets.dislikedIds.has(recipeId);
}

function ratingWeight(rating) {
  return RATING_WEIGHT[rating];
}

function rankCandidates(candidates) {
  return [...candidates].sort((a, b) => {
    if (a.recentlyUsed !== b.recentlyUsed) return a.recentlyUsed ? 1 : -1;
    if (a.longIdle !== b.longIdle) return a.longIdle ? -1 : 1;
    const wa = RATING_WEIGHT[a.rating];
    const wb = RATING_WEIGHT[b.rating];
    if (wa !== wb) return wb - wa;
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

function mealAllowsCompanion(meal) {
  return meal === "lunch" || meal === "dinner" || meal === "late_dinner";
}

function mealOrderIndex(meal) {
  const idx = MEAL_SLOTS.indexOf(meal);
  return idx >= 0 ? idx : 99;
}

function preferInventedCandidates(candidates, inventedIds, minNeeded) {
  if (inventedIds.size > 0) {
    const invented = candidates.filter((c) => inventedIds.has(c.recipeId));
    if (invented.length >= Math.min(minNeeded, inventedIds.size)) {
      return invented.length >= minNeeded
        ? invented
        : [
            ...invented,
            ...candidates.filter((c) => !inventedIds.has(c.recipeId)),
          ];
    }
  }
  return preferFreshCandidates(candidates, minNeeded);
}

function extractJsonObject(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
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
    const { slotId, recipeId, companionRecipeId: rawCompanion } = item;
    if (typeof slotId !== "string" || typeof recipeId !== "string") continue;
    if (!allowedSlotIds.has(slotId) || !allowedRecipeIds.has(recipeId)) continue;
    if (seenSlots.has(slotId)) continue;
    seenSlots.add(slotId);
    let companionRecipeId = null;
    const meal = mealBySlot.get(slotId);
    if (
      meal &&
      mealAllowsCompanion(meal) &&
      typeof rawCompanion === "string" &&
      allowedRecipeIds.has(rawCompanion) &&
      rawCompanion !== recipeId
    ) {
      companionRecipeId = rawCompanion;
    }
    out.push({ slotId, recipeId, companionRecipeId });
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
  dislikedIds: new Set(["r2"]),
};
check("refuse hard-suppress", isHardSuppressed("r1", sets));
check("dislike hard-suppress", isHardSuppressed("r2", sets));
check("ok not suppressed", !isHardSuppressed("r3", sets));

check("like > medium weight", ratingWeight("like") > ratingWeight("medium"));
check("medium > none weight", ratingWeight("medium") > ratingWeight("none"));

const ranked = rankCandidates([
  { recipeId: "a", name: "А", longIdle: false, recentlyUsed: false, rating: "like" },
  { recipeId: "b", name: "Б", longIdle: true, recentlyUsed: false, rating: "medium" },
  { recipeId: "c", name: "В", longIdle: true, recentlyUsed: false, rating: "like" },
]);
check(
  "rank long-idle like first",
  ranked[0].recipeId === "c" && ranked[1].recipeId === "b",
);

const rankedFresh = rankCandidates([
  { recipeId: "old", name: "Старое", longIdle: true, recentlyUsed: true, rating: "like" },
  { recipeId: "new", name: "Новое", longIdle: false, recentlyUsed: false, rating: "none" },
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
  "preferInventedCandidates picks new ids",
  preferInventedCandidates(
    [
      { recipeId: "old", recentlyUsed: false },
      { recipeId: "new1", recentlyUsed: false },
      { recipeId: "new2", recentlyUsed: false },
    ],
    new Set(["new1", "new2"]),
    2,
  ).every((c) => c.recipeId.startsWith("new")),
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
  "companion kept for lunch",
  withCompanion.find((a) => a.slotId === "s1")?.companionRecipeId === "rec-side",
);
check(
  "companion stripped for breakfast",
  withCompanion.find((a) => a.slotId === "s2")?.companionRecipeId == null,
);
check(
  "companion stripped when equals main",
  withCompanion.find((a) => a.slotId === "s3")?.companionRecipeId == null,
);

function isBreakfastMeal(meal) {
  return meal === "breakfast" || meal === "second_breakfast";
}

function looksLikeProteinDish(name) {
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
  if (/(^|\s)котлет/.test(n)) return true;
  if (/(^|\s)(плов|лазань|гуляш)/.test(n)) return true;
  return false;
}

function resolvePlateKind(proposal, mainHasProtein) {
  if (proposal.plateKind === "complete" && mainHasProtein) return "complete";
  if (proposal.plateKind === "needs_companion") return "needs_companion";
  if (proposal.companionRecipeId) return "needs_companion";
  if (!mainHasProtein) return "needs_companion";
  return "complete";
}

function createPlateAssignmentState(slots, proposals) {
  const mealBySlot = new Map(slots.map((s) => [s.slotId, s.meal]));
  const dayBySlot = new Map(slots.map((s) => [s.slotId, s.dayIndex]));
  const used = new Set(
    proposals.flatMap((p) => (p.companionRecipeId ? [p.companionRecipeId] : [])),
  );
  const breakfastMains = new Set(
    proposals
      .filter((p) => isBreakfastMeal(mealBySlot.get(p.slotId)))
      .map((p) => p.recipeId),
  );
  const usedOnDay = new Map();
  for (const p of proposals) {
    const day = dayBySlot.get(p.slotId);
    if (day == null) continue;
    const set = usedOnDay.get(day) ?? new Set();
    set.add(p.recipeId);
    usedOnDay.set(day, set);
  }
  return { mealBySlot, dayBySlot, used, breakfastMains, usedOnDay };
}

function orderedPlateProposals(proposals, mealBySlot, dayBySlot) {
  return [...proposals].sort((a, b) => {
    const dayA = dayBySlot.get(a.slotId) ?? 0;
    const dayB = dayBySlot.get(b.slotId) ?? 0;
    if (dayA !== dayB) return dayA - dayB;
    return (
      mealOrderIndex(mealBySlot.get(a.slotId)) -
      mealOrderIndex(mealBySlot.get(b.slotId))
    );
  });
}

function directCompanion(proposal, candidates, avoidAsCompanion) {
  const companion = proposal.companionRecipeId;
  if (!companion || companion === proposal.recipeId) return null;
  if (avoidAsCompanion.has(companion)) return null;
  return candidates.some((c) => c.recipeId === companion) ? companion : null;
}

function recordCompanion(companion, day, used, usedOnDay) {
  if (!companion) return;
  used.add(companion);
  if (day == null) return;
  const set = usedOnDay.get(day) ?? new Set();
  set.add(companion);
  usedOnDay.set(day, set);
}

function normalizePlateAssignments(slots, proposals, candidates) {
  const { mealBySlot, dayBySlot, used, breakfastMains, usedOnDay } =
    createPlateAssignmentState(slots, proposals);
  const nameById = new Map(candidates.map((c) => [c.recipeId, c.name]));
  const ordered = orderedPlateProposals(proposals, mealBySlot, dayBySlot);
  const outBySlot = new Map();
  for (const proposal of ordered) {
    const meal = mealBySlot.get(proposal.slotId);
    const mainHasProtein = looksLikeProteinDish(
      nameById.get(proposal.recipeId) ?? "",
    );
    if (!meal || !mealAllowsCompanion(meal)) {
      outBySlot.set(proposal.slotId, {
        slotId: proposal.slotId,
        recipeId: proposal.recipeId,
        companionRecipeId: null,
      });
      continue;
    }
    const kind = resolvePlateKind(proposal, mainHasProtein);
    if (kind === "complete") {
      outBySlot.set(proposal.slotId, {
        slotId: proposal.slotId,
        recipeId: proposal.recipeId,
        companionRecipeId: null,
      });
      continue;
    }
    const day = dayBySlot.get(proposal.slotId);
    const dayUsed = day != null ? (usedOnDay.get(day) ?? new Set()) : new Set();
    const avoidAsCompanion = new Set([...breakfastMains, ...dayUsed]);
    let companion = directCompanion(proposal, candidates, avoidAsCompanion);
    if (
      companion &&
      !mainHasProtein &&
      !looksLikeProteinDish(nameById.get(companion) ?? "")
    ) {
      companion = null;
    }
    if (!companion) {
      companion = pickCompanionCandidate(
        candidates,
        proposal.recipeId,
        used,
        avoidAsCompanion,
        { requireProtein: !mainHasProtein },
      );
    }
    recordCompanion(companion, day, used, usedOnDay);
    outBySlot.set(proposal.slotId, {
      slotId: proposal.slotId,
      recipeId: proposal.recipeId,
      companionRecipeId: companion,
    });
  }
  return proposals.map(
    (p) =>
      outBySlot.get(p.slotId) ?? {
        slotId: p.slotId,
        recipeId: p.recipeId,
        companionRecipeId: null,
      },
  );
}

const plateSlots = [
  { slotId: "s1", dayIndex: 1, meal: "lunch" },
  { slotId: "s2", dayIndex: 1, meal: "dinner" },
];
const plateCands = [
  { recipeId: "main-a", name: "Куриное филе" },
  { recipeId: "side-a", name: "Пюре" },
  { recipeId: "plov", name: "Плов с курицей" },
];
check(
  "pickCompanionCandidate prefers plateRole=companion",
  pickCompanionCandidate(
    [
      { recipeId: "main-a", name: "Филе", plateRole: "main" },
      { recipeId: "side-b", name: "Гречка", plateRole: "companion" },
      { recipeId: "main-b", name: "Котлеты", plateRole: "main" },
    ],
    "main-a",
  ) === "side-b",
);
const filledBare = normalizePlateAssignments(
  plateSlots,
  [
    {
      slotId: "s1",
      recipeId: "main-a",
      companionRecipeId: null,
      plateKind: "needs_companion",
    },
    {
      slotId: "s2",
      recipeId: "plov",
      companionRecipeId: "side-a",
      plateKind: "complete",
    },
  ],
  plateCands,
);
check(
  "normalize fills needs_companion lunch when AI omitted companion id",
  filledBare.find((a) => a.slotId === "s1")?.companionRecipeId === "side-a",
);
check(
  "normalize trusts plateKind=complete and strips companion",
  filledBare.find((a) => a.slotId === "s2")?.companionRecipeId == null,
);
check(
  "normalize does not invent companion without AI plateKind/companion",
  normalizePlateAssignments(
    [{ slotId: "d1", dayIndex: 1, meal: "dinner" }],
    [{ slotId: "d1", recipeId: "plov", companionRecipeId: null }],
    plateCands,
  ).find((a) => a.slotId === "d1")?.companionRecipeId == null,
);
check(
  "normalize honors AI needs_companion pairing (no keyword override)",
  normalizePlateAssignments(
    [{ slotId: "d3", dayIndex: 3, meal: "dinner" }],
    [
      {
        slotId: "d3",
        recipeId: "plov",
        companionRecipeId: "side-a",
        plateKind: "needs_companion",
      },
    ],
    plateCands,
  ).find((a) => a.slotId === "d3")?.companionRecipeId === "side-a",
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

const proteinPlate = normalizePlateAssignments(
  [{ slotId: "d1", dayIndex: 1, meal: "dinner" }],
  [
    {
      slotId: "d1",
      recipeId: "pancakes",
      companionRecipeId: "carrot-salad",
      plateKind: "needs_companion",
    },
  ],
  [
    { recipeId: "pancakes", name: "Картофельные оладьи с укропом" },
    { recipeId: "carrot-salad", name: "Морковный салат с чесноком" },
    { recipeId: "chicken", name: "Куриная грудка" },
  ],
);
check(
  "normalize replaces veg+veg dinner with protein companion",
  proteinPlate.find((a) => a.slotId === "d1")?.companionRecipeId === "chicken",
);

const proteinLessComplete = normalizePlateAssignments(
  [{ slotId: "d2", dayIndex: 1, meal: "dinner" }],
  [
    {
      slotId: "d2",
      recipeId: "pancakes",
      companionRecipeId: null,
      plateKind: "complete",
    },
  ],
  [
    { recipeId: "pancakes", name: "Картофельные оладьи с укропом" },
    { recipeId: "chicken", name: "Куриная грудка", plateRole: "companion" },
  ],
);
check(
  "normalize rejects protein-less plateKind=complete",
  proteinLessComplete.find((a) => a.slotId === "d2")?.companionRecipeId ===
    "chicken",
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
  const pool =
    others.length > 0
      ? others
      : candidates.filter((c) => c.recipeId !== mainRecipeId);
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
            plateKind: "needs_companion",
            companionRecipeId: "sauce",
          }
        : p,
    ),
    mixCands,
  );
  const lunchCompanion = plated.find((a) => a.slotId === "l1")?.companionRecipeId;
  check(
    "normalize keeps AI sauce companion and clears breakfast companion",
    lunchCompanion === "sauce" &&
      plated.find((a) => a.slotId === "b1")?.companionRecipeId == null,
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
  const dayIds = [
    lunch?.recipeId,
    lunch?.companionRecipeId,
    dinner?.recipeId,
    dinner?.companionRecipeId,
  ].filter(Boolean);
  check(
    "normalize rejects same-day potato/chicken swap",
    new Set(dayIds).size === dayIds.length &&
      lunch?.companionRecipeId !== "chicken" &&
      dinner?.companionRecipeId !== "potato",
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

if (failed > 0) {
  console.log(`${failed} case(s) failed`);
  process.exit(1);
}
console.log("All suggestions logic cases passed");
