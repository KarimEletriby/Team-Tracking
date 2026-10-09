import React from 'react';
import { User } from '../types';

interface HeaderProps {
  currentUser: User;
  title: string;
  subtitle?: string;
  activeWorkspace?: 'admin' | 'mentor' | 'member';
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  title,
  subtitle,
  activeWorkspace
}) => {
  const isAdmin = currentUser.role === 'admin';
  const isMentor = currentUser.role === 'mentor';

  const getAvatarBg = () => {
    if (isAdmin) return activeWorkspace === 'mentor' ? 'var(--primary)' : '#7c3aed';
    if (isMentor) return 'var(--primary)';
    return '#059669';
  };

  const getRoleTitle = () => {
    if (isAdmin) return activeWorkspace === 'mentor' ? 'Admin (Mentor Mode)' : 'System Administrator';
    if (isMentor) return 'Supervisor';
    return 'Team Member';
  };

  return (
    <header className="top-header" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 32px',
      backgroundColor: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-color)',
      minHeight: '68px'
    }}>
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '2px', margin: 0 }}>
            {subtitle}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: getAvatarBg(),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '0.85rem'
          }}>
            {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.2 }}>
              {currentUser.name}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {getRoleTitle()}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
