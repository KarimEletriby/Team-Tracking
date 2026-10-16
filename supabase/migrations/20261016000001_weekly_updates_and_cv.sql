-- ========================================================================
-- TeamTrack: Weekly Progress Tracking & Member CV
-- Migration: 20261016000001_weekly_updates_and_cv.sql
-- ========================================================================

-- 1. Add week_number column to work_updates
alter table public.work_updates 
  add column if not exists week_number integer;

comment on column public.work_updates.week_number is 'The cohort/sprint week number (e.g. 1, 2, 3...)';

-- 2. Add cv_url column to member_profiles
alter table public.member_profiles 
  add column if not exists cv_url text;

comment on column public.member_profiles.cv_url is 'Direct URL or storage path to member CV / resume';

-- 3. Create index for fast retrieval by week
create index if not exists idx_work_updates_week on public.work_updates (week_number);
