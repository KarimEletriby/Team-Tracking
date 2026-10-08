export type UserRole = 'mentor' | 'member';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface Team {
  id: string;
  mentorId: string;
  name: string;
  createdAt: string;
  memberCount?: number;
}

export interface MemberProfile {
  id: string;
  userId: string;
  role: string;
  responsibilities: string[];
  technicalSkills: string[];
  bio: string;
  avatarUrl: string;
  updatedAt: string;
}

export interface WorkUpdate {
  id: string;
  userId: string;
  teamId?: string | null;
  title: string;
  whatWorkedOn: string;
  technicalWork: string;
  challenges?: string;
  nextStep?: string;
  evidenceLink?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMemberCard {
  id: string; // userId
  name: string;
  email: string;
  role: string;
  avatarUrl: string;
  lastUpdate: string | null;
  updateCount: number;
}

export interface MemberDetail {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  teamId: string | null;
  teamName: string | null;
  profile: MemberProfile;
}

export interface AuthState {
  token: string | null;
  user: User | null;
  profile?: MemberProfile | null;
  teamId?: string | null;
  teamName?: string | null;
}
