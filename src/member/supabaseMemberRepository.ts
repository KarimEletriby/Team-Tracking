import { requireSupabase } from '../lib/supabase';
import {
  MemberEntityId,
  MemberEvidenceFile,
  MemberHomeData,
  MemberProfessionalLinks,
  MemberProfile,
  MemberProfileInput,
  MemberProjectContext,
  MemberRepository,
  MemberWorkUpdate,
  MemberWorkUpdateInput,
} from './contracts';

const EVIDENCE_BUCKET = 'teamtrack-evidence';
const MAX_EVIDENCE_FILE_BYTES = 25 * 1024 * 1024;
const SIGNED_URL_LIFETIME_SECONDS = 60 * 60;

type ProfileRow = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
};

type MemberProfileRow = {
  user_id: string;
  project_role: string;
  bio: string;
  technical_skills: string[];
  responsibilities: string[];
  social_links: unknown;
};

type TeamRow = {
  id: string;
  name: string;
  project_name: string;
  project_goal: string;
};

type TeamMembershipRow = {
  team_id: string;
  teams: TeamRow | TeamRow[] | null;
};

type AttachmentRow = {
  id: string;
  kind: 'link' | 'file';
  label: string;
  external_url: string | null;
  storage_path: string | null;
  original_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

type WorkUpdateRow = {
  id: string;
  member_id: string;
  title: string;
  what_worked_on: string;
  technical_contribution: string;
  challenges: string | null;
  next_step: string | null;
  created_at: string;
  updated_at: string;
  update_attachments?: AttachmentRow[] | null;
};

const normaliseText = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

const normaliseHttpUrl = (value: string | undefined, fieldName: string): string | undefined => {
  const trimmed = normaliseText(value);
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Unsupported protocol');
    return url.toString();
  } catch {
    throw new Error(`${fieldName} must be a valid http(s) URL.`);
  }
};

