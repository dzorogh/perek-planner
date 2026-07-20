/**
 * Pure checks for snack label normalize / AI JSON parse (no fixed pool).
 * Usage: node scripts/verify-snack-pool-logic.mjs
 */

function normalizeSnackLabel(label) {
  return label.trim().toLocaleLowerCase("ru");
}

function formatSnackLabel(label) {
  const trimmed = label.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toLocaleUpperCase("ru") + trimmed.slice(1);
}

function parseOptionalNonNegInt(raw) {
  let n = NaN;
  if (typeof raw === "number") {
    n = raw;
  } else if (typeof raw === "string") {
    n = Number(raw);
  }
  if (!Number.isFinite(n) || n < 0 || n === 0) return null;
  return Math.trunc(n);
}

function inventPriceToKopecks(row) {
  const rub = parseOptionalNonNegInt(row.price_rub_per_serving);
  if (rub != null) {
    if (rub > 400) return null;
    return rub * 100;
  }
  return null;
}

function parseSnackItem(item) {
  if (typeof item === "string") {
    const label = formatSnackLabel(item);
    if (!label || label.length > 80) return null;
    return {
      label,
      priceCentsPerServing: null,
      caloriesKcalPerServing: null,
    };
  }
  if (!item || typeof item !== "object") return null;
  const rawName = item.name ?? item.label;
  if (typeof rawName !== "string") return null;
  const label = formatSnackLabel(rawName);
  if (!label || label.length > 80) return null;
  const nutrition =
    item.nutrition_per_serving && typeof item.nutrition_per_serving === "object"
      ? item.nutrition_per_serving
      : null;
  return {
    label,
    priceCentsPerServing: inventPriceToKopecks(item),
    caloriesKcalPerServing: parseOptionalNonNegInt(nutrition?.kcal),
  };
}

function parseSnacksJson(content, count, disliked) {
  let parsed;
  try {
    parsed = JSON.parse(content.trim());
  } catch {
    return [];
  }
  if (!Array.isArray(parsed.snacks)) return [];
  const out = [];
  const seen = new Set();
  for (const item of parsed.snacks) {
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

if (normalizeSnackLabel("  Йогурт ") !== "йогурт") {
  console.error("FAIL normalize");
  process.exit(1);
}

if (formatSnackLabel("овощные палочки с хумусом") !== "Овощные палочки с хумусом") {
  console.error("FAIL formatSnackLabel");
  process.exit(1);
}

const parsed = parseSnacksJson(
  JSON.stringify({
    snacks: [
      "Хумус с хлебцами",
      "йогурт",
      "хумус с хлебцами",
      {
        name: "ряженка",
        price_rub_per_serving: 55,
        nutrition_per_serving: { kcal: 140 },
      },
    ],
  }),
  2,
  new Set(["йогурт"]),
);
if (
  parsed.length !== 2 ||
  parsed[0].label !== "Хумус с хлебцами" ||
  parsed[1].label !== "Ряженка" ||
  parsed[1].priceCentsPerServing !== 5500 ||
  parsed[1].caloriesKcalPerServing !== 140
) {
  console.error("FAIL parse", parsed);
  process.exit(1);
}

const filtered = parseSnacksJson(
  JSON.stringify({ snacks: ["банан", "орехи"] }),
  2,
  new Set(["банан", "орехи"]),
);
if (filtered.length !== 0) {
  console.error("FAIL avoid filter", filtered);
  process.exit(1);
}

console.log("PASS: snack generate/parse logic");
