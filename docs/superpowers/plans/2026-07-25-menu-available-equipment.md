# Menu Available Equipment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let operators pick kitchen equipment when creating a menu; persist profile default + menu snapshot; hard-filter cookable recipes so AI invent/assign/resuggest only uses recipes whose `required_equipment` ⊆ selected set.

**Architecture:** Closed vocabulary in domain helpers; `user_settings.available_equipment` + `menus.available_equipment` + `recipes.required_equipment` columns; chip picker on create + menu edit; invent JSON gains `required_equipment`; `buildCandidates` and invent parsers enforce subset eligibility in code (not prompt-only).

**Tech Stack:** Next.js 16 App Router, Supabase Postgres/RLS, server actions, OpenRouter invent prompts, Node verify scripts (`npm run verify:logic`).

**Spec:** `docs/superpowers/specs/2026-07-25-menu-available-equipment-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `src/domain/menu/equipment.ts` | Vocabulary, defaults, parse/normalize/validate, subset check |
| `scripts/verify-equipment-logic.mjs` | Pure-logic checks mirroring `equipment.ts` |
| `supabase/migrations/20260725010000_available_equipment.sql` | Columns, checks, backfill, `create_menu_skeleton` + `p_equipment` |
| `src/domain/settings/available-equipment.ts` | Load/upsert `user_settings.available_equipment` |
| `src/domain/menu/create-skeleton.ts` | Pass `p_equipment` into RPC |
| `src/domain/menu/create-menu-actions.ts` | Validate form equipment; upsert settings; pass into generate |
| `src/domain/menu/equipment-actions.ts` | Update menu equipment (+ profile) from plan screen |
| `src/domain/menu/load-menu.ts` | Expose `availableEquipment` on menu view |
| `src/components/menu/equipment-picker.tsx` | Chip UI (create + menu) |
| `src/components/menu/create-menu-form.tsx` | Wire picker + hidden field + load defaults |
| `src/components/menu/menu-equipment-editor.tsx` | Client editor on plan/menu |
| `app/(authenticated)/plan/menu/page.tsx` | Render editor with current menu equipment |
| `src/domain/suggestions/candidates.ts` | Filter by menu equipment |
| `src/domain/suggestions/invent-recipes.ts` | Prompt, parse, persist `required_equipment` |
| `src/domain/suggestions/invent-for-position.ts` | Prompt + context `availableEquipment` + eligibility |
| `src/domain/suggestions/generate-menu.ts` | Pass equipment through create pipeline |
| `src/domain/suggestions/resuggest-slot.ts` | Load menu equipment for invent/candidates |
| `src/domain/suggestions/expand-menu-recipes.ts` | Thread equipment into invent if needed |
| `package.json` | Add verify script to `verify:logic` |
| `docs/data-models.md` | Document new columns |

---

### Task 1: Domain helpers + verify script (TDD)

**Files:**
- Create: `src/domain/menu/equipment.ts`
- Create: `scripts/verify-equipment-logic.mjs`
- Modify: `package.json` (`verify:logic` script)

- [ ] **Step 1: Write the failing verify script**

Create `scripts/verify-equipment-logic.mjs` with the pure functions inlined (same pattern as `scripts/verify-fridge-keep-logic.mjs`):

```javascript
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

check("default has stove+oven", DEFAULT_AVAILABLE_EQUIPMENT.join(",") === "stove,oven");
check("normalize ok", normalizeEquipmentList(["oven", "stove", "stove"]).join(",") === "oven,stove");
check("normalize rejects unknown", normalizeEquipmentList(["toaster"]) === null);
check("normalize rejects empty", normalizeEquipmentList([]) === null);
check("csv parse", parseEquipmentCsv("stove, air_fryer").join(",") === "stove,air_fryer");
check("csv empty fails", parseEquipmentCsv("") === null);
check("fit equal", recipeFitsAvailableEquipment(["stove"], ["stove", "oven"]));
check("fit equal full", recipeFitsAvailableEquipment(["stove", "oven"], ["stove", "oven"]));
check("fit fail extra", !recipeFitsAvailableEquipment(["microwave"], ["stove", "oven"]));
check("fit fail empty required", !recipeFitsAvailableEquipment([], ["stove"]));
check("fit fail unknown required", !recipeFitsAvailableEquipment(["toaster"], ["stove", "toaster"]));

