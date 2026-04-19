create extension if not exists pgcrypto;

create table if not exists public.mkt_coach_leads (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,
  owner_email text,
  full_name text not null,
  business_name text,
  email text not null,
  country text,
  segment text not null default 'independent_coach',
  source text not null default 'manual',
  stage text not null default 'identified',
  next_action_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists mkt_coach_leads_stage_idx
  on public.mkt_coach_leads (stage, updated_at desc);

create index if not exists mkt_coach_leads_owner_idx
  on public.mkt_coach_leads (owner_user_id, updated_at desc);

create index if not exists mkt_coach_leads_email_idx
  on public.mkt_coach_leads (email);

drop trigger if exists set_mkt_coach_leads_updated_at on public.mkt_coach_leads;
create trigger set_mkt_coach_leads_updated_at
before update on public.mkt_coach_leads
for each row
execute function public.set_current_timestamp_updated_at();

create table if not exists public.mkt_coach_touchpoints (
  id uuid primary key default gen_random_uuid(),
  coach_lead_id uuid not null references public.mkt_coach_leads(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  channel text not null default 'email',
  touch_type text not null default 'outreach',
  outcome text,
  note text,
  occurred_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists mkt_coach_touchpoints_lead_idx
  on public.mkt_coach_touchpoints (coach_lead_id, occurred_at desc);

create table if not exists public.mkt_coach_templates (
  id uuid primary key default gen_random_uuid(),
  template_name text not null,
  segment text not null default 'independent_coach',
  channel text not null default 'email',
  subject text,
  body text not null,
  active boolean not null default true,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_by_email text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists mkt_coach_templates_segment_idx
  on public.mkt_coach_templates (segment, active, updated_at desc);

drop trigger if exists set_mkt_coach_templates_updated_at on public.mkt_coach_templates;
create trigger set_mkt_coach_templates_updated_at
before update on public.mkt_coach_templates
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.mkt_coach_leads enable row level security;
alter table public.mkt_coach_touchpoints enable row level security;
alter table public.mkt_coach_templates enable row level security;

drop policy if exists "mkt_coach_leads_no_direct_access" on public.mkt_coach_leads;
create policy "mkt_coach_leads_no_direct_access"
on public.mkt_coach_leads
for all
using (false)
with check (false);

drop policy if exists "mkt_coach_touchpoints_no_direct_access" on public.mkt_coach_touchpoints;
create policy "mkt_coach_touchpoints_no_direct_access"
on public.mkt_coach_touchpoints
for all
using (false)
with check (false);

drop policy if exists "mkt_coach_templates_no_direct_access" on public.mkt_coach_templates;
create policy "mkt_coach_templates_no_direct_access"
on public.mkt_coach_templates
for all
using (false)
with check (false);

