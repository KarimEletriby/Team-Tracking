import styles from './MentorUi.module.css';

export type MentorStatus = 'success' | 'warning' | 'info' | 'neutral' | 'danger';

interface StatusBadgeProps {
  label: string;
  status?: MentorStatus;
  showDot?: boolean;
}

/** A text label for progress, review, and attention states. */
export function StatusBadge({ label, status = 'neutral', showDot = true }: StatusBadgeProps) {
  return (
    <span className={`${styles.statusBadge} ${styles[status]}`}>
      {showDot && <span className={styles.statusDot} aria-hidden="true" />}
      {label}
    </span>
  );
}