if (failed > 0) {
  console.error(`${failed} case(s) failed`);
  process.exit(1);
}
console.log("All equipment logic cases passed");
```

- [ ] **Step 2: Run verify script — expect PASS** (logic is self-contained in the script for now)

Run: `node scripts/verify-equipment-logic.mjs`  
Expected: `All equipment logic cases passed`

- [ ] **Step 3: Implement TypeScript source of truth**

Create `src/domain/menu/equipment.ts`:

```typescript
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
  return normalizeEquipmentList(
    EQUIPMENT_IDS.filter((id) => selection[id]),
  );
}

export const DEFAULT_EQUIPMENT_SELECTION: EquipmentSelection =
  selectionFromList([...DEFAULT_AVAILABLE_EQUIPMENT]);
```

- [ ] **Step 4: Wire into `verify:logic`**

In `package.json`, append to the `verify:logic` script:

`&& node scripts/verify-equipment-logic.mjs`

- [ ] **Step 5: Commit**

```bash
git add src/domain/menu/equipment.ts scripts/verify-equipment-logic.mjs package.json
git commit -m "$(cat <<'EOF'
Add kitchen equipment vocabulary and eligibility helpers.

EOF
)"
```

---

### Task 2: Migration + apply via Supabase MCP

**Files:**
- Create: `supabase/migrations/20260725010000_available_equipment.sql`
- Apply via MCP `user-supabase` → `apply_migration`

- [ ] **Step 1: Write migration SQL**

```sql
-- Available kitchen equipment: profile default, menu snapshot, recipe requirements.

-- 1) Columns
alter table public.user_settings
  add column if not exists available_equipment text[] not null
    default array['stove', 'oven']::text[];

alter table public.menus
  add column if not exists available_equipment text[] not null
    default array['stove', 'oven']::text[];

alter table public.recipes
  add column if not exists required_equipment text[] not null
    default array['stove', 'oven']::text[];

comment on column public.user_settings.available_equipment is
  'Operator kitchen equipment default; pre-fills create-menu picker.';

comment on column public.menus.available_equipment is
  'Snapshot of equipment allowed for this menu; hard filter for AI/candidates.';

comment on column public.recipes.required_equipment is
  'Equipment required to cook this recipe; must be ⊆ menu.available_equipment.';

-- 2) Vocabulary checks (array contained in closed set; non-empty)
alter table public.user_settings
  drop constraint if exists user_settings_available_equipment_check;
alter table public.user_settings
  add constraint user_settings_available_equipment_check
  check (
    cardinality(available_equipment) >= 1
    and available_equipment <@ array[
      'stove','oven','air_fryer','grill','multicooker','pressure_cooker','microwave'
    ]::text[]
  );

alter table public.menus
  drop constraint if exists menus_available_equipment_check;
alter table public.menus
  add constraint menus_available_equipment_check
  check (
    cardinality(available_equipment) >= 1
    and available_equipment <@ array[
      'stove','oven','air_fryer','grill','multicooker','pressure_cooker','microwave'
    ]::text[]
  );

alter table public.recipes
  drop constraint if exists recipes_required_equipment_check;
alter table public.recipes
  add constraint recipes_required_equipment_check
  check (
    cardinality(required_equipment) >= 1
    and required_equipment <@ array[
      'stove','oven','air_fryer','grill','multicooker','pressure_cooker','microwave'
    ]::text[]
  );

-- 3) Seed backfill (known stove-only; others keep default stove+oven)
update public.recipes
set required_equipment = array['stove']::text[]
where id in (
  'b2000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000002'
);

