-- Cross-app experience agent session + message persistence.

create table if not exists public.experience_agent_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module text not null,
  route_path text not null,
  status text not null default 'active' check (status in ('active', 'closed')),
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.experience_agent_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.experience_agent_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_experience_agent_sessions_user_updated
  on public.experience_agent_sessions(user_id, updated_at desc);

create index if not exists idx_experience_agent_messages_session_created
  on public.experience_agent_messages(session_id, created_at asc);

alter table public.experience_agent_sessions enable row level security;
alter table public.experience_agent_messages enable row level security;

drop policy if exists "experience_agent_sessions_select_own" on public.experience_agent_sessions;
create policy "experience_agent_sessions_select_own"
  on public.experience_agent_sessions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "experience_agent_sessions_insert_own" on public.experience_agent_sessions;
create policy "experience_agent_sessions_insert_own"
  on public.experience_agent_sessions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "experience_agent_sessions_update_own" on public.experience_agent_sessions;
create policy "experience_agent_sessions_update_own"
  on public.experience_agent_sessions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "experience_agent_messages_select_own" on public.experience_agent_messages;
create policy "experience_agent_messages_select_own"
  on public.experience_agent_messages
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "experience_agent_messages_insert_own" on public.experience_agent_messages;
create policy "experience_agent_messages_insert_own"
  on public.experience_agent_messages
  for insert
  to authenticated
  with check (auth.uid() = user_id);

