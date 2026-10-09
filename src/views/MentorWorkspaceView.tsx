import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  FolderKanban,
  Code2,
  Globe2,
  Plus,
  Save,
  Settings2,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  CreateMemberInput,
  CreateTeamInput,
  MentorMemberSummary,
  MentorRepository,
  MentorTeam,
  MentorWorkUpdate,
  MemberReviewData,
  TeamWorkspaceData,
} from '../mentor';
import {
  ActivityItem,
  EmptyState,
  LoadingState,
  PageHeader,
  SearchFilterBar,
  StatCard,
  StatusBadge,
  Toast,
} from '../components/mentor';
import styles from './MentorWorkspaceView.module.css';

type MentorScreen = 'overview' | 'teams' | 'team' | 'member';
type TeamTab = 'overview' | 'members' | 'updates';

interface MentorWorkspaceViewProps {
  mentorId: string;
  mentorName: string;
  externalView?: string;
  navigationSignal?: number;
  onSectionChange?: (section: 'dashboard' | 'teams') => void;
  repository: MentorRepository;
}

const formatDate = (value: string | null | undefined) => {
  if (!value) return 'No activity yet';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
};

const healthBadge = (health: MentorTeam['health']) => ({
  'on-track': { label: 'On track', status: 'success' as const },
  'needs-attention': { label: 'Needs attention', status: 'warning' as const },
  'at-risk': { label: 'At risk', status: 'danger' as const },
}[health]);

const memberStatusBadge = (status: MentorMemberSummary['progressStatus']) => ({
  'on-track': { label: 'On track', status: 'success' as const },
  'needs-attention': { label: 'Needs attention', status: 'warning' as const },
  'no-recent-update': { label: 'No recent update', status: 'danger' as const },
}[status]);

function TeamCard({ team, onOpen, onManage }: { team: MentorTeam; onOpen: () => void; onManage: () => void }) {
  const health = healthBadge(team.health);
  return (
    <article className={styles.teamCard}>
      <div className={styles.cardTopline}>
        <span className={styles.teamIcon}><FolderKanban size={19} /></span>
        <StatusBadge {...health} />
      </div>
      <div>
        <h2>{team.name}</h2>
        <p className={styles.teamProject}>{team.projectName}</p>
      </div>
      <div className={styles.progressRow}>
        <div className={styles.progressLabels}><span>Project progress</span><strong>{team.completionPercent}%</strong></div>
        <div className={styles.progressTrack} aria-label={`${team.completionPercent}% complete`}><span style={{ width: `${team.completionPercent}%` }} /></div>
      </div>
      <dl className={styles.teamMeta}>
        <div><dt>Members</dt><dd>{team.memberCount}</dd></div>
        <div><dt>Need attention</dt><dd>{team.needsAttentionCount}</dd></div>
        <div><dt>Last activity</dt><dd>{formatDate(team.lastActivityAt)}</dd></div>
      </dl>
      <div className={styles.teamActions}>
        <button type="button" className="btn btn-secondary" onClick={onOpen}>Open workspace <ArrowRight size={15} /></button>
        <button type="button" className="btn btn-secondary btn-icon" onClick={onManage} aria-label={`Manage ${team.name}`}><Settings2 size={16} /></button>
      </div>
    </article>
  );
}

function Breadcrumbs({ items }: { items: Array<{ label: string; onClick?: () => void }> }) {
  return (
    <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
      {items.map((item, index) => <span key={`${item.label}-${index}`}>
        {index > 0 && <span className={styles.breadcrumbSeparator}>/</span>}
        {item.onClick ? <button type="button" onClick={item.onClick}>{item.label}</button> : <span aria-current="page">{item.label}</span>}
      </span>)}
    </nav>
  );
}

