create extension if not exists pgcrypto;

create table if not exists public.mkt_recommendations (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null default 'campaign',
  entity_id uuid,
  recommendation_type text not null,
  reason_codes_json jsonb not null default '[]'::jsonb,
  metric_snapshot_json jsonb not null default '{}'::jsonb,
  proposed_change_json jsonb not null default '{}'::jsonb,
  status text not null default 'proposed',
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_by_email text,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  approved_by_email text,
  approved_at timestamptz,
  applied_at timestamptz,
  rejected_at timestamptz,
  rejection_note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists mkt_recommendations_status_idx
  on public.mkt_recommendations (status, created_at desc);

create index if not exists mkt_recommendations_entity_idx
  on public.mkt_recommendations (entity_type, entity_id);

drop trigger if exists set_mkt_recommendations_updated_at on public.mkt_recommendations;
create trigger set_mkt_recommendations_updated_at
before update on public.mkt_recommendations
for each row
execute function public.set_current_timestamp_updated_at();

create table if not exists public.mkt_approvals (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.mkt_recommendations(id) on delete cascade,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  requested_by_email text,
  assigned_to_user_id uuid references auth.users(id) on delete set null,
  assigned_to_email text,
  decision text not null default 'pending',
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists mkt_approvals_recommendation_idx
  on public.mkt_approvals (recommendation_id, created_at desc);

create index if not exists mkt_approvals_decision_idx
  on public.mkt_approvals (decision, created_at desc);

drop trigger if exists set_mkt_approvals_updated_at on public.mkt_approvals;
create trigger set_mkt_approvals_updated_at
before update on public.mkt_approvals
for each row
execute function public.set_current_timestamp_updated_at();

create table if not exists public.mkt_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action_type text not null,
  entity_type text not null,
  entity_id text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists mkt_audit_log_created_idx
  on public.mkt_audit_log (created_at desc);

create index if not exists mkt_audit_log_entity_idx
  on public.mkt_audit_log (entity_type, entity_id, created_at desc);

alter table public.mkt_recommendations enable row level security;
alter table public.mkt_approvals enable row level security;
alter table public.mkt_audit_log enable row level security;

drop policy if exists "mkt_recommendations_no_direct_access" on public.mkt_recommendations;
create policy "mkt_recommendations_no_direct_access"
on public.mkt_recommendations
for all
using (false)
with check (false);

drop policy if exists "mkt_approvals_no_direct_access" on public.mkt_approvals;
create policy "mkt_approvals_no_direct_access"
on public.mkt_approvals
for all
using (false)
with check (false);

drop policy if exists "mkt_audit_log_no_direct_access" on public.mkt_audit_log;
create policy "mkt_audit_log_no_direct_access"
on public.mkt_audit_log
for all
using (false)
with check (false);

