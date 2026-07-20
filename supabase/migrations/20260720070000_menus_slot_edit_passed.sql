-- Story 2.4: UJ-1 gate — operator must pass slot edit before Shopping list (FR23).

alter table public.menus
  add column if not exists slot_edit_passed_at timestamptz null;

comment on column public.menus.slot_edit_passed_at is
  'Set when operator continues from Menu slot edit to Portion plan (UJ-1 / FR23). Null = Shopping list blocked.';
