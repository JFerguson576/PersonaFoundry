create table if not exists public.career_background_jobs (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.career_candidates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_type text not null,
  request_payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  result_summary text,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists career_background_jobs_candidate_id_idx
  on public.career_background_jobs (candidate_id, created_at desc);

create index if not exists career_background_jobs_user_id_idx
  on public.career_background_jobs (user_id, created_at desc);

drop trigger if exists set_career_background_jobs_updated_at on public.career_background_jobs;
create trigger set_career_background_jobs_updated_at
before update on public.career_background_jobs
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.career_background_jobs enable row level security;

drop policy if exists "career_background_jobs_select_own" on public.career_background_jobs;
create policy "career_background_jobs_select_own"
on public.career_background_jobs
for select
using (auth.uid() = user_id);

drop policy if exists "career_background_jobs_insert_own" on public.career_background_jobs;
create policy "career_background_jobs_insert_own"
on public.career_background_jobs
for insert
with check (auth.uid() = user_id);

drop policy if exists "career_background_jobs_update_own" on public.career_background_jobs;
create policy "career_background_jobs_update_own"
on public.career_background_jobs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "career_background_jobs_delete_own" on public.career_background_jobs;
create policy "career_background_jobs_delete_own"
on public.career_background_jobs
for delete
using (auth.uid() = user_id);
