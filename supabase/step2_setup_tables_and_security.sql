-- ========================================================================
-- STEP 2: Create Tables, RLS Policies, and Triggers
-- Run this after Step 1 has completed successfully.
-- ========================================================================

-- 1. Create tables for pending invitations
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

create index if not exists mentor_invitations_email_idx on public.mentor_invitations (lower(email));
create index if not exists team_invitations_email_idx on public.team_invitations (lower(email));

-- 2. Security Helper Functions for RLS
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

create or replace function public.is_mentor_of_team(target_team_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.teams
    where id = target_team_id and mentor_id = auth.uid()
  );
$$;

-- 3. Pre-registration Eligibility Check RPC
create or replace function public.check_registration_eligibility(p_email text, p_role text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  clean_email text := lower(trim(p_email));
begin
  -- Primary Admin check
  if clean_email = 'karimeletriby15@gmail.com' then
    return jsonb_build_object('allowed', true, 'role', 'admin');
  end if;

  -- Admin role registration is strictly forbidden for anyone else
  if p_role = 'admin' then
    if exists (select 1 from public.profiles where lower(email) = clean_email and role = 'admin') then
      return jsonb_build_object('allowed', true, 'role', 'admin');
    else
      return jsonb_build_object('allowed', false, 'message', 'This email is not authorized for administrator access.');
    end if;
  end if;

  -- Mentor check: Must be pre-approved by Admin in mentor_invitations
  if p_role = 'mentor' then
    if exists (select 1 from public.mentor_invitations where lower(email) = clean_email)
       or exists (select 1 from public.profiles where lower(email) = clean_email and (role = 'mentor' or role = 'admin')) then
      return jsonb_build_object('allowed', true, 'role', 'mentor');
    else
      return jsonb_build_object('allowed', false, 'message', 'This email is not authorized as a mentor. Please contact the administrator for access.');
    end if;
  end if;

  -- Member check: Must be pre-added to a team by a Mentor in team_invitations or team_members
  if p_role = 'member' then
    if exists (select 1 from public.team_invitations where lower(email) = clean_email)
       or exists (
         select 1 from public.team_members tm
         join public.profiles p on p.id = tm.member_id
         where lower(p.email) = clean_email
       ) then
      return jsonb_build_object('allowed', true, 'role', 'member');
    else
      return jsonb_build_object('allowed', false, 'message', 'This email is not assigned to any team. Your mentor must add you to a team first.');
    end if;
  end if;

  return jsonb_build_object('allowed', false, 'message', 'Invalid role requested.');
end;
$$;

grant execute on function public.check_registration_eligibility(text, text) to anon, authenticated;

-- 4. Strict Trigger on auth.users: Rejects ANY uninvited registration
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  clean_email text := lower(coalesce(new.email, ''));
  assigned_role public.app_role;
  invited_record record;
  has_team_invite boolean := false;
  has_mentor_invite boolean := false;
begin
  -- 1. Primary Admin
  if clean_email = 'karimeletriby15@gmail.com' then
    assigned_role := 'admin'::public.app_role;

  -- 2. Approved Mentor
  elsif exists (select 1 from public.mentor_invitations where lower(email) = clean_email) then
    assigned_role := 'mentor'::public.app_role;
    has_mentor_invite := true;

  -- 3. Invited Member
  elsif exists (select 1 from public.team_invitations where lower(email) = clean_email) then
    assigned_role := 'member'::public.app_role;
    has_team_invite := true;

  -- 4. Existing account in profiles
  elsif exists (select 1 from public.profiles where id = new.id) then
    return new;

  -- 5. Reject unauthorized registrations
  else
    raise exception 'Unauthorized registration: this email is not invited or authorized on the platform.';
  end if;

  insert into public.profiles (id, full_name, email, avatar_url, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), ''),
    clean_email,
    nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), ''),
    assigned_role
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = case when excluded.full_name <> '' then excluded.full_name else profiles.full_name end,
    role = case
      when clean_email = 'karimeletriby15@gmail.com' then 'admin'::public.app_role
      else profiles.role
    end;

  if has_mentor_invite then
    delete from public.mentor_invitations where lower(email) = clean_email;
  end if;

  if has_team_invite then
    for invited_record in (select team_id from public.team_invitations where lower(email) = clean_email) loop
      insert into public.team_members (team_id, member_id)
      values (invited_record.team_id, new.id)
      on conflict do nothing;
    end loop;
    delete from public.team_invitations where lower(email) = clean_email;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. RLS Permissions & Policies
alter table public.mentor_invitations enable row level security;
grant select, insert, update, delete on public.mentor_invitations to authenticated;

drop policy if exists "admins manage mentor invitations" on public.mentor_invitations;
create policy "admins manage mentor invitations"
  on public.mentor_invitations for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.team_invitations enable row level security;
grant select, insert, update, delete on public.team_invitations to authenticated;

drop policy if exists "mentors and admins manage team invitations" on public.team_invitations;
create policy "mentors and admins manage team invitations"
  on public.team_invitations for all to authenticated
  using (public.is_admin() or public.is_mentor_of_team(team_id))
  with check (public.is_admin() or public.is_mentor_of_team(team_id));

-- Teammates can view each other's profile and member_profiles
drop policy if exists "teammates can view each other's profiles" on public.profiles;
create policy "teammates can view each other's profiles"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or public.is_teammate_of(id)
    or exists (
      select 1 from public.teams t
      join public.team_members tm on tm.team_id = t.id
      where t.mentor_id = auth.uid() and tm.member_id = public.profiles.id
    )
  );

drop policy if exists "teammates can view each other's member_profiles" on public.member_profiles;
create policy "teammates can view each other's member_profiles"
  on public.member_profiles for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or public.is_teammate_of(user_id)
    or exists (
      select 1 from public.teams t
      join public.team_members tm on tm.team_id = t.id
      where t.mentor_id = auth.uid() and tm.member_id = public.member_profiles.user_id
    )
  );

-- 6. Ensure Karim Eletriby is primary administrator
update public.profiles
set role = 'admin'
where lower(email) = 'karimeletriby15@gmail.com';