function TeamManagementDrawer({
  team,
  mentorId,
  repository,
  onClose,
  onSaved,
}: {
  team?: MentorTeam;
  mentorId: string;
  repository: MentorRepository;
  onClose: () => void;
  onSaved: (savedTeam: MentorTeam) => Promise<void>;
}) {
  const [name, setName] = useState(team?.name ?? '');
  const [projectName, setProjectName] = useState(team?.projectName ?? '');
  const [projectGoal, setProjectGoal] = useState(team?.projectGoal ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = Boolean(team);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !projectName.trim() || !projectGoal.trim()) {
      setError('Add a team name, project name, and project goal.');
      return;
    }
    setSaving(true); setError(null);
    try {
      const input: CreateTeamInput = { name: name.trim(), projectName: projectName.trim(), projectGoal: projectGoal.trim() };
      const saved = team ? await repository.updateTeam(team.id, input) : await repository.createTeam(mentorId, input);
      if (!saved) throw new Error('Team unavailable');
      await onSaved(saved);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The team could not be saved. Please try again.');
    } finally { setSaving(false); }
  };

  return <div className={styles.drawerOverlay} role="presentation" onMouseDown={onClose}>
    <section className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="team-management-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className={styles.drawerHeader}><div><p className={styles.eyebrow}>Team management</p><h2 id="team-management-title">{isEditing ? `Edit ${team?.name}` : 'Create a team'}</h2></div><button type="button" className="btn btn-secondary btn-icon" onClick={onClose} aria-label="Close team management"><X size={18} /></button></div>
      <form className={styles.drawerForm} onSubmit={(event) => void submit(event)}>
        {error && <p className={styles.formError}><AlertCircle size={16} />{error}</p>}
        <label className={styles.fieldLabel}>Team name<input className="form-control" value={name} onChange={(event) => setName(event.target.value)} autoFocus /></label>
        <label className={styles.fieldLabel}>Project name<input className="form-control" value={projectName} onChange={(event) => setProjectName(event.target.value)} /></label>
        <label className={styles.fieldLabel}>Project goal<textarea className="form-control" rows={4} value={projectGoal} onChange={(event) => setProjectGoal(event.target.value)} /></label>
        <div className={styles.drawerActions}><button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}><Save size={15} />{isEditing ? 'Save changes' : 'Create team'}</button></div>
      </form>
    </section>
  </div>;
}

function MemberManagementDrawer({
  member,
  initialTeamId,
  teams,
  repository,
  onClose,
  onSaved,
  onRemoved,
}: {
  member?: MentorMemberSummary;
  initialTeamId: string;
  teams: MentorTeam[];
  repository: MentorRepository;
  onClose: () => void;
  onSaved: (teamId: string) => Promise<void>;
  onRemoved: () => Promise<void>;
}) {
  const [name, setName] = useState(member?.name ?? '');
  const [email, setEmail] = useState(member?.email ?? '');
  const [projectRole, setProjectRole] = useState(member?.projectRole ?? '');
  const [teamId, setTeamId] = useState(member?.teamId ?? initialTeamId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = Boolean(member);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isEditing && (!name.trim() || !email.trim())) { setError('Add the member name and email.'); return; }
    setSaving(true); setError(null);
    try {
      const input: CreateMemberInput = { name: name.trim(), email: email.trim(), projectRole: projectRole.trim() || 'Team Member' };
      if (member) {
        if (teamId !== member.teamId) {
          const moved = await repository.moveMember(member.id, teamId);
          if (!moved) throw new Error('Team unavailable');
        }
      } else {
        const created = await repository.addMember(teamId, input);
        if (!created) throw new Error('Team unavailable');
      }
      await onSaved(teamId);
      onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The member could not be saved. Please try again.'); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!member || !window.confirm(`Remove ${member.name} from this workspace?`)) return;
    setSaving(true); setError(null);
    try {
      const removed = await repository.removeMember(member.id);
      if (!removed) throw new Error('Member unavailable');
      await onRemoved();
      onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The member could not be removed. Please try again.'); }
    finally { setSaving(false); }
  };

  return <div className={styles.drawerOverlay} role="presentation" onMouseDown={onClose}>
    <section className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="member-management-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className={styles.drawerHeader}><div><p className={styles.eyebrow}>Member management</p><h2 id="member-management-title">{isEditing ? `Edit ${member?.name}` : 'Add a member'}</h2></div><button type="button" className="btn btn-secondary btn-icon" onClick={onClose} aria-label="Close member management"><X size={18} /></button></div>
      <form className={styles.drawerForm} onSubmit={(event) => void submit(event)}>
        {error && <p className={styles.formError}><AlertCircle size={16} />{error}</p>}
        {isEditing && <p className={styles.memberManagementNote}>Members manage their own profile details. You can move them between your teams or remove them from this team.</p>}
        <label className={styles.fieldLabel}>Full name<input className="form-control" value={name} onChange={(event) => setName(event.target.value)} autoFocus readOnly={isEditing} /></label>
        <label className={styles.fieldLabel}>Email address<input type="email" className="form-control" value={email} onChange={(event) => setEmail(event.target.value)} readOnly={isEditing} /></label>
        <label className={styles.fieldLabel}>Project role <span>Optional — member can set or edit their own role</span><input className="form-control" value={projectRole} onChange={(event) => setProjectRole(event.target.value)} placeholder="e.g. Frontend developer (or leave for member to set)" readOnly={isEditing} /></label>
        <label className={styles.fieldLabel}>Team<select className="form-control" value={teamId} onChange={(event) => setTeamId(event.target.value)}>{teams.map((teamOption) => <option key={teamOption.id} value={teamOption.id}>{teamOption.name}</option>)}</select></label>
        <div className={styles.drawerActions}>{isEditing && <button type="button" className={styles.dangerButton} onClick={() => void remove()} disabled={saving}><Trash2 size={15} />Remove member</button>}<span className={styles.drawerSpacer} /><button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}><Save size={15} />{isEditing ? 'Save team assignment' : 'Add member'}</button></div>
      </form>
    </section>
  </div>;
}

