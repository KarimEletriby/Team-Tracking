import { BriefcaseBusiness, Code2, Globe2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { MemberProfessionalLinks } from '../../member';
import styles from './MemberUi.module.css';

export interface ProfileSummaryCardProps {
  name: string;
  role: string;
  teamName?: string;
  projectName?: string;
  bio?: string;
  skills?: string[];
  responsibilities?: string[];
  professionalLinks?: MemberProfessionalLinks;
  avatarLabel?: string;
  headerAction?: ReactNode;
}

/** A concise, read-only overview of a member's project profile. */
export function ProfileSummaryCard({
  name,
  role,
  teamName,
  projectName,
  bio,
  skills = [],
  responsibilities = [],
  professionalLinks,
  avatarLabel,
  headerAction,
}: ProfileSummaryCardProps) {
  const context = [teamName, projectName].filter(Boolean).join(' · ');
  const initials = avatarLabel?.trim() || name.trim().slice(0, 1).toUpperCase();

  return (
    <section className={`${styles.card} ${styles.profileCard}`} aria-label="Profile summary">
      <div className={styles.profileHeader}>
        <div className={styles.profileIdentity}>
          <span className={styles.avatar} aria-hidden="true">{initials}</span>
          <div>
            <h2 className={styles.profileName}>{name}</h2>
            <p className={styles.profileRole}>{role}</p>
            {context && <p className={styles.profileContext}>{context}</p>}
          </div>
        </div>
        {headerAction}
      </div>

      {bio && <p className={styles.bio}>{bio}</p>}

      {(skills.length > 0 || responsibilities.length > 0) && (
        <div className={styles.profileDetails}>
          {skills.length > 0 && (
            <div>
              <span className={styles.detailLabel}>Technical skills</span>
              <ul className={styles.chipList}>
                {skills.map((skill) => <li key={skill} className={styles.chip}>{skill}</li>)}
              </ul>
            </div>
          )}
          {responsibilities.length > 0 && (
            <div>
              <span className={styles.detailLabel}>Responsibilities</span>
              <ul className={styles.responsibilities}>
                {responsibilities.map((responsibility) => <li key={responsibility}>{responsibility}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {professionalLinks && Object.values(professionalLinks).some(Boolean) && (
        <div className={styles.profileLinks}>
          <span className={styles.detailLabel}>Professional links</span>
          <div className={styles.linkList}>
            {professionalLinks.linkedIn && <a href={professionalLinks.linkedIn} target="_blank" rel="noreferrer"><BriefcaseBusiness size={16} />LinkedIn</a>}
            {professionalLinks.github && <a href={professionalLinks.github} target="_blank" rel="noreferrer"><Code2 size={16} />GitHub</a>}
            {professionalLinks.portfolio && <a href={professionalLinks.portfolio} target="_blank" rel="noreferrer"><Globe2 size={16} />Portfolio</a>}
          </div>
        </div>
      )}
    </section>
  );
}
