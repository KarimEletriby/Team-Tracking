import React, { useState, useEffect } from 'react';
import { ArrowLeft, UserPlus, Clock, ArrowRight, User, Settings, AlertCircle } from 'lucide-react';
import { Team, TeamMemberCard } from '../types';
import { api, formatRelativeTime } from '../api';

interface TeamDetailViewProps {
  teamId: string;
  onBack: () => void;
  onSelectMember: (memberId: string) => void;
  onOpenAddMember: (team: Team) => void;
  onOpenRenameTeam: (team: Team) => void;
}

export const TeamDetailView: React.FC<TeamDetailViewProps> = ({
  teamId,
  onBack,
  onSelectMember,
  onOpenAddMember,
  onOpenRenameTeam
}) => {
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMemberCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeamData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getTeam(teamId);
      setTeam(res.team);
      setMembers(res.members);
    } catch (err: any) {
      setError(err?.message || 'Failed to load team.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, [teamId]);

  if (loading) {
    return (
      <div className="page-body">
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          Loading team details...
        </div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="page-body">
        <button onClick={onBack} className="btn btn-secondary btn-sm" style={{ marginBottom: '20px' }}>
          <ArrowLeft size={16} />
          <span>Back to Teams</span>
        </button>
        <div className="card" style={{ padding: '24px', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={20} />
          <span>{error || 'Team not found'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-body">
      {/* Top Navigation */}
      <button
        id="btn-back-teams"
        onClick={onBack}
        className="btn btn-secondary btn-sm"
        style={{ marginBottom: '20px', gap: '6px' }}
      >
        <ArrowLeft size={16} />
        <span>Back to Teams</span>
      </button>

      {/* Team Header Banner */}
      <div className="card" style={{ marginBottom: '28px', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span className="badge badge-blue">Team Container</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </span>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
              {team.name}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => onOpenRenameTeam(team)}
              className="btn btn-secondary btn-sm"
            >
              <Settings size={15} />
              <span>Configure Name</span>
            </button>
            <button
              id="btn-add-member"
              onClick={() => onOpenAddMember(team)}
              className="btn btn-primary btn-sm"
            >
              <UserPlus size={16} />
              <span>+ Add Member</span>
            </button>
          </div>
        </div>
      </div>

      {/* Team Members Section */}
      <div style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
          Team Members
        </h3>
      </div>

      {/* Member Cards Grid or Empty State */}
      {members.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <User size={32} />
          </div>
          <div className="empty-state-title">No members have been added yet.</div>
          <div className="empty-state-desc">
            Add real team members to start tracking their contributions and profiles.
          </div>
          <button
            onClick={() => onOpenAddMember(team)}
            className="btn btn-primary"
            style={{ marginTop: '16px' }}
          >
            <UserPlus size={16} />
            <span>+ Add Member</span>
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '20px'
        }}>
          {members.map((member) => (
            <div
              key={member.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '22px',
                transition: 'all 0.15s ease'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                  {/* Profile Picture */}
                  {member.avatarUrl ? (
                    <img
                      src={member.avatarUrl}
                      alt={member.name}
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid var(--border-color)'
                      }}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary-light)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '1.1rem',
                      flexShrink: 0
                    }}>
                      {member.name ? member.name.charAt(0).toUpperCase() : 'M'}
                    </div>
                  )}

                  <div style={{ overflow: 'hidden' }}>
                    <h4 style={{
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      color: 'var(--text-main)',
                      margin: 0,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {member.name}
                    </h4>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--primary)', fontWeight: 600, marginTop: '2px' }}>
                      {member.role || 'Role not specified'}
                    </div>
                  </div>
                </div>

                {/* Last Update */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                  padding: '8px 10px',
                  backgroundColor: 'var(--bg-surface-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '16px'
                }}>
                  <Clock size={14} />
                  <span>Last Update: {formatRelativeTime(member.lastUpdate)}</span>
                </div>
              </div>

              {/* Open Profile Button */}
              <button
                id={`btn-open-member-${member.id}`}
                onClick={() => onSelectMember(member.id)}
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <span>View Profile & Updates</span>
                <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
