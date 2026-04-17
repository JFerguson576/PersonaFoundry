create table if not exists public.career_premium_autopilot_settings (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.career_candidates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  is_enabled boolean not null default false,
  schedule_weekday smallint not null default 1 check (schedule_weekday >= 0 and schedule_weekday <= 6),
  schedule_hour smallint not null default 9 check (schedule_hour >= 0 and schedule_hour <= 23),
  schedule_timezone text not null default 'UTC',
  target_role text,
  location text,
  market_notes text,
  company_name text,
  job_title text,
  job_description text,
  dossier_influence text not null default 'medium',
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (candidate_id, user_id)
);

create index if not exists career_premium_autopilot_user_idx
  on public.career_premium_autopilot_settings (user_id, updated_at desc);

create index if not exists career_premium_autopilot_candidate_idx
  on public.career_premium_autopilot_settings (candidate_id, updated_at desc);

drop trigger if exists set_career_premium_autopilot_updated_at on public.career_premium_autopilot_settings;
create trigger set_career_premium_autopilot_updated_at
before update on public.career_premium_autopilot_settings
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.career_premium_autopilot_settings enable row level security;

drop policy if exists "career_premium_autopilot_select_own" on public.career_premium_autopilot_settings;
create policy "career_premium_autopilot_select_own"
on public.career_premium_autopilot_settings
for select
using (auth.uid() = user_id);

drop policy if exists "career_premium_autopilot_insert_own" on public.career_premium_autopilot_settings;
create policy "career_premium_autopilot_insert_own"
on public.career_premium_autopilot_settings
for insert
with check (auth.uid() = user_id);

drop policy if exists "career_premium_autopilot_update_own" on public.career_premium_autopilot_settings;
create policy "career_premium_autopilot_update_own"
on public.career_premium_autopilot_settings
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "career_premium_autopilot_delete_own" on public.career_premium_autopilot_settings;
create policy "career_premium_autopilot_delete_own"
on public.career_premium_autopilot_settings
for delete
using (auth.uid() = user_id);