const requiredText = (value: string, name: string): string => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${name} is required.`);
  return trimmed;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

const stringValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const toProfessionalLinks = (value: unknown): MemberProfessionalLinks => {
  const links = asRecord(value);
  return {
    linkedIn: stringValue(links.linkedIn),
    github: stringValue(links.github),
    portfolio: stringValue(links.portfolio),
  };
};

const cleanProfessionalLinks = (links: MemberProfessionalLinks): MemberProfessionalLinks => ({
  linkedIn: normaliseHttpUrl(links.linkedIn, 'LinkedIn URL'),
  github: normaliseHttpUrl(links.github, 'GitHub URL'),
  portfolio: normaliseHttpUrl(links.portfolio, 'Portfolio URL'),
});

const cleanStringList = (values: string[]): string[] =>
  values.map((value) => value.trim()).filter(Boolean);

const toDataBlob = async (evidence: MemberEvidenceFile): Promise<Blob> => {
  if (evidence.sizeBytes > MAX_EVIDENCE_FILE_BYTES) {
    throw new Error('Evidence files must be 25 MB or smaller.');
  }
  if (!evidence.dataUrl.startsWith('data:')) {
    throw new Error('Choose the evidence file again before saving this update.');
  }

  const response = await fetch(evidence.dataUrl);
  if (!response.ok) throw new Error('The selected evidence file could not be read.');
  const blob = await response.blob();
  if (blob.size > MAX_EVIDENCE_FILE_BYTES) {
    throw new Error('Evidence files must be 25 MB or smaller.');
  }
  return blob;
};

const safeFileName = (fileName: string): string => {
  const baseName = fileName.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return baseName || 'evidence-file';
};

/**
 * Supabase-backed member data source. It targets the schema in
 * supabase/migrations/20261008000000_teamtrack_initial_schema.sql and keeps
 * the shared member repository interface.
 */
export class SupabaseMemberRepository implements MemberRepository {
  async getHome(memberId: MemberEntityId): Promise<MemberHomeData | null> {
    const authUser = await this.requireCurrentMember(memberId);
    const [profile, memberProfile, project, updates] = await Promise.all([
      this.getProfileRow(memberId),
      this.getMemberProfileRow(memberId),
      this.getProjectContext(memberId),
      this.getUpdates(memberId),
    ]);

    if (!profile || !memberProfile) return null;
    const teammates = project.teamId ? await this.getTeammates(project.teamId, memberId) : [];

    return {
      member: this.toMemberProfile(profile, memberProfile, authUser.email ?? ''),
      project,
      teammates,
      latestUpdate: updates[0] ?? null,
      updateCount: updates.length,
    };
  }

  async updateProfile(memberId: MemberEntityId, input: MemberProfileInput): Promise<MemberProfile | null> {
    const authUser = await this.requireCurrentMember(memberId);
    const projectRole = input.projectRole.trim();
    const bio = input.bio.trim();
    const technicalSkills = cleanStringList(input.technicalSkills);
    const responsibilities = cleanStringList(input.responsibilities);

    if (!projectRole || !bio || technicalSkills.length === 0 || responsibilities.length === 0) {
      throw new Error('Project role, about you (bio), technical skills, and responsibilities are all required.');
    }

    const client = requireSupabase();
    const { error } = await client
      .from('member_profiles')
      .update({
        project_role: projectRole,
        bio: bio,
        technical_skills: technicalSkills,
        responsibilities: responsibilities,
        social_links: cleanProfessionalLinks(input.professionalLinks),
      })
      .eq('user_id', memberId);
    if (error) throw new Error(error.message);

    const [profile, memberProfile] = await Promise.all([
      this.getProfileRow(memberId),
      this.getMemberProfileRow(memberId),
    ]);
    return profile && memberProfile
      ? this.toMemberProfile(profile, memberProfile, authUser.email ?? '')
      : null;
  }

  async getUpdates(memberId: MemberEntityId): Promise<MemberWorkUpdate[]> {
    await this.requireCurrentMember(memberId);
    const client = requireSupabase();
    const { data, error } = await client
      .from('work_updates')
      .select('id, member_id, title, what_worked_on, technical_contribution, challenges, next_step, created_at, updated_at, update_attachments(id, kind, label, external_url, storage_path, original_name, mime_type, size_bytes, created_at)')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    return Promise.all(((data ?? []) as unknown as WorkUpdateRow[]).map((row) => this.toWorkUpdate(row)));
  }

  async getUpdate(memberId: MemberEntityId, updateId: MemberEntityId): Promise<MemberWorkUpdate | null> {
    await this.requireCurrentMember(memberId);
    const client = requireSupabase();
    const { data, error } = await client
      .from('work_updates')
      .select('id, member_id, title, what_worked_on, technical_contribution, challenges, next_step, created_at, updated_at, update_attachments(id, kind, label, external_url, storage_path, original_name, mime_type, size_bytes, created_at)')
      .eq('id', updateId)
      .eq('member_id', memberId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? this.toWorkUpdate(data as unknown as WorkUpdateRow) : null;
  }

  async createUpdate(memberId: MemberEntityId, input: MemberWorkUpdateInput): Promise<MemberWorkUpdate | null> {
    await this.requireCurrentMember(memberId);
    const client = requireSupabase();
    const teamId = await this.getAssignedTeamId(memberId);
    const { data, error } = await client
      .from('work_updates')
      .insert({ member_id: memberId, team_id: teamId, ...this.toUpdateFields(input) })
      .select('id')
      .single();
    if (error) throw new Error(error.message);

    try {
      await this.syncEvidence(memberId, data.id as string, input);
      return this.getUpdate(memberId, data.id as string);
    } catch (syncError) {
      await client.from('work_updates').delete().eq('id', data.id as string).eq('member_id', memberId);
      throw syncError;
    }
  }

  async updateUpdate(
    memberId: MemberEntityId,
    updateId: MemberEntityId,
    input: MemberWorkUpdateInput,
  ): Promise<MemberWorkUpdate | null> {
    await this.requireCurrentMember(memberId);
    const client = requireSupabase();
    const { data, error } = await client
      .from('work_updates')
      .update(this.toUpdateFields(input))
      .eq('id', updateId)
      .eq('member_id', memberId)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;

    await this.syncEvidence(memberId, updateId, input);
    return this.getUpdate(memberId, updateId);
  }

  async deleteUpdate(memberId: MemberEntityId, updateId: MemberEntityId): Promise<boolean> {
    await this.requireCurrentMember(memberId);
    const client = requireSupabase();
    const attachments = await this.getAttachments(updateId);
    const { error, count } = await client
      .from('work_updates')
      .delete({ count: 'exact' })
      .eq('id', updateId)
      .eq('member_id', memberId);
    if (error) throw new Error(error.message);

    const storagePaths = attachments.flatMap((attachment) => attachment.storage_path ? [attachment.storage_path] : []);
    if (storagePaths.length) {
      const { error: storageError } = await client.storage.from(EVIDENCE_BUCKET).remove(storagePaths);
      if (storageError) console.warn('The update was deleted, but its evidence file could not be removed.', storageError);
    }
    return (count ?? 0) > 0;
  }

  private async requireCurrentMember(memberId: MemberEntityId) {
    const client = requireSupabase();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new Error('Sign in to access your member workspace.');
    if (data.user.id !== memberId) throw new Error('You can only access your own member workspace.');
    return data.user;
  }

  private async getProfileRow(memberId: MemberEntityId): Promise<ProfileRow | null> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('profiles')
      .select('id, full_name, avatar_url, created_at')
      .eq('id', memberId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as unknown as ProfileRow | null;
  }

  private async getMemberProfileRow(memberId: MemberEntityId): Promise<MemberProfileRow | null> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('member_profiles')
      .select('user_id, project_role, bio, technical_skills, responsibilities, social_links')
      .eq('user_id', memberId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as unknown as MemberProfileRow | null;
  }

  private async getProjectContext(memberId: MemberEntityId): Promise<MemberProjectContext> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('team_members')
      .select('team_id, teams(id, name, project_name, project_goal)')
      .eq('member_id', memberId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const assignment = data as unknown as TeamMembershipRow | null;
    const team = Array.isArray(assignment?.teams) ? assignment.teams[0] : assignment?.teams;
    if (!assignment || !team) {
      return {
        teamId: '',
        teamName: 'No team assigned',
        projectName: 'Project not assigned yet',
        projectGoal: 'Your mentor will add you to a project soon.',
      };
    }
    return {
      teamId: team.id,
      teamName: team.name,
      projectName: team.project_name,
      projectGoal: team.project_goal,
    };
  }

  async getTeammates(teamId: string, _currentMemberId: string): Promise<any[]> {
    if (!teamId) return [];
    const client = requireSupabase();

    const { data: tmData, error: tmError } = await client
      .from('team_members')
      .select('member_id, joined_at')
      .eq('team_id', teamId);
    if (tmError || !tmData || tmData.length === 0) return [];

    const memberIds = tmData.map((x) => x.member_id);

    const [profilesResult, memberProfilesResult] = await Promise.all([
      client.from('profiles').select('id, full_name, email, avatar_url, created_at').in('id', memberIds),
      client.from('member_profiles').select('user_id, project_role, bio, technical_skills, responsibilities, social_links').in('user_id', memberIds),
    ]);

    const profiles = new Map(((profilesResult.data ?? []) as any[]).map((p) => [p.id, p]));
    const memberProfiles = new Map(((memberProfilesResult.data ?? []) as any[]).map((p) => [p.user_id, p]));

    return tmData.map((tm) => {
      const p = profiles.get(tm.member_id);
      const mp = memberProfiles.get(tm.member_id);
      return {
        id: tm.member_id,
        name: p?.full_name || p?.email?.split('@')[0] || 'Team member',
        email: p?.email || '',
        avatarUrl: p?.avatar_url ?? undefined,
        projectRole: mp?.project_role || 'Team Member',
        bio: mp?.bio || '',
        technicalSkills: mp?.technical_skills ?? [],
        responsibilities: mp?.responsibilities ?? [],
        professionalLinks: toProfessionalLinks(mp?.social_links),
        joinedAt: tm.joined_at,
      };
    });
  }

  private toMemberProfile(profile: ProfileRow, memberProfile: MemberProfileRow, email: string): MemberProfile {
    return {
      id: profile.id,
      name: profile.full_name,
      email,
      avatarUrl: profile.avatar_url ?? undefined,
      projectRole: memberProfile.project_role,
      bio: memberProfile.bio,
      technicalSkills: memberProfile.technical_skills ?? [],
      responsibilities: memberProfile.responsibilities ?? [],
      professionalLinks: toProfessionalLinks(memberProfile.social_links),
      joinedAt: profile.created_at,
    };
  }

  private async toWorkUpdate(row: WorkUpdateRow): Promise<MemberWorkUpdate> {
    const attachments = [...(row.update_attachments ?? [])].sort(
      (first, second) => Date.parse(second.created_at) - Date.parse(first.created_at),
    );
    const link = attachments.find((attachment) => attachment.kind === 'link');
    const file = attachments.find((attachment) => attachment.kind === 'file');
    return {
      id: row.id,
      memberId: row.member_id,
      title: row.title,
      whatWorkedOn: row.what_worked_on,
      technicalContribution: row.technical_contribution,
      challenges: row.challenges ?? undefined,
      nextStep: row.next_step ?? undefined,
      evidenceUrl: link?.external_url ?? undefined,
      evidenceFile: file ? await this.toEvidenceFile(file) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async toEvidenceFile(attachment: AttachmentRow): Promise<MemberEvidenceFile | undefined> {
    if (!attachment.storage_path || !attachment.original_name) return undefined;
    const client = requireSupabase();
    const { data, error } = await client.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUrl(attachment.storage_path, SIGNED_URL_LIFETIME_SECONDS);
    if (error || !data?.signedUrl) {
      console.warn('Evidence file is unavailable.', error);
      return undefined;
    }
    return {
      fileName: attachment.original_name,
      mimeType: attachment.mime_type ?? 'application/octet-stream',
      sizeBytes: attachment.size_bytes ?? 0,
      // The existing UI consumes this as an anchor href. A signed URL preserves
      // the same contract while keeping the Storage bucket private.
      dataUrl: data.signedUrl,
    };
  }

  private async getAssignedTeamId(memberId: MemberEntityId): Promise<string> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('team_members')
      .select('team_id')
      .eq('member_id', memberId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data?.team_id) throw new Error('You need to be assigned to a team before adding an update.');
    return data.team_id as string;
  }

  private toUpdateFields(input: MemberWorkUpdateInput) {
    return {
      title: requiredText(input.title, 'Title'),
      what_worked_on: requiredText(input.whatWorkedOn, 'What you worked on'),
      technical_contribution: requiredText(input.technicalContribution, 'Technical contribution'),
      challenges: normaliseText(input.challenges) ?? null,
      next_step: normaliseText(input.nextStep) ?? null,
    };
  }

  private async getAttachments(updateId: MemberEntityId): Promise<AttachmentRow[]> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('update_attachments')
      .select('id, kind, label, external_url, storage_path, original_name, mime_type, size_bytes, created_at')
      .eq('update_id', updateId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as AttachmentRow[];
  }

  private async syncEvidence(
    memberId: MemberEntityId,
    updateId: MemberEntityId,
    input: MemberWorkUpdateInput,
  ): Promise<void> {
    const client = requireSupabase();
    const existing = await this.getAttachments(updateId);
    const existingLinks = existing.filter((attachment) => attachment.kind === 'link');
    const existingFiles = existing.filter((attachment) => attachment.kind === 'file');
    const evidenceUrl = normaliseHttpUrl(input.evidenceUrl, 'Evidence link');

    if (evidenceUrl) {
      // Insert the replacement before removing the previous link so a failed
      // request never destroys existing evidence.
      const { data: newLink, error } = await client.from('update_attachments').insert({
        update_id: updateId,
        uploaded_by: memberId,
        kind: 'link',
        label: 'Evidence link',
        external_url: evidenceUrl,
        storage_path: null,
      }).select('id').single();
      if (error) throw new Error(error.message);
      const obsoleteLinkIds = existingLinks.map((link) => link.id).filter((id) => id !== newLink.id);
      if (obsoleteLinkIds.length) {
        const { error: removeError } = await client.from('update_attachments').delete().in('id', obsoleteLinkIds);
        if (removeError) throw new Error(removeError.message);
      }
    } else if (existingLinks.length) {
      const { error } = await client.from('update_attachments').delete().in('id', existingLinks.map((link) => link.id));
      if (error) throw new Error(error.message);
    }

    if (!input.evidenceFile) {
      await this.removeFileAttachments(existingFiles);
      return;
    }

    // Existing server-backed files are passed to the editor as signed URLs.
    // Keeping one preserves the file; a data URL means the user chose a new file.
    if (!input.evidenceFile.dataUrl.startsWith('data:')) return;

    const newFile = await this.createFileAttachment(memberId, updateId, input.evidenceFile);
    try {
      await this.removeFileAttachments(existingFiles);
    } catch (error) {
      await this.removeFileAttachments([newFile]);
      throw error;
    }
  }

  private async createFileAttachment(
    memberId: MemberEntityId,
    updateId: MemberEntityId,
    evidence: MemberEvidenceFile,
  ): Promise<AttachmentRow> {
    const client = requireSupabase();
    const blob = await toDataBlob(evidence);
    const storagePath = `${memberId}/${updateId}/${crypto.randomUUID()}-${safeFileName(evidence.fileName)}`;
    const { error: uploadError } = await client.storage.from(EVIDENCE_BUCKET).upload(storagePath, blob, {
      contentType: evidence.mimeType || blob.type || 'application/octet-stream',
      upsert: false,
    });
    if (uploadError) throw new Error(uploadError.message);

    const { data, error: attachmentError } = await client
      .from('update_attachments')
      .insert({
        update_id: updateId,
        uploaded_by: memberId,
        kind: 'file',
        label: evidence.fileName,
        storage_path: storagePath,
        external_url: null,
        original_name: evidence.fileName,
        mime_type: evidence.mimeType || blob.type || 'application/octet-stream',
        size_bytes: blob.size,
      })
      .select('id, kind, label, external_url, storage_path, original_name, mime_type, size_bytes, created_at')
      .single();
    if (attachmentError) {
      await client.storage.from(EVIDENCE_BUCKET).remove([storagePath]);
      throw new Error(attachmentError.message);
    }
    return data as unknown as AttachmentRow;
  }

  private async removeFileAttachments(attachments: AttachmentRow[]): Promise<void> {
    if (!attachments.length) return;
    const client = requireSupabase();
    const ids = attachments.map((attachment) => attachment.id);
    const paths = attachments.flatMap((attachment) => attachment.storage_path ? [attachment.storage_path] : []);
    const { error: databaseError } = await client.from('update_attachments').delete().in('id', ids);
    if (databaseError) throw new Error(databaseError.message);
    if (paths.length) {
      const { error: storageError } = await client.storage.from(EVIDENCE_BUCKET).remove(paths);
      if (storageError) console.warn('The evidence record was removed, but its file could not be removed.', storageError);
    }
  }
}

export const supabaseMemberRepository = new SupabaseMemberRepository();
export { MAX_EVIDENCE_FILE_BYTES };
