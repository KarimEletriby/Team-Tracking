import { User, Team, WorkUpdate, MemberDetail, TeamMemberCard, MemberProfile, UserRole } from './types';

const TOKEN_KEY = 'teamtrack_auth_token_v1';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.error || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return data as T;
}

// Auth API
export const api = {
  // Auth
  async register(params: { name: string; email: string; password: string; role: UserRole }): Promise<{ user: User; token: string }> {
    const res = await request<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    setStoredToken(res.token);
    return res;
  },

  async login(params: { email: string; password: string }): Promise<{ user: User; token: string }> {
    const res = await request<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    setStoredToken(res.token);
    return res;
  },

  async getMe(): Promise<{ user: User; profile?: MemberProfile; teamId?: string | null; teamName?: string | null }> {
    return request('/api/auth/me');
  },

  async getUsers(): Promise<{ users: User[] }> {
    return request('/api/auth/users');
  },

  logout() {
    setStoredToken(null);
  },

  // Teams (Mentor Only)
  async getTeams(): Promise<{ teams: Team[] }> {
    return request('/api/teams');
  },

  async createTeam(name: string): Promise<{ team: Team }> {
    return request('/api/teams', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  async getTeam(id: string): Promise<{ team: Team; members: TeamMemberCard[] }> {
    return request(`/api/teams/${id}`);
  },

  async updateTeam(id: string, name: string): Promise<{ team: Team }> {
    return request(`/api/teams/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  },

  async addMemberToTeam(
    teamId: string,
    params: { name: string; email: string; password?: string; roleTitle?: string }
  ): Promise<{ member: TeamMemberCard }> {
    return request(`/api/teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  // Members
  async getMember(id: string): Promise<{ member: MemberDetail }> {
    return request(`/api/members/${id}`);
  },

  async updateMemberProfile(
    id: string,
    params: Partial<Pick<MemberProfile, 'role' | 'responsibilities' | 'technicalSkills' | 'bio' | 'avatarUrl'>>
  ): Promise<{ member: MemberDetail }> {
    return request(`/api/members/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(params),
    });
  },

  async getMemberUpdates(id: string): Promise<{ updates: WorkUpdate[] }> {
    return request(`/api/members/${id}/updates`);
  },

  // Updates (Member creates/edits own updates)
  async createUpdate(params: {
    title: string;
    whatWorkedOn: string;
    technicalWork: string;
    challenges?: string;
    nextStep?: string;
    evidenceLink?: string;
  }): Promise<{ update: WorkUpdate }> {
    return request('/api/updates', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async updateUpdate(
    id: string,
    params: Partial<{
      title: string;
      whatWorkedOn: string;
      technicalWork: string;
      challenges: string;
      nextStep: string;
      evidenceLink: string;
    }>
  ): Promise<{ update: WorkUpdate }> {
    return request(`/api/updates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(params),
    });
  },

  async deleteUpdate(id: string): Promise<{ success: boolean }> {
    return request(`/api/updates/${id}`, {
      method: 'DELETE',
    });
  },
};

export function formatRelativeTime(isoDate: string | null | undefined): string {
  if (!isoDate) return 'No updates yet';
  const now = Date.now();
  const past = new Date(isoDate).getTime();
  const diffSec = Math.floor((now - past) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
