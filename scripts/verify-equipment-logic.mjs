/**
 * Pure available-equipment helpers (no DB).
 * Usage: node scripts/verify-equipment-logic.mjs
 */

const EQUIPMENT_IDS = [
  "stove",
  "oven",
  "air_fryer",
  "grill",
  "multicooker",
  "pressure_cooker",
  "microwave",
];

const DEFAULT_AVAILABLE_EQUIPMENT = ["stove", "oven"];

function isEquipmentId(value) {
  return EQUIPMENT_IDS.includes(value);
}

function normalizeEquipmentList(raw) {
  if (!Array.isArray(raw)) return null;
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    if (typeof item !== "string") return null;
    const id = item.trim();
    if (!isEquipmentId(id)) return null;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  if (out.length === 0) return null;
  return out;
}

function parseEquipmentCsv(raw) {
  if (typeof raw !== "string") return null;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return normalizeEquipmentList(parts);
}

function recipeFitsAvailableEquipment(required, available) {
  const req = normalizeEquipmentList(required);
  const avail = normalizeEquipmentList(available);
  if (!req || !avail) return false;
  return req.every((id) => avail.includes(id));
}

function equipmentImpliedByDishName(name) {
  const n = String(name || "")
    .trim()
    .toLowerCase();
  if (!n) return [];
  const out = [];
  const add = (id) => {
    if (!out.includes(id)) out.push(id);
  };
  if (/(аэрогрил|air[\s-]?fry)/i.test(n)) add("air_fryer");
  else if (/\bгрил[ьяею]|на гриле|гриль\b/i.test(n)) add("grill");
  if (/мультиварк/i.test(n)) add("multicooker");
  if (/скороварк|под давлением/i.test(n)) add("pressure_cooker");
  if (/микроволн|\bсвч\b/i.test(n)) add("microwave");
  return out;
}

function dishNameEquipmentConflicts(name, available) {
  const avail = normalizeEquipmentList(available);
  if (!avail) return equipmentImpliedByDishName(name);
  return equipmentImpliedByDishName(name).filter((id) => !avail.includes(id));
}

function clampRequiredEquipmentToAvailable(required, available) {
  const avail = normalizeEquipmentList(available) ?? [
    ...DEFAULT_AVAILABLE_EQUIPMENT,
  ];
  const req = normalizeEquipmentList(required);
  if (req) {
    const kept = req.filter((id) => avail.includes(id));
    if (kept.length > 0) return kept;
  }
  const prefer = (ids) => {
    for (const id of ids) {
      if (avail.includes(id)) return [id];
    }
    return null;
  };
  if (req?.includes("grill")) {
    const mapped = prefer(["oven", "stove", "air_fryer"]);
    if (mapped) return mapped;
  }
  if (req?.includes("air_fryer")) {
    const mapped = prefer(["oven", "stove"]);
    if (mapped) return mapped;
  }
  if (req?.includes("multicooker") || req?.includes("pressure_cooker")) {
    const mapped = prefer(["stove", "oven"]);
    if (mapped) return mapped;
  }
  if (req?.includes("microwave")) {
    const mapped = prefer(["stove", "oven"]);
    if (mapped) return mapped;
  }
  return prefer(["stove", "oven"]) ?? [avail[0]];
}

let failed = 0;
function check(name, cond) {
  if (cond) console.log(`PASS: ${name}`);
  else {
    console.log(`FAIL: ${name}`);
    failed += 1;
  }
}

check(
  "default has stove+oven",
  DEFAULT_AVAILABLE_EQUIPMENT.join(",") === "stove,oven",
);
check(
  "normalize ok",
  normalizeEquipmentList(["oven", "stove", "stove"]).join(",") === "oven,stove",
);
check("normalize rejects unknown", normalizeEquipmentList(["toaster"]) === null);
check("normalize rejects empty", normalizeEquipmentList([]) === null);
check(
  "csv parse",
  parseEquipmentCsv("stove, air_fryer").join(",") === "stove,air_fryer",
);
check("csv empty fails", parseEquipmentCsv("") === null);
check(
  "fit equal",
  recipeFitsAvailableEquipment(["stove"], ["stove", "oven"]),
);
check(
  "fit equal full",
  recipeFitsAvailableEquipment(["stove", "oven"], ["stove", "oven"]),
);
check(
  "fit fail extra",
  !recipeFitsAvailableEquipment(["microwave"], ["stove", "oven"]),
);
check(
  "fit fail empty required",
  !recipeFitsAvailableEquipment([], ["stove"]),
);
check(
  "fit fail unknown required",
  !recipeFitsAvailableEquipment(["toaster"], ["stove", "toaster"]),
);
check(
  "name implies grill",
  equipmentImpliedByDishName("Говяжьи стейки на гриле").join(",") === "grill",
);
check(
  "name implies air_fryer not grill",
  equipmentImpliedByDishName("Курица в аэрогриле").join(",") === "air_fryer",
);
check(
  "name conflict when grill missing",
  dishNameEquipmentConflicts("Стейки на гриле", ["stove", "oven"]).join(
    ",",
  ) === "grill",
);
check(
  "name ok when grill available",
  dishNameEquipmentConflicts("Стейки на гриле", ["stove", "grill"]).length ===
    0,
);
check(
  "clamp grill→oven",
  clampRequiredEquipmentToAvailable(["grill"], ["stove", "oven"]).join(",") ===
    "oven",
);
check(
  "clamp keeps subset",
  clampRequiredEquipmentToAvailable(["stove", "grill"], ["stove", "oven"]).join(
    ",",
  ) === "stove",
);

if (failed > 0) {
  console.error(`${failed} case(s) failed`);
  process.exit(1);
}
console.log("All equipment logic cases passed");
