create table if not exists public.career_generated_assets (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.career_candidates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_type text not null,
  version integer not null default 1,
  title text not null,
  content text not null,
  source_profile_id uuid references public.career_candidate_profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists career_generated_assets_candidate_type_version_idx
  on public.career_generated_assets (candidate_id, asset_type, version);

create index if not exists career_generated_assets_user_id_idx
  on public.career_generated_assets (user_id, created_at desc);

alter table public.career_generated_assets enable row level security;

drop policy if exists "career_generated_assets_select_own" on public.career_generated_assets;
create policy "career_generated_assets_select_own"
on public.career_generated_assets
for select
using (auth.uid() = user_id);

drop policy if exists "career_generated_assets_insert_own" on public.career_generated_assets;
create policy "career_generated_assets_insert_own"
on public.career_generated_assets
for insert
with check (auth.uid() = user_id);

drop policy if exists "career_generated_assets_update_own" on public.career_generated_assets;
create policy "career_generated_assets_update_own"
on public.career_generated_assets
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "career_generated_assets_delete_own" on public.career_generated_assets;
create policy "career_generated_assets_delete_own"
on public.career_generated_assets
for delete
using (auth.uid() = user_id);
