-- TeamSync multi-group upgrade
-- Run this once in Supabase SQL editor on existing projects.

alter table public.teamsync_workspaces
  drop constraint if exists teamsync_workspaces_user_id_key;

alter table public.teamsync_workspaces
  add column if not exists group_name text;

alter table public.teamsync_workspaces
  alter column group_name set default 'My Team';

update public.teamsync_workspaces
set group_name = 'My Team'
where group_name is null or btrim(group_name) = '';

alter table public.teamsync_workspaces
  alter column group_name set not null;

drop index if exists teamsync_workspaces_user_id_group_name_key;
create unique index if not exists teamsync_workspaces_user_id_group_name_key
  on public.teamsync_workspaces(user_id, group_name);
