-- Superuser tester outreach history for feedback follow-up campaigns.

create table if not exists public.tester_feedback_outreach (
  id uuid primary key default gen_random_uuid(),
  sent_by_user_id uuid not null references auth.users(id) on delete cascade,
  sent_by_email text,
  audience_status text not null default 'all' check (audience_status in ('all', 'open', 'in_review', 'resolved')),
  audience_module text,
  recipient_count integer not null default 0,
  subject text not null,
  message text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_tester_feedback_outreach_created
  on public.tester_feedback_outreach(created_at desc);

