import { ExternalLink, Paperclip } from 'lucide-react';
import type { ReactNode } from 'react';
import type { MemberEvidenceFile } from '../../member';
import styles from './MemberUi.module.css';

export interface UpdateCardProps {
  title: string;
  dateLabel: string;
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
  summary,
  technicalContribution,
  challenges,
  nextStep,
  evidenceUrl,
  evidenceFile,
  evidenceLabel = 'Open evidence',
  metaLabel = 'Update',
  action,
}: UpdateCardProps) {
  const detailSections = [
    technicalContribution && { label: 'Technical contribution', content: technicalContribution },
    challenges && { label: 'Challenges', content: challenges },
    nextStep && { label: 'Next step', content: nextStep },
  ].filter((section): section is { label: string; content: string } => Boolean(section));

  return (
    <article className={`${styles.card} ${styles.updateCard}`}>
      <div className={styles.updateMeta}>
        <span>{metaLabel}</span>
        <span className={styles.updateMetaSeparator} aria-hidden="true">•</span>
        <time>{dateLabel}</time>
        {action}
      </div>
      <h3 className={styles.updateTitle}>{title}</h3>
      <p className={styles.updateSummary}>{summary}</p>

      {detailSections.length > 0 && (
        <div className={styles.updateSections}>
          {detailSections.map((section) => (
            <div key={section.label}>
              <span className={styles.updateSectionLabel}>{section.label}</span>
              <p className={styles.updateSectionText}>{section.content}</p>
            </div>
          ))}
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
