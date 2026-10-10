-- ========================================================================
-- TeamTrack: Fix Team Member Visibility & Teammates Listing
-- Migration: 20261010000000_fix_teammate_visibility.sql
-- ========================================================================

-- 1. Robust Security Functions (plpgsql to prevent query inlining & RLS recursion)

create or replace function public.is_member_of_team(target_team_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_member boolean;
begin
  if auth.uid() is null then
    return false;
  end if;
  select exists (
    select 1 from public.team_members
    where team_id = target_team_id and member_id = auth.uid()
  ) into v_is_member;
  return coalesce(v_is_member, false);
end;
$$;

create or replace function public.is_teammate_of(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_teammate boolean;
begin
  if auth.uid() is null or target_user_id is null then
    return false;
  end if;
  if auth.uid() = target_user_id then
    return true;
  end if;
  select exists (
    select 1
    from public.team_members tm1
    join public.team_members tm2 on tm1.team_id = tm2.team_id
    where tm1.member_id = auth.uid() and tm2.member_id = target_user_id
  ) into v_is_teammate;
  return coalesce(v_is_teammate, false);
end;
$$;

create or replace function public.is_mentor_of_team(target_team_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_mentor boolean;
begin
  if auth.uid() is null then
    return false;
  end if;
  select exists (
    select 1 from public.teams
    where id = target_team_id and mentor_id = auth.uid()
  ) into v_is_mentor;
  return coalesce(v_is_mentor, false);
end;
$$;

create or replace function public.mentor_manages_member(target_member_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manages boolean;
begin
  if auth.uid() is null or target_member_id is null then
    return false;
  end if;
  select exists (
    select 1
    from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.member_id = target_member_id and t.mentor_id = auth.uid()
  ) into v_manages;
  return coalesce(v_manages, false);
end;
$$;

-- 2. Update RLS on team_members so teammates can see each other
drop policy if exists "members see their assignment and mentors see owned assignments" on public.team_members;
drop policy if exists "team_members_select_policy" on public.team_members;
create policy "team_members_select_policy"
  on public.team_members for select to authenticated
  using (
    public.is_admin()
    or member_id = auth.uid()
    or public.is_mentor_of_team(team_id)
    or public.is_member_of_team(team_id)
  );

-- 3. Update RLS on profiles so teammates can read each other's basic profile
drop policy if exists "profiles are visible to their owner or supervising mentor" on public.profiles;
drop policy if exists "profiles are visible to authorized users" on public.profiles;
drop policy if exists "profiles_select_policy" on public.profiles;
create policy "profiles_select_policy"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or public.mentor_manages_member(id)
    or public.is_teammate_of(id)
  );

-- 4. Update RLS on member_profiles so teammates can view project roles & technical skills
drop policy if exists "members read their profile and mentors read supervised profiles" on public.member_profiles;
drop policy if exists "members read their profile and teammates/mentors read supervised profiles" on public.member_profiles;
drop policy if exists "member_profiles_select_policy" on public.member_profiles;
create policy "member_profiles_select_policy"
  on public.member_profiles for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or public.mentor_manages_member(user_id)
    or public.is_teammate_of(user_id)
  );

-- 5. Update RLS on team_invitations so team members can see pending teammates
alter table public.team_invitations enable row level security;
grant select on public.team_invitations to authenticated;

drop policy if exists "mentors and admins manage team invitations" on public.team_invitations;
drop policy if exists "team_invitations_select_policy" on public.team_invitations;
create policy "team_invitations_select_policy"
  on public.team_invitations for select to authenticated
  using (
    public.is_admin()
    or public.is_mentor_of_team(team_id)
    or public.is_member_of_team(team_id)
  );

drop policy if exists "team_invitations_write_policy" on public.team_invitations;
create policy "team_invitations_write_policy"
  on public.team_invitations for all to authenticated
  using (public.is_admin() or public.is_mentor_of_team(team_id))
  with check (public.is_admin() or public.is_mentor_of_team(team_id));

-- 6. Dedicated RPC function to fetch all team members cleanly in a single secure query
create or replace function public.get_team_members(p_team_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_auth boolean;
  v_result jsonb;
begin
  -- Caller must be admin, mentor of this team, or member of this team
  v_is_auth := public.is_admin()
    or public.is_mentor_of_team(p_team_id)
    or exists (select 1 from public.team_members where team_id = p_team_id and member_id = auth.uid());

  if not v_is_auth then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(m), '[]'::jsonb) into v_result
  from (
    -- Registered active team members
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

    -- Pending invited team members
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

-- 7. Auto-backfill: If any user with matching email in team_invitations already registered, link them now
do $$
declare
  r record;
begin
  for r in (
    select ti.team_id, p.id as member_id, ti.email
    from public.team_invitations ti
    join public.profiles p on lower(p.email) = lower(ti.email)
  ) loop
    insert into public.team_members (team_id, member_id)
    values (r.team_id, r.member_id)
    on conflict do nothing;

    delete from public.team_invitations
    where team_id = r.team_id and lower(email) = lower(r.email);
  end loop;
end;
$$;
