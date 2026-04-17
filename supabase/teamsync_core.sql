create table if not exists public.teamsync_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_name text not null default 'My Team',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.teamsync_workspaces
  add column if not exists group_name text;

alter table public.teamsync_workspaces
  alter column group_name set default 'My Team';

update public.teamsync_workspaces
set group_name = 'My Team'
where group_name is null or btrim(group_name) = '';

alter table public.teamsync_workspaces
  alter column group_name set not null;

alter table public.teamsync_workspaces
  drop constraint if exists teamsync_workspaces_user_id_key;

drop index if exists teamsync_workspaces_user_id_group_name_key;
create unique index if not exists teamsync_workspaces_user_id_group_name_key
  on public.teamsync_workspaces(user_id, group_name);

create table if not exists public.teamsync_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.teamsync_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  role_title text,
  strengths_text text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.teamsync_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.teamsync_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_title text not null,
  scenario_category text not null default 'Professional',
  pressure_level integer not null default 3,
  result_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists teamsync_workspaces_user_id_idx
  on public.teamsync_workspaces(user_id);

create index if not exists teamsync_members_workspace_created_idx
  on public.teamsync_members(workspace_id, created_at desc);

create index if not exists teamsync_members_user_id_idx
  on public.teamsync_members(user_id, created_at desc);

create index if not exists teamsync_runs_workspace_created_idx
  on public.teamsync_runs(workspace_id, created_at desc);

create index if not exists teamsync_runs_user_id_idx
  on public.teamsync_runs(user_id, created_at desc);

drop trigger if exists set_teamsync_workspaces_updated_at on public.teamsync_workspaces;
create trigger set_teamsync_workspaces_updated_at
before update on public.teamsync_workspaces
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_teamsync_members_updated_at on public.teamsync_members;
create trigger set_teamsync_members_updated_at
before update on public.teamsync_members
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_teamsync_runs_updated_at on public.teamsync_runs;
create trigger set_teamsync_runs_updated_at
before update on public.teamsync_runs
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.teamsync_workspaces enable row level security;
alter table public.teamsync_members enable row level security;
alter table public.teamsync_runs enable row level security;

drop policy if exists "teamsync_workspaces_select_own" on public.teamsync_workspaces;
create policy "teamsync_workspaces_select_own"
on public.teamsync_workspaces
for select
using (auth.uid() = user_id);

drop policy if exists "teamsync_workspaces_insert_own" on public.teamsync_workspaces;
create policy "teamsync_workspaces_insert_own"
on public.teamsync_workspaces
for insert
with check (auth.uid() = user_id);

drop policy if exists "teamsync_workspaces_update_own" on public.teamsync_workspaces;
create policy "teamsync_workspaces_update_own"
on public.teamsync_workspaces
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "teamsync_workspaces_delete_own" on public.teamsync_workspaces;
create policy "teamsync_workspaces_delete_own"
on public.teamsync_workspaces
for delete
using (auth.uid() = user_id);

drop policy if exists "teamsync_members_select_own" on public.teamsync_members;
create policy "teamsync_members_select_own"
on public.teamsync_members
for select
using (auth.uid() = user_id);

drop policy if exists "teamsync_members_insert_own" on public.teamsync_members;
create policy "teamsync_members_insert_own"
on public.teamsync_members
for insert
with check (auth.uid() = user_id);

drop policy if exists "teamsync_members_update_own" on public.teamsync_members;
create policy "teamsync_members_update_own"
on public.teamsync_members
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "teamsync_members_delete_own" on public.teamsync_members;
create policy "teamsync_members_delete_own"
on public.teamsync_members
for delete
using (auth.uid() = user_id);

drop policy if exists "teamsync_runs_select_own" on public.teamsync_runs;
create policy "teamsync_runs_select_own"
on public.teamsync_runs
for select
using (auth.uid() = user_id);

drop policy if exists "teamsync_runs_insert_own" on public.teamsync_runs;
create policy "teamsync_runs_insert_own"
on public.teamsync_runs
for insert
with check (auth.uid() = user_id);

drop policy if exists "teamsync_runs_update_own" on public.teamsync_runs;
create policy "teamsync_runs_update_own"
on public.teamsync_runs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "teamsync_runs_delete_own" on public.teamsync_runs;
create policy "teamsync_runs_delete_own"
on public.teamsync_runs
for delete
using (auth.uid() = user_id);
