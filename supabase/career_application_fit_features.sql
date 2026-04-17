alter table public.career_applications
  add column if not exists fit_analysis_asset_id uuid references public.career_generated_assets(id) on delete set null;

create index if not exists career_applications_fit_analysis_asset_idx
  on public.career_applications (fit_analysis_asset_id);
