import React from 'react';
import { Users, Plus, ArrowRight, Settings } from 'lucide-react';
import { Team } from '../types';

interface MentorDashboardProps {
  teams: Team[];
  onOpenTeam: (teamId: string) => void;
  onOpenAddTeam: () => void;
  onOpenRenameTeam: (team: Team) => void;
}

export const MentorDashboard: React.FC<MentorDashboardProps> = ({
  teams,
  onOpenTeam,
  onOpenAddTeam,
  onOpenRenameTeam
}) => {
  return (
    <div className="page-body">
      {/* Title & Add Team button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '28px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
            Mentor Dashboard
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px', margin: 0 }}>
            Supervise teams and monitor member work contributions.
          </p>
        </div>

        <button
          id="btn-add-team"
          onClick={onOpenAddTeam}
          className="btn btn-primary"
        >
          <Plus size={16} />
          <span>+ Add Team</span>
        </button>
      </div>

      {/* Subheader: My Teams */}
      <div style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
          My Teams
        </h3>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Total Teams: {teams.length}
        </span>
      </div>

      {/* Teams Grid */}
      {teams.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Users size={32} />
          </div>
          <div className="empty-state-title">No teams yet</div>
          <div className="empty-state-desc">
            You don't have any teams under supervision. Create a new team container to get started.
          </div>
          <button onClick={onOpenAddTeam} className="btn btn-primary" style={{ marginTop: '16px' }}>
            <Plus size={16} />
            <span>+ Add Team</span>
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '20px',
          marginBottom: '32px'
        }}>
          {teams.map((team) => {
            const count = team.memberCount ?? 0;
            return (
              <div
                key={team.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '24px',
                  transition: 'all 0.15s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--primary-light)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700
                    }}>
                      <Users size={20} />
                    </div>
                    <button
                      title="Configure team name"
                      onClick={() => onOpenRenameTeam(team)}
                      className="btn btn-secondary btn-icon"
                      style={{ padding: '6px' }}
                    >
                      <Settings size={15} />
                    </button>
                  </div>

                  <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                    {team.name}
                  </h4>

                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                    {count === 0 ? (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No members yet
                      </span>
                    ) : (
                      <span>
                        Members: <strong style={{ color: 'var(--text-main)' }}>{count}</strong>
                      </span>
                    )}
                  </div>
                </div>

                <button
                  id={`btn-open-team-${team.id}`}
                  onClick={() => onOpenTeam(team.id)}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <span>Open Team</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
