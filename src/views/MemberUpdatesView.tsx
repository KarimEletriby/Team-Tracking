import React, { useState, useEffect } from 'react';
import { Plus, Clock, ExternalLink, Calendar, Edit3, Trash2, AlertCircle } from 'lucide-react';
import { WorkUpdate, User as UserType } from '../types';
import { api, formatRelativeTime } from '../api';

interface MemberUpdatesViewProps {
  currentUser: UserType;
  onOpenAddUpdate: () => void;
  onOpenEditUpdate: (update: WorkUpdate) => void;
}

export const MemberUpdatesView: React.FC<MemberUpdatesViewProps> = ({
  currentUser,
  onOpenAddUpdate,
  onOpenEditUpdate
}) => {
  const [updates, setUpdates] = useState<WorkUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUpdates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getMemberUpdates(currentUser.id);
      setUpdates(res.updates);
    } catch (err: any) {
      setError(err?.message || 'Failed to load updates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpdates();
  }, [currentUser.id]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this work update?')) return;
    try {
      await api.deleteUpdate(id);
      setUpdates((prev) => prev.filter((u) => u.id !== id));
    } catch (err: any) {
      alert(err?.message || 'Failed to delete update.');
    }
  };

  return (
    <div className="page-body">
      {/* Header */}
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
            My Updates
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px', margin: 0 }}>
            Chronological documentation of your technical progress and achievements.
          </p>
        </div>

        <button
          id="btn-add-update-page"
          onClick={onOpenAddUpdate}
          className="btn btn-primary"
        >
          <Plus size={16} />
          <span>+ Add Update</span>
        </button>
      </div>

      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#fef2f2',
          color: '#b91c1c',
          border: '1px solid #fecaca',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '20px'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          Loading your updates...
        </div>
      ) : updates.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Clock size={32} />
          </div>
          <div className="empty-state-title">No updates yet</div>
          <div className="empty-state-desc">
            You haven't logged any work updates yet. Document your technical progress and milestones here.
          </div>
          <button
            onClick={onOpenAddUpdate}
            className="btn btn-primary"
            style={{ marginTop: '16px' }}
          >
            <Plus size={16} />
            <span>+ Add Update</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {updates.map((upd) => (
            <div key={upd.id} className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                    {upd.title}
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    <Calendar size={13} />
                    <span>{new Date(upd.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    <span>•</span>
                    <span>{formatRelativeTime(upd.createdAt)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => onOpenEditUpdate(upd)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                  >
                    <Edit3 size={13} />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(upd.id)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '4px 8px', color: '#ef4444' }}
                    title="Delete update"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* What worked on */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em', marginBottom: '4px' }}>
                  What did you work on?
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-line' }}>
                  {upd.whatWorkedOn}
                </p>
              </div>

              {/* Technical Work */}
              <div style={{
                marginBottom: '14px',
                padding: '14px 16px',
                backgroundColor: 'var(--bg-surface-subtle)',
                borderRadius: 'var(--radius-sm)',
                borderLeft: '3px solid var(--primary)'
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.04em', marginBottom: '4px' }}>
                  Technical Work & Achievements
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-line' }}>
                  {upd.technicalWork}
                </p>
              </div>

              {/* Optional Fields Grid */}
              {(upd.challenges || upd.nextStep || upd.evidenceLink) && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '14px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border-color)',
                  fontSize: '0.85rem'
                }}>
                  {upd.challenges && (
                    <div>
                      <span style={{ fontWeight: 600, color: '#b45309' }}>Challenges: </span>
                      <span style={{ color: 'var(--text-secondary)' }}>{upd.challenges}</span>
                    </div>
                  )}

                  {upd.nextStep && (
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--primary)' }}>Next Step: </span>
                      <span style={{ color: 'var(--text-secondary)' }}>{upd.nextStep}</span>
                    </div>
                  )}

                  {upd.evidenceLink && (
                    <div>
                      <a
                        href={upd.evidenceLink}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: 'var(--primary)',
                          fontWeight: 600,
                          textDecoration: 'underline'
                        }}
                      >
                        <ExternalLink size={13} />
                        <span>View Evidence / Link</span>
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
