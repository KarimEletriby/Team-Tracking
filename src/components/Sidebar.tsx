import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  User, 
  Clock, 
  LogOut, 
  Code2, 
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { User as UserType } from '../types';

interface SidebarProps {
  currentUser: UserType;
  currentView: string;
  activeWorkspace?: 'admin' | 'mentor' | 'member';
  onSwitchWorkspace?: (workspace: 'admin' | 'mentor') => void;
  onNavigate: (view: string, payload?: any) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  currentView,
  activeWorkspace = 'admin',
  onSwitchWorkspace,
  onNavigate,
  onLogout
}) => {
  const isAdmin = currentUser.role === 'admin';
  const isMentor = currentUser.role === 'mentor';
  const [collapsed, setCollapsed] = useState(false);

  const getRoleLabel = () => {
    if (isAdmin) {
      return activeWorkspace === 'mentor' ? 'Admin (Mentor Mode)' : 'System Admin';
    }
    if (isMentor) return 'Mentor System';
    return 'Member Portal';
  };

  const getAvatarBg = () => {
    if (isAdmin) {
      return activeWorkspace === 'mentor' ? 'var(--primary)' : '#7c3aed';
    }
    if (isMentor) return 'var(--primary)';
    return '#059669';
  };

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`} style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'space-between' }}>
      {/* Top Header / Brand */}
      <div>
        <div className="sidebar-brand" style={{ padding: '24px 20px', borderBottom: '1px solid var(--sidebar-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ 
              width: '36px', 
              height: '36px', 
              borderRadius: '8px', 
              backgroundColor: isAdmin ? '#7c3aed' : 'var(--primary)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: '#ffffff',
              boxShadow: isAdmin ? '0 2px 8px rgba(124,58,237,0.4)' : '0 2px 8px rgba(37,99,235,0.4)'
            }}>
              {isAdmin ? <ShieldCheck size={20} /> : <Code2 size={20} />}
            </div>
            <div className="sidebar-brand-copy">
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>
                TeamTrack
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                {getRoleLabel()}
              </div>
            </div>
          </div>
          <button type="button" className="sidebar-toggle" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        {/* Navigation Section */}
        <div style={{ padding: '20px 12px' }}>
          <div className="sidebar-section-label" style={{ 
            fontSize: '0.6875rem', 
            fontWeight: 700, 
            textTransform: 'uppercase', 
            color: '#475569', 
            padding: '0 12px 10px',
            letterSpacing: '0.05em' 
          }}>
            Navigation
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {isAdmin && (
              <>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '4px',
                  padding: '3px',
                  marginBottom: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                  <button
                    type="button"
                    onClick={() => onSwitchWorkspace?.('admin')}
                    style={{
                      padding: '6px 8px',
                      border: 0,
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      backgroundColor: activeWorkspace === 'admin' ? '#7c3aed' : 'transparent',
                      color: activeWorkspace === 'admin' ? '#ffffff' : '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <ShieldCheck size={14} /> Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => onSwitchWorkspace?.('mentor')}
                    style={{
                      padding: '6px 8px',
                      border: 0,
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      backgroundColor: activeWorkspace === 'mentor' ? 'var(--primary)' : 'transparent',
                      color: activeWorkspace === 'mentor' ? '#ffffff' : '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <LayoutDashboard size={14} /> Mentor
                  </button>
                </div>

                {activeWorkspace === 'admin' ? (
                  <button
                    id="nav-admin-dashboard"
                    onClick={() => onNavigate('dashboard')}
                    className={`sidebar-nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
                  >
                    <ShieldCheck size={18} />
                    <span>Admin Panel</span>
                  </button>
                ) : (
                  <>
                    <button
                      id="nav-mentor-dashboard"
                      onClick={() => onNavigate('dashboard')}
                      className={`sidebar-nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
                    >
                      <LayoutDashboard size={18} />
                      <span>Mentor Dashboard</span>
                    </button>

                    <button
                      id="nav-mentor-teams"
                      onClick={() => onNavigate('teams')}
                      className={`sidebar-nav-item ${currentView === 'teams' || currentView === 'team-detail' ? 'active' : ''}`}
                    >
                      <Users size={18} />
                      <span>My Teams</span>
                    </button>
                  </>
                )}
              </>
            )}

            {isMentor && (
              <>
                <button
                  id="nav-mentor-dashboard"
                  onClick={() => onNavigate('dashboard')}
                  title={collapsed ? 'Dashboard' : undefined}
                  className={`sidebar-nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
                >
                  <LayoutDashboard size={18} />
                  <span className="sidebar-label">Dashboard</span>
                </button>

                <button
                  id="nav-mentor-teams"
                  onClick={() => onNavigate('teams')}
                  title={collapsed ? 'Teams' : undefined}
                  className={`sidebar-nav-item ${currentView === 'teams' || currentView === 'team-detail' ? 'active' : ''}`}
                >
                  <Users size={18} />
                  <span className="sidebar-label">Teams</span>
                </button>
              </>
            )}

            {!isAdmin && !isMentor && (
              <>
                <button
                  id="nav-member-profile"
                  onClick={() => onNavigate('profile')}
                  title={collapsed ? 'My Profile' : undefined}
                  className={`sidebar-nav-item ${currentView === 'profile' ? 'active' : ''}`}
                >
                  <User size={18} />
                  <span className="sidebar-label">My Profile</span>
                </button>

                <button
                  id="nav-member-team"
                  onClick={() => onNavigate('team')}
                  className={`sidebar-nav-item ${currentView === 'team' ? 'active' : ''}`}
                >
                  <Users size={18} />
                  <span>My Team</span>
                </button>

                <button
                  id="nav-member-updates"
                  onClick={() => onNavigate('updates')}
                  title={collapsed ? 'My Updates' : undefined}
                  className={`sidebar-nav-item ${currentView === 'updates' ? 'active' : ''}`}
                >
                  <Clock size={18} />
                  <span className="sidebar-label">My Updates</span>
                </button>
              </>
            )}
          </nav>
        </div>
      </div>

      {/* User Information & Logout */}
      <div className="sidebar-footer" style={{ padding: '16px', borderTop: '1px solid var(--sidebar-border)' }}>
        <div className="sidebar-user-card" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 12px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
          marginBottom: '12px'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: getAvatarBg(),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.9rem',
            flexShrink: 0
          }}>
            {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="sidebar-user-details" style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#ffffff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {currentUser.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <span
                className={`badge ${isAdmin ? 'badge-purple' : isMentor ? 'badge-blue' : 'badge-green'}`}
                style={{
                  fontSize: '0.65rem',
                  padding: '1px 6px',
                  backgroundColor: isAdmin ? '#4c1d95' : undefined,
                  color: isAdmin ? '#ddd6fe' : undefined,
                  border: isAdmin ? '1px solid #6d28d9' : undefined
                }}
              >
                {isAdmin ? 'System Admin' : isMentor ? 'Mentor' : 'Member'}
              </span>
            </div>
          </div>
        </div>

        <button
          id="btn-logout"
          onClick={onLogout}
          className="sidebar-nav-item"
          title={collapsed ? 'Sign Out' : undefined}
          style={{ width: '100%', color: '#ef4444', justifyContent: 'flex-start' }}
        >
          <LogOut size={16} />
          <span className="sidebar-label">Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
