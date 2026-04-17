create extension if not exists pgcrypto;

create table if not exists public.referral_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_user_id uuid not null references auth.users(id) on delete cascade,
  inviter_email text,
  invitee_email text not null,
  invitee_name text,
  relationship text,
  note text,
  status text not null default 'queued',
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists referral_invites_inviter_user_idx on public.referral_invites (inviter_user_id, created_at desc);
create index if not exists referral_invites_invitee_email_idx on public.referral_invites (invitee_email);

alter table public.referral_invites enable row level security;

drop policy if exists "Users can view own referrals" on public.referral_invites;
create policy "Users can view own referrals"
  on public.referral_invites
  for select
  using (auth.uid() = inviter_user_id);

drop policy if exists "Users can insert own referrals" on public.referral_invites;
create policy "Users can insert own referrals"
  on public.referral_invites
  for insert
  with check (auth.uid() = inviter_user_id);