export function MentorWorkspaceView({ mentorId, mentorName, externalView, navigationSignal = 0, onSectionChange, repository }: MentorWorkspaceViewProps) {
  const [screen, setScreen] = useState<MentorScreen>('overview');
  const [dashboard, setDashboard] = useState<Awaited<ReturnType<MentorRepository['getDashboard']>> | null>(null);
  const [teams, setTeams] = useState<MentorTeam[]>([]);
  const [workspace, setWorkspace] = useState<TeamWorkspaceData | null>(null);
  const [review, setReview] = useState<MemberReviewData | null>(null);
  const [teamTab, setTeamTab] = useState<TeamTab>('overview');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [teamToManage, setTeamToManage] = useState<MentorTeam | null | undefined>(undefined);
  const [memberToManage, setMemberToManage] = useState<MentorMemberSummary | null>(null);
  const [memberManagementTeamId, setMemberManagementTeamId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadOverview = async () => {
    setLoading(true); setLoadError(null);
    try {
      const [dashboardData, teamData] = await Promise.all([repository.getDashboard(mentorId), repository.getTeams(mentorId)]);
      setDashboard(dashboardData); setTeams(teamData);
    } catch {
      setLoadError('The mentor workspace could not be loaded.');
    } finally { setLoading(false); }
  };
  useEffect(() => { void loadOverview(); }, [mentorId, repository]);
  useEffect(() => {
    if (externalView === 'dashboard') { setScreen('overview'); setWorkspace(null); setReview(null); setSearch(''); setFilter('all'); }
    if (externalView === 'teams') { setScreen('teams'); setWorkspace(null); setReview(null); setSearch(''); setFilter('all'); }
  }, [navigationSignal]);

  const goToOverview = (pushHistory = true) => {
    setScreen('overview');
    setWorkspace(null);
    setReview(null);
    setSearch('');
    setFilter('all');
    onSectionChange?.('dashboard');
    if (pushHistory) {
      window.history.pushState({ mentorScreen: 'overview' }, '', '?view=dashboard');
    }
  };

  const goToTeams = (pushHistory = true) => {
    setScreen('teams');
    setWorkspace(null);
    setReview(null);
    setSearch('');
    setFilter('all');
    onSectionChange?.('teams');
    if (pushHistory) {
      window.history.pushState({ mentorScreen: 'teams' }, '', '?view=teams');
    }
  };

  const openTeam = async (teamId: string, pushHistory = true) => {
    setLoading(true); setLoadError(null);
    try {
      const data = await repository.getTeamWorkspace(teamId);
      if (!data) { setLoadError('This team is no longer available.'); return; }
      setWorkspace(data); setTeamTab('overview'); setScreen('team'); onSectionChange?.('teams');
      if (pushHistory) {
        window.history.pushState({ mentorScreen: 'team', teamId }, '', `?view=team&teamId=${teamId}`);
      }
    } catch { setLoadError('The team workspace could not be loaded.'); }
    finally { setLoading(false); }
  };

  const openMember = async (memberId: string, pushHistory = true) => {
    setLoading(true); setLoadError(null);
    try {
      const data = await repository.getMemberReview(memberId);
      if (!data) { setLoadError('This member profile is no longer available.'); return; }
      setReview(data); setScreen('member'); onSectionChange?.('teams');
      if (pushHistory) {
        window.history.pushState({ mentorScreen: 'member', memberId, teamId: workspace?.team.id }, '', `?view=member&memberId=${memberId}`);
      }
    } catch { setLoadError('The member profile could not be loaded.'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (!state || state.mentorScreen === 'overview') {
        goToOverview(false);
      } else if (state.mentorScreen === 'teams') {
        goToTeams(false);
      } else if (state.mentorScreen === 'team' && state.teamId) {
        void openTeam(state.teamId, false);
      } else if (state.mentorScreen === 'member' && state.memberId) {
        void openMember(state.memberId, false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [workspace]);

  const refreshManagementData = async (teamId?: string) => {
    try {
      const [dashboardData, teamData] = await Promise.all([
        repository.getDashboard(mentorId),
        repository.getTeams(mentorId),
      ]);
      setDashboard(dashboardData);
      setTeams(teamData);
      if (teamId) setWorkspace(await repository.getTeamWorkspace(teamId));
    } catch {
      setLoadError('The workspace could not be refreshed. Please try again.');
    }
  };

  const filteredTeams = useMemo(() => teams.filter((team) => {
    const matchesSearch = `${team.name} ${team.projectName}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (filter === 'all' || team.health === filter);
  }), [teams, search, filter]);
  const filteredMembers = useMemo(() => workspace?.members.filter((member) => {
    const matchesSearch = `${member.name} ${member.projectRole}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (filter === 'all' || member.progressStatus === filter);
  }) ?? [], [workspace, search, filter]);

  if (loading) return <div className="page-body"><LoadingState label="Loading mentor workspace…" /></div>;
  if (loadError || !dashboard) return <div className="page-body"><EmptyState title="Workspace unavailable" description={loadError ?? 'Refresh the page and try again.'} icon={<AlertCircle size={24} />} action={<button type="button" className="btn btn-primary" onClick={() => void loadOverview()}>Try again</button>} /></div>;

  const teamTabs: Array<{ id: TeamTab; label: string }> = [
    { id: 'overview', label: 'Overview' }, { id: 'members', label: 'Members' }, { id: 'updates', label: 'Updates' },
  ];

  const renderDashboard = () => <>
    <PageHeader eyebrow="Mentor workspace" title={`Welcome back, ${mentorName}`} description="A focused overview of teams, recent work, and the people who need your attention." actions={<button className="btn btn-primary" type="button" onClick={() => goToTeams()}>View teams <ArrowRight size={16} /></button>} />
    <div className={styles.statGrid}>
      <StatCard label="Teams" value={dashboard.summary.teamCount} hint="Under your supervision" icon={<FolderKanban size={17} />} />
      <StatCard label="Members" value={dashboard.summary.memberCount} hint="Across all teams" icon={<Users size={17} />} />
      <StatCard label="Updates this week" value={dashboard.summary.updatesThisWeek} hint="Recent member progress" icon={<FileText size={17} />} />
      <StatCard label="Need attention" value={dashboard.summary.membersNeedingAttention} hint="Members needing a check-in" icon={<AlertCircle size={17} />} />
    </div>
    <div className={styles.dashboardGrid}>
      <section className={`card ${styles.sectionCard}`}><div className={styles.sectionHeading}><div><h2>Teams needing attention</h2><p>Open a workspace to see members who need a check-in.</p></div><button type="button" className={styles.textButton} onClick={() => goToTeams()}>All teams</button></div>
        <div className={styles.teamList}>{dashboard.teams.map((team) => <button key={team.id} type="button" className={styles.attentionTeam} onClick={() => void openTeam(team.id)}><span><strong>{team.name}</strong><small>{team.needsAttentionCount} member{team.needsAttentionCount === 1 ? '' : 's'} need attention</small></span><StatusBadge {...healthBadge(team.health)} /></button>)}</div>
      </section>
      <section className={`card ${styles.sectionCard}`}><div className={styles.sectionHeading}><div><h2>Recent activity</h2><p>Latest movement across your teams.</p></div></div>
        <div>{dashboard.recentActivity.map((activity) => <ActivityItem key={activity.id} title={activity.message} timestamp={formatDate(activity.happenedAt)} icon={activity.type === 'member-needs-attention' ? <AlertCircle size={17} /> : <FileText size={17} />} />)}</div>
      </section>
    </div>
    <section className={styles.sectionBlock}><div className={styles.sectionHeading}><div><h2>Your teams</h2><p>Project health, progress, and the team members you manage.</p></div></div><div className={styles.teamGrid}>{dashboard.teams.map((team) => <TeamCard key={team.id} team={team} onOpen={() => void openTeam(team.id)} onManage={() => setTeamToManage(team)} />)}</div></section>
  </>;

  const renderTeams = () => <>
    <div style={{ marginBottom: '14px' }}>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          if (window.history.state?.mentorScreen) window.history.back();
          else goToOverview();
        }}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
      >
        <ArrowLeft size={16} /> Back to dashboard
      </button>
    </div>
    <PageHeader eyebrow="Mentor workspace" title="My teams" description="Create teams, organize members, and open the right workspace quickly." actions={<button type="button" className="btn btn-primary" onClick={() => setTeamToManage(null)}><Plus size={16} />Create team</button>} />
    <SearchFilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search teams or projects" filters={[{ id: 'health', label: 'Filter team health', value: filter, options: [{ value: 'all', label: 'All statuses' }, { value: 'on-track', label: 'On track' }, { value: 'needs-attention', label: 'Needs attention' }, { value: 'at-risk', label: 'At risk' }] }]} onFilterChange={(_, value) => setFilter(value)} />
    <div className={styles.teamGrid}>{filteredTeams.map((team) => <TeamCard key={team.id} team={team} onOpen={() => void openTeam(team.id)} onManage={() => setTeamToManage(team)} />)}</div>
    {!filteredTeams.length && <EmptyState title="No teams found" description="Try another search phrase or clear the health filter." icon={<FolderKanban size={24} />} />}
  </>;

  const renderTeam = () => {
    if (!workspace) return null;
    const { team } = workspace;
    return <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            if (window.history.state?.mentorScreen) window.history.back();
            else goToTeams();
          }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={16} /> Back to teams
        </button>
        <Breadcrumbs items={[{ label: 'My teams', onClick: () => goToTeams() }, { label: team.name }]} />
      </div>
      <PageHeader eyebrow="Team workspace" title={team.name} description={team.projectGoal} actions={<><StatusBadge {...healthBadge(team.health)} /><button type="button" className="btn btn-secondary" onClick={() => setTeamToManage(team)}><Settings2 size={16} />Manage team</button><button type="button" className="btn btn-primary" onClick={() => { setMemberToManage(null); setMemberManagementTeamId(team.id); }}><UserPlus size={16} />Add member</button></>} />
      <div className={styles.workspaceSummary}><div><span>Project</span><strong>{team.projectName}</strong></div><div><span>Members</span><strong>{team.memberCount}</strong></div><div><span>Progress</span><strong>{team.completionPercent}%</strong></div><div><span>Need attention</span><strong>{team.needsAttentionCount}</strong></div></div>
      <div className={styles.tabs} role="tablist" aria-label="Team workspace sections">{teamTabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={teamTab === tab.id} className={teamTab === tab.id ? styles.tabActive : styles.tab} onClick={() => { setTeamTab(tab.id); setSearch(''); setFilter('all'); }}>{tab.label}</button>)}</div>
      {teamTab === 'overview' && <div className={styles.dashboardGrid}><section className={`card ${styles.sectionCard}`}><div className={styles.sectionHeading}><div><h2>Member progress</h2><p>See who is on track and who needs a check-in.</p></div><button type="button" className={styles.textButton} onClick={() => setTeamTab('members')}>View members</button></div><div className={styles.memberPreview}>{workspace.members.map((member) => <button key={member.id} type="button" onClick={() => void openMember(member.id)}><span className={styles.avatar}>{member.name.charAt(0)}</span><span><strong>{member.name}</strong><small>{member.projectRole}</small></span><StatusBadge {...memberStatusBadge(member.progressStatus)} /></button>)}</div></section><section className={`card ${styles.sectionCard}`}><div className={styles.sectionHeading}><div><h2>Latest updates</h2><p>New work waiting for your review.</p></div><button type="button" className={styles.textButton} onClick={() => setTeamTab('updates')}>View updates</button></div>{workspace.updates.slice(0, 3).map((update) => <UpdateItem key={update.id} update={update} member={workspace.members.find((member) => member.id === update.memberId)} />)}</section></div>}
      {teamTab === 'members' && <><SearchFilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search members or roles" filters={[{ id: 'member-status', label: 'Filter member status', value: filter, options: [{ value: 'all', label: 'All statuses' }, { value: 'on-track', label: 'On track' }, { value: 'needs-attention', label: 'Needs attention' }, { value: 'no-recent-update', label: 'No recent update' }] }]} onFilterChange={(_, value) => setFilter(value)} /><div className={styles.memberTable}>{filteredMembers.map((member) => <button key={member.id} type="button" onClick={() => void openMember(member.id)}><span className={styles.avatar}>{member.name.charAt(0)}</span><span className={styles.memberName}><strong>{member.name}</strong><small>{member.projectRole}</small></span><span><small>Last update</small><strong>{formatDate(member.lastUpdateAt)}</strong></span><StatusBadge {...memberStatusBadge(member.progressStatus)} /><ArrowRight size={16} /></button>)}</div>{!filteredMembers.length && <EmptyState title="No members found" description="Try a different member name, role, or status." icon={<Users size={24} />} />}</>}
      {teamTab === 'updates' && <div className={styles.updateList}>{workspace.updates.map((update) => <UpdateItem key={update.id} update={update} member={workspace.members.find((member) => member.id === update.memberId)} expanded />)}</div>}
    </>;
  };

  const renderMember = () => {
    if (!review) return null;
    return <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            if (window.history.state?.mentorScreen) window.history.back();
            else if (workspace) setScreen('team');
            else goToTeams();
          }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={16} /> {workspace ? `Back to ${workspace.team.name}` : 'Back to teams'}
        </button>
        <Breadcrumbs items={[{ label: 'My teams', onClick: () => goToTeams() }, ...(workspace ? [{ label: workspace.team.name, onClick: () => setScreen('team') }] : []), { label: review.member.name }]} />
      </div>
      <PageHeader eyebrow="Member workspace" title={review.member.name} description={`${review.member.projectRole} · ${review.member.email}`} actions={<button type="button" className="btn btn-secondary" onClick={() => { setMemberToManage(review.member); setMemberManagementTeamId(review.member.teamId); }}><Settings2 size={16} />Manage member</button>} />
      <section className={`card ${styles.profileCard}`}><div className={styles.profileIntro}><span className={styles.profileAvatar}>{review.member.name.charAt(0)}</span><div><h2>{review.member.projectRole}</h2><p>{review.member.bio}</p></div><StatusBadge {...memberStatusBadge(review.member.progressStatus)} /></div><div className={styles.profileGrid}><div><h3>Technical skills</h3><p className={styles.chipList}>{review.member.technicalSkills.map((skill) => <span key={skill}>{skill}</span>)}</p></div><div><h3>Responsibilities</h3><ul>{review.member.responsibilities.map((responsibility) => <li key={responsibility}>{responsibility}</li>)}</ul></div><div><h3>Activity</h3><p>{review.member.updateCount} updates · Last update {formatDate(review.member.lastUpdateAt)}</p></div></div>{review.member.professionalLinks && Object.values(review.member.professionalLinks).some(Boolean) && <div className={styles.profileLinks}><h3>Professional links</h3><div>{review.member.professionalLinks.linkedIn && <a href={review.member.professionalLinks.linkedIn} target="_blank" rel="noreferrer"><BriefcaseBusiness size={16} />LinkedIn</a>}{review.member.professionalLinks.github && <a href={review.member.professionalLinks.github} target="_blank" rel="noreferrer"><Code2 size={16} />GitHub</a>}{review.member.professionalLinks.portfolio && <a href={review.member.professionalLinks.portfolio} target="_blank" rel="noreferrer"><Globe2 size={16} />Portfolio</a>}</div></div>}</section>
      <section className={`card ${styles.timelinePanel}`}><div className={styles.sectionHeading}><div><h2>Contribution timeline</h2><p>Technical work, evidence, and next steps.</p></div></div><div className={styles.updateList}>{review.updates.map((update) => <UpdateItem key={update.id} update={update} expanded />)}</div></section>
    </>;
  };

  return <div className={`page-body ${styles.workspaceRoot}`}>
    {screen === 'overview' && renderDashboard()}{screen === 'teams' && renderTeams()}{screen === 'team' && renderTeam()}{screen === 'member' && renderMember()}
    {teamToManage !== undefined && <TeamManagementDrawer team={teamToManage ?? undefined} mentorId={mentorId} repository={repository} onClose={() => setTeamToManage(undefined)} onSaved={async (savedTeam) => { const wasEditing = Boolean(teamToManage); await refreshManagementData(workspace?.team.id === savedTeam.id ? savedTeam.id : undefined); if (!workspace) setScreen('teams'); setToastMessage(wasEditing ? 'Team updated successfully.' : 'Team created successfully.'); }} />}
    {memberManagementTeamId && <MemberManagementDrawer member={memberToManage ?? undefined} initialTeamId={memberManagementTeamId} teams={teams} repository={repository} onClose={() => { setMemberToManage(null); setMemberManagementTeamId(null); }} onSaved={async (selectedTeamId) => { const wasEditing = Boolean(memberToManage); await refreshManagementData(selectedTeamId); if (memberToManage) setReview(await repository.getMemberReview(memberToManage.id)); setToastMessage(wasEditing ? 'Member details updated successfully.' : 'Member added successfully.'); }} onRemoved={async () => { await refreshManagementData(workspace?.team.id); setReview(null); setScreen(workspace ? 'team' : 'teams'); setToastMessage('Member removed successfully.'); }} />}
    {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />}
  </div>;
}

function UpdateItem({ update, member, expanded = false }: { update: MentorWorkUpdate; member?: MentorMemberSummary; expanded?: boolean }) {
  return <article className={styles.updateItem}><div className={styles.updateHeader}><div><p>{member?.name ?? 'Member'} · {formatDate(update.submittedAt)}</p><h3>{update.title}</h3></div><StatusBadge label={update.reviewStatus === 'new' ? 'New update' : 'Reviewed'} status={update.reviewStatus === 'new' ? 'info' : 'success'} /></div><p>{expanded ? update.technicalDetails : update.summary}</p>{expanded && <><div className={styles.updateDetail}><strong>Summary</strong><span>{update.summary}</span></div>{update.challenges && <div className={styles.updateDetail}><strong>Challenge</strong><span>{update.challenges}</span></div>}{update.nextStep && <div className={styles.updateDetail}><strong>Next step</strong><span>{update.nextStep}</span></div>}{update.evidenceUrl && <a href={update.evidenceUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} />Open evidence</a>}{update.evidenceFile && <a href={update.evidenceFile.signedUrl} target="_blank" rel="noreferrer" download={update.evidenceFile.fileName}><Download size={14} />View or download {update.evidenceFile.fileName}</a>}</>}</article>;
}
