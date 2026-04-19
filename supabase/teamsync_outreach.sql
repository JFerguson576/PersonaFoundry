create extension if not exists pgcrypto;

create table if not exists public.teamsync_outreach_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  user_email text not null,
  user_name text,
  segment text not null default 'teamsync_user',
  source text not null default 'usage_events',
  status text not null default 'queued',
  last_teamsync_event_at timestamptz,
  last_contacted_at timestamptz,
  next_action_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists teamsync_outreach_queue_status_idx
  on public.teamsync_outreach_queue (status, updated_at desc);

create index if not exists teamsync_outreach_queue_segment_idx
  on public.teamsync_outreach_queue (segment, updated_at desc);

drop trigger if exists set_teamsync_outreach_queue_updated_at on public.teamsync_outreach_queue;
create trigger set_teamsync_outreach_queue_updated_at
before update on public.teamsync_outreach_queue
for each row
execute function public.set_current_timestamp_updated_at();

create table if not exists public.teamsync_outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_by_email text,
  audience_status text not null default 'queued',
  audience_segment text not null default 'all',
  support_name text,
  calendly_url text,
  subject text not null,
  message text not null,
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  status text not null default 'draft',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.teamsync_outreach_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.teamsync_outreach_campaigns(id) on delete set null,
  queue_id uuid references public.teamsync_outreach_queue(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  event_type text not null default 'email_sent',
  status text not null default 'success',
  provider_message text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists teamsync_outreach_events_campaign_idx
  on public.teamsync_outreach_events (campaign_id, created_at desc);

alter table public.teamsync_outreach_queue enable row level security;
alter table public.teamsync_outreach_campaigns enable row level security;
alter table public.teamsync_outreach_events enable row level security;

drop policy if exists "teamsync_outreach_queue_no_direct_access" on public.teamsync_outreach_queue;
create policy "teamsync_outreach_queue_no_direct_access"
on public.teamsync_outreach_queue
for all
using (false)
with check (false);

drop policy if exists "teamsync_outreach_campaigns_no_direct_access" on public.teamsync_outreach_campaigns;
create policy "teamsync_outreach_campaigns_no_direct_access"
on public.teamsync_outreach_campaigns
for all
using (false)
with check (false);

drop policy if exists "teamsync_outreach_events_no_direct_access" on public.teamsync_outreach_events;
create policy "teamsync_outreach_events_no_direct_access"
on public.teamsync_outreach_events
for all
using (false)
with check (false);
