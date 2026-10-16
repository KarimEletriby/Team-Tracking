-- ========================================================================
-- TeamTrack: Add Round Support for Teams
-- Migration: 20261016000000_add_team_round.sql
-- ========================================================================

-- 1. Add round column with default value 2 (per requirement: existing teams are in Round 2)
alter table public.teams 
  add column if not exists round integer not null default 2;

comment on column public.teams.round is 'The competition or cohort round/stage the team belongs to (e.g. 1, 2, 3)';

-- 2. Ensure all existing teams are explicitly set to Round 2
update public.teams 
  set round = 2 
  where round is null or round < 1;

-- 3. Create index for fast filtering by round
create index if not exists idx_teams_round on public.teams (round);
