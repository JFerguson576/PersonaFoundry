alter table public.career_applications
  add column if not exists cover_letter_asset_id uuid references public.career_generated_assets(id) on delete set null,
  add column if not exists company_dossier_asset_id uuid references public.career_generated_assets(id) on delete set null;

create index if not exists career_applications_cover_letter_asset_idx
  on public.career_applications (cover_letter_asset_id);

create index if not exists career_applications_company_dossier_asset_idx
  on public.career_applications (company_dossier_asset_id);
