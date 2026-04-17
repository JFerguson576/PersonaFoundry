alter table public.career_applications
  add column if not exists salary_analysis_asset_id uuid references public.career_generated_assets(id) on delete set null;

create index if not exists career_applications_salary_analysis_asset_idx
  on public.career_applications (salary_analysis_asset_id);
