export const EQUIPMENT_IDS = [
  "stove",
  "oven",
  "air_fryer",
  "grill",
  "multicooker",
  "pressure_cooker",
  "microwave",
] as const;

export type EquipmentId = (typeof EQUIPMENT_IDS)[number];

export const EQUIPMENT_LABELS_RU: Record<EquipmentId, string> = {
  stove: "Плита",
  oven: "Духовка",
  air_fryer: "Аэрогриль",
  grill: "Гриль",
  multicooker: "Мультиварка",
  pressure_cooker: "Скороварка",
  microwave: "Микроволновка",
};

export const DEFAULT_AVAILABLE_EQUIPMENT: readonly EquipmentId[] = [
  "stove",
  "oven",
];

export function isEquipmentId(value: string): value is EquipmentId {
  return (EQUIPMENT_IDS as readonly string[]).includes(value);
}

/** Normalize + validate; null if empty or any unknown id. Dedupes, keeps first-seen order. */
export function normalizeEquipmentList(
  raw: readonly string[] | null | undefined,
): EquipmentId[] | null {
  if (!raw) return null;
  const seen = new Set<EquipmentId>();
  const out: EquipmentId[] = [];
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

export function parseEquipmentCsv(raw: unknown): EquipmentId[] | null {
  if (typeof raw !== "string") return null;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return normalizeEquipmentList(parts);
}

export function equipmentToCsv(ids: readonly EquipmentId[]): string {
  return ids.join(",");
}

/** required ⊆ available; both must be non-empty valid lists. */
export function recipeFitsAvailableEquipment(
  required: readonly string[] | null | undefined,
  available: readonly string[] | null | undefined,
): boolean {
  const req = normalizeEquipmentList(required);
  const avail = normalizeEquipmentList(available);
  if (!req || !avail) return false;
  return req.every((id) => avail.includes(id));
}

/**
 * Equipment a dish NAME clearly implies (Russian cues).
 * Used to catch plan names like «стейки на гриле» when grill is unavailable.
 */
export function equipmentImpliedByDishName(name: string): EquipmentId[] {
  const n = name.trim().toLowerCase();
  if (!n) return [];
  const out: EquipmentId[] = [];
  const add = (id: EquipmentId) => {
    if (!out.includes(id)) out.push(id);
  };
  if (/(аэрогрил|air[\s-]?fry)/i.test(n)) add("air_fryer");
  else if (/\bгрил[ьяею]|на гриле|гриль\b/i.test(n)) add("grill");
  if (/мультиварк/i.test(n)) add("multicooker");
  if (/скороварк|под давлением/i.test(n)) add("pressure_cooker");
  if (/микроволн|\bсвч\b/i.test(n)) add("microwave");
  return out;
}

/** Implied ids from the name that are missing from available. */
export function dishNameEquipmentConflicts(
  name: string,
  available: readonly string[] | null | undefined,
): EquipmentId[] {
  const avail = normalizeEquipmentList(available);
  if (!avail) return equipmentImpliedByDishName(name);
  return equipmentImpliedByDishName(name).filter((id) => !avail.includes(id));
}

/**
 * Keep required ⊆ available. If nothing remains, remap common appliances
 * (grill→oven/stove, …) or fall back to stove / first available.
 */
export function clampRequiredEquipmentToAvailable(
  required: readonly string[] | null | undefined,
  available: readonly EquipmentId[],
): EquipmentId[] {
  const avail =
    normalizeEquipmentList(available) ?? [...DEFAULT_AVAILABLE_EQUIPMENT];
  const req = normalizeEquipmentList(required);
  if (req) {
    const kept = req.filter((id) => avail.includes(id));
    if (kept.length > 0) return kept;
  }
  const prefer = (ids: readonly EquipmentId[]): EquipmentId[] | null => {
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
  return prefer(["stove", "oven"]) ?? [avail[0]!];
}

export type EquipmentSelection = Record<EquipmentId, boolean>;

export function selectionFromList(
  ids: readonly EquipmentId[],
): EquipmentSelection {
  const sel = Object.fromEntries(
    EQUIPMENT_IDS.map((id) => [id, false]),
  ) as EquipmentSelection;
  for (const id of ids) sel[id] = true;
  return sel;
}

export function listFromSelection(
  selection: EquipmentSelection,
): EquipmentId[] | null {
  return normalizeEquipmentList(EQUIPMENT_IDS.filter((id) => selection[id]));
}

export const DEFAULT_EQUIPMENT_SELECTION: EquipmentSelection =
  selectionFromList([...DEFAULT_AVAILABLE_EQUIPMENT]);
