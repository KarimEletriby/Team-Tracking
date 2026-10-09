import { requireSupabase } from '../lib/supabase';
import type {
  CreateMemberInput,
  CreateTeamInput,
  EntityId,
  MentorActivity,
  MentorDashboardData,
  MentorEvidenceFile,
  MentorMemberProfile,
  MentorMemberSummary,
  MentorProfessionalLinks,
  MentorRepository,
  MentorTeam,
  MentorWorkUpdate,
  MemberReviewData,
  TeamHealth,
  TeamWorkspaceData,
  UpdateTeamInput,
} from './contracts';

type TeamRow = {
  id: string;
  mentor_id: string;
  name: string;
  project_name: string;
  project_goal: string;
};

type MembershipRow = { team_id: string; member_id: string; joined_at: string };
type ProfileRow = { id: string; full_name: string; email: string; avatar_url: string | null };
type MemberProfileRow = {
  user_id: string;
  project_role: string;
  bio: string;
  technical_skills: string[];
  responsibilities: string[];
  social_links: unknown;
};
type WorkUpdateRow = {
  id: string;
  team_id: string;
  member_id: string;
  title: string;
  what_worked_on: string;
  technical_contribution: string;
  challenges: string | null;
  next_step: string | null;
  created_at: string;
};
type AttachmentRow = {
  update_id: string;
  kind: 'link' | 'file';
  label: string;
  external_url: string | null;
  storage_path: string | null;
  original_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
};

const RECENT_UPDATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const EVIDENCE_BUCKET = 'teamtrack-evidence';
const SIGNED_URL_LIFETIME_SECONDS = 60 * 60;

function throwIfError(error: { message: string; code?: string } | null): void {
  if (error) {
    if ((error as any).code === 'PGRST205' || error.message.includes('team_invitations') || error.message.includes('mentor_invitations')) {
      throw new Error('Invitations table not found in the database. Please execute the SQL migration script in your Supabase SQL Editor.');
    }
    throw new Error(error.message);
  }
}

function toProfessionalLinks(value: unknown): MentorProfessionalLinks | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const links = value as Record<string, unknown>;
  const readLink = (key: string): string | undefined => typeof links[key] === 'string' ? links[key] : undefined;
  const result = { linkedIn: readLink('linkedIn'), github: readLink('github'), portfolio: readLink('portfolio') };
  return result.linkedIn || result.github || result.portfolio ? result : undefined;
}

function isRecent(date: string | null): boolean {
  return Boolean(date) && Date.now() - Date.parse(date!) <= RECENT_UPDATE_WINDOW_MS;
}

function statusFromLatestUpdate(lastUpdateAt: string | null): MentorMemberSummary['progressStatus'] {
  if (!lastUpdateAt) return 'no-recent-update';
  return isRecent(lastUpdateAt) ? 'on-track' : 'needs-attention';
}

/**
 * Production data source for mentor screens. All reads and mutations run as
 * the signed-in user and therefore remain subject to the database RLS rules.
 */
export class SupabaseMentorRepository implements MentorRepository {
  async getDashboard(mentorId: EntityId): Promise<MentorDashboardData> {
    const mentor = await this.requireMentor(mentorId);
    const teams = await this.getTeams(mentorId);
    const workspaces = await Promise.all(teams.map((team) => this.getTeamWorkspace(team.id)));
    const resolvedWorkspaces = workspaces.filter((workspace): workspace is TeamWorkspaceData => workspace !== null);
    const members = resolvedWorkspaces.flatMap((workspace) => workspace.members);
    const updates = resolvedWorkspaces.flatMap((workspace) => workspace.updates);
    const recentActivity: MentorActivity[] = updates
      .slice(0, 8)
      .map((update): MentorActivity => ({
        id: `update-submitted-${update.id}`,
        teamId: update.teamId,
        memberId: update.memberId,
        type: 'update-submitted',
        message: `${this.memberName(members, update.memberId)} submitted a new progress update.`,
        happenedAt: update.submittedAt,
      }))
      .sort((first, second) => Date.parse(second.happenedAt) - Date.parse(first.happenedAt));

    return {
      mentor,
      summary: {
        teamCount: teams.length,
        memberCount: members.length,
        updatesThisWeek: updates.filter((update) => isRecent(update.submittedAt)).length,
        membersNeedingAttention: members.filter((member) => member.progressStatus !== 'on-track').length,
      },
      teams,
      recentActivity,
    };
  }

