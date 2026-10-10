-- ========================================================================
-- TeamTrack: Complete Production Database Schema & Security Migration
-- Run this in your Supabase Dashboard -> SQL Editor (New query -> Run)
-- Project: https://lcvujdwjcbkimfkwbhmd.supabase.co
-- ========================================================================

create extension if not exists pgcrypto;

-- 1. Custom Types
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('member', 'mentor', 'admin');
  else
    alter type public.app_role add value if not exists 'admin';
  end if;
  if not exists (select 1 from pg_type where typname = 'attachment_kind') then
    create type public.attachment_kind as enum ('link', 'file');
  end if;
end;
$$;

-- 2. Tables
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  avatar_url text,
  role public.app_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles (id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 120),
  project_name text not null default '' check (char_length(project_name) <= 160),
  project_goal text not null default '' check (char_length(project_goal) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (team_id, member_id),
  unique (member_id)
);

create table if not exists public.member_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  project_role text not null default '' check (char_length(project_role) <= 120),
  bio text not null default '' check (char_length(bio) <= 3000),
  technical_skills text[] not null default '{}',
  responsibilities text[] not null default '{}',
  social_links jsonb not null default '{}'::jsonb check (jsonb_typeof(social_links) = 'object'),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_updates (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 180),
  what_worked_on text not null check (char_length(trim(what_worked_on)) between 1 and 5000),
  technical_contribution text not null check (char_length(trim(technical_contribution)) between 1 and 5000),
  challenges text,
  next_step text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.update_attachments (
  id uuid primary key default gen_random_uuid(),
  update_id uuid not null references public.work_updates (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  kind public.attachment_kind not null,
  label text not null default '' check (char_length(label) <= 255),
  external_url text,
  storage_path text,
  original_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  constraint update_attachments_source_check check (
    (kind = 'link' and external_url is not null and storage_path is null)
    or
    (kind = 'file' and storage_path is not null and external_url is null)
  ),
  constraint update_attachments_file_size_check check (
    size_bytes is null or size_bytes between 0 and 26214400
  )
);

-- 3. Indices
create index if not exists team_members_member_id_idx on public.team_members (member_id);
create index if not exists teams_mentor_id_idx on public.teams (mentor_id);
create index if not exists work_updates_member_created_idx on public.work_updates (member_id, created_at desc);
create index if not exists work_updates_team_created_idx on public.work_updates (team_id, created_at desc);
create index if not exists update_attachments_update_id_idx on public.update_attachments (update_id);
create unique index if not exists update_attachments_storage_path_key
  on public.update_attachments (storage_path)
  where storage_path is not null;
create unique index if not exists profiles_email_unique
  on public.profiles (lower(email))
  where email <> '';

-- 4. Helper Functions for URL validation
create or replace function public.is_safe_http_url(value text)
returns boolean
language sql
immutable
as $$
  select value ~* '^https?://[^[:space:]]+$';
$$;

create or replace function public.has_valid_social_links(links jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(links) = 'object'
    and not exists (
      select 1
      from jsonb_each(links) as entry(key, value)
      where entry.key not in ('linkedIn', 'github', 'portfolio')
        or jsonb_typeof(entry.value) <> 'string'
        or not public.is_safe_http_url(entry.value #>> '{}')
    );
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'member_profiles_social_links_safe'
      and conrelid = 'public.member_profiles'::regclass
  ) then
    alter table public.member_profiles
      add constraint member_profiles_social_links_safe
      check (public.has_valid_social_links(social_links));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'update_attachments_external_url_safe'
      and conrelid = 'public.update_attachments'::regclass
  ) then
    alter table public.update_attachments
      add constraint update_attachments_external_url_safe
      check (kind <> 'link' or public.is_safe_http_url(external_url));
  end if;
end;
$$;

-- 5. User Creation & Timestamp Triggers
-- (handle_new_user is defined in Section 12 with strict invitation-only verification)

create or replace function public.handle_member_profile_created()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role = 'member' then
    insert into public.member_profiles (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_member_profile_created on public.profiles;
create trigger on_member_profile_created
  after insert on public.profiles
  for each row execute procedure public.handle_member_profile_created();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists teams_set_updated_at on public.teams;
create trigger teams_set_updated_at
  before update on public.teams
  for each row execute procedure public.set_updated_at();

drop trigger if exists member_profiles_set_updated_at on public.member_profiles;
create trigger member_profiles_set_updated_at
  before update on public.member_profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists work_updates_set_updated_at on public.work_updates;
create trigger work_updates_set_updated_at
  before update on public.work_updates
  for each row execute procedure public.set_updated_at();

-- 6. Invariant Assertion Triggers
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

  update public.profiles set role = 'mentor' where id = new.mentor_id;
  return new;
end;
$$;

drop trigger if exists teams_require_mentor on public.teams;
create trigger teams_require_mentor
  before insert or update of mentor_id on public.teams
  for each row execute procedure public.assert_team_mentor();

create or replace function public.assert_team_member_is_member()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles profile
    where profile.id = new.member_id and profile.role = 'member'
  ) then
    raise exception 'Only member profiles can be assigned to a team';
  end if;
  return new;
end;
$$;

drop trigger if exists team_members_require_member on public.team_members;
create trigger team_members_require_member
  before insert or update of member_id on public.team_members
  for each row execute procedure public.assert_team_member_is_member();

create or replace function public.assert_update_membership()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.team_members membership
    where membership.team_id = new.team_id and membership.member_id = new.member_id
  ) then
    raise exception 'A work update must belong to the member''s assigned team';
  end if;
  return new;
