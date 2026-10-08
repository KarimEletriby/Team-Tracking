import type { ReactNode } from 'react';
import styles from './MentorUi.module.css';

interface ActivityItemProps {
  title: string;
  description?: string;
  timestamp?: string;
  icon?: ReactNode;
}

/** A single activity entry intended for timeline or recent activity lists. */
export function ActivityItem({ title, description, timestamp, icon }: ActivityItemProps) {
  return (
    <article className={styles.activityItem}>
      {icon && <span className={styles.activityIcon} aria-hidden="true">{icon}</span>}
      <div className={styles.activityContent}>
        <h3 className={styles.activityTitle}>{title}</h3>
        {description && <p className={styles.activityDescription}>{description}</p>}
        {timestamp && <time className={styles.activityMeta}>{timestamp}</time>}
      </div>
    </article>
  );
}
