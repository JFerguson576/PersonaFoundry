create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'support', 'superuser')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, role)
);

create index if not exists user_roles_role_idx
  on public.user_roles (role, created_at desc);

create or replace function public.set_user_roles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_user_roles_updated_at on public.user_roles;
create trigger set_user_roles_updated_at
before update on public.user_roles
for each row
execute function public.set_user_roles_updated_at();

alter table public.user_roles enable row level security;

drop policy if exists "user_roles_no_direct_access" on public.user_roles;
create policy "user_roles_no_direct_access"
on public.user_roles
for all
using (false)
with check (false);

create or replace function public.has_platform_role(role_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = role_name
  );
$$;

grant execute on function public.has_platform_role(text) to authenticated;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_platform_role('admin')
    or public.has_platform_role('support')
    or public.has_platform_role('superuser');
$$;

grant execute on function public.is_platform_admin() to authenticated;

create or replace function public.is_platform_superuser()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_platform_role('superuser');
$$;

grant execute on function public.is_platform_superuser() to authenticated;
