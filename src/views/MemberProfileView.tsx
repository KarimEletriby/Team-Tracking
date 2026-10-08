import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Edit3, 
  Plus, 
  ExternalLink, 
  Clock, 
  AlertCircle, 
  User, 
  Code, 
  ListChecks, 
  Calendar,
  Trash2
} from 'lucide-react';
import { MemberDetail, WorkUpdate, User as UserType } from '../types';
import { api, formatRelativeTime } from '../api';

interface MemberProfileViewProps {
  memberId: string;
  currentUser: UserType;
  onBack?: () => void;
  onOpenEditProfile: () => void;
  onOpenAddUpdate: () => void;
  onOpenEditUpdate: (update: WorkUpdate) => void;
}

export const MemberProfileView: React.FC<MemberProfileViewProps> = ({
  memberId,
  currentUser,
  onBack,
  onOpenEditProfile,
  onOpenAddUpdate,
  onOpenEditUpdate
}) => {
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [updates, setUpdates] = useState<WorkUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOwner = currentUser.role === 'member' && currentUser.id === memberId;
  const isMentor = currentUser.role === 'mentor';

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const [memberRes, updatesRes] = await Promise.all([
        api.getMember(memberId),
        api.getMemberUpdates(memberId)
      ]);
      setMember(memberRes.member);
      setUpdates(updatesRes.updates);
    } catch (err: any) {
      setError(err?.message || 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [memberId]);

  const handleDeleteUpdate = async (updateId: string) => {
    if (!window.confirm('Are you sure you want to delete this update?')) return;
    try {
      await api.deleteUpdate(updateId);
      setUpdates((prev) => prev.filter((u) => u.id !== updateId));
    } catch (err: any) {
      alert(err?.message || 'Failed to delete update.');
    }
  };

  if (loading) {
    return (
      <div className="page-body">
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          Loading profile...
        </div>
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="page-body">
        {onBack && (
          <button onClick={onBack} className="btn btn-secondary btn-sm" style={{ marginBottom: '20px' }}>
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
        )}
        <div className="card" style={{ padding: '24px', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={20} />
          <span>{error || 'Profile not accessible.'}</span>
        </div>
      </div>
    );
  }

  const profile = member.profile;

  return (
    <div className="page-body">
      {/* Top Navigation Row (Only for Mentor viewing a member) */}
      {isMentor && onBack && (
        <button
          id="btn-back-team-from-member"
          onClick={onBack}
          className="btn btn-secondary btn-sm"
          style={{ marginBottom: '20px', gap: '6px' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Team</span>
        </button>
      )}

      {/* Main Profile Header Card */}
      <div className="card" style={{ padding: '32px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {/* Profile Picture */}
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={member.name}
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid var(--border-color)'
                }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1.75rem'
              }}>
                {member.name ? member.name.charAt(0).toUpperCase() : 'M'}
              </div>
            )}

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
                  {member.name}
                </h2>
                {member.teamName && (
                  <span className="badge badge-blue">
                    {member.teamName}
                  </span>
                )}
              </div>

              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: profile.role ? 'var(--primary)' : 'var(--text-muted)', marginTop: '4px' }}>
                {profile.role || 'Role not completed yet'}
              </div>

              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {member.email}
              </div>
            </div>
          </div>

          {/* Action button: Edit profile for owner */}
          {isOwner && (
            <button
              id="btn-edit-profile"
              onClick={onOpenEditProfile}
              className="btn btn-secondary btn-sm"
            >
              <Edit3 size={15} />
              <span>Edit Profile</span>
            </button>
          )}
        </div>

        {/* Profile Content Details Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          marginTop: '28px',
          paddingTop: '24px',
          borderTop: '1px solid var(--border-color)'
        }}>
          {/* About Me */}
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em', marginBottom: '8px' }}>
              About Me
            </div>
            {profile.bio ? (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-line', margin: 0 }}>
                {profile.bio}
              </p>
            ) : (
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No bio added yet.
              </div>
            )}
          </div>

          {/* Technical Skills */}
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em', marginBottom: '8px' }}>
              Technical Skills
            </div>
            {profile.technicalSkills && profile.technicalSkills.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {profile.technicalSkills.map((skill, idx) => (
                  <span
                    key={idx}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--primary-light)',
                      color: 'var(--primary)',
                      fontSize: '0.8125rem',
                      fontWeight: 600
                    }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No technical skills added yet.
              </div>
            )}
          </div>

          {/* Responsibilities */}
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em', marginBottom: '8px' }}>
              Responsibilities
            </div>
            {profile.responsibilities && profile.responsibilities.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {profile.responsibilities.map((resp, idx) => (
                  <li key={idx}>{resp}</li>
                ))}
              </ul>
            ) : (
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No responsibilities listed yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Work Updates Section */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            {isOwner ? 'My Work Updates' : 'Work Updates'}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px', margin: 0 }}>
            Chronological documentation of technical work and achievements ({updates.length})
          </p>
        </div>

        {isOwner && (
          <button
            id="btn-add-update-profile"
            onClick={onOpenAddUpdate}
            className="btn btn-primary"
          >
            <Plus size={16} />
            <span>+ Add Update</span>
          </button>
        )}
      </div>

      {/* Updates List or Empty State */}
      {updates.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Clock size={32} />
          </div>
          <div className="empty-state-title">No updates yet</div>
          <div className="empty-state-desc">
            {isOwner
              ? 'You have not added any work updates yet. Document your technical progress here.'
              : 'This member has not posted any updates yet.'}
          </div>
          {isOwner && (
            <button
              onClick={onOpenAddUpdate}
              className="btn btn-primary"
              style={{ marginTop: '16px' }}
            >
              <Plus size={16} />
              <span>+ Add Update</span>
            </button>
          )}
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

                {isOwner && (
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
                      onClick={() => handleDeleteUpdate(upd.id)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 8px', color: '#ef4444' }}
                      title="Delete update"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
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