-- 4) create_menu_skeleton accepts p_equipment
create or replace function public.create_menu_skeleton(
  p_day_count integer,
  p_servings integer default 2,
  p_meals text[] default array['breakfast', 'lunch', 'dinner']::text[],
  p_equipment text[] default array['stove', 'oven']::text[]
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_menu_id uuid;
  v_day integer;
  v_meal text;
  v_servings integer := coalesce(p_servings, 2);
  v_input text[] := coalesce(p_meals, array[]::text[]);
  v_allowed text[] := array[
    'breakfast',
    'second_breakfast',
    'lunch',
    'afternoon_snack',
    'dinner',
    'late_dinner'
  ];
  v_meals text[];
  v_equip_input text[] := coalesce(p_equipment, array['stove', 'oven']::text[]);
  v_equip_allowed text[] := array[
    'stove','oven','air_fryer','grill','multicooker','pressure_cooker','microwave'
  ];
  v_equipment text[];
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_day_count not in (2, 4, 6) then
    raise exception 'invalid day_count';
  end if;

  if v_servings < 1 or v_servings > 20 then
    raise exception 'invalid servings';
  end if;

  if exists (
    select 1
    from unnest(v_input) as m
    where m <> all (v_allowed)
  ) then
    raise exception 'invalid meals';
  end if;

  if cardinality(v_equip_input) < 1
     or exists (
       select 1
       from unnest(v_equip_input) as e
       where e <> all (v_equip_allowed)
     )
  then
    raise exception 'invalid equipment';
  end if;

  select coalesce(array_agg(a), array[]::text[])
  into v_meals
  from unnest(v_allowed) as a
  where a = any (v_input);

  select coalesce(array_agg(distinct e), array[]::text[])
  into v_equipment
  from unnest(v_equip_input) as e
  where e = any (v_equip_allowed);

  if cardinality(v_equipment) < 1 then
    raise exception 'invalid equipment';
  end if;

  insert into public.menus (user_id, day_count, default_servings_per_meal, available_equipment)
  values (v_user_id, p_day_count, v_servings, v_equipment)
  returning id into v_menu_id;

  if cardinality(v_meals) > 0 then
    for v_day in 1..p_day_count loop
      foreach v_meal in array v_meals loop
        insert into public.menu_slots (menu_id, day_index, meal, recipe_id, servings)
        values (v_menu_id, v_day, v_meal, null, v_servings);
      end loop;
    end loop;
  end if;

  return v_menu_id;
end;
$$;

comment on function public.create_menu_skeleton(integer, integer, text[], text[]) is
  'Create Menu + empty slots; snapshotted available_equipment; meals optional for snacks-only.';

revoke all on function public.create_menu_skeleton(integer, integer, text[], text[]) from public;
revoke all on function public.create_menu_skeleton(integer, integer, text[], text[]) from anon;
grant execute on function public.create_menu_skeleton(integer, integer, text[], text[]) to authenticated;

-- Keep older overloads callable if PostgREST still resolves them: drop prior 3-arg and re-grant 4-arg only.
drop function if exists public.create_menu_skeleton(integer, integer, text[]);
```

**Note:** Confirm with `list_migrations` / DB whether dropping the 3-arg overload is safe. If other callers exist, keep a 3-arg wrapper that calls the 4-arg with default equipment instead of dropping:

```sql
create or replace function public.create_menu_skeleton(
  p_day_count integer,
  p_servings integer default 2,
  p_meals text[] default array['breakfast', 'lunch', 'dinner']::text[]
)
returns uuid
language sql
security invoker
set search_path = public
as $$
  select public.create_menu_skeleton(
    p_day_count,
    p_servings,
    p_meals,
    array['stove', 'oven']::text[]
  );
$$;
```

Prefer the wrapper approach if `drop function` risks breaking in-flight clients.

- [ ] **Step 2: Apply migration via Supabase MCP**

Call `user-supabase` / `apply_migration` with name `available_equipment` and the SQL body.  
If auth fails: `mcp_auth` once, retry.  
Do not leave apply as a user-only reminder.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260725010000_available_equipment.sql
git commit -m "$(cat <<'EOF'
Add available_equipment columns and skeleton RPC param.

EOF
)"
```

---

### Task 3: Settings load/upsert + skeleton create path

**Files:**
- Create: `src/domain/settings/available-equipment.ts`
- Modify: `src/domain/menu/create-skeleton.ts`
- Modify: `src/domain/menu/create-menu-actions.ts`
- Modify: `src/domain/suggestions/generate-menu.ts` (options type + pass-through to skeleton)

- [ ] **Step 1: Settings helpers**

Create `src/domain/settings/available-equipment.ts`:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_AVAILABLE_EQUIPMENT,
  normalizeEquipmentList,
  type EquipmentId,
} from "@/domain/menu/equipment";

export async function loadAvailableEquipment(
  supabase: SupabaseClient,
  userId: string,
): Promise<EquipmentId[]> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("available_equipment")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return [...DEFAULT_AVAILABLE_EQUIPMENT];
  }

  return (
    normalizeEquipmentList(data.available_equipment as string[]) ?? [
      ...DEFAULT_AVAILABLE_EQUIPMENT,
    ]
  );
}

