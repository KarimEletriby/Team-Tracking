import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Code2,
  LayoutDashboard,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { api } from '../api';
import { isSupabaseConfigured } from '../lib/supabase';
import { User as UserType } from '../types';
import './LoginView.css';

type AccountRole = 'mentor' | 'member' | 'admin';
type AuthMode = 'landing' | 'login' | 'register';

interface LoginViewProps {
  onLoginSuccess: (user: UserType, initialWorkspace?: 'admin' | 'mentor' | 'member') => void;
}

const roleContent: Record<AccountRole, { label: string; shortLabel: string; description: string; icon: typeof UsersRound; points: string[] }> = {
  member: {
    label: 'Team member',
    shortLabel: 'I’m a team member',
    description: 'Join with the email your mentor added, create your password, and collaborate with your team.',
    icon: UsersRound,
    points: [
      'Access your assigned project team & teammates',
      'Define your own project role & technical profile',
      'Submit progress updates & evidence files',
    ],
  },
  mentor: {
    label: 'Mentor',
    shortLabel: 'I’m a mentor',
    description: 'Create teams, invite members, and supervise projects. (Mentors must be authorized by administrator KE).',
    icon: LayoutDashboard,
    points: [
      'Create and supervise project teams',
      'Add members by email (members set their own roles)',
      'Review contributions and download private evidence',
    ],
  },
  admin: {
    label: 'System Administrator',
    shortLabel: 'System Administrator',
    description: 'Platform management and governance. Manages mentor authorizations and teams.',
    icon: ShieldCheck,
    points: [
      'Authorize and add new mentors to the platform',
      'Full visibility into all teams and project updates',
      'Manage and delegate administrator privileges',
    ],
  },
};

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('landing');
  const [selectedRole, setSelectedRole] = useState<AccountRole>('member');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const selectRole = (role: AccountRole, nextMode: 'login' | 'register' = 'register') => {
    setSelectedRole(role);
    setMode(nextMode);
    setError(null);
    setSuccessMsg(null);
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const response = await api.login({
        email: email.trim(),
        password,
        expectedRole: selectedRole,
      });
      onLoginSuccess(response.user, selectedRole);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setError('Please fill out all registration fields.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const response = await api.register({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        role: selectedRole,
      });
      if (response.requiresEmailConfirmation) {
        setSuccessMsg('Check your email to confirm your account, then sign in.');
        setMode('login');
        setEmail(regEmail.trim());
        setPassword('');
        return;
      }
      if (response.user) onLoginSuccess(response.user, selectedRole);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'landing') {
    return (
      <main className="welcomePage">
        <nav className="welcomeNav" aria-label="Welcome navigation">
          <div className="welcomeBrand"><span className="welcomeBrandMark"><Code2 size={21} /></span><strong>TeamTrack</strong></div>
        </nav>
        <div className="welcomeBody">
          <section className="welcomeHero">
            <span className="welcomeEyebrow">TEAM COLLABORATION PORTAL</span>
            <h1>Keep every team’s work<br />clear and moving forward.</h1>
            <p>TeamTrack gives mentors and team members one focused place to organize projects, share progress, and stay aligned.</p>
          </section>

          {/* System Access & Governance Banner */}
          <div className="adminContactCard">
            <div className="adminContactInfo">
              <div className="adminContactBadge">
                <ShieldCheck size={22} />
              </div>
              <div className="adminContactText">
                <h4>System Access & Authorization</h4>
                <p>
                  Mentors must be authorized by the administrator (KE). Members join using the email provided by their mentor. Access is strictly invitation-only for verified project workspaces.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="adminLoginButton"
              onClick={() => {
                selectRole('admin', 'login');
                setEmail('');
              }}
            >
              <ShieldCheck size={16} /> Admin Portal
            </button>
          </div>

          {!isSupabaseConfigured && (
            <div style={{
              width: 'min(850px, calc(100% - 48px))',
              margin: '0 auto 16px',
              padding: '14px 20px',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: '#92400e',
              fontSize: '0.875rem'
            }}>
              <AlertCircle size={20} style={{ flexShrink: 0, color: '#d97706' }} />
              <div>
                <strong>Supabase configuration required:</strong> Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to <code>.env</code> to activate live database operations.
              </div>
            </div>
          )}

          <section className="roleChooser" aria-labelledby="choose-workspace-heading">
            <div className="roleChooserHeading"><span>GET STARTED</span><h2 id="choose-workspace-heading">Which workspace do you need?</h2></div>
            <div className="roleCards">
              {(['member', 'mentor'] as AccountRole[]).map((role) => {
                const item = roleContent[role];
                const Icon = item.icon;
                return (
                  <button type="button" key={role} className="roleCard" onClick={() => selectRole(role)}>
                    <span className="roleIcon"><Icon size={24} /></span>
                    <span className="roleCardContent">
                      <strong>{item.shortLabel}</strong>
                      <small>{item.description}</small>
                    </span>
                    <ArrowRight className="roleArrow" size={19} />
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    );
  }

  const role = roleContent[selectedRole];
  const RoleIcon = role.icon;
  return (
    <main className="authPage">
      <button type="button" className="authBack" onClick={() => { setMode('landing'); setError(null); setSuccessMsg(null); }}><ArrowLeft size={17} /> Back</button>
      <section className="authLayout">
        <aside className="authIntro">
          <div className="welcomeBrand"><span className="welcomeBrandMark"><Code2 size={21} /></span><strong>TeamTrack</strong></div>
          <div className="authIntroCopy">
            <span className="welcomeEyebrow">{role.label.toUpperCase()} WORKSPACE</span>
            <h1>
              {selectedRole === 'admin'
                ? 'Supervise with complete control.'
                : selectedRole === 'mentor'
                ? 'Lead your teams with clarity.'
                : 'Make your contribution visible.'}
            </h1>
            <p>{role.description}</p>
          </div>
          <ul className="authBenefits">{role.points.map((point) => <li key={point}><CheckCircle2 size={17} />{point}</li>)}</ul>
        </aside>
        <section className="authPanel" aria-label={`${role.label} authentication`}>
          <div className="authRoleBadge"><RoleIcon size={16} />{role.label}</div>
          <h2>{mode === 'login' ? 'Welcome back' : `Create your ${role.label.toLowerCase()} account`}</h2>
          <p className="authPanelDescription">{mode === 'login' ? 'Sign in to continue to your workspace.' : 'Use your email address to get started.'}</p>
          <div className="authModeTabs" role="tablist" aria-label="Authentication mode">
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(null); }}>Sign in</button>
            <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(null); }}>
              {selectedRole === 'member' ? 'Join as member' : 'Create account'}
            </button>
          </div>
          {!isSupabaseConfigured && (
            <div className="authMessage error" role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Configuration required:</strong> Please add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to <code>.env</code>.
              </div>
            </div>
          )}
          {error && <p className="authMessage error" role="alert">{error}</p>}
          {successMsg && <p className="authMessage success" role="status">{successMsg}</p>}
          {mode === 'login' ? (
            <form className="authForm" onSubmit={handleLogin}>
              <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoFocus required /></label>
              <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /></label>
              <button className="btn btn-primary authSubmit" type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'} <ArrowRight size={17} /></button>
            </form>
          ) : (
            <form className="authForm" onSubmit={handleRegister}>
              <label>Full name<input type="text" value={regName} onChange={(event) => setRegName(event.target.value)} placeholder="e.g. Maya Lin" autoFocus required /></label>
              <label>Email address<input type="email" value={regEmail} onChange={(event) => setRegEmail(event.target.value)} placeholder="you@example.com" required /></label>
              <label>Password<input type="password" value={regPassword} onChange={(event) => setRegPassword(event.target.value)} placeholder="Create a password" minLength={6} required /></label>
              {selectedRole === 'member' && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
                  Enter the email address provided by your mentor to automatically join your assigned team.
                </p>
              )}
              <button className="btn btn-primary authSubmit" type="submit" disabled={loading}>
                {loading ? 'Creating account...' : selectedRole === 'member' ? 'Join as team member' : `Create ${role.label.toLowerCase()} account`} <ArrowRight size={17} />
              </button>
            </form>
          )}
          <button type="button" className="switchRole" onClick={() => { setMode('landing'); setError(null); }}>Not a {role.label.toLowerCase()}? Choose another workspace</button>
        </section>
      </section>
    </main>
  );
};
