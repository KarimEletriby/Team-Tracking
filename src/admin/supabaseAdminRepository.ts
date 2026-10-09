import { requireSupabase } from '../lib/supabase';
import {
  AdminMentorItem,
  AdminOverviewData,
  AdminRepository,
  AdminTeamItem,
  AdminUserItem,
} from './contracts';

export class SupabaseAdminRepository implements AdminRepository {
  async getOverview(): Promise<AdminOverviewData> {
    const supabase = requireSupabase();

    // 1. Fetch all profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, created_at')
      .order('created_at', { ascending: false });

    if (profilesError) throw new Error(profilesError.message);
    const profiles = profilesData ?? [];

    // 2. Fetch pending mentor invitations
    const { data: mentorInvites } = await supabase
      .from('mentor_invitations')
      .select('id, email, full_name, created_at');

    // 3. Fetch all teams
    const { data: teamsData, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, project_name, mentor_id, created_at, team_members(count)')
      .order('created_at', { ascending: false });

    if (teamsError) throw new Error(teamsError.message);
    const teams = teamsData ?? [];

    // Map profiles to roles
    const mentorsList: AdminMentorItem[] = [];

    // Active mentors
    for (const p of profiles.filter((x) => x.role === 'mentor')) {
      const mentorTeams = teams.filter((t) => t.mentor_id === p.id);
      mentorsList.push({
        id: p.id,
        name: p.full_name || p.email.split('@')[0],
        email: p.email,
        teamCount: mentorTeams.length,
        createdAt: p.created_at,
        isPending: false,
      });
    }

    // Pending invited mentors
    for (const invite of mentorInvites ?? []) {
      mentorsList.push({
        id: invite.id,
        name: invite.full_name || invite.email.split('@')[0],
        email: invite.email,
        teamCount: 0,
        createdAt: invite.created_at,
        isPending: true,
      });
    }

    const adminsList: AdminUserItem[] = profiles
      .filter((x) => x.role === 'admin' || x.email.toLowerCase() === 'karimeletriby15@gmail.com')
      .map((p) => ({
        id: p.id,
        name: p.full_name || p.email.split('@')[0],
        email: p.email,
        role: 'admin',
        createdAt: p.created_at,
      }));

    // If Karim Eletriby is not yet in profiles, add as primary admin in list
    if (!adminsList.some((a) => a.email.toLowerCase() === 'karimeletriby15@gmail.com')) {
      adminsList.unshift({
        id: 'primary-admin',
        name: 'Karim Eletriby',
        email: 'karimeletriby15@gmail.com',
        role: 'admin',
        createdAt: new Date().toISOString(),
      });
    }

    const teamsList: AdminTeamItem[] = teams.map((t) => {
      const mentor = profiles.find((p) => p.id === t.mentor_id);
      const memberCount = Array.isArray(t.team_members) && t.team_members[0] ? (t.team_members[0] as any).count : 0;
      return {
        id: t.id,
        name: t.name,
        projectName: t.project_name,
        mentorName: mentor ? mentor.full_name || mentor.email.split('@')[0] : 'Unknown Mentor',
        memberCount: typeof memberCount === 'number' ? memberCount : 0,
        createdAt: t.created_at,
      };
    });

    const memberCount = profiles.filter((x) => x.role === 'member').length;

    return {
      summary: {
        mentorCount: mentorsList.length,
        teamCount: teamsList.length,
        memberCount,
        adminCount: adminsList.length,
      },
      mentors: mentorsList,
      teams: teamsList,
      admins: adminsList,
    };
  }

  async addMentor(name: string, email: string): Promise<boolean> {
    const supabase = requireSupabase();
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (existingUser) {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'mentor', full_name: cleanName || undefined })
        .eq('id', existingUser.id);
      if (error) throw new Error(error.message);
      return true;
    }

    // Insert into mentor_invitations
    const { error } = await supabase
      .from('mentor_invitations')
      .upsert({
        email: cleanEmail,
        full_name: cleanName,
      }, { onConflict: 'email' });

    if (error) throw new Error(error.message);
    return true;
  }

  async removeMentor(mentorId: string): Promise<boolean> {
    const supabase = requireSupabase();

    // Try deleting from mentor_invitations
    await supabase.from('mentor_invitations').delete().eq('id', mentorId);

    // If it's a profile, demote to member
    const { error } = await supabase
      .from('profiles')
      .update({ role: 'member' })
      .eq('id', mentorId);

    if (error) throw new Error(error.message);
    return true;
  }

  async promoteAdmin(email: string): Promise<boolean> {
    const supabase = requireSupabase();
    const cleanEmail = email.trim().toLowerCase();

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .ilike('email', cleanEmail)
      .select('id')
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!profile) {
      throw new Error('User not found. The user must register an account first before being promoted to admin.');
    }
    return true;
  }
}

export const supabaseAdminRepository = new SupabaseAdminRepository();