/** Best-effort upsert; returns false on failure (do not block menu create). */
export async function upsertAvailableEquipment(
  supabase: SupabaseClient,
  userId: string,
  equipment: readonly EquipmentId[],
): Promise<boolean> {
  const normalized = normalizeEquipmentList(equipment);
  if (!normalized) return false;

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      available_equipment: normalized,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  return !error;
}
```

- [ ] **Step 2: Extend create skeleton**

In `src/domain/menu/create-skeleton.ts`:

- Import `DEFAULT_AVAILABLE_EQUIPMENT`, `normalizeEquipmentList`, `EquipmentId`
- Add `equipment?: readonly EquipmentId[]` to `CreateSkeletonOptions`
- Resolve: `const equipment = normalizeEquipmentList(options.equipment) ?? [...DEFAULT_AVAILABLE_EQUIPMENT]`
- Pass `p_equipment: equipment` into `supabase.rpc("create_menu_skeleton", { ... })`

- [ ] **Step 3: Create action + generate options**

In `create-menu-actions.ts`:

```typescript
import { parseEquipmentCsv } from "@/domain/menu/equipment";
import { upsertAvailableEquipment } from "@/domain/settings/available-equipment";

// inside createMenuSkeletonAction, after meals validation:
const equipment = parseEquipmentCsv(formData.get("equipment"));
if (!equipment) {
  return { ok: false, error: "Выберите хотя бы один вид техники." };
}

// after auth, before generate:
await upsertAvailableEquipment(supabase, user.id, equipment);

const result = await generateBuyableMenuForUser(
  supabase,
  user.id,
  dayCount,
  { peopleCount, meals, includeSnacks, equipment },
);
```

In `generate-menu.ts` `GenerateMenuOptions` add:

```typescript
equipment?: readonly import("@/domain/menu/equipment").EquipmentId[];
```

When calling `createMenuSkeletonForUser`, pass `equipment: options.equipment`.

Keep `options.equipment` available later for invent wiring (Task 6–7); for this task at least snapshot on menu create.

- [ ] **Step 4: Commit**

```bash
git add src/domain/settings/available-equipment.ts src/domain/menu/create-skeleton.ts src/domain/menu/create-menu-actions.ts src/domain/suggestions/generate-menu.ts
git commit -m "$(cat <<'EOF'
Persist menu equipment snapshot and profile default on create.

EOF
)"
```

---

### Task 4: Equipment picker UI on create form

**Files:**
- Create: `src/components/menu/equipment-picker.tsx`
- Modify: `src/components/menu/create-menu-form.tsx`
- Create: `src/domain/settings/available-equipment-actions.ts` (load defaults for client)

- [ ] **Step 1: Server action to load defaults**

Create `src/domain/settings/available-equipment-actions.ts`:

```typescript
"use server";

import {
  DEFAULT_AVAILABLE_EQUIPMENT,
  type EquipmentId,
} from "@/domain/menu/equipment";
import { loadAvailableEquipment } from "@/domain/settings/available-equipment";
import { createClient } from "@/lib/supabase/server";

export async function getAvailableEquipmentAction(): Promise<EquipmentId[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [...DEFAULT_AVAILABLE_EQUIPMENT];
  return loadAvailableEquipment(supabase, user.id);
}
```

- [ ] **Step 2: Build `EquipmentPicker`**

Create `src/components/menu/equipment-picker.tsx` modeled on `meal-types-picker.tsx`:

- Props: `value: EquipmentSelection`, `onChange`, `disabled?`, `ariaLabel?` default `"Доступная техника"`
- Render chips for every `EQUIPMENT_IDS` with `EQUIPMENT_LABELS_RU`
- Lock last selected chip (`selectedCount === 1`)
- `data-component="equipment-picker"`

Export helpers already live in `equipment.ts` (`selectionFromList`, `listFromSelection`).

- [ ] **Step 3: Wire `CreateMenuForm`**

- State: `equipment` selection, default `DEFAULT_EQUIPMENT_SELECTION`
- On mount: `getAvailableEquipmentAction().then((ids) => setEquipment(selectionFromList(ids)))`
- Hidden input: `name="equipment" value={equipmentToCsv(listFromSelection(equipment) ?? DEFAULT_AVAILABLE_EQUIPMENT)}`
- After meal types block, add:

```tsx
<div className="mt-5 text-left">
  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-slot-label">
    Какая техника есть
  </p>
  <EquipmentPicker
    value={equipment}
    onChange={setEquipment}
    disabled={isPending}
  />
  <p className="mb-5 mt-1.5 text-xs text-slot-label">
    Сгенерируем блюда только под выбранную технику
  </p>
