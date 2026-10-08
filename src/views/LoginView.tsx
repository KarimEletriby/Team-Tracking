import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Code2, LayoutDashboard, UsersRound } from 'lucide-react';
import { api } from '../api';
import { User as UserType } from '../types';
import './LoginView.css';

type AccountRole = 'mentor' | 'member';
type AuthMode = 'landing' | 'login' | 'register';

interface LoginViewProps {
  onLoginSuccess: (user: UserType) => void;
}

const roleContent: Record<AccountRole, { label: string; shortLabel: string; description: string; icon: typeof UsersRound; points: string[] }> = {
  mentor: {
    label: 'Mentor',
    shortLabel: 'I’m a mentor',
    description: 'Organize teams, follow progress, and support each member.',
    icon: LayoutDashboard,
    points: ['Create and manage teams', 'Review member updates', 'See shared work in one place'],
  },
  member: {
    label: 'Team member',
    shortLabel: 'I’m a team member',
    description: 'Show your work, share progress, and keep your mentor informed.',
    icon: UsersRound,
    points: ['Build a professional profile', 'Post progress updates', 'Share links and files'],
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
      const response = await api.login({ email: email.trim(), password });
      onLoginSuccess(response.user);
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
      if (response.user) onLoginSuccess(response.user);
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
        <section className="welcomeHero">
          <span className="welcomeEyebrow">TEAM COLLABORATION PORTAL</span>
          <h1>Keep every team’s work<br />clear and moving forward.</h1>
          <p>TeamTrack gives mentors and team members one focused place to organize projects, share progress, and stay aligned.</p>
        </section>
        <section className="roleChooser" aria-labelledby="choose-workspace-heading">
          <div className="roleChooserHeading"><span>GET STARTED</span><h2 id="choose-workspace-heading">Which workspace do you need?</h2></div>
          <div className="roleCards">
            {(Object.keys(roleContent) as AccountRole[]).map((role) => {
              const item = roleContent[role];
              const Icon = item.icon;
              return <button type="button" key={role} className="roleCard" onClick={() => selectRole(role)}>
                <span className="roleIcon"><Icon size={24} /></span>
                <span className="roleCardContent"><strong>{item.shortLabel}</strong><small>{item.description}</small></span>
                <ArrowRight className="roleArrow" size={19} />
              </button>;
            })}
          </div>
        </section>
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
          <div className="authIntroCopy"><span className="welcomeEyebrow">{role.label.toUpperCase()} WORKSPACE</span><h1>{selectedRole === 'mentor' ? 'Lead your teams with clarity.' : 'Make your contribution visible.'}</h1><p>{role.description}</p></div>
          <ul className="authBenefits">{role.points.map((point) => <li key={point}><CheckCircle2 size={17} />{point}</li>)}</ul>
        </aside>
        <section className="authPanel" aria-label={`${role.label} authentication`}>
          <div className="authRoleBadge"><RoleIcon size={16} />{role.label}</div>
          <h2>{mode === 'login' ? 'Welcome back' : `Create your ${role.label.toLowerCase()} account`}</h2>
          <p className="authPanelDescription">{mode === 'login' ? 'Sign in to continue to your workspace.' : 'Use your email address to get started.'}</p>
          <div className="authModeTabs" role="tablist" aria-label="Authentication mode">
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(null); }}>Sign in</button>
            <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(null); }}>Create account</button>
          </div>
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
              <button className="btn btn-primary authSubmit" type="submit" disabled={loading}>{loading ? 'Creating account...' : `Create ${role.label.toLowerCase()} account`} <ArrowRight size={17} /></button>
            </form>
          )}
          <button type="button" className="switchRole" onClick={() => { setMode('landing'); setError(null); }}>Not a {role.label.toLowerCase()}? Choose another workspace</button>
        </section>
      </section>
    </main>
  );
};
