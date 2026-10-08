import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { MemberProfile } from '../types';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile?: MemberProfile | null;
  onSave: (params: {
    role: string;
    responsibilities: string[];
    technicalSkills: string[];
    bio: string;
    avatarUrl: string;
  }) => Promise<void>;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSave
}) => {
  const [role, setRole] = useState(profile?.role || '');
  const [responsibilitiesText, setResponsibilitiesText] = useState(
    profile?.responsibilities?.join('\n') || ''
  );
  const [skillsText, setSkillsText] = useState(
    profile?.technicalSkills?.join(', ') || ''
  );
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setRole(profile.role || '');
      setResponsibilitiesText(profile.responsibilities?.join('\n') || '');
      setSkillsText(profile.technicalSkills?.join(', ') || '');
      setBio(profile.bio || '');
      setAvatarUrl(profile.avatarUrl || '');
    }
  }, [profile, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const responsibilities = responsibilitiesText
      .split('\n')
      .map((r) => r.replace(/^[•\-\*]\s*/, '').trim())
      .filter((r) => r.length > 0);

    const technicalSkills = skillsText
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    try {
      await onSave({
        role: role.trim(),
        responsibilities,
        technicalSkills,
        bio: bio.trim(),
        avatarUrl: avatarUrl.trim()
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Edit Profile
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px', margin: 0 }}>
              Keep your professional role, skills, and bio updated.
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="btn btn-secondary btn-icon"
            style={{ padding: '6px' }}
          >
            <X size={18} />
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
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.875rem',
            marginBottom: '16px'
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="profile-role">
              Role
            </label>
            <input
              id="profile-role"
              type="text"
              className="form-control"
              placeholder="e.g. ML Engineer, Frontend Developer"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="profile-skills">
              Technical Skills <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(comma separated)</span>
            </label>
            <input
              id="profile-skills"
              type="text"
              className="form-control"
              placeholder="e.g. Python, PyTorch, OpenCV, Docker"
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="profile-responsibilities">
              Responsibilities <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(one per line)</span>
            </label>
            <textarea
              id="profile-responsibilities"
              className="form-control"
              rows={3}
              placeholder="e.g.&#10;Model architecture development&#10;Data preprocessing pipeline&#10;Model inference optimization"
              value={responsibilitiesText}
              onChange={(e) => setResponsibilitiesText(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="profile-bio">
              About Me (Bio)
            </label>
            <textarea
              id="profile-bio"
              className="form-control"
              rows={3}
              placeholder="Short description of your background and technical interests..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="profile-avatar">
              Profile Picture URL <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Optional image link)</span>
            </label>
            <input
              id="profile-avatar"
              type="url"
              className="form-control"
              placeholder="https://images.unsplash.com/..."
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              <Check size={16} />
              <span>{loading ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
