create extension if not exists pgcrypto;

create table if not exists public.career_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  city text,
  primary_goal text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.career_source_documents (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.career_candidates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null,
  title text,
  content_text text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.career_candidate_profiles (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.career_candidates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_version integer not null default 1,
  career_identity text not null,
  market_positioning text not null,
  seniority_level text not null,
  core_strengths jsonb not null default '[]'::jsonb,
  signature_achievements jsonb not null default '[]'::jsonb,
  role_families jsonb not null default '[]'::jsonb,
  skills jsonb not null default '[]'::jsonb,
  risks_or_gaps jsonb not null default '[]'::jsonb,
  recommended_target_roles jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists career_candidates_user_id_idx
  on public.career_candidates (user_id, created_at desc);

create index if not exists career_source_documents_candidate_id_idx
  on public.career_source_documents (candidate_id, created_at desc);

create index if not exists career_source_documents_user_id_idx
  on public.career_source_documents (user_id, created_at desc);

create unique index if not exists career_candidate_profiles_candidate_version_idx
  on public.career_candidate_profiles (candidate_id, profile_version);

create index if not exists career_candidate_profiles_user_id_idx
  on public.career_candidate_profiles (user_id, created_at desc);

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_career_candidates_updated_at on public.career_candidates;
create trigger set_career_candidates_updated_at
before update on public.career_candidates
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_career_source_documents_updated_at on public.career_source_documents;
create trigger set_career_source_documents_updated_at
before update on public.career_source_documents
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.career_candidates enable row level security;
alter table public.career_source_documents enable row level security;
alter table public.career_candidate_profiles enable row level security;

drop policy if exists "career_candidates_select_own" on public.career_candidates;
create policy "career_candidates_select_own"
on public.career_candidates
for select
using (auth.uid() = user_id);

drop policy if exists "career_candidates_insert_own" on public.career_candidates;
create policy "career_candidates_insert_own"
on public.career_candidates
for insert
with check (auth.uid() = user_id);

drop policy if exists "career_candidates_update_own" on public.career_candidates;
create policy "career_candidates_update_own"
on public.career_candidates
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "career_candidates_delete_own" on public.career_candidates;
create policy "career_candidates_delete_own"
on public.career_candidates
for delete
using (auth.uid() = user_id);

drop policy if exists "career_source_documents_select_own" on public.career_source_documents;
create policy "career_source_documents_select_own"
on public.career_source_documents
for select
using (auth.uid() = user_id);

drop policy if exists "career_source_documents_insert_own" on public.career_source_documents;
create policy "career_source_documents_insert_own"
on public.career_source_documents
for insert
with check (auth.uid() = user_id);

drop policy if exists "career_source_documents_update_own" on public.career_source_documents;
create policy "career_source_documents_update_own"
on public.career_source_documents
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "career_source_documents_delete_own" on public.career_source_documents;
create policy "career_source_documents_delete_own"
on public.career_source_documents
for delete
using (auth.uid() = user_id);

drop policy if exists "career_candidate_profiles_select_own" on public.career_candidate_profiles;
create policy "career_candidate_profiles_select_own"
on public.career_candidate_profiles
for select
using (auth.uid() = user_id);

drop policy if exists "career_candidate_profiles_insert_own" on public.career_candidate_profiles;
create policy "career_candidate_profiles_insert_own"
on public.career_candidate_profiles
for insert
with check (auth.uid() = user_id);

drop policy if exists "career_candidate_profiles_update_own" on public.career_candidate_profiles;
create policy "career_candidate_profiles_update_own"
on public.career_candidate_profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "career_candidate_profiles_delete_own" on public.career_candidate_profiles;
create policy "career_candidate_profiles_delete_own"
on public.career_candidate_profiles
for delete
using (auth.uid() = user_id);