  async getTeams(mentorId: EntityId): Promise<MentorTeam[]> {
    await this.requireMentor(mentorId);
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('teams')
      .select('id, mentor_id, name, project_name, project_goal')
      .eq('mentor_id', mentorId)
      .order('created_at', { ascending: true });
    throwIfError(error);

    const teams = (data ?? []) as TeamRow[];
    return Promise.all(teams.map((team) => this.toMentorTeam(team)));
  }

  async getTeamWorkspace(teamId: EntityId): Promise<TeamWorkspaceData | null> {
    await this.requireMentor();
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('teams')
      .select('id, mentor_id, name, project_name, project_goal')
      .eq('id', teamId)
      .maybeSingle();
    throwIfError(error);
    if (!data) return null;

    const team = data as TeamRow;
    const details = await this.loadTeamDetails(team.id);
    return {
      team: this.toMentorTeamFromDetails(team, details.members, details.updates),
      members: details.members.map(this.toMemberSummary),
      updates: details.updates,
    };
  }

  async getMemberReview(memberId: EntityId): Promise<MemberReviewData | null> {
    await this.requireMentor();
    const supabase = requireSupabase();
    const { data: memberships, error: membershipError } = await supabase
      .from('team_members')
      .select('team_id, member_id, joined_at')
      .eq('member_id', memberId);
    throwIfError(membershipError);
    const membership = (memberships as MembershipRow[] | null)?.[0];
    if (!membership) return null;

    const [profileResult, memberProfileResult, updatesResult] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, avatar_url').eq('id', memberId).maybeSingle(),
      supabase.from('member_profiles').select('user_id, project_role, bio, technical_skills, responsibilities, social_links').eq('user_id', memberId).maybeSingle(),
      supabase.from('work_updates').select('id, team_id, member_id, title, what_worked_on, technical_contribution, challenges, next_step, created_at').eq('member_id', memberId).order('created_at', { ascending: false }),
    ]);
    throwIfError(profileResult.error);
    throwIfError(memberProfileResult.error);
    throwIfError(updatesResult.error);
    if (!profileResult.data) return null;

    const updates = await this.toMentorUpdates((updatesResult.data ?? []) as WorkUpdateRow[]);
    const member = this.toMemberProfile({
      membership,
      profile: profileResult.data as ProfileRow,
      memberProfile: memberProfileResult.data as MemberProfileRow | null,
      updates,
    });

    return { member, updates };
  }

  async createTeam(mentorId: EntityId, input: CreateTeamInput): Promise<MentorTeam> {
    await this.requireMentor(mentorId);
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('teams')
      .insert({ mentor_id: mentorId, name: input.name.trim(), project_name: input.projectName.trim(), project_goal: input.projectGoal.trim() })
      .select('id, mentor_id, name, project_name, project_goal')
      .single();
    throwIfError(error);
    return this.toMentorTeam(data as TeamRow);
  }

  async updateTeam(teamId: EntityId, input: UpdateTeamInput): Promise<MentorTeam | null> {
    await this.requireMentor();
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('teams')
      .update({ name: input.name.trim(), project_name: input.projectName.trim(), project_goal: input.projectGoal.trim() })
      .eq('id', teamId)
      .select('id, mentor_id, name, project_name, project_goal')
      .maybeSingle();
    throwIfError(error);
    return data ? this.toMentorTeam(data as TeamRow) : null;
  }

  async addMember(teamId: EntityId, input: CreateMemberInput): Promise<MentorMemberProfile | null> {
    await this.requireMentor();
    const supabase = requireSupabase();
    const cleanEmail = input.email.trim().toLowerCase();
    const cleanName = input.name.trim();
    const cleanRole = (input.projectRole || '').trim();

    // 1. Check if user with this email already exists in profiles
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (existingProfile) {
      const { error: tmError } = await supabase
        .from('team_members')
        .upsert({ team_id: teamId, member_id: existingProfile.id }, { onConflict: 'member_id' });
      throwIfError(tmError);

      if (cleanRole) {
        await supabase
          .from('member_profiles')
          .upsert({ user_id: existingProfile.id, project_role: cleanRole }, { onConflict: 'user_id' });
      }

      const review = await this.getMemberReview(existingProfile.id);
      return review?.member ?? null;
    }

    // 2. User has not registered yet: save in team_invitations
    const { error: inviteError } = await supabase
      .from('team_invitations')
      .upsert({
        team_id: teamId,
        email: cleanEmail,
        full_name: cleanName,
      }, { onConflict: 'team_id,email' });
    throwIfError(inviteError);

    try {
      await supabase.functions.invoke('invite-member', {
        body: {
          teamId,
          email: cleanEmail,
          fullName: cleanName,
          projectRole: cleanRole,
          redirectTo: window.location.origin,
        },
      });
    } catch {
      // Ignored if local invitation is used
    }

    return {
      id: 'pending-' + cleanEmail,
      teamId,
      name: cleanName || cleanEmail.split('@')[0],
      email: cleanEmail,
      projectRole: cleanRole || 'Team Member (Pending signup)',
      progressStatus: 'no-recent-update',
      lastUpdateAt: null,
      updateCount: 0,
      bio: 'Invited by mentor — will activate when member joins with this email.',
      technicalSkills: [],
      responsibilities: [],
      joinedAt: new Date().toISOString(),
    };
  }

  async moveMember(memberId: EntityId, teamId: EntityId): Promise<MentorMemberProfile | null> {
    await this.requireMentor();
    const supabase = requireSupabase();
    if (memberId.startsWith('pending-')) {
      const email = memberId.replace('pending-', '');
      await supabase.from('team_invitations').update({ team_id: teamId }).ilike('email', email);
      return null;
    }

    const { data, error } = await supabase
      .from('team_members')
      .update({ team_id: teamId })
      .eq('member_id', memberId)
      .select('team_id, member_id, joined_at')
      .maybeSingle();
    throwIfError(error);
    if (!data) return null;

    const review = await this.getMemberReview(memberId);
    return review?.member ?? null;
  }

  async removeMember(memberId: EntityId): Promise<boolean> {
    await this.requireMentor();
    const supabase = requireSupabase();
    if (memberId.startsWith('pending-')) {
      const email = memberId.replace('pending-', '');
      await supabase.from('team_invitations').delete().ilike('email', email);
      return true;
    }

    const { data, error } = await supabase
      .from('team_members')
      .delete()
      .eq('member_id', memberId)
      .select('member_id');
    throwIfError(error);
    return Boolean(data?.length);
  }

  private async requireMentor(expectedMentorId?: EntityId): Promise<{ id: string; name: string; avatarUrl?: string }> {
    const supabase = requireSupabase();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('Please sign in as a mentor to continue.');
    if (expectedMentorId && user.id !== expectedMentorId) throw new Error('You cannot access another mentor workspace.');

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role')
      .eq('id', user.id)
      .single();
    throwIfError(error);
    if (!data) throw new Error('Your mentor profile could not be loaded.');
    if (data.role !== 'mentor' && data.role !== 'admin' && user.email?.toLowerCase() !== 'karimeletriby15@gmail.com') {
      throw new Error('Mentor access is required for this workspace.');
    }
    return { id: data.id, name: data.full_name || user.email?.split('@')[0] || 'Mentor', avatarUrl: data.avatar_url ?? undefined };
  }

  private async toMentorTeam(team: TeamRow): Promise<MentorTeam> {
    const details = await this.loadTeamDetails(team.id);
    return this.toMentorTeamFromDetails(team, details.members, details.updates);
  }

  private toMentorTeamFromDetails(team: TeamRow, members: MentorMemberProfile[], updates: MentorWorkUpdate[]): MentorTeam {
    const lastActivityAt = updates[0]?.submittedAt ?? null;
    const needsAttentionCount = members.filter((member) => member.progressStatus !== 'on-track').length;
    let health: TeamHealth = 'on-track';
    if (members.length > 0 && needsAttentionCount === members.length) health = 'at-risk';
    else if (needsAttentionCount > 0) health = 'needs-attention';

    return {
      id: team.id,
      mentorId: team.mentor_id,
      name: team.name,
      projectName: team.project_name,
      projectGoal: team.project_goal,
      memberCount: members.length,
      health,
      completionPercent: 0,
      lastActivityAt,
      needsAttentionCount,
    };
  }

  private async loadTeamDetails(teamId: EntityId): Promise<{ members: MentorMemberProfile[]; updates: MentorWorkUpdate[] }> {
    const supabase = requireSupabase();
    const [membershipsResult, updatesResult, invitationsResult] = await Promise.all([
      supabase.from('team_members').select('team_id, member_id, joined_at').eq('team_id', teamId),
      supabase.from('work_updates').select('id, team_id, member_id, title, what_worked_on, technical_contribution, challenges, next_step, created_at').eq('team_id', teamId).order('created_at', { ascending: false }),
      supabase.from('team_invitations').select('id, email, full_name, created_at').eq('team_id', teamId),
    ]);
    throwIfError(membershipsResult.error);
    throwIfError(updatesResult.error);
    const memberships = (membershipsResult.data ?? []) as MembershipRow[];
    const updates = await this.toMentorUpdates((updatesResult.data ?? []) as WorkUpdateRow[]);
    const pendingInvites = (invitationsResult.data ?? []) as Array<{ id: string; email: string; full_name: string; created_at: string }>;

    let activeMembers: MentorMemberProfile[] = [];
    if (memberships.length > 0) {
      const memberIds = memberships.map((membership) => membership.member_id);
      const [profilesResult, memberProfilesResult] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, avatar_url').in('id', memberIds),
        supabase.from('member_profiles').select('user_id, project_role, bio, technical_skills, responsibilities, social_links').in('user_id', memberIds),
      ]);
      throwIfError(profilesResult.error);
      throwIfError(memberProfilesResult.error);
      const profiles = new Map(((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
      const memberProfiles = new Map(((memberProfilesResult.data ?? []) as MemberProfileRow[]).map((profile) => [profile.user_id, profile]));

      activeMembers = memberships
        .map((membership) => {
          const profile = profiles.get(membership.member_id);
          return profile ? this.toMemberProfile({ membership, profile, memberProfile: memberProfiles.get(membership.member_id) ?? null, updates }) : null;
        })
        .filter((member): member is MentorMemberProfile => member !== null);
    }

    const pendingMembers: MentorMemberProfile[] = pendingInvites.map((invite) => ({
      id: 'pending-' + invite.email,
      teamId,
      name: invite.full_name || invite.email.split('@')[0],
      email: invite.email,
      projectRole: 'Team Member (Pending signup)',
      progressStatus: 'no-recent-update',
      lastUpdateAt: null,
      updateCount: 0,
      bio: 'Invited by mentor — will activate when member creates their password.',
      technicalSkills: [],
      responsibilities: [],
      joinedAt: invite.created_at,
    }));

    return {
      members: [...activeMembers, ...pendingMembers],
      updates,
    };
  }

  private async toMentorUpdates(rows: WorkUpdateRow[]): Promise<MentorWorkUpdate[]> {
    if (rows.length === 0) return [];
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('update_attachments')
      .select('update_id, kind, label, external_url, storage_path, original_name, mime_type, size_bytes')
      .in('update_id', rows.map((row) => row.id));
    throwIfError(error);
    const attachmentsByUpdate = new Map<string, AttachmentRow[]>();
    for (const attachment of (data ?? []) as AttachmentRow[]) {
      const attachments = attachmentsByUpdate.get(attachment.update_id) ?? [];
      attachments.push(attachment);
      attachmentsByUpdate.set(attachment.update_id, attachments);
    }

    return Promise.all(rows.map(async (row) => {
      const attachments = attachmentsByUpdate.get(row.id) ?? [];
      const link = attachments.find((attachment) => attachment.kind === 'link');
      const file = attachments.find((attachment) => attachment.kind === 'file');
      return {
        id: row.id,
        teamId: row.team_id,
        memberId: row.member_id,
        title: row.title,
        summary: row.what_worked_on,
        technicalDetails: row.technical_contribution,
        challenges: row.challenges || undefined,
        nextStep: row.next_step || undefined,
        evidenceUrl: link?.external_url || undefined,
        evidenceFile: file ? await this.toEvidenceFile(file) : undefined,
        submittedAt: row.created_at,
        reviewStatus: 'new' as const,
      };
    }));
  }

  private async toEvidenceFile(attachment: AttachmentRow): Promise<MentorEvidenceFile | undefined> {
    if (!attachment.storage_path || !attachment.original_name) return undefined;
    const { data, error } = await requireSupabase().storage
      .from(EVIDENCE_BUCKET)
      .createSignedUrl(attachment.storage_path, SIGNED_URL_LIFETIME_SECONDS);
    if (error || !data?.signedUrl) {
      console.warn('Evidence file is unavailable to this mentor.', error);
      return undefined;
    }
    return {
      fileName: attachment.original_name,
      mimeType: attachment.mime_type ?? 'application/octet-stream',
      sizeBytes: attachment.size_bytes ?? 0,
      signedUrl: data.signedUrl,
    };
  }

  private toMemberProfile({ membership, profile, memberProfile, updates }: {
    membership: MembershipRow;
    profile: ProfileRow;
    memberProfile: MemberProfileRow | null;
    updates: MentorWorkUpdate[];
  }): MentorMemberProfile {
    const memberUpdates = updates.filter((update) => update.memberId === membership.member_id);
    const lastUpdateAt = memberUpdates[0]?.submittedAt ?? null;
    return {
      id: profile.id,
      teamId: membership.team_id,
      name: profile.full_name || 'Unnamed member',
      email: profile.email,
      avatarUrl: profile.avatar_url ?? undefined,
      projectRole: memberProfile?.project_role ?? '',
      progressStatus: statusFromLatestUpdate(lastUpdateAt),
      lastUpdateAt,
      updateCount: memberUpdates.length,
      bio: memberProfile?.bio ?? '',
      technicalSkills: memberProfile?.technical_skills ?? [],
      responsibilities: memberProfile?.responsibilities ?? [],
      professionalLinks: toProfessionalLinks(memberProfile?.social_links),
      joinedAt: membership.joined_at,
    };
  }

  private toMemberSummary = (member: MentorMemberProfile): MentorMemberSummary => {
    const { bio: _bio, technicalSkills: _technicalSkills, responsibilities: _responsibilities, professionalLinks: _professionalLinks, joinedAt: _joinedAt, ...summary } = member;
    return summary;
  };

  private memberName(members: MentorMemberSummary[], memberId: string): string {
    return members.find((member) => member.id === memberId)?.name ?? 'A member';
  }
}

export const supabaseMentorRepository = new SupabaseMentorRepository();
