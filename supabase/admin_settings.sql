create table if not exists public.admin_settings (
  key text primary key,
  value_json jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists admin_settings_updated_at_idx
  on public.admin_settings (updated_at desc);

alter table public.admin_settings enable row level security;

drop policy if exists "admin_settings_no_direct_access" on public.admin_settings;
create policy "admin_settings_no_direct_access"
on public.admin_settings
for all
using (false)
with check (false);
