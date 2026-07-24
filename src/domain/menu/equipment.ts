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