</div>
```

Do **not** mention cut/deferred features in copy.

- [ ] **Step 4: Manual smoke**

Run: `npm run lint` (or targeted tsc if used). Open create dialog — chips show stove+oven on; deselecting last chip disabled.

- [ ] **Step 5: Commit**

```bash
git add src/components/menu/equipment-picker.tsx src/components/menu/create-menu-form.tsx src/domain/settings/available-equipment-actions.ts
git commit -m "$(cat <<'EOF'
Add equipment picker to create-menu form.

EOF
)"
```

---

### Task 5: Candidate filter by menu equipment

**Files:**
- Modify: `src/domain/suggestions/candidates.ts`
- Modify: `scripts/verify-equipment-logic.mjs` (optional extra case already covered)
- Modify: `scripts/verify-suggestions-logic.mjs` only if you add a documented filter case there — prefer keeping eligibility in equipment verify script

- [ ] **Step 1: Update `buildCandidates`**

In `candidates.ts`:

1. Select `day_count, available_equipment` from menus.
2. Normalize menu equipment with `normalizeEquipmentList`; if null, treat as `DEFAULT_AVAILABLE_EQUIPMENT`.
3. Extend `fetchAllRecipes` select to include `required_equipment`.
4. Skip recipe when `!recipeFitsAvailableEquipment(recipe.required_equipment, available)`.

```typescript
import {
  DEFAULT_AVAILABLE_EQUIPMENT,
  normalizeEquipmentList,
  recipeFitsAvailableEquipment,
} from "@/domain/menu/equipment";

// menu select:
.select("day_count, available_equipment")

const available =
  normalizeEquipmentList(menu.available_equipment as string[]) ?? [
    ...DEFAULT_AVAILABLE_EQUIPMENT,
  ];

// in loop after fridge-keep:
if (!recipeFitsAvailableEquipment(recipe.required_equipment, available)) {
  continue;
}
```

Update `fetchAllRecipes` types/select: `id, name, fridge_keep_days, plate_role, required_equipment`.

- [ ] **Step 2: Commit**

```bash
git add src/domain/suggestions/candidates.ts
git commit -m "$(cat <<'EOF'
Filter suggestion candidates by menu available equipment.

EOF
)"
```

---

### Task 6: Invent parse + persist `required_equipment`

**Files:**
- Modify: `src/domain/suggestions/invent-recipes.ts`
- Modify: `scripts/verify-suggestions-logic.mjs` **or** extend `scripts/verify-equipment-logic.mjs` with a tiny parse fixture if you extract a pure parse helper — minimum: unit-test eligibility already done; add parser cases in invent file via a small exported `parseRequiredEquipmentField`

- [ ] **Step 1: Extend draft type + parser**

In `invent-recipes.ts`:

```typescript
import {
  normalizeEquipmentList,
  recipeFitsAvailableEquipment,
  type EquipmentId,
} from "@/domain/menu/equipment";