end;
$$;

drop trigger if exists work_updates_require_membership on public.work_updates;
create trigger work_updates_require_membership
  before insert or update of member_id, team_id on public.work_updates
  for each row execute procedure public.assert_update_membership();

create or replace function public.assert_attachment_owner()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  update_owner uuid;
begin
  select member_id into update_owner from public.work_updates where id = new.update_id;

  if update_owner is null or update_owner <> new.uploaded_by then
    raise exception 'Only the update owner can attach evidence';
  end if;

  if new.kind = 'file'
    and new.storage_path not like new.uploaded_by::text || '/' || new.update_id::text || '/%' then
    raise exception 'Evidence files must use the member/update storage path';
  end if;
  return new;
end;
$$;

drop trigger if exists update_attachments_require_owner on public.update_attachments;
create trigger update_attachments_require_owner
  before insert or update of update_id, uploaded_by, kind, storage_path on public.update_attachments
  for each row execute procedure public.assert_attachment_owner();

-- 7. Security Definer Helper Predicates for RLS
create or replace function public.is_mentor_of_team(target_team_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.teams
    where id = target_team_id
      and mentor_id = auth.uid()
  );
$$;

create or replace function public.mentor_manages_member(target_member_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.team_members membership
    join public.teams team on team.id = membership.team_id
    where membership.member_id = target_member_id
      and team.mentor_id = auth.uid()
  );
$$;

-- 8. Row Level Security Policies
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.member_profiles enable row level security;
alter table public.work_updates enable row level security;
alter table public.update_attachments enable row level security;

revoke all on public.profiles, public.teams, public.team_members,
  public.member_profiles, public.work_updates, public.update_attachments from anon;
revoke all on public.profiles, public.teams, public.team_members,
  public.member_profiles, public.work_updates, public.update_attachments from authenticated;

grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;
grant select, insert, update, delete on public.teams to authenticated;
grant select, insert, update, delete on public.team_members to authenticated;
grant select, update on public.member_profiles to authenticated;
grant select, insert, update, delete on public.work_updates to authenticated;
grant select, insert, update, delete on public.update_attachments to authenticated;

-- Policies for public.profiles
drop policy if exists "profiles are visible to their owner or supervising mentor" on public.profiles;
create policy "profiles are visible to their owner or supervising mentor"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.mentor_manages_member(id));

drop policy if exists "users can update their own safe profile fields" on public.profiles;
create policy "users can update their own safe profile fields"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Policies for public.teams
drop policy if exists "mentors can read owned teams" on public.teams;
create policy "mentors can read owned teams"
  on public.teams for select to authenticated
  using (mentor_id = auth.uid() or exists (
    select 1 from public.team_members membership
    where membership.team_id = id and membership.member_id = auth.uid()
  ));

