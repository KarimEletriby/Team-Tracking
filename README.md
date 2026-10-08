# TeamTrack

TeamTrack is a workspace for mentors and student teams. Mentors create teams, invite members, and follow their progress. Members maintain a project profile, share updates, and attach a link or file as evidence of their work.

## What it includes

- Separate Mentor and Member workspaces
- Role selection during account creation
- Team creation, editing, member invitations, reassignment, and removal
- Member profiles with skills, responsibilities, bio, LinkedIn, GitHub, and portfolio links
- Work updates with optional external links or private file uploads
- Mentor visibility into assigned teams, member profiles, updates, and uploaded evidence
- Supabase Auth, Postgres, Row Level Security, Storage, and an Edge Function for invitations

## Tech stack

- React + TypeScript + Vite
- Supabase Auth, Postgres, Storage, and Edge Functions
- Lucide icons and plain CSS

## Run locally

1. Install Node.js 20 or newer.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file from `.env.example` and add the project values from Supabase:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

5. Open `http://127.0.0.1:5173`.

## Set up Supabase

Run the SQL files in `supabase/migrations` in their numeric order using the Supabase SQL Editor. They create the database tables, security rules, private `teamtrack-evidence` bucket, and validation rules.

Deploy the `invite-member` Edge Function from `supabase/functions/invite-member`. It must be deployed before a mentor can invite members.

For local testing, add `http://127.0.0.1:5173/**` to Supabase Authentication redirect URLs. Before deployment, replace it with your deployed domain and set the same frontend environment variables on the hosting provider.

## Validate before publishing

```bash
npm run build
```

Then test this flow with two accounts:

1. Create a mentor account and create a team.
2. Invite a member to that team.
3. Sign in as the member, complete the profile, and publish an update with a file or link.
4. Sign back in as the mentor and confirm the profile, update, and evidence are visible.

