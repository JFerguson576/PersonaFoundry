create table if not exists public.career_live_job_runs (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.career_candidates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  target_role text not null,
  location text,
  market_notes text,
  status text not null default 'queued',
  error_message text,
  result_asset_id uuid references public.career_generated_assets(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists career_live_job_runs_candidate_id_idx
  on public.career_live_job_runs (candidate_id, created_at desc);

create index if not exists career_live_job_runs_user_id_idx
  on public.career_live_job_runs (user_id, created_at desc);

drop trigger if exists set_career_live_job_runs_updated_at on public.career_live_job_runs;
create trigger set_career_live_job_runs_updated_at
before update on public.career_live_job_runs
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.career_live_job_runs enable row level security;

drop policy if exists "career_live_job_runs_select_own" on public.career_live_job_runs;
create policy "career_live_job_runs_select_own"
on public.career_live_job_runs
for select
using (auth.uid() = user_id);

drop policy if exists "career_live_job_runs_insert_own" on public.career_live_job_runs;
create policy "career_live_job_runs_insert_own"
on public.career_live_job_runs
for insert
with check (auth.uid() = user_id);

drop policy if exists "career_live_job_runs_update_own" on public.career_live_job_runs;
create policy "career_live_job_runs_update_own"
on public.career_live_job_runs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "career_live_job_runs_delete_own" on public.career_live_job_runs;
create policy "career_live_job_runs_delete_own"
on public.career_live_job_runs
for delete
using (auth.uid() = user_id);
