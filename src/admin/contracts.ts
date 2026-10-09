export interface AdminSummary {
  mentorCount: number;
  teamCount: number;
  memberCount: number;
  adminCount: number;
}

export interface AdminMentorItem {
  id: string;
  name: string;
  email: string;
  teamCount: number;
  createdAt: string;
  isPending?: boolean;
}

export interface AdminTeamItem {
  id: string;
  name: string;
  projectName: string;
  mentorName: string;
  memberCount: number;
  createdAt: string;
}

export interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'mentor' | 'member';
  createdAt: string;
}

export interface AdminOverviewData {
  summary: AdminSummary;
  mentors: AdminMentorItem[];
  teams: AdminTeamItem[];
  admins: AdminUserItem[];
}

export interface AdminRepository {
  getOverview(): Promise<AdminOverviewData>;
  addMentor(name: string, email: string): Promise<boolean>;
  removeMentor(mentorId: string): Promise<boolean>;
  promoteAdmin(email: string): Promise<boolean>;
}
