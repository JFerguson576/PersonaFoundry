create extension if not exists pgcrypto;

create table if not exists public.mkt_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null,
  severity text not null default 'watch',
  message text not null,
  related_entity_type text,
  related_entity_id text,
  status text not null default 'open',
  metadata_json jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_by_email text,
  resolved_by_user_id uuid references auth.users(id) on delete set null,
  resolved_by_email text,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists mkt_alerts_status_idx
  on public.mkt_alerts (status, created_at desc);

create index if not exists mkt_alerts_severity_idx
  on public.mkt_alerts (severity, created_at desc);

create index if not exists mkt_alerts_entity_idx
  on public.mkt_alerts (related_entity_type, related_entity_id);

drop trigger if exists set_mkt_alerts_updated_at on public.mkt_alerts;
create trigger set_mkt_alerts_updated_at
before update on public.mkt_alerts
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.mkt_alerts enable row level security;

drop policy if exists "mkt_alerts_no_direct_access" on public.mkt_alerts;
create policy "mkt_alerts_no_direct_access"
on public.mkt_alerts
for all
using (false)
with check (false);

