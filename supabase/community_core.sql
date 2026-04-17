create extension if not exists pgcrypto;

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text,
  post_type text not null check (post_type in ('idea', 'success_story')),
  title text not null,
  summary text,
  body text not null,
  impact_area text,
  status text not null default 'approved' check (status in ('pending', 'approved', 'hidden')),
  is_featured boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text,
  body text not null,
  status text not null default 'approved' check (status in ('approved', 'hidden')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.community_post_votes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (post_id, user_id)
);

create index if not exists community_posts_created_idx
  on public.community_posts(created_at desc);

create index if not exists community_posts_type_created_idx
  on public.community_posts(post_type, created_at desc);

create index if not exists community_posts_status_created_idx
  on public.community_posts(status, created_at desc);

create index if not exists community_comments_post_created_idx
  on public.community_comments(post_id, created_at asc);

create index if not exists community_votes_post_idx
  on public.community_post_votes(post_id);

drop trigger if exists set_community_posts_updated_at on public.community_posts;
create trigger set_community_posts_updated_at
before update on public.community_posts
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_community_comments_updated_at on public.community_comments;
create trigger set_community_comments_updated_at
before update on public.community_comments
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_post_votes enable row level security;

drop policy if exists "community_posts_select_public_or_own" on public.community_posts;
create policy "community_posts_select_public_or_own"
on public.community_posts
for select
using (
  status = 'approved'
  or auth.uid() = user_id
  or exists (
    select 1
    from public.user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.role in ('admin', 'support', 'superuser')
  )
);

drop policy if exists "community_posts_insert_own" on public.community_posts;
create policy "community_posts_insert_own"
on public.community_posts
for insert
with check (auth.uid() = user_id);

drop policy if exists "community_posts_update_own_or_admin" on public.community_posts;
create policy "community_posts_update_own_or_admin"
on public.community_posts
for update
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.role in ('admin', 'support', 'superuser')
  )
)
with check (
  auth.uid() = user_id
  or exists (
    select 1
    from public.user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.role in ('admin', 'support', 'superuser')
  )
);

drop policy if exists "community_comments_select_public_or_own" on public.community_comments;
create policy "community_comments_select_public_or_own"
on public.community_comments
for select
using (
  status = 'approved'
  or auth.uid() = user_id
  or exists (
    select 1
    from public.user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.role in ('admin', 'support', 'superuser')
  )
);

drop policy if exists "community_comments_insert_own" on public.community_comments;
create policy "community_comments_insert_own"
on public.community_comments
for insert
with check (auth.uid() = user_id);

drop policy if exists "community_comments_update_own_or_admin" on public.community_comments;
create policy "community_comments_update_own_or_admin"
on public.community_comments
for update
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.role in ('admin', 'support', 'superuser')
  )
)
with check (
  auth.uid() = user_id
  or exists (
    select 1
    from public.user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.role in ('admin', 'support', 'superuser')
  )
);

drop policy if exists "community_votes_select_all" on public.community_post_votes;
create policy "community_votes_select_all"
on public.community_post_votes
for select
using (true);

drop policy if exists "community_votes_insert_own" on public.community_post_votes;
create policy "community_votes_insert_own"
on public.community_post_votes
for insert
with check (auth.uid() = user_id);

drop policy if exists "community_votes_delete_own" on public.community_post_votes;
create policy "community_votes_delete_own"
on public.community_post_votes
for delete
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.role in ('admin', 'support', 'superuser')
  )
);
