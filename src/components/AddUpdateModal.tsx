import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, FilePlus2 } from 'lucide-react';
import { WorkUpdate } from '../types';

interface AddUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateToEdit?: WorkUpdate | null;
  onSubmit: (data: {
    title: string;
    whatWorkedOn: string;
    technicalWork: string;
    challenges?: string;
    nextStep?: string;
    evidenceLink?: string;
  }) => Promise<void>;
}

export const AddUpdateModal: React.FC<AddUpdateModalProps> = ({
  isOpen,
  onClose,
  updateToEdit,
  onSubmit
}) => {
  const [title, setTitle] = useState('');
  const [whatWorkedOn, setWhatWorkedOn] = useState('');
  const [technicalWork, setTechnicalWork] = useState('');
  const [challenges, setChallenges] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [evidenceLink, setEvidenceLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!updateToEdit;

  useEffect(() => {
    if (updateToEdit) {
      setTitle(updateToEdit.title || '');
      setWhatWorkedOn(updateToEdit.whatWorkedOn || '');
      setTechnicalWork(updateToEdit.technicalWork || '');
      setChallenges(updateToEdit.challenges || '');
      setNextStep(updateToEdit.nextStep || '');
      setEvidenceLink(updateToEdit.evidenceLink || '');
    } else {
      setTitle('');
      setWhatWorkedOn('');
      setTechnicalWork('');
      setChallenges('');
      setNextStep('');
      setEvidenceLink('');
    }
    setError(null);
  }, [updateToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a title for this update.');
      return;
    }
    if (!whatWorkedOn.trim()) {
      setError('Please describe what you worked on.');
      return;
    }
    if (!technicalWork.trim()) {
      setError('Please describe what you technically achieved.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await onSubmit({
        title: title.trim(),
        whatWorkedOn: whatWorkedOn.trim(),
        technicalWork: technicalWork.trim(),
        challenges: challenges.trim() || undefined,
        nextStep: nextStep.trim() || undefined,
        evidenceLink: evidenceLink.trim() || undefined
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save update.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              {isEditing ? 'Edit Work Update' : '+ Add Work Update'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px', margin: 0 }}>
              Document your work and technical contributions.
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
            <label className="form-label" htmlFor="update-title">
              Title <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="update-title"
              type="text"
              className="form-control"
              placeholder="e.g. Implemented ResNet Backbone and Evaluated Validation Loss"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="update-what-worked-on">
              What did you work on? <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              id="update-what-worked-on"
              className="form-control"
              rows={3}
              placeholder="Describe the context, tasks, and areas of the system worked on..."
              value={whatWorkedOn}
              onChange={(e) => setWhatWorkedOn(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="update-technical-work">
              Technical Work (What did you achieve?) <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              id="update-technical-work"
              className="form-control"
              rows={3}
              placeholder="Detail the technical milestones, code written, experiments, or architecture changes achieved..."
              value={technicalWork}
              onChange={(e) => setTechnicalWork(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="update-challenges">
              Challenges <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Optional)</span>
            </label>
            <textarea
              id="update-challenges"
              className="form-control"
              rows={2}
              placeholder="Any roadblocks, bugs, or technical difficulties encountered..."
              value={challenges}
              onChange={(e) => setChallenges(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="update-next-step">
              Next Step <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Optional)</span>
            </label>
            <input
              id="update-next-step"
              type="text"
              className="form-control"
              placeholder="e.g. Fine-tune hyperparameters and prepare benchmark results"
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="update-evidence-link">
              Evidence / Link <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Optional)</span>
            </label>
            <input
              id="update-evidence-link"
              type="url"
              className="form-control"
              placeholder="https://github.com/... or PR link"
              value={evidenceLink}
              onChange={(e) => setEvidenceLink(e.target.value)}
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
              <span>{loading ? 'Saving...' : (isEditing ? 'Save Changes' : 'Add Update')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
