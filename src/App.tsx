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

      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          if (isMounted) setAuthLoading(false);
          return;
        }
        void syncAuthenticatedUser();
      });
    } catch {
      setAuthLoading(false);
    }

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

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

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-page)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Loading application...</div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  // Determine page title for Header
  const getHeaderTitle = () => {
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