drop policy if exists "mentors can create their own teams" on public.teams;
create policy "mentors can create their own teams"
  on public.teams for insert to authenticated
  with check (mentor_id = auth.uid() and exists (
    select 1 from public.profiles where id = auth.uid() and role = 'mentor'
  ));

drop policy if exists "mentors can update owned teams" on public.teams;
create policy "mentors can update owned teams"
  on public.teams for update to authenticated
  using (mentor_id = auth.uid())
  with check (mentor_id = auth.uid());

drop policy if exists "mentors can delete owned teams" on public.teams;
create policy "mentors can delete owned teams"
  on public.teams for delete to authenticated
  using (mentor_id = auth.uid());

-- Policies for public.team_members
drop policy if exists "members see their assignment and mentors see owned assignments" on public.team_members;
create policy "members see their assignment and mentors see owned assignments"
  on public.team_members for select to authenticated
  using (member_id = auth.uid() or public.is_mentor_of_team(team_id));

drop policy if exists "mentors can assign members to owned teams" on public.team_members;
create policy "mentors can assign members to owned teams"
  on public.team_members for insert to authenticated
  with check (public.is_mentor_of_team(team_id));

drop policy if exists "mentors can change assignments in owned teams" on public.team_members;
create policy "mentors can change assignments in owned teams"
  on public.team_members for update to authenticated
  using (public.is_mentor_of_team(team_id))
  with check (public.is_mentor_of_team(team_id));

drop policy if exists "mentors can remove members from owned teams" on public.team_members;
create policy "mentors can remove members from owned teams"
  on public.team_members for delete to authenticated
  using (public.is_mentor_of_team(team_id));

-- Policies for public.member_profiles
drop policy if exists "members read their profile and mentors read supervised profiles" on public.member_profiles;
create policy "members read their profile and mentors read supervised profiles"
  on public.member_profiles for select to authenticated
  using (user_id = auth.uid() or public.mentor_manages_member(user_id));

drop policy if exists "members update only their own member profile" on public.member_profiles;
create policy "members update only their own member profile"
  on public.member_profiles for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Policies for public.work_updates
drop policy if exists "members read own updates and mentors read team updates" on public.work_updates;
create policy "members read own updates and mentors read team updates"
  on public.work_updates for select to authenticated
  using (member_id = auth.uid() or public.is_mentor_of_team(team_id));

drop policy if exists "members create updates only for their assigned team" on public.work_updates;
create policy "members create updates only for their assigned team"
  on public.work_updates for insert to authenticated
  with check (member_id = auth.uid());

drop policy if exists "members update their own updates" on public.work_updates;
create policy "members update their own updates"
  on public.work_updates for update to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

drop policy if exists "members delete their own updates" on public.work_updates;
create policy "members delete their own updates"
  on public.work_updates for delete to authenticated
  using (member_id = auth.uid());

-- Policies for public.update_attachments
drop policy if exists "owners and supervising mentors read update evidence" on public.update_attachments;
create policy "owners and supervising mentors read update evidence"
  on public.update_attachments for select to authenticated
  using (
    uploaded_by = auth.uid()
    or exists (
      select 1 from public.work_updates work_update
      where work_update.id = update_id and public.is_mentor_of_team(work_update.team_id)
    )
  );

drop policy if exists "members attach evidence to their own updates" on public.update_attachments;
create policy "members attach evidence to their own updates"
  on public.update_attachments for insert to authenticated
  with check (uploaded_by = auth.uid());

drop policy if exists "members edit evidence on their own updates" on public.update_attachments;
create policy "members edit evidence on their own updates"
  on public.update_attachments for update to authenticated
  using (uploaded_by = auth.uid())
  with check (uploaded_by = auth.uid());

drop policy if exists "members delete their own update evidence" on public.update_attachments;
create policy "members delete their own update evidence"
  on public.update_attachments for delete to authenticated
  using (uploaded_by = auth.uid());

-- 9. Private Evidence Storage Bucket
insert into storage.buckets (id, name, public, file_size_limit)
values ('teamtrack-evidence', 'teamtrack-evidence', false, 26214400)
on conflict (id) do nothing;

