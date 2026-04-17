create table if not exists public.career_applications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.career_candidates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  job_title text not null,
  location text,
  job_url text,
  status text not null default 'targeting',
  notes text,
  next_action text,
  follow_up_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists career_applications_candidate_idx on public.career_applications(candidate_id, created_at desc);
create index if not exists career_applications_user_idx on public.career_applications(user_id, updated_at desc);
create index if not exists career_applications_status_idx on public.career_applications(user_id, status);

drop trigger if exists set_career_applications_updated_at on public.career_applications;
create trigger set_career_applications_updated_at
before update on public.career_applications
for each row execute function public.set_current_timestamp_updated_at();

alter table public.career_applications enable row level security;

drop policy if exists "Users can view their own career applications" on public.career_applications;
create policy "Users can view their own career applications"
on public.career_applications
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own career applications" on public.career_applications;
create policy "Users can insert their own career applications"
on public.career_applications
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own career applications" on public.career_applications;
create policy "Users can update their own career applications"
on public.career_applications
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own career applications" on public.career_applications;
create policy "Users can delete their own career applications"
on public.career_applications
for delete
using (auth.uid() = user_id);
