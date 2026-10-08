-- TeamTrack production data model.
-- Core TeamTrack schema.

create extension if not exists pgcrypto;

create type public.app_role as enum ('member', 'mentor');
create type public.attachment_kind as enum ('link', 'file');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  role public.app_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles (id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 120),
  project_name text not null default '' check (char_length(project_name) <= 160),
  project_goal text not null default '' check (char_length(project_goal) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (team_id, member_id),
  unique (member_id)
);

create table public.member_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  project_role text not null default '' check (char_length(project_role) <= 120),
  bio text not null default '' check (char_length(bio) <= 3000),
  technical_skills text[] not null default '{}',
  responsibilities text[] not null default '{}',
  social_links jsonb not null default '{}'::jsonb check (jsonb_typeof(social_links) = 'object'),
  updated_at timestamptz not null default now()
);

create table public.work_updates (
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

create table public.update_attachments (
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

create index team_members_member_id_idx on public.team_members (member_id);
create index teams_mentor_id_idx on public.teams (mentor_id);
create index work_updates_member_created_idx on public.work_updates (member_id, created_at desc);
create index work_updates_team_created_idx on public.work_updates (team_id, created_at desc);
create index update_attachments_update_id_idx on public.update_attachments (update_id);
create unique index update_attachments_storage_path_key
  on public.update_attachments (storage_path)
  where storage_path is not null;

-- The selected account type is stored in trusted Auth metadata at sign-up.
-- It is validated server-side and cannot later be changed by a client update.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), ''),
    nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), ''),
    case
      when new.raw_user_meta_data ->> 'requested_role' = 'mentor' then 'mentor'::public.app_role
      else 'member'::public.app_role
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

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

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger teams_set_updated_at
  before update on public.teams
  for each row execute procedure public.set_updated_at();

create trigger member_profiles_set_updated_at
  before update on public.member_profiles
  for each row execute procedure public.set_updated_at();

create trigger work_updates_set_updated_at
  before update on public.work_updates
  for each row execute procedure public.set_updated_at();

-- Team and update invariants are checked in trusted trigger functions, rather
-- than relying solely on UI behaviour or RLS predicates.
create or replace function public.assert_team_mentor()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles profile
    where profile.id = new.mentor_id and profile.role = 'mentor'
  ) then
    raise exception 'A team mentor must have the mentor role';
  end if;
  return new;
end;
$$;

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

create trigger update_attachments_require_owner
  before insert or update of update_id, uploaded_by, kind, storage_path on public.update_attachments
  for each row execute procedure public.assert_attachment_owner();

-- Security-definer predicates avoid RLS recursion when policies follow the
-- membership graph. They only expose boolean authorization decisions.
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

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.member_profiles enable row level security;
alter table public.work_updates enable row level security;
alter table public.update_attachments enable row level security;

-- The Data API is enabled for the project, but table access is granted only
-- to signed-in users and is still constrained by the RLS policies below.
revoke all on public.profiles, public.teams, public.team_members,
  public.member_profiles, public.work_updates, public.update_attachments from anon;
revoke all on public.profiles, public.teams, public.team_members,
  public.member_profiles, public.work_updates, public.update_attachments from authenticated;
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.teams to authenticated;
grant select, insert, update, delete on public.team_members to authenticated;
grant select, update on public.member_profiles to authenticated;
grant select, insert, update, delete on public.work_updates to authenticated;
grant select, insert, update, delete on public.update_attachments to authenticated;

create policy "profiles are visible to their owner or supervising mentor"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.mentor_manages_member(id));

create policy "users can update their own safe profile fields"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Prevent clients from promoting themselves even though they may update their
-- display name or avatar. A trusted service role can still manage assignments.
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

create policy "mentors can read owned teams"
  on public.teams for select to authenticated
  using (mentor_id = auth.uid() or exists (
    select 1 from public.team_members membership
    where membership.team_id = id and membership.member_id = auth.uid()
  ));

create policy "mentors can create their own teams"
  on public.teams for insert to authenticated
  with check (mentor_id = auth.uid() and exists (
    select 1 from public.profiles where id = auth.uid() and role = 'mentor'
  ));

create policy "mentors can update owned teams"
  on public.teams for update to authenticated
  using (mentor_id = auth.uid())
  with check (mentor_id = auth.uid());

create policy "mentors can delete owned teams"
  on public.teams for delete to authenticated
  using (mentor_id = auth.uid());

create policy "members see their assignment and mentors see owned assignments"
  on public.team_members for select to authenticated
  using (member_id = auth.uid() or public.is_mentor_of_team(team_id));

create policy "mentors can assign members to owned teams"
  on public.team_members for insert to authenticated
  with check (public.is_mentor_of_team(team_id));

create policy "mentors can change assignments in owned teams"
  on public.team_members for update to authenticated
  using (public.is_mentor_of_team(team_id))
  with check (public.is_mentor_of_team(team_id));

create policy "mentors can remove members from owned teams"
  on public.team_members for delete to authenticated
  using (public.is_mentor_of_team(team_id));

create policy "members read their profile and mentors read supervised profiles"
  on public.member_profiles for select to authenticated
  using (user_id = auth.uid() or public.mentor_manages_member(user_id));

create policy "members update only their own member profile"
  on public.member_profiles for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "members read own updates and mentors read team updates"
  on public.work_updates for select to authenticated
  using (member_id = auth.uid() or public.is_mentor_of_team(team_id));

create policy "members create updates only for their assigned team"
  on public.work_updates for insert to authenticated
  with check (member_id = auth.uid());

create policy "members update their own updates"
  on public.work_updates for update to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

create policy "members delete their own updates"
  on public.work_updates for delete to authenticated
  using (member_id = auth.uid());

create policy "owners and supervising mentors read update evidence"
  on public.update_attachments for select to authenticated
  using (
    uploaded_by = auth.uid()
    or exists (
      select 1 from public.work_updates work_update
      where work_update.id = update_id and public.is_mentor_of_team(work_update.team_id)
    )
  );

create policy "members attach evidence to their own updates"
  on public.update_attachments for insert to authenticated
  with check (uploaded_by = auth.uid());

create policy "members edit evidence on their own updates"
  on public.update_attachments for update to authenticated
  using (uploaded_by = auth.uid())
  with check (uploaded_by = auth.uid());

create policy "members delete their own update evidence"
  on public.update_attachments for delete to authenticated
  using (uploaded_by = auth.uid());

-- Private bucket: objects are served only through these Storage RLS policies.
insert into storage.buckets (id, name, public, file_size_limit)
values ('teamtrack-evidence', 'teamtrack-evidence', false, 26214400)
on conflict (id) do nothing;

create policy "members upload evidence beneath their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'teamtrack-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

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

create policy "members can delete evidence beneath their own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'teamtrack-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Database checks and the bucket limit both enforce 25 MB. The client should
-- also reject files larger than 25 MB before upload for a faster user message.
