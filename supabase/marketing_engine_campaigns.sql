create extension if not exists pgcrypto;

create table if not exists public.mkt_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,
  owner_email text,
  name text not null,
  channel text not null default 'manual',
  status text not null default 'draft',
  offer_label text,
  landing_url text,
  daily_budget numeric(12,2) not null default 0,
  targeting_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists mkt_campaigns_status_idx
  on public.mkt_campaigns (status, created_at desc);

create index if not exists mkt_campaigns_channel_idx
  on public.mkt_campaigns (channel, created_at desc);

create index if not exists mkt_campaigns_created_idx
  on public.mkt_campaigns (created_at desc);

drop trigger if exists set_mkt_campaigns_updated_at on public.mkt_campaigns;
create trigger set_mkt_campaigns_updated_at
before update on public.mkt_campaigns
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.mkt_campaigns enable row level security;

drop policy if exists "mkt_campaigns_no_direct_access" on public.mkt_campaigns;
create policy "mkt_campaigns_no_direct_access"
on public.mkt_campaigns
for all
using (false)
with check (false);

