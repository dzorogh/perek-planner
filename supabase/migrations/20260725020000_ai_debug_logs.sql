-- Per-user OpenRouter debug log for Settings panel (replaces process memory).

create table if not exists public.ai_debug_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  model text not null,
  duration_ms integer not null check (duration_ms >= 0),
  ok boolean not null,
  error text,
  request_messages jsonb not null default '[]'::jsonb,
  response text
);

comment on table public.ai_debug_logs is
  'Per-operator OpenRouter request/response pairs for Settings debug panel.';

comment on column public.ai_debug_logs.request_messages is
  'JSON array of {role, content} messages sent to OpenRouter.';

create index if not exists ai_debug_logs_user_created_idx
  on public.ai_debug_logs (user_id, created_at desc);

alter table public.ai_debug_logs enable row level security;

create policy "ai_debug_logs_select_own"
  on public.ai_debug_logs for select to authenticated
  using (user_id = auth.uid());

create policy "ai_debug_logs_insert_own"
  on public.ai_debug_logs for insert to authenticated
  with check (user_id = auth.uid());

create policy "ai_debug_logs_delete_own"
  on public.ai_debug_logs for delete to authenticated
  using (user_id = auth.uid());

revoke all on table public.ai_debug_logs from anon, public;
grant select, insert, delete on table public.ai_debug_logs to authenticated;
