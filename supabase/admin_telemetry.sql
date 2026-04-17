create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  module text not null,
  event_type text not null,
  candidate_id uuid references public.career_candidates(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.api_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  module text not null,
  feature text not null,
  provider text not null default 'openai',
  model text not null,
  status text not null,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  estimated_cost_usd numeric(12,6),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists usage_events_user_id_idx
  on public.usage_events (user_id, created_at desc);

create index if not exists usage_events_module_event_idx
  on public.usage_events (module, event_type, created_at desc);

create index if not exists api_usage_logs_user_id_idx
  on public.api_usage_logs (user_id, created_at desc);

create index if not exists api_usage_logs_module_feature_idx
  on public.api_usage_logs (module, feature, created_at desc);

alter table public.usage_events enable row level security;
alter table public.api_usage_logs enable row level security;

drop policy if exists "usage_events_insert_own" on public.usage_events;
create policy "usage_events_insert_own"
on public.usage_events
for insert
with check (user_id is null or auth.uid() = user_id);

drop policy if exists "usage_events_select_own" on public.usage_events;
create policy "usage_events_select_own"
on public.usage_events
for select
using (auth.uid() = user_id);

drop policy if exists "api_usage_logs_insert_own" on public.api_usage_logs;
create policy "api_usage_logs_insert_own"
on public.api_usage_logs
for insert
with check (user_id is null or auth.uid() = user_id);

drop policy if exists "api_usage_logs_select_own" on public.api_usage_logs;
create policy "api_usage_logs_select_own"
on public.api_usage_logs
for select
using (auth.uid() = user_id);
