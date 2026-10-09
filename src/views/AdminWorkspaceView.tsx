import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FolderKanban,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { AdminOverviewData, AdminRepository, supabaseAdminRepository } from '../admin';
import { EmptyState, LoadingState, Toast } from '../components/mentor';
import { User } from '../types';
import styles from './AdminWorkspaceView.module.css';

interface AdminWorkspaceViewProps {
  currentUser: User;
  onLogout: () => void;
  repository?: AdminRepository;
}

type AdminTab = 'mentors' | 'teams' | 'admins';

export const AdminWorkspaceView: React.FC<AdminWorkspaceViewProps> = ({
  currentUser,
  repository = supabaseAdminRepository,
}) => {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('mentors');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Drawers
  const [isAddMentorOpen, setIsAddMentorOpen] = useState(false);
  const [mentorName, setMentorName] = useState('');
  const [mentorEmail, setMentorEmail] = useState('');
  const [addMentorSaving, setAddMentorSaving] = useState(false);
  const [addMentorError, setAddMentorError] = useState<string | null>(null);

  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [addAdminSaving, setAddAdminSaving] = useState(false);
  const [addAdminError, setAddAdminError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const overview = await repository.getOverview();
      setData(overview);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load admin workspace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleAddMentor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mentorEmail.trim()) {
      setAddMentorError('Please provide an email address.');
      return;
    }
    setAddMentorSaving(true);
    setAddMentorError(null);
    try {
      await repository.addMentor(mentorName.trim(), mentorEmail.trim());
      setIsAddMentorOpen(false);
      setMentorName('');
      setMentorEmail('');
      setToastMessage('Mentor added successfully. They can now sign in or register.');
      await loadData();
    } catch (caught) {
      setAddMentorError(caught instanceof Error ? caught.message : 'Failed to add mentor.');
    } finally {
      setAddMentorSaving(false);
    }
  };

  const handleRemoveMentor = async (mentorId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove mentor "${name}"?`)) return;
    try {
      await repository.removeMentor(mentorId);
      setToastMessage(`Mentor "${name}" removed.`);
      await loadData();
    } catch (caught) {
      alert(caught instanceof Error ? caught.message : 'Failed to remove mentor.');
    }
  };

  const handlePromoteAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim()) {
      setAddAdminError('Please provide an email address.');
      return;
    }
    setAddAdminSaving(true);
    setAddAdminError(null);
    try {
      await repository.promoteAdmin(adminEmail.trim());
      setIsAddAdminOpen(false);
      setAdminEmail('');
      setToastMessage(`User ${adminEmail.trim()} promoted to Admin.`);
      await loadData();
    } catch (caught) {
      setAddAdminError(caught instanceof Error ? caught.message : 'Failed to promote admin.');
    } finally {
      setAddAdminSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-body">
        <LoadingState label="Loading admin workspace..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-body">
        <EmptyState
          title="Admin workspace unavailable"
          description={error ?? 'Could not retrieve data.'}
          icon={<AlertCircle size={24} />}
          action={
            <button type="button" className="btn btn-primary" onClick={() => void loadData()}>
              Try again
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className={`page-body ${styles.adminRoot}`}>
      {/* Hero Welcome */}
      <section className={styles.adminHero}>
        <div className={styles.adminHeroTop}>
          <span className={styles.adminBadge}>
            <ShieldCheck size={15} /> System Administrator
          </span>
          <span style={{ fontSize: '0.85rem', color: '#c7d2fe' }}>
            Primary Admin: Karim Eletriby
          </span>
        </div>
        <h2>Welcome back, {currentUser.name || 'Karim'}</h2>
        <p>
          You have full authority over the TeamTrack system. Manage mentors, supervise all project teams, and delegate admin privileges.
        </p>
      </section>

      {/* Stats Summary */}
      <div className={styles.statGrid}>
        <div className={styles.statCard}>
          <span className={styles.statCardLabel}>Active Mentors</span>
          <span className={styles.statCardValue}>{data.summary.mentorCount}</span>
          <span className={styles.statCardHint}>Authorized supervisors</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statCardLabel}>Total Teams</span>
          <span className={styles.statCardValue}>{data.summary.teamCount}</span>
          <span className={styles.statCardHint}>Across all workspaces</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statCardLabel}>Total Members</span>
          <span className={styles.statCardValue}>{data.summary.memberCount}</span>
          <span className={styles.statCardHint}>Enrolled students</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statCardLabel}>System Admins</span>
          <span className={styles.statCardValue}>{data.summary.adminCount}</span>
          <span className={styles.statCardHint}>Karim Eletriby & delegates</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          className={activeTab === 'mentors' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('mentors')}
        >
          Mentors ({data.mentors.length})
        </button>
        <button
          type="button"
          className={activeTab === 'teams' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('teams')}
        >
          All Teams ({data.teams.length})
        </button>
        <button
          type="button"
          className={activeTab === 'admins' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('admins')}
        >
          Administrators ({data.admins.length})
        </button>
      </div>

      {/* TAB CONTENT: Mentors */}
      {activeTab === 'mentors' && (
        <section className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <div>
              <h3>Authorized Mentors</h3>
              <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Only mentors added by you can create teams and guide members.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setAddMentorError(null);
                setIsAddMentorOpen(true);
              }}
            >
              <UserPlus size={16} /> Add Mentor
            </button>
          </div>

          {data.mentors.length === 0 ? (
            <div style={{ padding: '36px' }}>
              <EmptyState
                title="No mentors yet"
                description="Click 'Add Mentor' to authorize your first mentor."
                icon={<Users size={24} />}
              />
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Mentor</th>
                  <th>Email</th>
                  <th>Teams</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.mentors.map((mentor) => (
                  <tr key={mentor.id}>
                    <td>
                      <span className={styles.mentorAvatar}>
                        {mentor.name.charAt(0).toUpperCase()}
                      </span>
                      <strong>{mentor.name}</strong>
                    </td>
                    <td>{mentor.email}</td>
                    <td>{mentor.teamCount} team{mentor.teamCount === 1 ? '' : 's'}</td>
                    <td>
                      {mentor.isPending ? (
                        <span className={styles.pendingBadge}>Pending Signup</span>
                      ) : (
                        <span className={styles.activeBadge}>Active</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ color: '#ef4444' }}
                        onClick={() => void handleRemoveMentor(mentor.id, mentor.name)}
                        aria-label={`Remove ${mentor.name}`}
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* TAB CONTENT: Teams */}
      {activeTab === 'teams' && (
        <section className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <div>
              <h3>All Teams Across the System</h3>
              <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                High-level visibility into all projects and student groups.
              </p>
            </div>
          </div>

          {data.teams.length === 0 ? (
            <div style={{ padding: '36px' }}>
              <EmptyState
                title="No teams created yet"
                description="Mentors will create teams once authorized."
                icon={<FolderKanban size={24} />}
              />
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Team Name</th>
                  <th>Project</th>
                  <th>Supervising Mentor</th>
                  <th>Members</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.teams.map((team) => (
                  <tr key={team.id}>
                    <td><strong>{team.name}</strong></td>
                    <td>{team.projectName}</td>
                    <td>{team.mentorName}</td>
                    <td>{team.memberCount} member{team.memberCount === 1 ? '' : 's'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {new Date(team.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* TAB CONTENT: Admins */}
      {activeTab === 'admins' && (
        <section className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <div>
              <h3>System Administrators</h3>
              <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Administrators can authorize mentors and configure system-level settings.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setAddAdminError(null);
                setIsAddAdminOpen(true);
              }}
            >
              <Plus size={16} /> Add Admin
            </button>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>Admin Name</th>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {data.admins.map((adm) => (
                <tr key={adm.id}>
                  <td>
                    <span className={styles.mentorAvatar} style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                      {adm.name.charAt(0).toUpperCase()}
                    </span>
                    <strong>{adm.name}</strong>
                    {adm.email.toLowerCase() === 'karimeletriby15@gmail.com' && (
                      <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#7c3aed', fontWeight: 700 }}>
                        (Primary Admin)
                      </span>
                    )}
                  </td>
                  <td>{adm.email}</td>
                  <td><span className={styles.adminBadgeRow}>Administrator</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* DRAWER: Add Mentor */}
      {isAddMentorOpen && (
        <div className={styles.drawerOverlay} role="presentation" onMouseDown={() => setIsAddMentorOpen(false)}>
          <section
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-mentor-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className={styles.drawerHeader}>
              <div>
                <p className={styles.eyebrow}>ADMIN PRIVILEGE</p>
                <h2 id="add-mentor-title">Add New Mentor</h2>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={() => setIsAddMentorOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <form className={styles.drawerForm} onSubmit={(e) => void handleAddMentor(e)}>
              {addMentorError && (
                <p className={styles.formError}>
                  <AlertCircle size={16} />
                  {addMentorError}
                </p>
              )}
              <label className={styles.fieldLabel}>
                Mentor Full Name
                <input
                  className="form-control"
                  value={mentorName}
                  onChange={(e) => setMentorName(e.target.value)}
                  placeholder="e.g. Dr. Ahmed Hassan"
                  autoFocus
                />
              </label>
              <label className={styles.fieldLabel}>
                Mentor Email Address *
                <input
                  type="email"
                  className="form-control"
                  value={mentorEmail}
                  onChange={(e) => setMentorEmail(e.target.value)}
                  placeholder="mentor@example.com"
                  required
                />
              </label>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
                Adding this email authorizes this user to access the Mentor Workspace. If they haven't registered yet, they can sign up with this email anytime.
              </p>
              <div className={styles.drawerActions}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddMentorOpen(false)}
                  disabled={addMentorSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={addMentorSaving}
                >
                  <UserPlus size={16} />
                  {addMentorSaving ? 'Saving...' : 'Authorize Mentor'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* DRAWER: Add Admin */}
      {isAddAdminOpen && (
        <div className={styles.drawerOverlay} role="presentation" onMouseDown={() => setIsAddAdminOpen(false)}>
          <section
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-admin-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className={styles.drawerHeader}>
              <div>
                <p className={styles.eyebrow}>ADMIN PRIVILEGE</p>
                <h2 id="add-admin-title">Promote / Add Admin</h2>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={() => setIsAddAdminOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <form className={styles.drawerForm} onSubmit={(e) => void handlePromoteAdmin(e)}>
              {addAdminError && (
                <p className={styles.formError}>
                  <AlertCircle size={16} />
                  {addAdminError}
                </p>
              )}
              <label className={styles.fieldLabel}>
                User Email Address *
                <input
                  type="email"
                  className="form-control"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  required
                  autoFocus
                />
              </label>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
                This user must have already registered an account with this email. Promoting them grants full administrator privileges.
              </p>
              <div className={styles.drawerActions}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddAdminOpen(false)}
                  disabled={addAdminSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={addAdminSaving}
                >
                  <ShieldCheck size={16} />
                  {addAdminSaving ? 'Promoting...' : 'Promote to Admin'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      )}
    </div>
  );
};
