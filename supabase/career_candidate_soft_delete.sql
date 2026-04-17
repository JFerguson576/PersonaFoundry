alter table public.career_candidates
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists purge_after timestamptz;

create index if not exists career_candidates_deleted_at_idx
  on public.career_candidates (deleted_at, purge_after);
