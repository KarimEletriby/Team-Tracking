import type { ReactNode } from 'react';
import styles from './MentorUi.module.css';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
}

/** A compact high-level metric card. */
export function StatCard({ label, value, hint, icon }: StatCardProps) {
  return (
    <section className={styles.statCard} aria-label={label}>
      <div className={styles.statHeader}>
        <span>{label}</span>
        {icon && <span className={styles.statIcon} aria-hidden="true">{icon}</span>}
      </div>
      <p className={styles.statValue}>{value}</p>
      {hint && <p className={styles.statHint}>{hint}</p>}
    </section>
  );
}
