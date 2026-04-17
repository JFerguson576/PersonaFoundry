create extension if not exists pgcrypto;

create table if not exists public.admin_notebook_entries (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid not null references auth.users(id) on delete cascade,
  author_email text,
  title text,
  note text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_notebook_entries_created_idx on public.admin_notebook_entries (created_at desc);
create index if not exists admin_notebook_entries_status_idx on public.admin_notebook_entries (status);
