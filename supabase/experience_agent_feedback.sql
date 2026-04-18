-- Feedback signals for agent reply quality.

create table if not exists public.experience_agent_feedback (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.experience_agent_sessions(id) on delete cascade,
  message_id uuid references public.experience_agent_messages(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating text not null check (rating in ('up', 'down')),
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_experience_agent_feedback_session_created
  on public.experience_agent_feedback(session_id, created_at desc);

alter table public.experience_agent_feedback enable row level security;

drop policy if exists "experience_agent_feedback_select_own" on public.experience_agent_feedback;
create policy "experience_agent_feedback_select_own"
  on public.experience_agent_feedback
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "experience_agent_feedback_insert_own" on public.experience_agent_feedback;
create policy "experience_agent_feedback_insert_own"
  on public.experience_agent_feedback
  for insert
  to authenticated
  with check (auth.uid() = user_id);

