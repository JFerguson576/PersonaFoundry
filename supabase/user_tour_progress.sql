create table if not exists public.user_tour_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module text not null check (module in ('career', 'persona', 'teamsync')),
  tour_version text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, module, tour_version)
);

alter table public.user_tour_progress enable row level security;

drop policy if exists "user_tour_progress_select_own" on public.user_tour_progress;
create policy "user_tour_progress_select_own"
  on public.user_tour_progress
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_tour_progress_insert_own" on public.user_tour_progress;
create policy "user_tour_progress_insert_own"
  on public.user_tour_progress
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_tour_progress_update_own" on public.user_tour_progress;
create policy "user_tour_progress_update_own"
  on public.user_tour_progress
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
