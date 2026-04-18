create table if not exists public.user_access_levels (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_level text not null check (access_level in ('viewer', 'editor', 'manager')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists user_access_levels_level_idx
  on public.user_access_levels (access_level, updated_at desc);

create or replace function public.set_user_access_levels_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_user_access_levels_updated_at on public.user_access_levels;
create trigger set_user_access_levels_updated_at
before update on public.user_access_levels
for each row
execute function public.set_user_access_levels_updated_at();

alter table public.user_access_levels enable row level security;

drop policy if exists "user_access_levels_no_direct_access" on public.user_access_levels;
create policy "user_access_levels_no_direct_access"
on public.user_access_levels
for all
using (false)
with check (false);
