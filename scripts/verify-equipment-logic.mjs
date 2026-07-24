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

if (failed > 0) {
  console.error(`${failed} case(s) failed`);
  process.exit(1);
}
console.log("All equipment logic cases passed");
