import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DB_FILE = path.resolve(process.cwd(), 'server', 'database.json');
const JWT_SECRET = 'teamtrack_secure_jwt_secret_key_2026';

// Helper to hash password
function hashPassword(password) {
  const salt = 'salt_teamtrack_2026';
  return crypto.scryptSync(password, salt, 32).toString('hex');
}

// Helper to create token
function generateToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

// Helper to verify token
function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  if (signature !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// Initial clean database state: ZERO fake business data
function getInitialDb() {
  return {
    users: [],
    teams: [],
    teamMembers: [],
    memberProfiles: [],
    updates: []
  };
}

// Load DB
function loadDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = getInitialDb();
      saveDb(initial);
      return initial;
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading db:', err);
    return getInitialDb();
  }
}

// Save DB atomically
function saveDb(db) {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

// Parse request body helper
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

// Send JSON helper
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

// Extract authenticated user
function authenticate(req, db) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (!payload || !payload.userId) return null;
  const user = db.users.find((u) => u.id === payload.userId);
  return user || null;
}

export function backendApiPlugin() {
  return {
    name: 'teamtrack-backend-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api')) {
          return next();
        }

        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS'
          });
          return res.end();
        }

        const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = urlObj.pathname;
        const method = req.method;
        const db = loadDb();

        try {
          // ==========================================
          // AUTH ROUTES
          // ==========================================

          // POST /api/auth/register
          if (pathname === '/api/auth/register' && method === 'POST') {
            const body = await parseBody(req);
            const { name, email, password, role } = body;

            if (!name || !email || !password || !role) {
              return sendJson(res, 400, { error: 'Name, email, password, and role are required.' });
            }
            if (role !== 'mentor' && role !== 'member') {
              return sendJson(res, 400, { error: 'Role must be either "mentor" or "member".' });
            }

            const cleanEmail = email.toLowerCase().trim();
            if (db.users.some((u) => u.email === cleanEmail)) {
              return sendJson(res, 409, { error: 'An account with this email already exists.' });
            }

            const userId = 'u_' + crypto.randomUUID().substring(0, 8);
            const newUser = {
              id: userId,
              name: name.trim(),
              email: cleanEmail,
              passwordHash: hashPassword(password),
              role,
              createdAt: new Date().toISOString()
            };

            db.users.push(newUser);

            // If Mentor: initialize 2 empty teams per specification:
            // "The system is designed to support 2 teams initially, with the ability for the Mentor to add more teams later.
            // Do NOT invent names or members for the two teams. The Mentor should create/configure the teams and enter their actual information."
            if (role === 'mentor') {
              const team1 = {
                id: 'team_' + crypto.randomUUID().substring(0, 8),
                mentorId: userId,
                name: 'Team 1',
                createdAt: new Date().toISOString()
              };
              const team2 = {
                id: 'team_' + crypto.randomUUID().substring(0, 8),
                mentorId: userId,
                name: 'Team 2',
                createdAt: new Date().toISOString()
              };
              db.teams.push(team1, team2);
            } else if (role === 'member') {
              // Create empty member profile
              db.memberProfiles.push({
                id: 'prof_' + crypto.randomUUID().substring(0, 8),
                userId,
                role: '',
                responsibilities: [],
                technicalSkills: [],
                bio: '',
                avatarUrl: '',
                updatedAt: new Date().toISOString()
              });
            }

            saveDb(db);

            const token = generateToken({ userId: newUser.id, role: newUser.role });
            const { passwordHash: _, ...safeUser } = newUser;
            return sendJson(res, 201, { user: safeUser, token });
          }

          // POST /api/auth/login
          if (pathname === '/api/auth/login' && method === 'POST') {
            const body = await parseBody(req);
            const { email, password } = body;

            if (!email || !password) {
              return sendJson(res, 400, { error: 'Email and password are required.' });
            }

            const cleanEmail = email.toLowerCase().trim();
            const user = db.users.find((u) => u.email === cleanEmail);
            if (!user || user.passwordHash !== hashPassword(password)) {
              return sendJson(res, 401, { error: 'Invalid email or password.' });
            }

            const token = generateToken({ userId: user.id, role: user.role });
            const { passwordHash: _, ...safeUser } = user;
            return sendJson(res, 200, { user: safeUser, token });
          }

          // GET /api/auth/me
          if (pathname === '/api/auth/me' && method === 'GET') {
            const user = authenticate(req, db);
            if (!user) {
              return sendJson(res, 401, { error: 'Unauthorized. Please log in.' });
            }
            const { passwordHash: _, ...safeUser } = user;
            let extra = {};
            if (user.role === 'member') {
              const profile = db.memberProfiles.find((p) => p.userId === user.id) || null;
              const tm = db.teamMembers.find((m) => m.userId === user.id);
              const team = tm ? db.teams.find((t) => t.id === tm.teamId) : null;
              extra = { profile, teamId: tm?.teamId || null, teamName: team?.name || null };
            }
            return sendJson(res, 200, { user: safeUser, ...extra });
          }

          // GET /api/auth/users (convenience endpoint for testing/switching between real accounts)
          if (pathname === '/api/auth/users' && method === 'GET') {
            const safeUsers = db.users.map(({ passwordHash: _, ...u }) => u);
            return sendJson(res, 200, { users: safeUsers });
          }

          // ==========================================
          // BACKEND AUTHORIZATION CHECK FOR REMAINING ENDPOINTS
          // ==========================================
          const currentUser = authenticate(req, db);
          if (!currentUser) {
            return sendJson(res, 401, { error: 'Authentication required. Invalid or missing token.' });
          }

          // ==========================================
          // TEAMS ENDPOINTS (MENTOR ONLY)
          // ==========================================

          // GET /api/teams
          if (pathname === '/api/teams' && method === 'GET') {
            // Strictly enforce: Members must NOT be able to view teams
            if (currentUser.role !== 'mentor') {
              return sendJson(res, 403, { error: 'Forbidden: Members are not permitted to access teams.' });
            }

            const mentorTeams = db.teams.filter((t) => t.mentorId === currentUser.id);
            const teamsWithCounts = mentorTeams.map((team) => {
              const memberCount = db.teamMembers.filter((tm) => tm.teamId === team.id).length;
              return {
                ...team,
                memberCount
              };
            });

            return sendJson(res, 200, { teams: teamsWithCounts });
          }

          // POST /api/teams
          if (pathname === '/api/teams' && method === 'POST') {
            if (currentUser.role !== 'mentor') {
              return sendJson(res, 403, { error: 'Forbidden: Only mentors can create teams.' });
            }

            const body = await parseBody(req);
            const name = body.name?.trim();
            if (!name) {
              return sendJson(res, 400, { error: 'Team name is required.' });
            }

            const newTeam = {
              id: 'team_' + crypto.randomUUID().substring(0, 8),
              mentorId: currentUser.id,
              name,
              createdAt: new Date().toISOString()
            };
            db.teams.push(newTeam);
            saveDb(db);

            return sendJson(res, 201, { team: { ...newTeam, memberCount: 0 } });
          }

          // MATCH /api/teams/:id
          const teamIdMatch = pathname.match(/^\/api\/teams\/([^/]+)$/);
          if (teamIdMatch) {
            const teamId = teamIdMatch[1];

            // Members can NEVER view or edit teams
            if (currentUser.role !== 'mentor') {
              return sendJson(res, 403, { error: 'Forbidden: Members cannot access teams.' });
            }

            const team = db.teams.find((t) => t.id === teamId);
            if (!team) {
              return sendJson(res, 404, { error: 'Team not found.' });
            }
            if (team.mentorId !== currentUser.id) {
              return sendJson(res, 403, { error: 'Forbidden: You do not supervise this team.' });
            }

            // GET /api/teams/:id
            if (method === 'GET') {
              const teamMembersAssoc = db.teamMembers.filter((tm) => tm.teamId === team.id);
              const membersData = teamMembersAssoc.map((tm) => {
                const user = db.users.find((u) => u.id === tm.userId);
                const profile = db.memberProfiles.find((p) => p.userId === tm.userId);
                const userUpdates = db.updates.filter((up) => up.userId === tm.userId);
                const latestUpdate = userUpdates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

                return {
                  id: tm.userId,
                  name: user?.name || 'Unnamed Member',
                  email: user?.email || '',
                  role: profile?.role || 'Not specified',
                  avatarUrl: profile?.avatarUrl || '',
                  lastUpdate: latestUpdate?.createdAt || null,
                  updateCount: userUpdates.length
                };
              });

              return sendJson(res, 200, {
                team: {
                  ...team,
                  memberCount: membersData.length
                },
                members: membersData
              });
            }

            // PATCH /api/teams/:id (Update team name)
            if (method === 'PATCH') {
              const body = await parseBody(req);
              if (body.name?.trim()) {
                team.name = body.name.trim();
                saveDb(db);
              }
              return sendJson(res, 200, { team });
            }
          }

          // POST /api/teams/:id/members
          const addMemberMatch = pathname.match(/^\/api\/teams\/([^/]+)\/members$/);
          if (addMemberMatch && method === 'POST') {
            const teamId = addMemberMatch[1];

            if (currentUser.role !== 'mentor') {
              return sendJson(res, 403, { error: 'Forbidden: Only mentors can add members to a team.' });
            }

            const team = db.teams.find((t) => t.id === teamId);
            if (!team) {
              return sendJson(res, 404, { error: 'Team not found.' });
            }
            if (team.mentorId !== currentUser.id) {
              return sendJson(res, 403, { error: 'Forbidden: You do not supervise this team.' });
            }

            const body = await parseBody(req);
            const { name, email, password, roleTitle } = body;

            if (!name || !email) {
              return sendJson(res, 400, { error: 'Member name and email are required.' });
            }

            const cleanEmail = email.toLowerCase().trim();
            let memberUser = db.users.find((u) => u.email === cleanEmail);

            if (!memberUser) {
              // Create user account for member
              const memberPassword = password || '123456';
              const memberId = 'u_' + crypto.randomUUID().substring(0, 8);
              memberUser = {
                id: memberId,
                name: name.trim(),
                email: cleanEmail,
                passwordHash: hashPassword(memberPassword),
                role: 'member',
                createdAt: new Date().toISOString()
              };
              db.users.push(memberUser);

              // Initialize empty member profile
              db.memberProfiles.push({
                id: 'prof_' + crypto.randomUUID().substring(0, 8),
                userId: memberId,
                role: roleTitle?.trim() || '',
                responsibilities: [],
                technicalSkills: [],
                bio: '',
                avatarUrl: '',
                updatedAt: new Date().toISOString()
              });
            }

            // Check if already in this team
            const alreadyInTeam = db.teamMembers.some((tm) => tm.teamId === teamId && tm.userId === memberUser.id);
            if (!alreadyInTeam) {
              db.teamMembers.push({
                id: 'tm_' + crypto.randomUUID().substring(0, 8),
                teamId: team.id,
                userId: memberUser.id,
                createdAt: new Date().toISOString()
              });
            }

            saveDb(db);

            const profile = db.memberProfiles.find((p) => p.userId === memberUser.id);
            return sendJson(res, 201, {
              member: {
                id: memberUser.id,
                name: memberUser.name,
                email: memberUser.email,
                role: profile?.role || 'Not specified',
                avatarUrl: profile?.avatarUrl || '',
                lastUpdate: null,
                updateCount: 0
              }
            });
          }

          // ==========================================
          // MEMBER PROFILE ENDPOINTS
          // ==========================================

          // MATCH /api/members/:id
          const memberIdMatch = pathname.match(/^\/api\/members\/([^/]+)$/);
          if (memberIdMatch) {
            const targetUserId = memberIdMatch[1];

            // Authorization logic per Section 9:
            // "MENTOR: Mentor -> Own Teams -> Members in those Teams -> Member Profiles"
            // "MEMBER: Member -> Own Profile"
            // "A Member must never be able to access another member by manually changing URL, ID, API parameters"
            if (currentUser.role === 'member') {
              if (currentUser.id !== targetUserId) {
                return sendJson(res, 403, {
                  error: 'Forbidden: You are not authorized to access another member\'s profile.'
                });
              }
            } else if (currentUser.role === 'mentor') {
              // Verify target user is in one of mentor's teams
              const mentorTeams = db.teams.filter((t) => t.mentorId === currentUser.id);
              const mentorTeamIds = mentorTeams.map((t) => t.id);
              const isInMentorTeam = db.teamMembers.some(
                (tm) => tm.userId === targetUserId && mentorTeamIds.includes(tm.teamId)
              );
              if (!isInMentorTeam) {
                return sendJson(res, 403, {
                  error: 'Forbidden: You do not supervise this member.'
                });
              }
            }

            const targetUser = db.users.find((u) => u.id === targetUserId);
            if (!targetUser) {
              return sendJson(res, 404, { error: 'Member not found.' });
            }

            let profile = db.memberProfiles.find((p) => p.userId === targetUserId);
            if (!profile) {
              profile = {
                id: 'prof_' + crypto.randomUUID().substring(0, 8),
                userId: targetUserId,
                role: '',
                responsibilities: [],
                technicalSkills: [],
                bio: '',
                avatarUrl: '',
                updatedAt: new Date().toISOString()
              };
              db.memberProfiles.push(profile);
              saveDb(db);
            }

            // Find team
            const tm = db.teamMembers.find((m) => m.userId === targetUserId);
            const team = tm ? db.teams.find((t) => t.id === tm.teamId) : null;

            // GET /api/members/:id
            if (method === 'GET') {
              const { passwordHash: _, ...safeUser } = targetUser;
              return sendJson(res, 200, {
                member: {
                  ...safeUser,
                  teamId: tm?.teamId || null,
                  teamName: team?.name || null,
                  profile
                }
              });
            }

            // PATCH /api/members/:id (Edit profile)
            if (method === 'PATCH') {
              // Mentors CANNOT edit member profiles. Only member can edit their own profile.
              if (currentUser.role !== 'member' || currentUser.id !== targetUserId) {
                return sendJson(res, 403, {
                  error: 'Forbidden: Only the member can edit their own profile.'
                });
              }

              const body = await parseBody(req);
              if (body.role !== undefined) profile.role = body.role.trim();
              if (body.bio !== undefined) profile.bio = body.bio.trim();
              if (Array.isArray(body.responsibilities)) {
                profile.responsibilities = body.responsibilities;
              }
              if (Array.isArray(body.technicalSkills)) {
                profile.technicalSkills = body.technicalSkills;
              }
              if (body.avatarUrl !== undefined) {
                profile.avatarUrl = body.avatarUrl.trim();
              }
              profile.updatedAt = new Date().toISOString();

              saveDb(db);
              const { passwordHash: _, ...safeUser } = targetUser;
              return sendJson(res, 200, {
                member: {
                  ...safeUser,
                  teamId: tm?.teamId || null,
                  teamName: team?.name || null,
                  profile
                }
              });
            }
          }

          // ==========================================
          // MEMBER UPDATES ENDPOINTS
          // ==========================================

          // MATCH /api/members/:id/updates
          const memberUpdatesMatch = pathname.match(/^\/api\/members\/([^/]+)\/updates$/);
          if (memberUpdatesMatch && method === 'GET') {
            const targetUserId = memberUpdatesMatch[1];

            // Authorization: Member -> Own updates ONLY
            // Mentor -> Updates of members inside their supervised teams ONLY
            if (currentUser.role === 'member') {
              if (currentUser.id !== targetUserId) {
                return sendJson(res, 403, {
                  error: 'Forbidden: You cannot view updates from other members.'
                });
              }
            } else if (currentUser.role === 'mentor') {
              const mentorTeams = db.teams.filter((t) => t.mentorId === currentUser.id);
              const mentorTeamIds = mentorTeams.map((t) => t.id);
              const isInMentorTeam = db.teamMembers.some(
                (tm) => tm.userId === targetUserId && mentorTeamIds.includes(tm.teamId)
              );
              if (!isInMentorTeam) {
                return sendJson(res, 403, {
                  error: 'Forbidden: You do not supervise this member.'
                });
              }
            }

            const updates = db.updates
              .filter((u) => u.userId === targetUserId)
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            return sendJson(res, 200, { updates });
          }

          // POST /api/updates (Member adds update)
          if (pathname === '/api/updates' && method === 'POST') {
            // Mentor CANNOT create updates
            if (currentUser.role !== 'member') {
              return sendJson(res, 403, { error: 'Forbidden: Only members can create work updates.' });
            }

            const body = await parseBody(req);
            const { title, whatWorkedOn, technicalWork, challenges, nextStep, evidenceLink } = body;

            if (!title?.trim() || !whatWorkedOn?.trim() || !technicalWork?.trim()) {
              return sendJson(res, 400, {
                error: 'Title, "What did you work on?", and "Technical Work" are required.'
              });
            }

            // Determine teamId of member
            const tm = db.teamMembers.find((m) => m.userId === currentUser.id);

            const newUpdate = {
              id: 'upd_' + crypto.randomUUID().substring(0, 8),
              userId: currentUser.id,
              teamId: tm?.teamId || null,
              title: title.trim(),
              whatWorkedOn: whatWorkedOn.trim(),
              technicalWork: technicalWork.trim(),
              challenges: challenges?.trim() || '',
              nextStep: nextStep?.trim() || '',
              evidenceLink: evidenceLink?.trim() || '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            db.updates.push(newUpdate);
            saveDb(db);

            return sendJson(res, 201, { update: newUpdate });
          }

          // PATCH /api/updates/:id (Member edits own update)
          const updateIdMatch = pathname.match(/^\/api\/updates\/([^/]+)$/);
          if (updateIdMatch && method === 'PATCH') {
            const updateId = updateIdMatch[1];
            const update = db.updates.find((u) => u.id === updateId);
            if (!update) {
              return sendJson(res, 404, { error: 'Update not found.' });
            }

            // Only the owner member can edit the update
            if (currentUser.role !== 'member' || update.userId !== currentUser.id) {
              return sendJson(res, 403, { error: 'Forbidden: You can only edit your own updates.' });
            }

            const body = await parseBody(req);
            if (body.title?.trim()) update.title = body.title.trim();
            if (body.whatWorkedOn?.trim()) update.whatWorkedOn = body.whatWorkedOn.trim();
            if (body.technicalWork?.trim()) update.technicalWork = body.technicalWork.trim();
            if (body.challenges !== undefined) update.challenges = body.challenges.trim();
            if (body.nextStep !== undefined) update.nextStep = body.nextStep.trim();
            if (body.evidenceLink !== undefined) update.evidenceLink = body.evidenceLink.trim();
            update.updatedAt = new Date().toISOString();

            saveDb(db);
            return sendJson(res, 200, { update });
          }

          // DELETE /api/updates/:id (Member deletes own update)
          if (updateIdMatch && method === 'DELETE') {
            const updateId = updateIdMatch[1];
            const update = db.updates.find((u) => u.id === updateId);
            if (!update) {
              return sendJson(res, 404, { error: 'Update not found.' });
            }

            if (currentUser.role !== 'member' || update.userId !== currentUser.id) {
              return sendJson(res, 403, { error: 'Forbidden: You can only delete your own updates.' });
            }

            db.updates = db.updates.filter((u) => u.id !== updateId);
            saveDb(db);
            return sendJson(res, 200, { success: true });
          }

          // Route not found
          return sendJson(res, 404, { error: 'API route not found' });
        } catch (err) {
          console.error('API Error:', err);
          return sendJson(res, 500, { error: 'Internal Server Error', details: err?.message });
        }
      });
    }
  };
}