export type InventRecipeDraft = {
  // ...existing fields...
  requiredEquipment: EquipmentId[];
};
```

In `parseInventRecipesJson`, after ingredients validation, parse:

```typescript
const requiredEquipment = normalizeEquipmentList(
  (row.required_equipment ?? row.requiredEquipment) as string[] | undefined,
);
if (!requiredEquipment) return;
```

Include `requiredEquipment` in `out.push({...})`.

- [ ] **Step 2: Persist column**

In `persistInventedRecipe` insert:

```typescript
required_equipment: draft.requiredEquipment,
```

- [ ] **Step 3: Filter invent drafts against available set**

Add:

```typescript
export function filterDraftsByAvailableEquipment(
  drafts: InventRecipeDraft[],
  available: readonly EquipmentId[],
): InventRecipeDraft[] {
  return drafts.filter((d) =>
    recipeFitsAvailableEquipment(d.requiredEquipment, available),
  );
}
```

Call this wherever invent batches are kept before persist (same place near-duplicate / meal-fit filters run). Thread `availableEquipment` into `inventRecipesForUser` options (add field; load from caller).

- [ ] **Step 4: Update INVENT_SYSTEM JSON schema + rules**

In the JSON example object inside `INVENT_SYSTEM`, add:

`"required_equipment":["stove"|"oven"|"air_fryer"|"grill"|"multicooker"|"pressure_cooker"|"microwave",...]`

Add rules bullets:

```
- required_equipment: non-empty array of equipment ids REQUIRED to cook the dish (subset of availableEquipment from the request). Use only: stove, oven, air_fryer, grill, multicooker, pressure_cooker, microwave. Example: pan fry → ["stove"]; bake → ["oven"]; air-fry → ["air_fryer"]. HARD: never invent a dish that needs equipment outside availableEquipment.
- Prefer dishes that use the available set realistically; you need NOT use every available appliance in the batch.
```

In the user/content payload builder for invent, include `availableEquipment: string[]`.

- [ ] **Step 5: Commit**

```bash
git add src/domain/suggestions/invent-recipes.ts
git commit -m "$(cat <<'EOF'
Require and persist recipe required_equipment from invent.

EOF
)"
```

---

### Task 7: Wire equipment through generate, resuggest, invent-for-position

**Files:**
- Modify: `src/domain/suggestions/generate-menu.ts`
- Modify: `src/domain/suggestions/expand-menu-recipes.ts` (if it calls invent)
- Modify: `src/domain/suggestions/resuggest-slot.ts`
- Modify: `src/domain/suggestions/invent-for-position.ts`
- Modify: `src/domain/suggestions/plan-menu-names.ts` and/or `openrouter-generate.ts` — add one HARD line that dishes must be cookable with `availableEquipment` only (pass array in request JSON)

- [ ] **Step 1: generate-menu**

After menu create (or when invent starts), resolve equipment:

```typescript
const equipment =
  normalizeEquipmentList(options.equipment) ?? [
    ...DEFAULT_AVAILABLE_EQUIPMENT,
  ];
```

Pass into invent / expand / name-plan / assign prompts as `availableEquipment: equipment`.

- [ ] **Step 2: resuggest-slot**

Load `available_equipment` with the menu row (or from already-loaded menu). Pass into invent-for-position and any invent batch. `buildCandidates` already reads from DB after Task 5.

- [ ] **Step 3: invent-for-position**

- Add `availableEquipment: readonly EquipmentId[]` to `InventPositionContext` (required).
- Extend `POSITION_MAIN_SYSTEM` / `POSITION_COMPANION_SYSTEM` JSON + rules like Task 6.
- Include `availableEquipment` in the chat user payload.
- After parse: if `!recipeFitsAvailableEquipment(draft.requiredEquipment, context.availableEquipment)` return parse failure.

- [ ] **Step 4: Name-plan / assign prompts**

Add to system or user JSON: `availableEquipment` and a one-line HARD constraint: only propose dishes cookable with that set (library ids already filtered by candidates; this guides invent-adjacent naming).

- [ ] **Step 5: Commit**

```bash
git add src/domain/suggestions/generate-menu.ts src/domain/suggestions/expand-menu-recipes.ts src/domain/suggestions/resuggest-slot.ts src/domain/suggestions/invent-for-position.ts src/domain/suggestions/plan-menu-names.ts src/domain/suggestions/openrouter-generate.ts
git commit -m "$(cat <<'EOF'
Enforce menu equipment across invent, assign, and resuggest.

EOF
)"
```

---

### Task 8: Edit equipment on menu plan screen

**Files:**
- Create: `src/domain/menu/equipment-actions.ts`
- Create: `src/components/menu/menu-equipment-editor.tsx`
- Modify: `src/domain/menu/load-menu.ts`
- Modify: `app/(authenticated)/plan/menu/page.tsx`

- [ ] **Step 1: Load field**

In `load-menu.ts`:

- Add `availableEquipment: EquipmentId[]` to `MenuSkeletonView`
- Select `available_equipment` with menu
- Map via `normalizeEquipmentList(...) ?? [...DEFAULT_AVAILABLE_EQUIPMENT]`

- [ ] **Step 2: Update action**

Create `src/domain/menu/equipment-actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { parseEquipmentCsv } from "@/domain/menu/equipment";
import { upsertAvailableEquipment } from "@/domain/settings/available-equipment";
import { createClient } from "@/lib/supabase/server";

