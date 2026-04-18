alter table if exists public.career_premium_autopilot_settings
  add column if not exists auto_research_from_matches boolean not null default true,
  add column if not exists auto_generate_cover_letters boolean not null default true;

create table if not exists public.career_premium_autopilot_review_queue (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.career_candidates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  background_job_id uuid references public.career_background_jobs(id) on delete set null,
  trigger_source text not null default 'scheduled_run',
  target_role text,
  company_name text,
  job_title text,
  location text,
  job_url text,
  live_search_asset_id uuid references public.career_generated_assets(id) on delete set null,
  company_dossier_asset_id uuid references public.career_generated_assets(id) on delete set null,
  cover_letter_asset_id uuid references public.career_generated_assets(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists career_premium_autopilot_review_queue_user_idx
  on public.career_premium_autopilot_review_queue (user_id, created_at desc);

create index if not exists career_premium_autopilot_review_queue_candidate_idx
  on public.career_premium_autopilot_review_queue (candidate_id, created_at desc);

create index if not exists career_premium_autopilot_review_queue_status_idx
  on public.career_premium_autopilot_review_queue (user_id, status, created_at desc);

alter table public.career_premium_autopilot_review_queue enable row level security;

drop policy if exists "career_premium_autopilot_review_queue_select_own" on public.career_premium_autopilot_review_queue;
create policy "career_premium_autopilot_review_queue_select_own"
on public.career_premium_autopilot_review_queue
for select
using (auth.uid() = user_id);

drop policy if exists "career_premium_autopilot_review_queue_insert_own" on public.career_premium_autopilot_review_queue;
create policy "career_premium_autopilot_review_queue_insert_own"
on public.career_premium_autopilot_review_queue
for insert
with check (auth.uid() = user_id);

drop policy if exists "career_premium_autopilot_review_queue_update_own" on public.career_premium_autopilot_review_queue;
create policy "career_premium_autopilot_review_queue_update_own"
on public.career_premium_autopilot_review_queue
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "career_premium_autopilot_review_queue_delete_own" on public.career_premium_autopilot_review_queue;
create policy "career_premium_autopilot_review_queue_delete_own"
on public.career_premium_autopilot_review_queue
for delete
using (auth.uid() = user_id);
