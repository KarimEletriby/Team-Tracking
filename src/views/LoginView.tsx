import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Code2,
  Eye,
  EyeOff,
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
  const [mode, setMode] = useState<AuthMode>('login');
  const [selectedRole, setSelectedRole] = useState<AccountRole>('member');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const selectRole = (role: AccountRole, nextMode: 'login' | 'register' = 'login', pushHistory = true) => {
    setSelectedRole(role);
    setMode(nextMode);
    setError(null);
    setSuccessMsg(null);
    if (pushHistory) {
      const url = new URL(window.location.href);
      url.searchParams.set('auth', nextMode);
      url.searchParams.set('role', role);
      window.history.pushState({ authMode: nextMode, role }, '', url.toString());
    }
  };

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setError(null);
    const url = new URL(window.location.href);
    url.searchParams.set('auth', nextMode);
    url.searchParams.set('role', selectedRole);
    window.history.pushState({ authMode: nextMode, role: selectedRole }, '', url.toString());
  };

  const handleBackToLanding = () => {
    if (window.history.state && window.history.state.authMode && window.history.state.authMode !== 'login') {
      window.history.back();
    } else {
      setMode('login');
      setError(null);
      setSuccessMsg(null);
    }
  };

  const clearAuthUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('auth');
    url.searchParams.delete('role');
    window.history.replaceState(null, '', url.pathname);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authParam = params.get('auth');
    const roleParam = params.get('role');
    if (
      (authParam === 'login' || authParam === 'register' || authParam === 'landing') &&
      (!roleParam || roleParam === 'member' || roleParam === 'mentor' || roleParam === 'admin')
    ) {
      if (authParam === 'landing') {
        setMode('landing');
      } else {
        setMode(authParam as AuthMode);
        if (roleParam) setSelectedRole(roleParam as AccountRole);
      }
    } else {
      setMode('login');
      if (roleParam === 'member' || roleParam === 'mentor' || roleParam === 'admin') {
        setSelectedRole(roleParam as AccountRole);
      }
    }

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      const currentParams = new URLSearchParams(window.location.search);
      const currentAuth = currentParams.get('auth');
      const currentRole = currentParams.get('role');

      if (state && (state.authMode === 'login' || state.authMode === 'register' || state.authMode === 'landing')) {
        setMode(state.authMode);
        if (state.role) setSelectedRole(state.role);
      } else if (currentAuth === 'login' || currentAuth === 'register' || currentAuth === 'landing') {
        setMode(currentAuth as AuthMode);
        if (currentRole === 'member' || currentRole === 'mentor' || currentRole === 'admin') {
          setSelectedRole(currentRole as AccountRole);
        }
      } else {
        setMode('login');
      }
      setError(null);
      setSuccessMsg(null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
      clearAuthUrl();
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
        switchMode('login');
        setEmail(regEmail.trim());
        setPassword('');
        return;
      }
      if (response.user) {
        clearAuthUrl();
        onLoginSuccess(response.user, selectedRole);
      }
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
      <section className="authLayout">
        <aside className="authIntro">
          <div className="welcomeBrand"><span className="welcomeBrandMark"><Code2 size={21} /></span><strong>TeamTrack</strong></div>
          <div className="authIntroCopy">
            <span className="welcomeEyebrow">{role.label.toUpperCase()} PORTAL</span>
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
          {/* Top Role Workspace Switcher Tabs */}
          <div className="authRoleSelector" role="tablist" aria-label="Choose workspace role">
            {(['member', 'mentor', 'admin'] as AccountRole[]).map((r) => {
              const rContent = roleContent[r];
              const RIcon = rContent.icon;
              const isSelected = selectedRole === r;
              return (
                <button
                  key={r}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`roleSelectorBtn ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedRole(r);
                    setError(null);
                    setSuccessMsg(null);
                    if (r === 'admin') setMode('login');
                  }}
                >
                  <RIcon size={15} />
                  <span>{r === 'admin' ? 'Admin' : r === 'mentor' ? 'Mentor' : 'Member'}</span>
                </button>
              );
            })}
          </div>

          <h2>{mode === 'login' ? 'Sign in to TeamTrack' : `Create your ${role.label.toLowerCase()} account`}</h2>
          <p className="authPanelDescription">
            {mode === 'login'
              ? `Enter your credentials to access the ${role.label.toLowerCase()} workspace.`
              : 'Use your email address to get started.'}
          </p>

          <div className="authModeTabs" role="tablist" aria-label="Authentication mode">
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Sign in</button>
            {selectedRole !== 'admin' && (
              <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>
                {selectedRole === 'member' ? 'Join as member' : 'Create account'}
              </button>
            )}
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
              <label>
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                  required
                />
              </label>
              <label>
                <span>Password</span>
                <span className="passwordInputWrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    className="passwordToggle"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>
              <button className="btn btn-primary authSubmit" type="submit" disabled={loading}>
                {loading ? 'Signing in...' : `Sign in as ${role.label}`} <ArrowRight size={17} />
              </button>
            </form>
          ) : (
            <form className="authForm" onSubmit={handleRegister}>
              <label>
                Full name
                <input
                  type="text"
                  value={regName}
                  onChange={(event) => setRegName(event.target.value)}
                  placeholder="e.g. Maya Lin"
                  autoFocus
                  required
                />
              </label>
              <label>
                Email address
                <input
                  type="email"
                  value={regEmail}
                  onChange={(event) => setRegEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </label>
              <label>
                <span>Password</span>
                <span className="passwordInputWrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(event) => setRegPassword(event.target.value)}
                    placeholder="Create a password"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    className="passwordToggle"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>
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
        </section>
      </section>
    </main>
  );
};
