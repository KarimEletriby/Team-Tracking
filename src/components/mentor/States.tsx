import { useId, type ReactNode } from 'react';
import styles from './MentorUi.module.css';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** A helpful placeholder for views with no content yet. */
export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  const titleId = useId();

  return (
    <section className={`${styles.state} ${className ?? ''}`} aria-labelledby={titleId}>
      {icon && <span className={styles.stateIcon} aria-hidden="true">{icon}</span>}
      <h2 id={titleId} className={styles.stateTitle}>{title}</h2>
      <p className={styles.stateDescription}>{description}</p>
      {action && <div className={styles.stateAction}>{action}</div>}
    </section>
  );
}

interface LoadingStateProps {
  label?: string;
  className?: string;
}

/** An accessible, compact loading indicator. */
export function LoadingState({ label = 'Loading…', className }: LoadingStateProps) {
  return (
    <div className={`${styles.loadingRow} ${className ?? ''}`} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
