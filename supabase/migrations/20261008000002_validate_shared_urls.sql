-- Only safe public http(s) links may be rendered in member or mentor profiles.

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
      select 
      from jsonb_each(links) as entry(key, value)
      where entry.key not in ('linkedIn', 'github', 'portfolio')
        or jsonb_typeof(entry.value) <> 'string'
        or not public.is_safe_http_url(entry.value #>> '{}')
    );
$$;

alter table public.member_profiles
  add constraint member_profiles_social_links_safe
  check (public.has_valid_social_links(social_links));

alter table public.update_attachments
  add constraint update_attachments_external_url_safe
  check (kind <> 'link' or public.is_safe_http_url(external_url));
