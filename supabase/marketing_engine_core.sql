create extension if not exists pgcrypto;

create table if not exists public.mkt_policy_settings (
  id uuid primary key default gen_random_uuid(),
  updated_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_email text,
  reserve_floor_amount numeric(14,2) not null default 0,
  reinvestment_rate_pct numeric(6,3) not null default 0.30,
  max_weekly_spend numeric(14,2) not null default 0,
  payback_target_days integer not null default 120,
  automation_mode text not null default 'manual',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists mkt_policy_settings_updated_idx
  on public.mkt_policy_settings (updated_at desc);

drop trigger if exists set_mkt_policy_settings_updated_at on public.mkt_policy_settings;
create trigger set_mkt_policy_settings_updated_at
before update on public.mkt_policy_settings
for each row
execute function public.set_current_timestamp_updated_at();

create table if not exists public.mkt_cash_ledger (
  id uuid primary key default gen_random_uuid(),
  entered_by_user_id uuid references auth.users(id) on delete set null,
  entered_by_email text,
  source text not null default 'manual',
  event_type text not null,
  amount numeric(14,2) not null,
  note text,
  occurred_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists mkt_cash_ledger_occurred_idx
  on public.mkt_cash_ledger (occurred_at desc);

create index if not exists mkt_cash_ledger_source_idx
  on public.mkt_cash_ledger (source, event_type);

drop trigger if exists set_mkt_cash_ledger_updated_at on public.mkt_cash_ledger;
create trigger set_mkt_cash_ledger_updated_at
before update on public.mkt_cash_ledger
for each row
execute function public.set_current_timestamp_updated_at();

create table if not exists public.mkt_budget_snapshots (
  id uuid primary key default gen_random_uuid(),
  computed_by_user_id uuid references auth.users(id) on delete set null,
  computed_by_email text,
  week_start date not null,
  collected_cash_7d numeric(14,2) not null default 0,
  cash_on_hand numeric(14,2) not null default 0,
  reserve_floor_amount numeric(14,2) not null default 0,
  safe_budget_weekly numeric(14,2) not null default 0,
  safe_budget_daily numeric(14,2) not null default 0,
  reserve_status text not null default 'healthy',
  formula_inputs jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists mkt_budget_snapshots_computed_idx
  on public.mkt_budget_snapshots (computed_at desc);

create index if not exists mkt_budget_snapshots_week_idx
  on public.mkt_budget_snapshots (week_start desc);

drop trigger if exists set_mkt_budget_snapshots_updated_at on public.mkt_budget_snapshots;
create trigger set_mkt_budget_snapshots_updated_at
before update on public.mkt_budget_snapshots
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.mkt_policy_settings enable row level security;
alter table public.mkt_cash_ledger enable row level security;
alter table public.mkt_budget_snapshots enable row level security;

drop policy if exists "mkt_policy_settings_no_direct_access" on public.mkt_policy_settings;
create policy "mkt_policy_settings_no_direct_access"
on public.mkt_policy_settings
for all
using (false)
with check (false);

drop policy if exists "mkt_cash_ledger_no_direct_access" on public.mkt_cash_ledger;
create policy "mkt_cash_ledger_no_direct_access"
on public.mkt_cash_ledger
for all
using (false)
with check (false);

drop policy if exists "mkt_budget_snapshots_no_direct_access" on public.mkt_budget_snapshots;
create policy "mkt_budget_snapshots_no_direct_access"
on public.mkt_budget_snapshots
for all
using (false)
with check (false);

