-- ========================================================================
-- TeamTrack: Enforce Invitation-Only Access for Mentors & Members
-- Migration: 20261009000001_enforce_invitation_only_registration.sql
-- ========================================================================

-- 1. RPC function to check eligibility before registration
create or replace function public.check_registration_eligibility(p_email text, p_role text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  clean_email text := lower(trim(p_email));
begin
  -- 1. Primary Admin (Karim Eletriby)
  if clean_email = 'karimeletriby15@gmail.com' then
    return jsonb_build_object('allowed', true, 'role', 'admin');
  end if;

  -- 2. If attempting as Admin
  if p_role = 'admin' then
    if exists (select 1 from public.profiles where lower(email) = clean_email and role = 'admin') then
      return jsonb_build_object('allowed', true, 'role', 'admin');
    else
      return jsonb_build_object(
        'allowed', false,
        'message', 'هذا البريد غير مصرح له بالدخول كمسؤول للنظام.'
      );
    end if;
  end if;

  -- 3. If attempting as Mentor
  if p_role = 'mentor' then
    if exists (select 1 from public.mentor_invitations where lower(email) = clean_email)
       or exists (select 1 from public.profiles where lower(email) = clean_email and (role = 'mentor' or role = 'admin')) then
      return jsonb_build_object('allowed', true, 'role', 'mentor');
    else
      return jsonb_build_object(
        'allowed', false,
        'message', 'هذا البريد غير معتمد كمرشد في النظام. يجب أن يضيفك المشرف العام (Karim Eletriby - karimeletriby15@gmail.com) أولاً.'
      );
    end if;
  end if;

  -- 4. If attempting as Member
  if p_role = 'member' then
    if exists (select 1 from public.team_invitations where lower(email) = clean_email)
       or exists (
         select 1 from public.team_members tm
         join public.profiles p on p.id = tm.member_id
         where lower(p.email) = clean_email
       ) then
      return jsonb_build_object('allowed', true, 'role', 'member');
    else
      return jsonb_build_object(
        'allowed', false,
        'message', 'هذا البريد غير مضاف لأي فريق. يجب أن يقوم المرشد (Mentor) بإضافتك إلى فريقه أولاً.'
      );
    end if;
  end if;

  return jsonb_build_object('allowed', false, 'message', 'الدور المطلوب غير صالح.');
end;
$$;

grant execute on function public.check_registration_eligibility(text, text) to anon, authenticated;

-- 2. Enforce strict authorization inside handle_new_user trigger
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
  -- 1. Primary Admin:
  if clean_email = 'karimeletriby15@gmail.com' then
    assigned_role := 'admin'::public.app_role;

  -- 2. Pre-approved Mentor by Admin:
  elsif exists (select 1 from public.mentor_invitations where lower(email) = clean_email) then
    assigned_role := 'mentor'::public.app_role;
    has_mentor_invite := true;

  -- 3. Pre-invited Member by Mentor:
  elsif exists (select 1 from public.team_invitations where lower(email) = clean_email) then
    assigned_role := 'member'::public.app_role;
    has_team_invite := true;

  -- 4. Existing account in profiles:
  elsif exists (select 1 from public.profiles where id = new.id) then
    return new;

  -- 5. Otherwise REJECT unauthorized registration:
  else
    raise exception 'غير مصرح بالتسجيل: هذا البريد الإلكتروني غير مدعو أو غير معتمد في النظام.';
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
