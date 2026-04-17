create extension if not exists pgcrypto;

create table if not exists public.admin_candidate_health_inbox (
  candidate_id uuid primary key references public.career_candidates(id) on delete cascade,
  reviewed_at timestamptz,
  snoozed_until timestamptz,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_email text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists admin_candidate_health_inbox_snoozed_idx
  on public.admin_candidate_health_inbox (snoozed_until);

create index if not exists admin_candidate_health_inbox_updated_idx
  on public.admin_candidate_health_inbox (updated_at desc);

alter table public.admin_candidate_health_inbox enable row level security;

drop policy if exists "admin_candidate_health_inbox_no_direct_access" on public.admin_candidate_health_inbox;
create policy "admin_candidate_health_inbox_no_direct_access"
on public.admin_candidate_health_inbox
for all
using (false)
with check (false);

