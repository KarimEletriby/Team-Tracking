/** Shared types for the member workspace and its Supabase data source. */

export type MemberEntityId = string;
export type MemberISODateString = string;

export interface MemberProfile {
  id: MemberEntityId;
  name: string;
  email: string;
  avatarUrl?: string;
  projectRole: string;
  bio: string;
  technicalSkills: string[];
  responsibilities: string[];
  professionalLinks: MemberProfessionalLinks;
  joinedAt: MemberISODateString;
}

/** Optional public links a member chooses to share with their mentor. */
export interface MemberProfessionalLinks {
  linkedIn?: string;
  github?: string;
  portfolio?: string;
}

/** Read-only project context shown to a member. */
export interface MemberProjectContext {
  teamId: MemberEntityId;
  teamName: string;
  projectName: string;
  projectGoal: string;
}

export interface MemberWorkUpdate {
  id: MemberEntityId;
  memberId: MemberEntityId;
  title: string;
  whatWorkedOn: string;
  technicalContribution: string;
  challenges?: string;
  nextStep?: string;
  evidenceUrl?: string;
  /** File data held briefly while the update form is being submitted. */
  evidenceFile?: MemberEvidenceFile;
  createdAt: MemberISODateString;
  updatedAt: MemberISODateString;
}

export interface MemberEvidenceFile {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** A local data URL used to upload the selected file to private storage. */
  dataUrl: string;
}

export interface MemberHomeData {
  member: MemberProfile;
  project: MemberProjectContext;
  latestUpdate: MemberWorkUpdate | null;
  updateCount: number;
}

export type MemberProfileInput = Pick<
  MemberProfile,
  'projectRole' | 'bio' | 'technicalSkills' | 'responsibilities' | 'professionalLinks'
>;

export type MemberWorkUpdateInput = Pick<
  MemberWorkUpdate,
  | 'title'
  | 'whatWorkedOn'
  | 'technicalContribution'
  | 'challenges'
  | 'nextStep'
  | 'evidenceUrl'
  | 'evidenceFile'
>;

/** Operations available to the signed-in member. */
export interface MemberRepository {
  getHome(memberId: MemberEntityId): Promise<MemberHomeData | null>;
  updateProfile(
    memberId: MemberEntityId,
    input: MemberProfileInput,
  ): Promise<MemberProfile | null>;
  getUpdates(memberId: MemberEntityId): Promise<MemberWorkUpdate[]>;
  getUpdate(
    memberId: MemberEntityId,
    updateId: MemberEntityId,
  ): Promise<MemberWorkUpdate | null>;
  createUpdate(
    memberId: MemberEntityId,
    input: MemberWorkUpdateInput,
  ): Promise<MemberWorkUpdate | null>;
  updateUpdate(
    memberId: MemberEntityId,
    updateId: MemberEntityId,
    input: MemberWorkUpdateInput,
  ): Promise<MemberWorkUpdate | null>;
  deleteUpdate(memberId: MemberEntityId, updateId: MemberEntityId): Promise<boolean>;
}
