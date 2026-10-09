/** Shared types for the mentor workspace and its Supabase data source. */

export type EntityId = string;
export type ISODateString = string;

export type TeamHealth = 'on-track' | 'needs-attention' | 'at-risk';
export type MemberProgressStatus = 'on-track' | 'needs-attention' | 'no-recent-update';
export type UpdateReviewStatus = 'new' | 'reviewed';

export interface MentorIdentity {
  id: EntityId;
  name: string;
  avatarUrl?: string;
}

export interface MentorTeam {
  id: EntityId;
  mentorId: EntityId;
  name: string;
  projectName: string;
  projectGoal: string;
  memberCount: number;
  health: TeamHealth;
  completionPercent: number;
  lastActivityAt: ISODateString | null;
  needsAttentionCount: number;
}

export interface MentorMemberSummary {
  id: EntityId;
  teamId: EntityId;
  name: string;
  email: string;
  avatarUrl?: string;
  projectRole: string;
  progressStatus: MemberProgressStatus;
  lastUpdateAt: ISODateString | null;
  updateCount: number;
}

export interface MentorMemberProfile extends MentorMemberSummary {
  bio: string;
  technicalSkills: string[];
  responsibilities: string[];
  professionalLinks?: MentorProfessionalLinks;
  joinedAt: ISODateString;
}

export interface MentorProfessionalLinks {
  linkedIn?: string;
  github?: string;
  portfolio?: string;
}

export interface MentorWorkUpdate {
  id: EntityId;
  teamId: EntityId;
  memberId: EntityId;
  title: string;
  summary: string;
  technicalDetails: string;
  challenges?: string;
  nextStep?: string;
  evidenceUrl?: string;
  /** A short-lived Storage URL generated only for an authorized mentor. */
  evidenceFile?: MentorEvidenceFile;
  submittedAt: ISODateString;
  reviewStatus: UpdateReviewStatus;
}

export interface MentorEvidenceFile {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  signedUrl: string;
}

export interface MentorActivity {
  id: EntityId;
  teamId: EntityId;
  memberId?: EntityId;
  type: 'update-submitted' | 'member-needs-attention';
  message: string;
  happenedAt: ISODateString;
}

export interface MentorDashboardData {
  mentor: MentorIdentity;
  summary: {
    teamCount: number;
    memberCount: number;
    updatesThisWeek: number;
    membersNeedingAttention: number;
  };
  teams: MentorTeam[];
  recentActivity: MentorActivity[];
}

export interface TeamWorkspaceData {
  team: MentorTeam;
  members: MentorMemberSummary[];
  updates: MentorWorkUpdate[];
}

export interface MemberReviewData {
  member: MentorMemberProfile;
  updates: MentorWorkUpdate[];
}

/** Operations available to the signed-in mentor. */
export interface MentorRepository {
  getDashboard(mentorId: EntityId): Promise<MentorDashboardData>;
  getTeams(mentorId: EntityId): Promise<MentorTeam[]>;
  getTeamWorkspace(teamId: EntityId): Promise<TeamWorkspaceData | null>;
  getMemberReview(memberId: EntityId): Promise<MemberReviewData | null>;
  createTeam(mentorId: EntityId, input: CreateTeamInput): Promise<MentorTeam>;
  updateTeam(teamId: EntityId, input: UpdateTeamInput): Promise<MentorTeam | null>;
  addMember(teamId: EntityId, input: CreateMemberInput): Promise<MentorMemberProfile | null>;
  moveMember(memberId: EntityId, teamId: EntityId): Promise<MentorMemberProfile | null>;
  removeMember(memberId: EntityId): Promise<boolean>;
}

export interface CreateTeamInput {
  name: string;
  projectName: string;
  projectGoal: string;
}

export type UpdateTeamInput = CreateTeamInput;

export interface CreateMemberInput {
  name: string;
  email: string;
  projectRole?: string;
}
