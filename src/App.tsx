import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginView } from './views/LoginView';
import { MentorWorkspaceView } from './views/MentorWorkspaceView';
import { MemberWorkspaceView } from './views/MemberWorkspaceView';
import { api } from './api';
import { requireSupabase } from './lib/supabase';
import { supabaseMemberRepository } from './member';
import { supabaseMentorRepository } from './mentor';
import { User } from './types';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Navigation
  // Mentor views: 'dashboard', 'teams'. Workspace navigation is local to the mentor prototype.
  // Member views: 'profile', 'updates'
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [mentorNavigationSignal, setMentorNavigationSignal] = useState(0);
  useEffect(() => {
    let isMounted = true;

    const syncAuthenticatedUser = async () => {
      try {
        const res = await api.getMe();
        if (!isMounted) return;
        setCurrentUser(res.user);
        if (res.user.role === 'mentor') {
          setCurrentView('dashboard');
        } else {
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

  const handleLoginSuccess = async (user: User) => {
    setCurrentUser(user);
    if (user.role === 'mentor') {
      setCurrentView('dashboard');
    } else {
      setCurrentView('profile');
    }
  };

  const handleLogout = async () => {
    setCurrentUser(null);
    setCurrentView('dashboard');
    try {
      await api.logout();
    } catch {
      // The local UI is already signed out; Supabase will retry token cleanup.
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
    if (currentUser.role === 'mentor') {
      if (currentView === 'teams') return 'My Teams';
      return 'Mentor Dashboard';
    } else {
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
          onNavigate={(view) => {
            setCurrentView(view);
            if (currentUser.role === 'mentor') setMentorNavigationSignal((signal) => signal + 1);
        }}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="main-content">
        <Header
          currentUser={currentUser}
          title={getHeaderTitle()}
        />

        <main>
          {/* MENTOR FLOW */}
          {currentUser.role === 'mentor' && (
            <MentorWorkspaceView mentorId={currentUser.id} mentorName={currentUser.name} externalView={currentView} navigationSignal={mentorNavigationSignal} onSectionChange={setCurrentView} repository={supabaseMentorRepository} />
          )}

          {/* MEMBER FLOW */}
          {currentUser.role === 'member' && (
            <MemberWorkspaceView memberId={currentUser.id} memberName={currentUser.name} externalView={currentView} onSectionChange={setCurrentView} repository={supabaseMemberRepository} />
          )}
        </main>
      </div>
    </div>
  );
}
