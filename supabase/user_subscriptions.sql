-- Per-user subscription and guardrail metadata for unit economics.

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan_code text not null default 'free',
  billing_status text not null default 'active' check (billing_status in ('trial', 'active', 'past_due', 'cancelled')),
  monthly_subscription_usd numeric(10,2) not null default 0 check (monthly_subscription_usd >= 0),
  monthly_api_budget_usd numeric(10,2) check (monthly_api_budget_usd is null or monthly_api_budget_usd >= 0),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_user_subscriptions_billing_status
  on public.user_subscriptions(billing_status);

alter table public.user_subscriptions enable row level security;

drop policy if exists "user_subscriptions_select_own" on public.user_subscriptions;
create policy "user_subscriptions_select_own"
  on public.user_subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

