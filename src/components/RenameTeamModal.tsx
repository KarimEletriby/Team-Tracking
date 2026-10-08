import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';

interface RenameTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  onSubmit: (newName: string) => Promise<void>;
}

export const RenameTeamModal: React.FC<RenameTeamModalProps> = ({
  isOpen,
  onClose,
  currentName,
  onSubmit
}) => {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(currentName);
  }, [currentName, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Team name cannot be empty.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onSubmit(name.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to rename team.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '440px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Configure Team Name
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px', margin: 0 }}>
              Update the name for this team container.
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
            <label className="form-label" htmlFor="rename-team-input">
              Team Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="rename-team-input"
              type="text"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
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
              <span>{loading ? 'Saving...' : 'Save Name'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
