import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type InviteMemberRequest = {
  teamId?: string;
  /** Use this only to assign an existing, currently unassigned member. */
  memberId?: string;
  /** Use this only to invite a brand-new member account. */
  email?: string;
  fullName?: string;
  projectRole?: string;
  redirectTo?: string;
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const cleanText = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/**
 * Supabase Auth has no email lookup endpoint. The service-role Admin API is
 * paginated, so search every page without returning account information to the
 * caller. For very large installations, replace this with a trusted database
 * RPC that performs the same exact-email lookup.
 */
async function findAuthUserByEmail(
  adminClient: ReturnType<typeof createClient>,
  email: string,
): Promise<{ id: string } | null> {
  const pageSize = 1_000;
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: pageSize });
    if (error) throw new Error(error.message);

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return { id: user.id };
    if (data.users.length < pageSize) return null;
    page += 1;
  }
}

async function ensureUnassignedMember(
  adminClient: ReturnType<typeof createClient>,
  memberId: string,
): Promise<boolean> {
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', memberId)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (!profile || profile.role !== 'member') return false;

  const { data: assignment, error: assignmentError } = await adminClient
    .from('team_members')
    .select('team_id')
    .eq('member_id', memberId)
    .maybeSingle();
  if (assignmentError) throw new Error(assignmentError.message);
  return !assignment;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    console.error('Supabase Edge Function environment is incomplete.');
    return json(500, { error: 'Server configuration is incomplete.' });
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json(401, { error: 'Authorization is required.' });

  let body: InviteMemberRequest;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Request body must be valid JSON.' });
  }

  const teamId = cleanText(body.teamId);
  const memberId = cleanText(body.memberId);
  const email = cleanText(body.email).toLowerCase();
  const fullName = cleanText(body.fullName);
  const projectRole = cleanText(body.projectRole);
  const redirectTo = cleanText(body.redirectTo);

  if (!teamId) return json(400, { error: 'teamId is required.' });
  if (memberId && email) {
    return json(400, { error: 'Provide memberId for an existing member or email for a new invitation, not both.' });
  }
  if (!memberId && !email) {
    return json(400, { error: 'Provide memberId for an existing member or email for a new invitation.' });
  }
  if (email && !isValidEmail(email)) return json(400, { error: 'A valid email address is required.' });
  if (projectRole.length > 120) return json(400, { error: 'projectRole cannot exceed 120 characters.' });

  // This client is scoped to the caller's JWT. It is used for authentication
  // and authorization checks before the service role is ever used.
  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await callerClient.auth.getUser();
  const caller = authData.user;
  if (authError || !caller) return json(401, { error: 'Your session is invalid or expired.' });

  const { data: callerProfile, error: callerProfileError } = await callerClient
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .maybeSingle();
  if (callerProfileError) return json(500, { error: callerProfileError.message });
  if (!callerProfile || callerProfile.role !== 'mentor') {
    return json(403, { error: 'Only mentors can add members to a team.' });
  }

  const { data: ownedTeam, error: ownedTeamError } = await callerClient
    .from('teams')
    .select('id, name')
    .eq('id', teamId)
    .eq('mentor_id', caller.id)
    .maybeSingle();
  if (ownedTeamError) return json(500, { error: ownedTeamError.message });
  if (!ownedTeam) return json(403, { error: 'You do not manage this team.' });

  // This client never leaves the function. It performs account invitation and
  // writes which the mentor's browser must not be trusted to perform directly.
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let targetMemberId = memberId;

  if (memberId) {
    try {
      if (!await ensureUnassignedMember(adminClient, memberId)) {
        return json(409, { error: 'This account cannot be added to the team.' });
      }
    } catch (error) {
      console.error('Existing member validation failed.', error);
      return json(500, { error: 'The member could not be validated.' });
    }
  } else {
    try {
      const existingUser = await findAuthUserByEmail(adminClient, email);
      if (existingUser) {
        if (!await ensureUnassignedMember(adminClient, existingUser.id)) {
          return json(409, { error: 'This account cannot be added to the team.' });
        }
        targetMemberId = existingUser.id;
      }
    } catch (error) {
      console.error('Existing email lookup failed.', error);
      return json(500, { error: 'The member could not be validated.' });
    }
  }

  if (!targetMemberId) {
    const { data: invitation, error: invitationError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      ...(redirectTo ? { redirectTo } : {}),
    });

    if (invitationError || !invitation.user) {
      // A simultaneous signup can make the invite fail after the lookup. Retry
      // one exact lookup, then apply the same unassigned-member requirement.
      try {
        const concurrentUser = await findAuthUserByEmail(adminClient, email);
        if (concurrentUser && await ensureUnassignedMember(adminClient, concurrentUser.id)) {
          targetMemberId = concurrentUser.id;
        } else {
          return json(409, { error: 'This account cannot be added to the team.' });
        }
      } catch (error) {
        console.error('Invitation fallback failed.', error);
        return json(500, { error: 'The member could not be invited.' });
      }
    } else {
      targetMemberId = invitation.user.id;
    }
  }

  if (!targetMemberId) {
    // Defensive guard for type narrowing and unexpected Auth responses.
    return json(500, { error: 'The member could not be added to the team.' });
  }

  /*
   * New users receive the member role from the auth-user trigger. Existing
   * accounts have already passed ensureUnassignedMember above, so this upsert
   * cannot promote a mentor or change an account's authorization level.
   */
  const { error: memberProfileError } = await adminClient
    .from('member_profiles')
    .upsert({ user_id: targetMemberId, project_role: projectRole }, { onConflict: 'user_id' });
  if (memberProfileError) return json(500, { error: memberProfileError.message });

  const { error: membershipError } = await adminClient
    .from('team_members')
    .insert({ team_id: teamId, member_id: targetMemberId });
  if (membershipError) {
    if (membershipError.code === '23505') {
      return json(409, { error: 'This account cannot be added to the team.' });
    }
    return json(500, { error: membershipError.message });
  }

  // Use one success status and response shape for invited and existing users,
  // so this endpoint does not become an account-enumeration oracle.
  return json(201, {
    success: true,
    teamId: ownedTeam.id,
  });
});
