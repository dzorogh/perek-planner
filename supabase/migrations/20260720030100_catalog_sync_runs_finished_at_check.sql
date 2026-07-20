-- Story 1.4 review: terminal sync runs must always set finished_at.
-- Repair any legacy terminal rows missing finished_at before adding the check.
update public.catalog_sync_runs
set finished_at = coalesce(finished_at, started_at, now())
where status in ('success', 'failed') and finished_at is null;

update public.catalog_sync_runs
set finished_at = null
where status = 'running' and finished_at is not null;

alter table public.catalog_sync_runs
  drop constraint if exists catalog_sync_runs_finished_at_terminal;

alter table public.catalog_sync_runs
  add constraint catalog_sync_runs_finished_at_terminal
  check (
    (status = 'running' and finished_at is null)
    or (status in ('success', 'failed') and finished_at is not null)
  );
