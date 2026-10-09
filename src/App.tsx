import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginView } from './views/LoginView';
import { AdminWorkspaceView } from './views/AdminWorkspaceView';
import { MentorWorkspaceView } from './views/MentorWorkspaceView';
import { MemberWorkspaceView } from './views/MemberWorkspaceView';
import { api } from './api';
import { requireSupabase } from './lib/supabase';
import { supabaseMemberRepository } from './member';
import { supabaseMentorRepository } from './mentor';
import { User } from './types';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<'admin' | 'mentor' | 'member'>('admin');
  const [authLoading, setAuthLoading] = useState(true);

  // Navigation
  // Admin views: 'dashboard'
  // Mentor views: 'dashboard', 'teams'
  // Member views: 'profile', 'team', 'updates'
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [mentorNavigationSignal, setMentorNavigationSignal] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const syncAuthenticatedUser = async () => {
      try {
        const res = await api.getMe();
        // Verify team assignment for members
        if (res.user.role === 'member') {
          const supabase = requireSupabase();
          let isAssigned = false;
          try {
            const { data: tm } = await supabase
              .from('team_members')
              .select('team_id')
              .eq('member_id', res.user.id)
              .limit(1);
            if (tm && tm.length > 0) isAssigned = true;
          } catch {}

          if (!isAssigned) {
            try {
              const { data: invites } = await supabase
                .from('team_invitations')
                .select('id, team_id')
                .ilike('email', res.user.email)
                .limit(1);
              if (invites && invites.length > 0) {
                isAssigned = true;
                await supabase.from('team_members').upsert({ team_id: invites[0].team_id, member_id: res.user.id }, { onConflict: 'member_id' });
                await supabase.from('team_invitations').delete().ilike('email', res.user.email);
              }
            } catch {}
          }

          if (!isAssigned) {
            await api.logout();
            if (!isMounted) return;
            setCurrentUser(null);
            return;
          }
        }

        setCurrentUser(res.user);
        if (res.user.role === 'admin') {
          const savedWorkspace = localStorage.getItem('teamtrack_admin_active_workspace') as 'admin' | 'mentor' | null;
          const initial = savedWorkspace === 'mentor' ? 'mentor' : 'admin';
          setActiveWorkspace(initial);
          setCurrentView('dashboard');
        } else if (res.user.role === 'mentor') {
          setActiveWorkspace('mentor');
          setCurrentView('dashboard');
        } else {
          setActiveWorkspace('member');
          setCurrentView('profile');
        }
      } catch {
        if (!isMounted) return;
        setCurrentUser(null);
      } finally {
        if (isMounted) setAuthLoading(false);
      }
    };

    let unsubscribe: (() => void) | undefined;
    try {
      const supabase = requireSupabase();
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session) {
          setCurrentUser(null);
          setAuthLoading(false);
          return;
        }
        void syncAuthenticatedUser();
      });
      unsubscribe = () => subscription.unsubscribe();

      const safetyTimer = setTimeout(() => {
        if (isMounted) setAuthLoading(false);
      }, 3500);

      void supabase.auth.getSession()
        .then(({ data: { session } }) => {
          clearTimeout(safetyTimer);
          if (!session) {
            if (isMounted) setAuthLoading(false);
            return;
          }
          void syncAuthenticatedUser();
        })
        .catch(() => {
          clearTimeout(safetyTimer);
          if (isMounted) setAuthLoading(false);
        });
    } catch {
      setAuthLoading(false);
    }

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (state && state.appView) {
        setCurrentView(state.appView);
        if (currentUser?.role === 'mentor' || (currentUser?.role === 'admin' && activeWorkspace === 'mentor')) {
          setMentorNavigationSignal((signal) => signal + 1);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser, activeWorkspace]);

  const handleLoginSuccess = async (user: User, initialWorkspace?: 'admin' | 'mentor' | 'member') => {
    setCurrentUser(user);
    if (user.role === 'admin') {
      const target = initialWorkspace === 'mentor' ? 'mentor' : 'admin';
      localStorage.setItem('teamtrack_admin_active_workspace', target);
      setActiveWorkspace(target);
      setCurrentView('dashboard');
    } else if (user.role === 'mentor') {
      setActiveWorkspace('mentor');
      setCurrentView('dashboard');
    } else {
      setActiveWorkspace('member');
      setCurrentView('profile');
    }
  };

  const handleSwitchAdminWorkspace = (workspace: 'admin' | 'mentor') => {
    localStorage.setItem('teamtrack_admin_active_workspace', workspace);
    setActiveWorkspace(workspace);
    setCurrentView('dashboard');
    if (workspace === 'mentor') {
      setMentorNavigationSignal((signal) => signal + 1);
    }
  };

  const handleLogout = async () => {
    setCurrentUser(null);
    setCurrentView('dashboard');
    localStorage.removeItem('teamtrack_admin_active_workspace');
    try {
      await api.logout();
    } catch {
      // Supabase token cleanup fallback
    }
  };

  // Determine page title for Header
  const getHeaderTitle = () => {
    if (!currentUser) return '';
    if (currentUser.role === 'admin' && activeWorkspace === 'admin') {
      return 'System Administration';
    } else if (currentUser.role === 'mentor' || (currentUser.role === 'admin' && activeWorkspace === 'mentor')) {
      if (currentView === 'teams') return 'My Teams';
      return 'Mentor Dashboard';
    } else {
      if (currentView === 'team') return 'My Team';
      if (currentView === 'updates') return 'My Work Updates';
      return 'My Profile';
    }
  };

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          fontFamily: 'Inter, system-ui, sans-serif',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '3px solid rgba(255, 255, 255, 0.1)',
            borderTopColor: '#2563eb',
            animation: 'teamtrack-spin 0.75s linear infinite',
          }}
        />
        <div style={{ color: '#94a3b8', fontSize: '0.95rem', fontWeight: 500 }}>
          Loading TeamTrack...
        </div>
        <style>{`
          @keyframes teamtrack-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <Sidebar
        currentUser={currentUser}
        currentView={currentView}
        activeWorkspace={activeWorkspace}
        onSwitchWorkspace={handleSwitchAdminWorkspace}
        onNavigate={(view) => {
          setCurrentView(view);
          const url = new URL(window.location.href);
          url.searchParams.set('tab', view);
          window.history.pushState({ appView: view }, '', url.toString());
          if (currentUser.role === 'mentor' || (currentUser.role === 'admin' && activeWorkspace === 'mentor')) {
            setMentorNavigationSignal((signal) => signal + 1);
          }
        }}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="main-content">
        <Header
          currentUser={currentUser}
          title={getHeaderTitle()}
          activeWorkspace={activeWorkspace}
        />

        <main>
          {/* ADMIN FLOW */}
          {currentUser.role === 'admin' && activeWorkspace === 'admin' && (
            <AdminWorkspaceView currentUser={currentUser} onLogout={handleLogout} />
          )}

          {/* MENTOR FLOW (native mentors OR admin in mentor mode) */}
          {(currentUser.role === 'mentor' || (currentUser.role === 'admin' && activeWorkspace === 'mentor')) && (
            <MentorWorkspaceView
              mentorId={currentUser.id}
              mentorName={currentUser.name}
              externalView={currentView}
              navigationSignal={mentorNavigationSignal}
              onSectionChange={setCurrentView}
              repository={supabaseMentorRepository}
            />
          )}

          {/* MEMBER FLOW */}
          {currentUser.role === 'member' && (
            <MemberWorkspaceView
              memberId={currentUser.id}
              memberName={currentUser.name}
              externalView={currentView}
              onSectionChange={setCurrentView}
              repository={supabaseMemberRepository}
            />
          )}
        </main>
      </div>
    </div>
  );
}
