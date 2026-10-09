-- ========================================================================
-- TeamTrack: Admin Role, Teammate Profile Visibility & Auto-linking
-- Migration: 20261009000000_admin_and_teammates.sql
-- ========================================================================

-- 1. Extend app_role enum to include 'admin'
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('member', 'mentor', 'admin');
  else
    alter type public.app_role add value if not exists 'admin';
  end if;
end;
$$;

-- 2. Create tables for pending invitations and pre-approved mentors
create table if not exists public.mentor_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  created_at timestamptz not null default now(),
  unique (team_id, email)
);

-- Index for fast lookup by email
create index if not exists mentor_invitations_email_idx on public.mentor_invitations (lower(email));
create index if not exists team_invitations_email_idx on public.team_invitations (lower(email));

-- 3. Helper Security Functions for RLS
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_teammate_of(target_user_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm1
    join public.team_members tm2 on tm1.team_id = tm2.team_id
    where tm1.member_id = auth.uid() and tm2.member_id = target_user_id
  );
$$;

create or replace function public.is_member_of_team(target_team_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_id = target_team_id and member_id = auth.uid()
  );
$$;

-- 4. Update handle_new_user trigger to recognize Karim Eletriby as Admin and auto-link teammates
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  assigned_role public.app_role;
  invited_record record;
begin
  -- 1. Check if this is the primary Admin (Karim Eletriby):
  if lower(coalesce(new.email, '')) = 'karimeletriby15@gmail.com' then
    assigned_role := 'admin'::public.app_role;
  -- 2. Check if this email was pre-approved as a mentor by the admin:
  elsif exists (select 1 from public.mentor_invitations where lower(email) = lower(coalesce(new.email, ''))) then
    assigned_role := 'mentor'::public.app_role;
  -- 3. If requested role was mentor, allow if permitted or requested:
  elsif new.raw_user_meta_data ->> 'requested_role' = 'mentor' then
    assigned_role := 'mentor'::public.app_role;
  else
    assigned_role := 'member'::public.app_role;
  end if;

  insert into public.profiles (id, full_name, email, avatar_url, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), ''),
    lower(coalesce(new.email, '')),
    nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), ''),
    assigned_role
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = case when excluded.full_name <> '' then excluded.full_name else profiles.full_name end,
    role = case
      when lower(coalesce(new.email, '')) = 'karimeletriby15@gmail.com' then 'admin'::public.app_role
      else profiles.role
    end;

  -- Clean up mentor invitation if it existed
  delete from public.mentor_invitations where lower(email) = lower(coalesce(new.email, ''));

  -- Auto-link member to all teams they were invited to:
  for invited_record in (select team_id from public.team_invitations where lower(email) = lower(coalesce(new.email, ''))) loop
    insert into public.team_members (team_id, member_id)
    values (invited_record.team_id, new.id)
    on conflict do nothing;
  end loop;

  -- Clean up team invitation
  delete from public.team_invitations where lower(email) = lower(coalesce(new.email, ''));

  return new;
end;
$$;

-- Upgrade Karim Eletriby to admin if already exists in profiles
update public.profiles
set role = 'admin'
where lower(email) = 'karimeletriby15@gmail.com';

-- 5. Updated RLS Policies

-- PROFILES
drop policy if exists "profiles are visible to their owner or supervising mentor" on public.profiles;
drop policy if exists "profiles are visible to authorized users" on public.profiles;
create policy "profiles are visible to authorized users"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or public.mentor_manages_member(id)
    or public.is_teammate_of(id)
  );

drop policy if exists "users can update their own safe profile fields" on public.profiles;
create policy "users can update their own safe profile fields"
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- MEMBER PROFILES
drop policy if exists "members read their profile and mentors read supervised profiles" on public.member_profiles;
drop policy if exists "members read their profile and teammates/mentors read supervised profiles" on public.member_profiles;
create policy "members read their profile and teammates/mentors read supervised profiles"
  on public.member_profiles for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or public.mentor_manages_member(user_id)
    or public.is_teammate_of(user_id)
  );

drop policy if exists "members update only their own member profile" on public.member_profiles;
create policy "members update only their own member profile"
  on public.member_profiles for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- TEAMS
drop policy if exists "mentors can read owned teams" on public.teams;
create policy "mentors can read owned teams"
  on public.teams for select to authenticated
  using (
    public.is_admin()
    or mentor_id = auth.uid()
    or exists (
      select 1 from public.team_members membership
      where membership.team_id = id and membership.member_id = auth.uid()
    )
  );

drop policy if exists "mentors can create their own teams" on public.teams;
create policy "mentors can create their own teams"
  on public.teams for insert to authenticated
  with check (
    public.is_admin()
    or (mentor_id = auth.uid() and exists (
      select 1 from public.profiles where id = auth.uid() and (role = 'mentor' or role = 'admin')
    ))
  );

drop policy if exists "mentors can update owned teams" on public.teams;
create policy "mentors can update owned teams"
  on public.teams for update to authenticated
  using (public.is_admin() or mentor_id = auth.uid())
  with check (public.is_admin() or mentor_id = auth.uid());

drop policy if exists "mentors can delete owned teams" on public.teams;
create policy "mentors can delete owned teams"
  on public.teams for delete to authenticated
  using (public.is_admin() or mentor_id = auth.uid());

-- TEAM MEMBERS
drop policy if exists "members see their assignment and mentors see owned assignments" on public.team_members;
create policy "members see their assignment and mentors see owned assignments"
  on public.team_members for select to authenticated
  using (
    public.is_admin()
    or member_id = auth.uid()
    or public.is_mentor_of_team(team_id)
    or public.is_member_of_team(team_id)
  );

drop policy if exists "mentors can assign members to owned teams" on public.team_members;
create policy "mentors can assign members to owned teams"
  on public.team_members for insert to authenticated
  with check (public.is_admin() or public.is_mentor_of_team(team_id));

drop policy if exists "mentors can change assignments in owned teams" on public.team_members;
create policy "mentors can change assignments in owned teams"
  on public.team_members for update to authenticated
  using (public.is_admin() or public.is_mentor_of_team(team_id))
  with check (public.is_admin() or public.is_mentor_of_team(team_id));

drop policy if exists "mentors can remove members from owned teams" on public.team_members;
create policy "mentors can remove members from owned teams"
  on public.team_members for delete to authenticated
  using (public.is_admin() or public.is_mentor_of_team(team_id));

-- TEAM INVITATIONS RLS
alter table public.team_invitations enable row level security;
grant select, insert, delete on public.team_invitations to authenticated;

drop policy if exists "mentors and admins manage team invitations" on public.team_invitations;
create policy "mentors and admins manage team invitations"
  on public.team_invitations for all to authenticated
  using (public.is_admin() or public.is_mentor_of_team(team_id))
  with check (public.is_admin() or public.is_mentor_of_team(team_id));

-- MENTOR INVITATIONS RLS
alter table public.mentor_invitations enable row level security;
grant select, insert, delete on public.mentor_invitations to authenticated;

drop policy if exists "admins manage mentor invitations" on public.mentor_invitations;
create policy "admins manage mentor invitations"
  on public.mentor_invitations for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
