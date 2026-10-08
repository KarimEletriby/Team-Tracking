-- Allow the account type selected during sign-up to create the corresponding
-- application profile. This only affects new Auth users; existing users keep
-- their current role.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), ''),
    lower(coalesce(new.email, '')),
    nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), ''),
    case
      when new.raw_user_meta_data ->> 'requested_role' = 'mentor' then 'mentor'::public.app_role
      else 'member'::public.app_role
    end
  );
  return new;
end;
$$;
