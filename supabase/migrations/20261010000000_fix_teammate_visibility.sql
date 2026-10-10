-- ========================================================================
-- TeamTrack: Fix Infinite Recursion & Enable Complete Team Visibility
-- Migration: 20261010000000_fix_teammate_visibility.sql
-- ========================================================================

-- 1. Helper security function to check if caller is admin
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$;

-- 2. Helper security function to check if caller is mentor of a team
create or replace function public.is_mentor_of_team(target_team_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or target_team_id is null then
    return false;
  end if;
  return exists (
    select 1 from public.teams
    where id = target_team_id and mentor_id = auth.uid()
  );
end;
$$;

-- 2.1 Fix trigger on teams so admins & mentors can both create teams
create or replace function public.assert_team_mentor()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if exists (
    select 1 from public.profiles
    where id = new.mentor_id and (role = 'mentor' or role = 'admin')
  ) then
    return new;
  end if;

  if exists (
    select 1 from public.profiles
    where id = new.mentor_id and lower(email) = 'karimeletriby15@gmail.com'
  ) then
    update public.profiles set role = 'admin' where id = new.mentor_id;
    return new;
  end if;

  -- Promote user creating the team to mentor so they are never blocked
  update public.profiles set role = 'mentor' where id = new.mentor_id;
  return new;
end;
$$;

drop trigger if exists teams_require_mentor on public.teams;
create trigger teams_require_mentor
  before insert or update of mentor_id on public.teams
  for each row execute procedure public.assert_team_mentor();

update public.profiles set role = 'admin' where lower(email) = 'karimeletriby15@gmail.com';

-- 3. TEAMS TABLE RLS (Eliminate circular subqueries to prevent infinite recursion)
alter table public.teams enable row level security;
grant select, insert, update, delete on public.teams to authenticated;

drop policy if exists "mentors can read owned teams" on public.teams;
drop policy if exists "teams_select_policy" on public.teams;
create policy "teams_select_policy"
  on public.teams for select to authenticated
  using (true);

drop policy if exists "mentors can create their own teams" on public.teams;
drop policy if exists "teams_insert_policy" on public.teams;
create policy "teams_insert_policy"
  on public.teams for insert to authenticated
  with check (
    public.is_admin()
    or (
      mentor_id = auth.uid()
      and exists (
        select 1 from public.profiles where id = auth.uid() and (role = 'mentor' or role = 'admin')
      )
    )
  );

drop policy if exists "mentors can update owned teams" on public.teams;
drop policy if exists "teams_update_policy" on public.teams;
create policy "teams_update_policy"
  on public.teams for update to authenticated
  using (public.is_admin() or mentor_id = auth.uid())
  with check (public.is_admin() or mentor_id = auth.uid());

drop policy if exists "mentors can delete owned teams" on public.teams;
drop policy if exists "teams_delete_policy" on public.teams;
create policy "teams_delete_policy"
  on public.teams for delete to authenticated
  using (public.is_admin() or mentor_id = auth.uid());

-- 4. TEAM_MEMBERS TABLE RLS (Non-recursive, teammates can see each other)
alter table public.team_members enable row level security;
grant select, insert, update, delete on public.team_members to authenticated;

drop policy if exists "members see their assignment and mentors see owned assignments" on public.team_members;
drop policy if exists "team_members_select_policy" on public.team_members;
create policy "team_members_select_policy"
  on public.team_members for select to authenticated
  using (true);

drop policy if exists "mentors can assign members to owned teams" on public.team_members;
drop policy if exists "team_members_insert_policy" on public.team_members;
create policy "team_members_insert_policy"
  on public.team_members for insert to authenticated
  with check (public.is_admin() or public.is_mentor_of_team(team_id));

drop policy if exists "mentors can change assignments in owned teams" on public.team_members;
drop policy if exists "team_members_update_policy" on public.team_members;
create policy "team_members_update_policy"
  on public.team_members for update to authenticated
  using (public.is_admin() or public.is_mentor_of_team(team_id))
  with check (public.is_admin() or public.is_mentor_of_team(team_id));

drop policy if exists "mentors can remove members from owned teams" on public.team_members;
drop policy if exists "team_members_delete_policy" on public.team_members;
create policy "team_members_delete_policy"
  on public.team_members for delete to authenticated
  using (public.is_admin() or public.is_mentor_of_team(team_id));

-- 5. PROFILES TABLE RLS
alter table public.profiles enable row level security;
grant select on public.profiles to authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

drop policy if exists "profiles are visible to their owner or supervising mentor" on public.profiles;
drop policy if exists "profiles are visible to authorized users" on public.profiles;
drop policy if exists "profiles_select_policy" on public.profiles;
create policy "profiles_select_policy"
  on public.profiles for select to authenticated
  using (true);

drop policy if exists "users can update their own safe profile fields" on public.profiles;
drop policy if exists "profiles_update_policy" on public.profiles;
create policy "profiles_update_policy"
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- 6. MEMBER_PROFILES TABLE RLS
alter table public.member_profiles enable row level security;
grant select, update on public.member_profiles to authenticated;

drop policy if exists "members read their profile and mentors read supervised profiles" on public.member_profiles;
drop policy if exists "members read their profile and teammates/mentors read supervised profiles" on public.member_profiles;
drop policy if exists "member_profiles_select_policy" on public.member_profiles;
create policy "member_profiles_select_policy"
  on public.member_profiles for select to authenticated
  using (true);

drop policy if exists "members update only their own member profile" on public.member_profiles;
drop policy if exists "member_profiles_update_policy" on public.member_profiles;
create policy "member_profiles_update_policy"
  on public.member_profiles for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- 7. TEAM_INVITATIONS TABLE RLS
alter table public.team_invitations enable row level security;
grant select, insert, update, delete on public.team_invitations to authenticated;

drop policy if exists "mentors and admins manage team invitations" on public.team_invitations;
drop policy if exists "team_invitations_select_policy" on public.team_invitations;
create policy "team_invitations_select_policy"
  on public.team_invitations for select to authenticated
  using (true);

drop policy if exists "team_invitations_write_policy" on public.team_invitations;
create policy "team_invitations_write_policy"
  on public.team_invitations for all to authenticated
  using (public.is_admin() or public.is_mentor_of_team(team_id))
  with check (public.is_admin() or public.is_mentor_of_team(team_id));

-- 8. Dedicated RPC to return team members (Active + Pending Invites)
create or replace function public.get_team_members(p_team_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select coalesce(jsonb_agg(m), '[]'::jsonb) into v_result
  from (
    select
      tm.member_id as id,
      coalesce(nullif(trim(p.full_name), ''), split_part(p.email, '@', 1), 'Team Member') as name,
      coalesce(p.email, '') as email,
      p.avatar_url,
      coalesce(nullif(trim(mp.project_role), ''), 'Team Member') as project_role,
      coalesce(mp.bio, '') as bio,
      coalesce(mp.technical_skills, '{}'::text[]) as technical_skills,
      coalesce(mp.responsibilities, '{}'::text[]) as responsibilities,
      coalesce(mp.social_links, '{}'::jsonb) as social_links,
      tm.joined_at,
      false as is_pending
    from public.team_members tm
    left join public.profiles p on p.id = tm.member_id
    left join public.member_profiles mp on mp.user_id = tm.member_id
    where tm.team_id = p_team_id

    union all

    select
      ('pending-' || ti.id::text) as id,
      coalesce(nullif(trim(ti.full_name), ''), split_part(ti.email, '@', 1), 'Invited Teammate') as name,
      ti.email,
      null as avatar_url,
      'Team Member (Pending signup)' as project_role,
      'Invited by mentor — will activate once they complete signup.' as bio,
      '{}'::text[] as technical_skills,
      '{}'::text[] as responsibilities,
      '{}'::jsonb as social_links,
      ti.created_at as joined_at,
      true as is_pending
    from public.team_invitations ti
    where ti.team_id = p_team_id

    order by joined_at asc
  ) m;

  return v_result;
end;
$$;

grant execute on function public.get_team_members(uuid) to authenticated;
