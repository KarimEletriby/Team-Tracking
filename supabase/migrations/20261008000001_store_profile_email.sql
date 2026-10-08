-- Keep a member's email available to the member and their supervising mentor.
-- auth.users is not exposed to the browser, so this safe copy supports the
-- approved mentor workspace without granting clients access to auth.users.

alter table public.profiles
  add column if not exists email text not null default '';

create unique index if not exists profiles_email_unique
  on public.profiles (lower(email))
  where email <> '';

update public.profiles profile
set email = lower(auth_user.email)
from auth.users auth_user
where auth_user.id = profile.id
  and profile.email = '';

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
    'member'
  );
  return new;
end;
$$;
