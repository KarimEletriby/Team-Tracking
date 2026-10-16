import { AlertTriangle, ExternalLink, Paperclip } from 'lucide-react';
import type { ReactNode } from 'react';
import type { MemberEvidenceFile } from '../../member';
import styles from './MemberUi.module.css';

export interface UpdateCardProps {
  title: string;
  dateLabel: string;
  weekNumber?: number;
  summary: string;
  technicalContribution?: string;
  challenges?: string;
  nextStep?: string;
  evidenceUrl?: string;
  evidenceFile?: MemberEvidenceFile;
  evidenceLabel?: string;
  metaLabel?: string;
  action?: ReactNode;
}

/** Displays a member update with optional technical details and supporting evidence. */
export function UpdateCard({
  title,
  dateLabel,
  weekNumber,
  summary,
  technicalContribution,
  challenges,
  nextStep,
  evidenceUrl,
  evidenceFile,
  evidenceLabel = 'Open evidence',
  metaLabel,
  action,
}: UpdateCardProps) {
  const displayMeta = metaLabel ?? (weekNumber ? `Week ${weekNumber}` : 'Weekly update');

  return (
    <article className={`${styles.card} ${styles.updateCard}`}>
      <div className={styles.updateMeta}>
        <span
          style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
            color: '#a855f7',
            padding: '2px 8px',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '0.75rem',
            border: '1px solid rgba(168, 85, 247, 0.3)',
          }}
        >
          {displayMeta}
        </span>
        <span className={styles.updateMetaSeparator} aria-hidden="true">•</span>
        <time>{dateLabel}</time>
        {action}
      </div>
      <h3 className={styles.updateTitle}>{title}</h3>
      <p className={styles.updateSummary} style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{summary}</p>

      {technicalContribution && (
        <div style={{ marginTop: '12px' }}>
          <span className={styles.updateSectionLabel}>Technical contribution & implementation</span>
          <p className={styles.updateSectionText} style={{ whiteSpace: 'pre-wrap' }}>{technicalContribution}</p>
        </div>
      )}

      {challenges && (
        <div
          style={{
            marginTop: '12px',
            padding: '12px 14px',
            background: 'rgba(239, 68, 68, 0.08)',
            borderLeft: '4px solid #ef4444',
            borderRadius: '0 8px 8px 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
            <AlertTriangle size={15} />
            <span>Challenges & Blockers (تحديات ومشاكل واجهتك)</span>
          </div>
          <p style={{ margin: 0, color: '#fca5a5', fontSize: '0.875rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {challenges}
          </p>
        </div>
      )}

      {nextStep && (
        <div style={{ marginTop: '12px' }}>
          <span className={styles.updateSectionLabel}>Next steps</span>
          <p className={styles.updateSectionText}>{nextStep}</p>
        </div>
      )}

      {evidenceUrl && (
        <a className={styles.evidenceLink} href={evidenceUrl} target="_blank" rel="noreferrer">
          {evidenceLabel}
          <ExternalLink size={15} aria-hidden="true" />
        </a>
      )}
      {evidenceFile && (
        <a className={styles.evidenceLink} href={evidenceFile.dataUrl} download={evidenceFile.fileName}>
          <Paperclip size={15} aria-hidden="true" />
          Download {evidenceFile.fileName}
        </a>
      )}
    </article>
  );
}