export type UpdateMenuEquipmentState =
  | { ok: true }
  | { ok: false; error: string }
  | null;

export async function updateMenuEquipmentAction(
  _prev: UpdateMenuEquipmentState,
  formData: FormData,
): Promise<UpdateMenuEquipmentState> {
  const menuId = String(formData.get("menuId") ?? "").trim();
  const equipment = parseEquipmentCsv(formData.get("equipment"));
  if (!menuId) return { ok: false, error: "Меню не найдено." };
  if (!equipment) {
    return { ok: false, error: "Выберите хотя бы один вид техники." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Сессия истекла. Войдите снова." };

  const { data, error } = await supabase
    .from("menus")
    .update({ available_equipment: equipment })
    .eq("id", menuId)
    .eq("user_id", user.id)
    .select("id");

  if (error || !data?.length) {
    return { ok: false, error: "Не удалось сохранить технику." };
  }

  await upsertAvailableEquipment(supabase, user.id, equipment);

  revalidatePath("/plan/menu");
  return { ok: true };
}
```

- [ ] **Step 3: Client editor**

Create `src/components/menu/menu-equipment-editor.tsx`:

- Props: `menuId`, `initialEquipment: EquipmentId[]`
- Local selection state from `selectionFromList(initialEquipment)`
- `useActionState(updateMenuEquipmentAction, null)`
- Hidden `menuId` + `equipment` csv
- Label «Техника для этого меню»
- On change of chips: update local state; submit via `formAction` on each toggle **or** a small «Сохранить» button — prefer auto-save on toggle with pending disabled chips (simpler: debounce-free submit on each successful toggle using form requestSubmit)
- Show `state.error` if any
- Do not auto-resuggest slots

Recommended UX: change chips locally; `useEffect` that calls form submit when csv changes (skip first mount), with `isPending` disabling picker.

- [ ] **Step 4: Page wire**

In `app/(authenticated)/plan/menu/page.tsx`, below the intro paragraph and above `DayCardGrid`:

```tsx
<MenuEquipmentEditor
  menuId={menu.id}
  initialEquipment={menu.availableEquipment}
/>
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/menu/equipment-actions.ts src/components/menu/menu-equipment-editor.tsx src/domain/menu/load-menu.ts app/(authenticated)/plan/menu/page.tsx
git commit -m "$(cat <<'EOF'
Allow editing available equipment on an existing menu.

EOF
)"
```

---

### Task 9: Docs + full verify

**Files:**
- Modify: `docs/data-models.md`
- Run verify

- [ ] **Step 1: Update data-models**

In Active Tables / Key Columns:

- `user_settings.available_equipment` — profile default for create picker  
- `menus.available_equipment` — per-menu hard filter snapshot  
- `recipes.required_equipment` — required appliances; ⊆ menu set for eligibility  
- Note RPC: `create_menu_skeleton(..., p_equipment text[] default {stove,oven})`

- [ ] **Step 2: Run verification**

```bash
npm run verify:logic
npm run lint
```

Expected: all verify scripts pass; lint clean on touched files.

If TypeScript build is part of local habit: `npm run build` (optional here if slow; required before PR).

- [ ] **Step 3: Commit**

```bash
git add docs/data-models.md
git commit -m "$(cat <<'EOF'
Document available equipment columns in data models.

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Closed vocabulary + RU labels | 1, 4 |
| Defaults stove+oven | 1, 2, 4 |
| ≥1 selection; stove/oven not privileged | 1, 4, 8 |
| `user_settings` + `menus` + `recipes.required_equipment` | 2, 3, 6 |
| Hard subset filter | 1, 5, 6, 7 |
| Create form picker + copy | 4 |
| Persist profile on create/edit | 3, 8 |
| Menu edit without auto-rebuild | 8 |
| Invent/resuggest/all AI for menu | 6, 7 |
| Backfill seeds | 2 |
| Snacks out of filter | (no snack changes) |
| Error messages | 3, 8 |
| verify script | 1, 9 |

## Self-review notes

- No TBD placeholders in tasks.
- RPC overload: prefer 3-arg SQL wrapper → 4-arg implementation to avoid breaking PostgREST resolution.
- Profile upsert failure must not fail create (Task 3).
- UI copy must not advertise abandoned scope (workspace rule).
