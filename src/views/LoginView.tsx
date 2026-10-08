import React, { useState, useEffect } from 'react';
import { Code2, ShieldCheck, User, Users, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '../api';
import { User as UserType, UserRole } from '../types';

interface LoginViewProps {
  onLoginSuccess: (user: UserType) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  // Login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Register form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('mentor');
  
  // Existing real users in database (for convenient testing)
  const [existingUsers, setExistingUsers] = useState<UserType[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await api.getUsers();
      setExistingUsers(res.users);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await api.login({ email: email.trim(), password });
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setError('Please fill out all registration fields.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await api.register({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        role: regRole,
      });
      setSuccessMsg('Account created successfully!');
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (u: UserType) => {
    setEmail(u.email);
    setPassword('123456');
    setError(null);
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-page)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      {/* Brand Icon & Heading */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '14px',
          backgroundColor: 'var(--sidebar-bg)',
          color: '#38bdf8',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
          boxShadow: 'var(--shadow-md)'
        }}>
          <Code2 size={32} />
        </div>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.03em' }}>
          TeamTrack System
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '6px' }}>
          Mentor Supervision & Member Tracking Portal
        </p>
      </div>

      {/* Main Card */}
      <div className="card" style={{ width: '100%', maxWidth: '460px', padding: '32px', boxShadow: 'var(--shadow-lg)' }}>
        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          backgroundColor: 'var(--bg-surface-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '4px',
          marginBottom: '24px'
        }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            style={{
              flex: 1,
              padding: '8px 16px',
              fontSize: '0.875rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: mode === 'login' ? 'var(--bg-surface)' : 'transparent',
              color: mode === 'login' ? 'var(--text-main)' : 'var(--text-muted)',
              boxShadow: mode === 'login' ? 'var(--shadow-xs)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(null); }}
            style={{
              flex: 1,
              padding: '8px 16px',
              fontSize: '0.875rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: mode === 'register' ? 'var(--bg-surface)' : 'transparent',
              color: mode === 'register' ? 'var(--text-main)' : 'var(--text-muted)',
              boxShadow: mode === 'register' ? 'var(--shadow-xs)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#fef2f2',
            color: '#b91c1c',
            border: '1px solid #fecaca',
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.875rem',
            marginBottom: '18px'
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#ecfdf5',
            color: '#047857',
            border: '1px solid #a7f3d0',
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.875rem',
            marginBottom: '18px'
          }}>
            <CheckCircle size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email Address</label>
              <input
                id="login-email"
                type="email"
                className="form-control"
                placeholder="mentor@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '12px', justifyContent: 'center' }}
              disabled={loading}
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-name">Full Name</label>
              <input
                id="reg-name"
                type="text"
                className="form-control"
                placeholder="e.g. Dr. Jane Mentor"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">Email Address</label>
              <input
                id="reg-email"
                type="email"
                className="form-control"
                placeholder="e.g. mentor@institution.edu"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">Password</label>
              <input
                id="reg-password"
                type="password"
                className="form-control"
                placeholder="Create a password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">System Role</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setRegRole('mentor')}
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1.5px solid ${regRole === 'mentor' ? 'var(--primary)' : 'var(--border-color)'}`,
                    backgroundColor: regRole === 'mentor' ? 'var(--primary-light)' : 'var(--bg-surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <ShieldCheck size={20} color={regRole === 'mentor' ? 'var(--primary)' : 'var(--text-muted)'} />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: regRole === 'mentor' ? 'var(--primary)' : 'var(--text-main)' }}>
                    Mentor
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Supervises Teams
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRegRole('member')}
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1.5px solid ${regRole === 'member' ? 'var(--accent-green)' : 'var(--border-color)'}`,
                    backgroundColor: regRole === 'member' ? 'var(--green-bg)' : 'var(--bg-surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <User size={20} color={regRole === 'member' ? 'var(--green-text)' : 'var(--text-muted)'} />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: regRole === 'member' ? 'var(--green-text)' : 'var(--text-main)' }}>
                    Member
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Logs Own Updates
                  </span>
                </button>
              </div>

              {regRole === 'mentor' && (
                <div style={{
                  marginTop: '10px',
                  padding: '10px 12px',
                  backgroundColor: 'var(--primary-light)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.78rem',
                  color: 'var(--primary)',
                  lineHeight: 1.4
                }}>
                  Mentors automatically start with <strong>2 empty team containers</strong> (Team 1 & Team 2) ready to configure with real data.
                </div>
              )}
            </div>

            <button
              id="btn-register-submit"
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '16px', justifyContent: 'center' }}
              disabled={loading}
            >
              <span>{loading ? 'Creating...' : `Register as ${regRole === 'mentor' ? 'Mentor' : 'Member'}`}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* Existing Real Users list for easy testing */}
        {existingUsers.length > 0 && (
          <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px', letterSpacing: '0.04em' }}>
              Existing Accounts in Database:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {existingUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleQuickLogin(u)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-surface-subtle)',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`badge ${u.role === 'mentor' ? 'badge-blue' : 'badge-green'}`} style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                      {u.role}
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{u.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({u.email})</span>
                  </div>
                  <span style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 600 }}>Select</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
