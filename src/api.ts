import { User } from './types';
import { requireSupabase } from './lib/supabase';

type ProfileRow = {
  id: string;
  full_name: string;
  role: 'mentor' | 'member';
  created_at: string;
};

function toApplicationUser(profile: ProfileRow, email: string | undefined): User {
  return {
    id: profile.id,
    name: profile.full_name || email?.split('@')[0] || 'TeamTrack user',
    email: email ?? '',
    role: profile.role,
    createdAt: profile.created_at,
  };
}

/** Authentication operations shared by the application shell and welcome flow. */
export const api = {
  async register(params: { name: string; email: string; password: string; role: 'mentor' | 'member' }): Promise<{ user: User | null; requiresEmailConfirmation: boolean }> {
    const supabase = requireSupabase();
    const { data, error } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        data: { full_name: params.name, requested_role: params.role },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) throw error;
    if (!data.user) throw new Error('Account creation could not be completed.');

    if (!data.session) {
      return { user: null, requiresEmailConfirmation: true };
    }

    const user = await this.getMe();
    return { user: user.user, requiresEmailConfirmation: false };
  },

  async login(params: { email: string; password: string }): Promise<{ user: User }> {
    const supabase = requireSupabase();
    const { error } = await supabase.auth.signInWithPassword({
      email: params.email,
      password: params.password,
    });

    if (error) throw error;
    return this.getMe();
  },

  async getMe(): Promise<{ user: User }> {
    const supabase = requireSupabase();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authUser) throw new Error('Please sign in to continue.');

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, role, created_at')
      .eq('id', authUser.id)
      .single<ProfileRow>();
    if (profileError) throw profileError;

    return { user: toApplicationUser(profile, authUser.email) };
  },

  async logout() {
    const { error } = await requireSupabase().auth.signOut();
    if (error) throw error;
  },
};
