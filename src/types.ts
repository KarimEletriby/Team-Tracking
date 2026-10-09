export type UserRole = 'admin' | 'mentor' | 'member';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}
