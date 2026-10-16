-- ========================================================================
-- TeamTrack: Authorize kkaarrmmeedd@gmail.com as a Member
-- File: supabase/allow_member_kkaarrmmeedd.sql
-- ========================================================================

-- 1. Pre-invite kkaarrmmeedd@gmail.com to the first team (Banking Team)
insert into public.team_invitations (team_id, email, full_name)
select id, 'kkaarrmmeedd@gmail.com', 'Karim Member'
from public.teams
order by created_at asc
limit 1
on conflict (team_id, email) do nothing;

-- 2. If an account already exists in auth.users/profiles, link them to the team:
update public.profiles 
set role = 'member' 
where lower(email) = 'kkaarrmmeedd@gmail.com';

insert into public.team_members (team_id, member_id)
select t.id, p.id
from public.teams t
cross join public.profiles p
where lower(p.email) = 'kkaarrmmeedd@gmail.com'
order by t.created_at asc
limit 1
on conflict (team_id, member_id) do nothing;

-- 3. Populate a rich member profile so you see skills, bio, and responsibilities immediately:
insert into public.member_profiles (
  user_id,
  project_role,
  bio,
  technical_skills,
  responsibilities,
  social_links
)
select 
  p.id,
  'Frontend Developer',
  'Software engineer passionate about modern web apps, TypeScript, and clean responsive UI design.',
  array['React', 'TypeScript', 'CSS3', 'Vite', 'Git'],
  array['Design and build user interfaces', 'Integrate Supabase backend APIs', 'Test and debug components'],
  jsonb_build_object(
    'github', 'https://github.com',
    'linkedIn', 'https://linkedin.com',
    'portfolio', 'https://portfolio.dev'
  )
from public.profiles p
where lower(p.email) = 'kkaarrmmeedd@gmail.com'
on conflict (user_id) do update set
  project_role = excluded.project_role,
  bio = excluded.bio,
  technical_skills = excluded.technical_skills,
  responsibilities = excluded.responsibilities,
  social_links = excluded.social_links;
