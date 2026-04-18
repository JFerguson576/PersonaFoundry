-- Tester feedback notes:
-- Floating in-app notes for bugs/improvements with route/location capture.

create table if not exists public.tester_feedback_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  note_type text not null check (note_type in ('bug', 'improvement', 'question')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'in_review', 'resolved')),
  message text not null,
  module text not null,
  route_path text not null,
  full_url text,
  section_anchor text,
  page_title text,
  viewport_width integer,
  viewport_height integer,
  browser_tz text,
  metadata jsonb not null default '{}'::jsonb,
  admin_note text,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_by_email text,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_tester_feedback_notes_user_id
  on public.tester_feedback_notes(user_id);

create index if not exists idx_tester_feedback_notes_status_created
  on public.tester_feedback_notes(status, created_at desc);

create index if not exists idx_tester_feedback_notes_module_created
  on public.tester_feedback_notes(module, created_at desc);

alter table public.tester_feedback_notes enable row level security;

drop policy if exists "tester_feedback_select_own" on public.tester_feedback_notes;
create policy "tester_feedback_select_own"
  on public.tester_feedback_notes
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "tester_feedback_insert_own" on public.tester_feedback_notes;
create policy "tester_feedback_insert_own"
  on public.tester_feedback_notes
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "tester_feedback_update_own" on public.tester_feedback_notes;
create policy "tester_feedback_update_own"
  on public.tester_feedback_notes
  for update
  to authenticated
  using (auth.uid() = user_id and status in ('open', 'in_review'))
  with check (auth.uid() = user_id);

