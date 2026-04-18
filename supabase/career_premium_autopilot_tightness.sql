alter table if exists public.career_premium_autopilot_settings
  add column if not exists role_match_tightness smallint not null default 60;

alter table if exists public.career_premium_autopilot_settings
  drop constraint if exists career_premium_autopilot_settings_role_match_tightness_check;

alter table if exists public.career_premium_autopilot_settings
  add constraint career_premium_autopilot_settings_role_match_tightness_check
  check (role_match_tightness >= 0 and role_match_tightness <= 100);
