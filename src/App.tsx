import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginView } from './views/LoginView';
import { MentorDashboard } from './views/MentorDashboard';
import { TeamDetailView } from './views/TeamDetailView';
import { MemberProfileView } from './views/MemberProfileView';
import { MemberUpdatesView } from './views/MemberUpdatesView';
import { AddTeamModal } from './components/AddTeamModal';
import { RenameTeamModal } from './components/RenameTeamModal';
import { AddMemberModal } from './components/AddMemberModal';
import { EditProfileModal } from './components/EditProfileModal';
import { AddUpdateModal } from './components/AddUpdateModal';
import { api, getStoredToken } from './api';
import { User, Team, WorkUpdate, MemberProfile } from './types';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentProfile, setCurrentProfile] = useState<MemberProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Navigation
  // Mentor views: 'dashboard', 'teams', 'team-detail', 'member-detail'
  // Member views: 'profile', 'updates'
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Mentor Teams list state
  const [teams, setTeams] = useState<Team[]>([]);

  // Modals state
  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false);
  const [isRenameTeamOpen, setIsRenameTeamOpen] = useState(false);
  const [teamToRename, setTeamToRename] = useState<Team | null>(null);
  
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [teamToAddMemberTo, setTeamToAddMemberTo] = useState<Team | null>(null);

  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isAddUpdateOpen, setIsAddUpdateOpen] = useState(false);
  const [updateToEdit, setUpdateToEdit] = useState<WorkUpdate | null>(null);

  // Check existing session on boot
  useEffect(() => {
    const initAuth = async () => {
      const token = getStoredToken();
      if (!token) {
        setAuthLoading(false);
        return;
      }
      try {
        const res = await api.getMe();
        setCurrentUser(res.user);
        if (res.user.role === 'mentor') {
          setCurrentView('dashboard');
          loadMentorTeams();
        } else {
          setCurrentView('profile');
          if (res.profile) setCurrentProfile(res.profile);
        }
      } catch {
        api.logout();
        setCurrentUser(null);
      } finally {
        setAuthLoading(false);
      }
    };
    initAuth();
  }, []);

  const loadMentorTeams = async () => {
    try {
      const res = await api.getTeams();
      setTeams(res.teams);
    } catch {
      // ignore
    }
  };

  const handleLoginSuccess = async (user: User) => {
    setCurrentUser(user);
    if (user.role === 'mentor') {
      setCurrentView('dashboard');
      await loadMentorTeams();
    } else {
      setCurrentView('profile');
      try {
        const res = await api.getMember(user.id);
        setCurrentProfile(res.member.profile);
      } catch {
        // ignore
      }
    }
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setCurrentProfile(null);
    setSelectedTeamId(null);
    setSelectedMemberId(null);
    setCurrentView('dashboard');
  };

  // Team actions
  const handleCreateTeam = async (name: string) => {
    const res = await api.createTeam(name);
    setTeams((prev) => [...prev, res.team]);
  };

  const handleRenameTeam = async (newName: string) => {
    if (!teamToRename) return;
    const res = await api.updateTeam(teamToRename.id, newName);
    setTeams((prev) => prev.map((t) => (t.id === res.team.id ? { ...t, name: res.team.name } : t)));
    setTeamToRename(null);
  };

  const handleAddMember = async (params: { name: string; email: string; password?: string; roleTitle?: string }) => {
    if (!teamToAddMemberTo) return;
    await api.addMemberToTeam(teamToAddMemberTo.id, params);
    await loadMentorTeams();
  };

  // Member profile actions
  const handleSaveProfile = async (profileData: {
    role: string;
    responsibilities: string[];
    technicalSkills: string[];
    bio: string;
    avatarUrl: string;
  }) => {
    if (!currentUser) return;
    const res = await api.updateMemberProfile(currentUser.id, profileData);
    setCurrentProfile(res.member.profile);
  };

  // Member update actions
  const handleSaveUpdate = async (updateData: {
    title: string;
    whatWorkedOn: string;
    technicalWork: string;
    challenges?: string;
    nextStep?: string;
    evidenceLink?: string;
  }) => {
    if (updateToEdit) {
      await api.updateUpdate(updateToEdit.id, updateData);
      setUpdateToEdit(null);
    } else {
      await api.createUpdate(updateData);
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
      if (currentView === 'team-detail') return 'Team Details';
      if (currentView === 'member-detail') return 'Member Profile & Contributions';
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
          if (view === 'dashboard' || view === 'teams') {
            setSelectedTeamId(null);
            setSelectedMemberId(null);
            loadMentorTeams();
          }
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
            <>
              {(currentView === 'dashboard' || currentView === 'teams') && (
                <MentorDashboard
                  teams={teams}
                  onOpenTeam={(teamId) => {
                    setSelectedTeamId(teamId);
                    setCurrentView('team-detail');
                  }}
                  onOpenAddTeam={() => setIsAddTeamOpen(true)}
                  onOpenRenameTeam={(team) => {
                    setTeamToRename(team);
                    setIsRenameTeamOpen(true);
                  }}
                />
              )}

              {currentView === 'team-detail' && selectedTeamId && (
                <TeamDetailView
                  teamId={selectedTeamId}
                  onBack={() => {
                    setCurrentView('dashboard');
                    loadMentorTeams();
                  }}
                  onSelectMember={(memberId) => {
                    setSelectedMemberId(memberId);
                    setCurrentView('member-detail');
                  }}
                  onOpenAddMember={(team) => {
                    setTeamToAddMemberTo(team);
                    setIsAddMemberOpen(true);
                  }}
                  onOpenRenameTeam={(team) => {
                    setTeamToRename(team);
                    setIsRenameTeamOpen(true);
                  }}
                />
              )}

              {currentView === 'member-detail' && selectedMemberId && (
                <MemberProfileView
                  memberId={selectedMemberId}
                  currentUser={currentUser}
                  onBack={() => {
                    setCurrentView('team-detail');
                  }}
                  onOpenEditProfile={() => {}}
                  onOpenAddUpdate={() => {}}
                  onOpenEditUpdate={() => {}}
                />
              )}
            </>
          )}

          {/* MEMBER FLOW */}
          {currentUser.role === 'member' && (
            <>
              {currentView === 'profile' && (
                <MemberProfileView
                  memberId={currentUser.id}
                  currentUser={currentUser}
                  onOpenEditProfile={() => setIsEditProfileOpen(true)}
                  onOpenAddUpdate={() => {
                    setUpdateToEdit(null);
                    setIsAddUpdateOpen(true);
                  }}
                  onOpenEditUpdate={(upd) => {
                    setUpdateToEdit(upd);
                    setIsAddUpdateOpen(true);
                  }}
                />
              )}

              {currentView === 'updates' && (
                <MemberUpdatesView
                  currentUser={currentUser}
                  onOpenAddUpdate={() => {
                    setUpdateToEdit(null);
                    setIsAddUpdateOpen(true);
                  }}
                  onOpenEditUpdate={(upd) => {
                    setUpdateToEdit(upd);
                    setIsAddUpdateOpen(true);
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Modals */}
      <AddTeamModal
        isOpen={isAddTeamOpen}
        onClose={() => setIsAddTeamOpen(false)}
        onSubmit={handleCreateTeam}
      />

      <RenameTeamModal
        isOpen={isRenameTeamOpen}
        onClose={() => {
          setIsRenameTeamOpen(false);
          setTeamToRename(null);
        }}
        currentName={teamToRename?.name || ''}
        onSubmit={handleRenameTeam}
      />

      <AddMemberModal
        isOpen={isAddMemberOpen}
        onClose={() => {
          setIsAddMemberOpen(false);
          setTeamToAddMemberTo(null);
        }}
        teamName={teamToAddMemberTo?.name || ''}
        onSubmit={handleAddMember}
      />

      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        profile={currentProfile}
        onSave={handleSaveProfile}
      />

      <AddUpdateModal
        isOpen={isAddUpdateOpen}
        onClose={() => {
          setIsAddUpdateOpen(false);
          setUpdateToEdit(null);
        }}
        updateToEdit={updateToEdit}
        onSubmit={handleSaveUpdate}
      />
    </div>
  );
}