drop policy if exists "members upload evidence beneath their own folder" on storage.objects;
create policy "members upload evidence beneath their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'teamtrack-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "update owners and mentors read linked evidence files" on storage.objects;
create policy "update owners and mentors read linked evidence files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'teamtrack-evidence'
    and exists (
      select 1
      from public.update_attachments attachment
      join public.work_updates work_update on work_update.id = attachment.update_id
      where attachment.storage_path = name
        and (work_update.member_id = auth.uid() or public.is_mentor_of_team(work_update.team_id))
    )
  );

drop policy if exists "members can update evidence beneath their own folder" on storage.objects;
create policy "members can update evidence beneath their own folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'teamtrack-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'teamtrack-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "members can delete evidence beneath their own folder" on storage.objects;
create policy "members can delete evidence beneath their own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'teamtrack-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 10. Automatic Backfill for accounts created prior to migration execution
insert into public.profiles (id, full_name, email, role)
select 
  u.id, 
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(u.email, '@', 1)),
  lower(coalesce(u.email, '')),
  case when u.raw_user_meta_data ->> 'requested_role' = 'mentor' then 'mentor'::public.app_role else 'member'::public.app_role end
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

insert into public.member_profiles (user_id)
select p.id
from public.profiles p
left join public.member_profiles mp on mp.user_id = p.id
where p.role = 'member' and mp.user_id is null
on conflict (user_id) do nothing;

-- 11. Admin Role, Teammate Policies & Invitation Management
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

-- (handle_new_user definition moved to section 12 with strict authorization checks)

update public.profiles
set role = 'admin'
where lower(email) = 'karimeletriby15@gmail.com';

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

drop policy if exists "members see their assignment and mentors see owned assignments" on public.team_members;
create policy "members see their assignment and mentors see owned assignments"
  on public.team_members for select to authenticated
  using (
    public.is_admin()
    or member_id = auth.uid()
    or public.is_mentor_of_team(team_id)
    or public.is_member_of_team(team_id)
  );

alter table public.team_invitations enable row level security;
grant select, insert, update, delete on public.team_invitations to authenticated;

drop policy if exists "mentors and admins manage team invitations" on public.team_invitations;
create policy "mentors and admins manage team invitations"
  on public.team_invitations for all to authenticated
  using (public.is_admin() or public.is_mentor_of_team(team_id))
  with check (public.is_admin() or public.is_mentor_of_team(team_id));

alter table public.mentor_invitations enable row level security;
grant select, insert, update, delete on public.mentor_invitations to authenticated;

drop policy if exists "admins manage mentor invitations" on public.mentor_invitations;
create policy "admins manage mentor invitations"
  on public.mentor_invitations for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 12. Registration Eligibility Check & Strict Authorization
create or replace function public.check_registration_eligibility(p_email text, p_role text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  clean_email text := lower(trim(p_email));
begin
  if clean_email = 'karimeletriby15@gmail.com' then
    return jsonb_build_object('allowed', true, 'role', 'admin');
  end if;

  if p_role = 'admin' then
    if exists (select 1 from public.profiles where lower(email) = clean_email and role = 'admin') then
      return jsonb_build_object('allowed', true, 'role', 'admin');
    else
      return jsonb_build_object('allowed', false, 'message', 'This email is not authorized for administrator access.');
    end if;
  end if;

  if p_role = 'mentor' then
    if exists (select 1 from public.mentor_invitations where lower(email) = clean_email)
       or exists (select 1 from public.profiles where lower(email) = clean_email and (role = 'mentor' or role = 'admin')) then
      return jsonb_build_object('allowed', true, 'role', 'mentor');
    else
      return jsonb_build_object('allowed', false, 'message', 'This email is not authorized as a mentor. Please contact the administrator for access.');
    end if;
  end if;

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
  if clean_email = 'karimeletriby15@gmail.com' then
    assigned_role := 'admin'::public.app_role;
  elsif exists (select 1 from public.mentor_invitations where lower(email) = clean_email) then
    assigned_role := 'mentor'::public.app_role;
    has_mentor_invite := true;
  elsif exists (select 1 from public.team_invitations where lower(email) = clean_email) then
    assigned_role := 'member'::public.app_role;
    has_team_invite := true;
  elsif exists (select 1 from public.profiles where id = new.id) then
    return new;
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


-- 13. Non-recursive Policies & Team Member Visibility Fix
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



