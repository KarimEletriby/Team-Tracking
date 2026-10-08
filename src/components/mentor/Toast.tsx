import { CheckCircle2, X } from 'lucide-react';
import { useEffect } from 'react';
import styles from './MentorUi.module.css';

interface ToastProps {
  message: string;
  onDismiss: () => void;
  duration?: number;
}

/** Brief confirmation for completed mentor actions. */
export function Toast({ message, onDismiss, duration = 3800 }: ToastProps) {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(timeout);
  }, [duration, onDismiss]);

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <CheckCircle2 size={18} aria-hidden="true" />
      <span>{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification"><X size={16} /></button>
    </div>
  );
}
