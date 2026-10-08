import React, { useState } from 'react';
import { X, UserPlus, AlertCircle } from 'lucide-react';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamName: string;
  onSubmit: (params: { name: string; email: string; password?: string; roleTitle?: string }) => Promise<void>;
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
  isOpen,
  onClose,
  teamName,
  onSubmit
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('123456');
  const [roleTitle, setRoleTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide the member\'s full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim() || '123456',
        roleTitle: roleTitle.trim() || undefined
      });
      setName('');
      setEmail('');
      setPassword('123456');
      setRoleTitle('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to add member.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '500px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Add Team Member
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px', margin: 0 }}>
              Add a real member to <strong>{teamName}</strong>.
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
            <label className="form-label" htmlFor="member-name-input">
              Full Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="member-name-input"
              type="text"
              className="form-control"
              placeholder="e.g. Sarah Jenkins"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="member-email-input">
              Email Address <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="member-email-input"
              type="email"
              className="form-control"
              placeholder="e.g. sarah@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="member-role-input">
              Role Title <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Optional - member can edit later)</span>
            </label>
            <input
              id="member-role-input"
              type="text"
              className="form-control"
              placeholder="e.g. ML Engineer, Backend Developer"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="member-password-input">
              Temporary Password <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(For member login)</span>
            </label>
            <input
              id="member-password-input"
              type="text"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              <UserPlus size={16} />
              <span>{loading ? 'Adding...' : 'Add Member'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
