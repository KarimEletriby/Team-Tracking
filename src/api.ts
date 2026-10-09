import { User } from './types';
import { requireSupabase } from './lib/supabase';

type ProfileRow = {
  id: string;
  full_name: string;
  role: 'admin' | 'mentor' | 'member';
  created_at: string;
};

function toApplicationUser(profile: ProfileRow, email: string | undefined): User {
  const isAdminEmail = email?.trim().toLowerCase() === 'karimeletriby15@gmail.com';
  return {
    id: profile.id,
    name: profile.full_name || email?.split('@')[0] || 'TeamTrack user',
    email: email ?? '',
    role: isAdminEmail ? 'admin' : profile.role,
    createdAt: profile.created_at,
  };
}

/** Authentication operations shared by the application shell and welcome flow. */
export const api = {
  async checkEligibility(email: string, role: 'admin' | 'mentor' | 'member'): Promise<{ allowed: boolean; message?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail === 'karimeletriby15@gmail.com') {
      return { allowed: true };
    }

    if (role === 'admin') {
      return {
        allowed: false,
        message: 'Administrator registration is restricted. Only authorized system administrators may access this portal.',
      };
    }

    try {
      const supabase = requireSupabase();
      const { data, error } = await supabase.rpc('check_registration_eligibility', {
        p_email: cleanEmail,
        p_role: role,
      });

      if (!error && data && typeof data === 'object') {
        let msg = (data as any).message;
        if (msg && /[\u0600-\u06FF]/.test(msg)) {
          if (role === 'mentor') {
            msg = 'This email is not authorized as a mentor. Please contact the administrator for access.';
          } else if (role === 'member') {
            msg = 'This email is not assigned to any team. Your mentor must add you to a team first.';
          } else {
            msg = 'This email is not authorized to register on the platform.';
          }
        }
        return {
          allowed: Boolean((data as any).allowed),
          message: msg,
        };
      }
    } catch {
      // Fall through to direct query fallback
    }

    try {
      const supabase = requireSupabase();
      if (role === 'mentor') {
        const { data, error } = await supabase
          .from('mentor_invitations')
          .select('id')
          .ilike('email', cleanEmail)
          .maybeSingle();

        if (error || !data) {
          return {
            allowed: false,
            message: 'This email is not authorized as a mentor. Please contact the administrator for access.',
          };
        }
      }

      if (role === 'member') {
        const { data, error } = await supabase
          .from('team_invitations')
          .select('id')
          .ilike('email', cleanEmail)
          .maybeSingle();

        if (error || !data) {
          return {
            allowed: false,
            message: 'This email is not assigned to any team. Your mentor must add you to a team first.',
          };
        }
      }
    } catch {
      return {
        allowed: false,
        message: 'Unable to verify email authorization. Please ensure you have been invited by your mentor.',
      };
    }

    return { allowed: true };
  },

  async register(params: { name: string; email: string; password: string; role: 'admin' | 'mentor' | 'member' }): Promise<{ user: User | null; requiresEmailConfirmation: boolean }> {
    const supabase = requireSupabase();
    const isAdminEmail = params.email.trim().toLowerCase() === 'karimeletriby15@gmail.com';
    const effectiveRole = isAdminEmail ? 'admin' : params.role;

    // Strict pre-registration authorization check
    const eligibility = await this.checkEligibility(params.email, effectiveRole);
    if (!eligibility.allowed) {
      throw new Error(eligibility.message || 'This email is not authorized to register on the platform.');
    }

    const { data, error } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        data: { full_name: params.name, requested_role: effectiveRole },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      if (
        error.message.toLowerCase().includes('not authorized') ||
        error.message.toLowerCase().includes('unauthorized') ||
        /[\u0600-\u06FF]/.test(error.message)
      ) {
        throw new Error('This email is not authorized to register. You must be invited by a mentor or administrator first.');
      }
      throw error;
    }
    if (!data.user) throw new Error('Account creation could not be completed.');

    if (!data.session) {
      return { user: null, requiresEmailConfirmation: true };
    }

    const user = await this.getMe();
    return { user: user.user, requiresEmailConfirmation: false };
  },

  async login(params: {
    email: string;
    password: string;
    expectedRole?: 'admin' | 'mentor' | 'member';
  }): Promise<{ user: User }> {
    const supabase = requireSupabase();
    const cleanEmail = params.email.trim().toLowerCase();

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: params.password,
    });

    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        throw new Error('Email not confirmed. Check your inbox for the confirmation link, or disable "Confirm email" in Supabase Auth Settings.');
      }
      if (error.message.toLowerCase().includes('invalid login credentials')) {
        throw new Error('Invalid email or password. Please verify your credentials.');
      }
      if (/[\u0600-\u06FF]/.test(error.message)) {
        throw new Error('Invalid email or password. Please verify your credentials.');
      }
      throw error;
    }

    const { user } = await this.getMe();

    // 1. Verify Admin Portal access
    if (params.expectedRole === 'admin') {
      if (user.role !== 'admin') {
        await supabase.auth.signOut();
        throw new Error('This account is not authorized for administrator portal access.');
      }
    }

    // 2. Verify Mentor Portal access
    if (params.expectedRole === 'mentor') {
      if (user.role !== 'mentor' && user.role !== 'admin') {
        await supabase.auth.signOut();
        throw new Error('This account is not a mentor account. If you are a team member, please sign in via the Member portal.');
      }
    }

    // 3. Verify Member Portal access
    if (params.expectedRole === 'member') {
      if (user.role === 'mentor') {
        await supabase.auth.signOut();
        throw new Error('This account is registered as a mentor. Please sign in via the Mentor portal.');
      }
    }

    // 4. Strict verification for members: must be assigned to a team or invited
    if (user.role === 'member') {
      let isAssigned = false;

      // Check active team membership
      try {
        const { data: tm } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('member_id', user.id)
          .limit(1);

        if (tm && tm.length > 0) {
          isAssigned = true;
        }
      } catch {}

      // Check pending invitations to auto-link
      if (!isAssigned) {
        try {
          const { data: invites } = await supabase
            .from('team_invitations')
            .select('id, team_id')
            .ilike('email', cleanEmail)
            .limit(1);

          if (invites && invites.length > 0) {
            isAssigned = true;
            const teamId = invites[0].team_id;
            await supabase.from('team_members').upsert({ team_id: teamId, member_id: user.id }, { onConflict: 'member_id' });
            await supabase.from('team_invitations').delete().ilike('email', cleanEmail);
          }
        } catch {}
      }

      if (!isAssigned) {
        await supabase.auth.signOut();
        throw new Error('This email is not assigned to any team. You must be added to a team by a mentor before signing in.');
      }
    }

    return { user };
  },

  async getMe(): Promise<{ user: User }> {
    const supabase = requireSupabase();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authUser) throw new Error('Please sign in to continue.');

    const isAdminEmail = authUser.email?.trim().toLowerCase() === 'karimeletriby15@gmail.com';

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, role, created_at')
      .eq('id', authUser.id)
      .maybeSingle<ProfileRow>();

    if (profileError) {
      if ((profileError as any).code === 'PGRST205') {
        throw new Error('Database schema not initialized. Please run the SQL migration in Supabase SQL editor.');
      }
      throw profileError;
    }

    if (!profile) {
      const rawRole = isAdminEmail ? 'admin' : ((authUser.user_metadata?.requested_role === 'mentor' ? 'mentor' : 'member') as 'admin' | 'mentor' | 'member');
      const fallbackProfile: ProfileRow = {
        id: authUser.id,
        full_name: (authUser.user_metadata?.full_name as string) || authUser.email?.split('@')[0] || 'TeamTrack user',
        role: rawRole,
        created_at: authUser.created_at,
      };
      return { user: toApplicationUser(fallbackProfile, authUser.email) };
    }

    return { user: toApplicationUser(profile, authUser.email) };
  },

  async logout() {
    const { error } = await requireSupabase().auth.signOut();
    if (error) throw error;
  },
};
