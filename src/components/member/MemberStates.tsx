import { ClipboardPenLine, FileText } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './MemberUi.module.css';

interface MemberProfilePromptProps {
  title?: string;
  description?: string;
  action?: ReactNode;
}

/** Guides a member toward completing the profile details mentors need to understand their work. */
export function ProfileCompletionPrompt({
  title = 'Complete your profile',
  description = 'Add your role, skills, and responsibilities so your mentor has the right context.',
  action,
}: MemberProfilePromptProps) {
  return (
    <aside className={styles.completionPrompt}>
      <span className={styles.completionIcon} aria-hidden="true"><ClipboardPenLine size={18} /></span>
      <div className={styles.completionContent}>
        <p className={styles.completionTitle}>{title}</p>
        <p className={styles.completionDescription}>{description}</p>
        {action && <div className={styles.completionAction}>{action}</div>}
      </div>
    </aside>
  );
}

interface UpdatesEmptyStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
}

/** A helpful starting point when the member has not posted any progress yet. */
export function UpdatesEmptyState({
  title = 'No updates yet',
  description = 'Share what you worked on to keep your mentor and team aligned.',
  action,
}: UpdatesEmptyStateProps) {
  return (
    <section className={styles.emptyState}>
      <span className={styles.emptyIcon} aria-hidden="true"><FileText size={22} /></span>
      <h2 className={styles.emptyTitle}>{title}</h2>
      <p className={styles.emptyDescription}>{description}</p>
      {action && <div className={styles.emptyAction}>{action}</div>}
    </section>
  );
}
