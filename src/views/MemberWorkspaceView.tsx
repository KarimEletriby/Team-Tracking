import { FormEvent, RefObject, useEffect, useRef, useState } from 'react';
import { AlertCircle, Edit3, FilePlus2, Paperclip, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { EmptyState, LoadingState, PageHeader, Toast } from '../components/mentor';
import { ProfileCompletionPrompt, ProfileSummaryCard, UpdateCard, UpdatesEmptyState } from '../components/member';
import {
  MemberHomeData,
  MemberEvidenceFile,
  MemberProfileInput,
  MemberRepository,
  MemberWorkUpdate,
  MemberWorkUpdateInput,
} from '../member';
import styles from './MemberWorkspaceView.module.css';

type MemberSection = 'profile' | 'updates';

interface MemberWorkspaceViewProps {
  memberId: string;
  memberName: string;
  externalView?: string;
  onSectionChange?: (section: MemberSection) => void;
  repository: MemberRepository;
}

const formatDate = (value: string) => new Intl.DateTimeFormat('en', {
  month: 'short', day: 'numeric', year: 'numeric',
}).format(new Date(value));

const maximumAttachmentSize = 25 * 1024 * 1024;

function formatFileSize(sizeBytes: number) {
  return `${(sizeBytes / (1024 * 1024)).toFixed(sizeBytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File could not be read'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useDrawerAccessibility(onClose: () => void, returnFocusTarget: RefObject<HTMLElement | null>) {
  const drawerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      drawerRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('keydown', handleKeyDown);
      returnFocusTarget.current?.focus();
    };
  }, [onClose, returnFocusTarget]);

  return drawerRef;
}

function ProfileEditor({
  home,
  repository,
  memberId,
  onClose,
  onSaved,
  returnFocusTarget,
}: {
  home: MemberHomeData;
  repository: MemberRepository;
  memberId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  returnFocusTarget: RefObject<HTMLElement | null>;
}) {
  const [projectRole, setProjectRole] = useState(home.member.projectRole);
  const [bio, setBio] = useState(home.member.bio);
  const [skillsText, setSkillsText] = useState(home.member.technicalSkills.join(', '));
  const [responsibilitiesText, setResponsibilitiesText] = useState(home.member.responsibilities.join('\n'));
  const [linkedIn, setLinkedIn] = useState(home.member.professionalLinks.linkedIn ?? '');
  const [github, setGithub] = useState(home.member.professionalLinks.github ?? '');
  const [portfolio, setPortfolio] = useState(home.member.professionalLinks.portfolio ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const drawerRef = useDrawerAccessibility(onClose, returnFocusTarget);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true); setError(null);
    try {
      const input: MemberProfileInput = {
        projectRole: projectRole.trim(),
        bio: bio.trim(),
        technicalSkills: skillsText.split(',').map((value) => value.trim()).filter(Boolean),
        responsibilities: responsibilitiesText.split('\n').map((value) => value.trim()).filter(Boolean),
        professionalLinks: { linkedIn, github, portfolio },
      };
      const saved = await repository.updateProfile(memberId, input);
      if (!saved) throw new Error('Profile unavailable');
      await onSaved();
      onClose();
    } catch { setError('Your profile could not be saved. Please try again.'); }
    finally { setSaving(false); }
  };

  return <div className={styles.drawerOverlay} role="presentation" onMouseDown={onClose}>
    <section ref={drawerRef} className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="edit-profile-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className={styles.drawerHeader}><div><p className={styles.eyebrow}>My profile</p><h2 id="edit-profile-title">Edit profile</h2></div><button type="button" className="btn btn-secondary btn-icon" onClick={onClose} aria-label="Close profile editor"><X size={18} /></button></div>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        {error && <p className={styles.formError}><AlertCircle size={16} />{error}</p>}
        <label className={styles.fieldLabel}>Project role<input className="form-control" value={projectRole} onChange={(event) => setProjectRole(event.target.value)} placeholder="e.g. Frontend developer" autoFocus /></label>
        <label className={styles.fieldLabel}>About you<textarea className="form-control" rows={4} value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Describe how you contribute to the project." /></label>
        <label className={styles.fieldLabel}>Technical skills <span>Separate skills with commas.</span><input className="form-control" value={skillsText} onChange={(event) => setSkillsText(event.target.value)} placeholder="React, TypeScript, CSS" /></label>
        <label className={styles.fieldLabel}>Responsibilities <span>Use one line for each responsibility.</span><textarea className="form-control" rows={4} value={responsibilitiesText} onChange={(event) => setResponsibilitiesText(event.target.value)} placeholder={'Dashboard screens\nDesign system consistency'} /></label>
        <fieldset className={styles.linksFieldset}><legend>Professional links <span>All optional — shared with your mentor.</span></legend><label className={styles.fieldLabel}>LinkedIn profile<input type="url" className="form-control" value={linkedIn} onChange={(event) => setLinkedIn(event.target.value)} placeholder="https://linkedin.com/in/your-name" /></label><label className={styles.fieldLabel}>GitHub profile<input type="url" className="form-control" value={github} onChange={(event) => setGithub(event.target.value)} placeholder="https://github.com/your-name" /></label><label className={styles.fieldLabel}>Portfolio website<input type="url" className="form-control" value={portfolio} onChange={(event) => setPortfolio(event.target.value)} placeholder="https://your-portfolio.com" /></label></fieldset>
        <div className={styles.drawerActions}><button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}><Pencil size={16} />Save profile</button></div>
      </form>
    </section>
  </div>;
}

function UpdateEditor({
  update,
  repository,
  memberId,
  onClose,
  onSaved,
  returnFocusTarget,
}: {
  update?: MemberWorkUpdate;
  repository: MemberRepository;
  memberId: string;
  onClose: () => void;
  onSaved: (kind: 'created' | 'updated') => Promise<void>;
  returnFocusTarget: RefObject<HTMLElement | null>;
}) {
  const [title, setTitle] = useState(update?.title ?? '');
  const [whatWorkedOn, setWhatWorkedOn] = useState(update?.whatWorkedOn ?? '');
  const [technicalContribution, setTechnicalContribution] = useState(update?.technicalContribution ?? '');
  const [challenges, setChallenges] = useState(update?.challenges ?? '');
  const [nextStep, setNextStep] = useState(update?.nextStep ?? '');
  const [evidenceUrl, setEvidenceUrl] = useState(update?.evidenceUrl ?? '');
  const [evidenceFile, setEvidenceFile] = useState<MemberEvidenceFile | undefined>(update?.evidenceFile);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = Boolean(update);

  const drawerRef = useDrawerAccessibility(onClose, returnFocusTarget);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (isReadingFile) {
      setError('Please wait for the selected file to finish preparing.');
      return;
    }
    if (!title.trim() || !whatWorkedOn.trim() || !technicalContribution.trim()) {
      setError('Add a title, the work completed, and your technical contribution.');
      return;
    }
    setSaving(true); setError(null);
    const input: MemberWorkUpdateInput = { title, whatWorkedOn, technicalContribution, challenges, nextStep, evidenceUrl, evidenceFile };
    try {
      const saved = update
        ? await repository.updateUpdate(memberId, update.id, input)
        : await repository.createUpdate(memberId, input);
      if (!saved) throw new Error('Update unavailable');
      await onSaved(isEditing ? 'updated' : 'created');
      onClose();
    } catch { setError('Your update could not be saved. Please try again.'); }
    finally { setSaving(false); }
  };

  const selectEvidenceFile = async (file?: File) => {
    if (!file) return;
    if (file.size > maximumAttachmentSize) {
      setError('Choose a file smaller than 25 MB.');
      return;
    }
    try {
      setError(null);
      setIsReadingFile(true);
      const dataUrl = await readFileAsDataUrl(file);
      setEvidenceFile({ fileName: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size, dataUrl });
    } catch { setError('The file could not be added. Please try again.'); }
    finally { setIsReadingFile(false); }
  };

  return <div className={styles.drawerOverlay} role="presentation" onMouseDown={onClose}>
    <section ref={drawerRef} className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="update-editor-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className={styles.drawerHeader}><div><p className={styles.eyebrow}>My updates</p><h2 id="update-editor-title">{isEditing ? 'Edit update' : 'Add update'}</h2></div><button type="button" className="btn btn-secondary btn-icon" onClick={onClose} aria-label="Close update editor"><X size={18} /></button></div>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        {error && <p className={styles.formError}><AlertCircle size={16} />{error}</p>}
        <label className={styles.fieldLabel}>Title <strong>*</strong><input className="form-control" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What did you complete?" autoFocus /></label>
        <label className={styles.fieldLabel}>What did you work on? <strong>*</strong><textarea className="form-control" rows={3} value={whatWorkedOn} onChange={(event) => setWhatWorkedOn(event.target.value)} placeholder="Summarize the task or area you worked on." /></label>
        <label className={styles.fieldLabel}>Technical contribution <strong>*</strong><textarea className="form-control" rows={4} value={technicalContribution} onChange={(event) => setTechnicalContribution(event.target.value)} placeholder="Explain the implementation, technical decision, or output." /></label>
        <label className={styles.fieldLabel}>Challenges <span>Optional</span><textarea className="form-control" rows={2} value={challenges} onChange={(event) => setChallenges(event.target.value)} /></label>
        <label className={styles.fieldLabel}>Next step <span>Optional</span><input className="form-control" value={nextStep} onChange={(event) => setNextStep(event.target.value)} /></label>
        <label className={styles.fieldLabel}>Evidence link <span>Optional — GitHub, PR, demo, or document.</span><input type="url" className="form-control" value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} placeholder="https://" /></label>
        <div className={styles.uploadField}>
          <span className={styles.uploadLabel}>Upload a file <small>Optional — images, videos, PDFs, or any supporting file (up to 25 MB).</small></span>
          <label className={styles.uploadButton}><Upload size={16} />{isReadingFile ? 'Preparing file…' : 'Choose file'}<input type="file" disabled={isReadingFile || saving} onChange={(event) => void selectEvidenceFile(event.target.files?.[0])} /></label>
          {evidenceFile && <div className={styles.selectedFile}><Paperclip size={16} /><span><strong>{evidenceFile.fileName}</strong><small>{formatFileSize(evidenceFile.sizeBytes)}</small></span><button type="button" onClick={() => setEvidenceFile(undefined)} aria-label={`Remove ${evidenceFile.fileName}`}>Remove</button></div>}
          <p className={styles.uploadHint}>You can add a link, a file, or both.</p>
        </div>
        <div className={styles.drawerActions}><button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving || isReadingFile}><FilePlus2 size={16} />{isReadingFile ? 'Preparing file…' : isEditing ? 'Save changes' : 'Publish update'}</button></div>
      </form>
    </section>
  </div>;
}

export function MemberWorkspaceView({ memberId, memberName, externalView, onSectionChange, repository }: MemberWorkspaceViewProps) {
  const [section, setSection] = useState<MemberSection>('profile');
  const [home, setHome] = useState<MemberHomeData | null>(null);
  const [updates, setUpdates] = useState<MemberWorkUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const [updateToEdit, setUpdateToEdit] = useState<MemberWorkUpdate | null | undefined>(undefined);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const drawerTriggerRef = useRef<HTMLElement | null>(null);

  const loadMemberData = async () => {
    setLoading(true); setError(null);
    try {
      const [homeData, updateData] = await Promise.all([repository.getHome(memberId), repository.getUpdates(memberId)]);
      if (!homeData) throw new Error('Member data unavailable');
      setHome(homeData); setUpdates(updateData);
    } catch { setError('Your workspace could not be loaded. Please try again.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadMemberData(); }, [memberId, repository]);
  useEffect(() => {
    if (externalView === 'profile' || externalView === 'updates') setSection(externalView);
  }, [externalView]);

  const goTo = (nextSection: MemberSection) => { setSection(nextSection); onSectionChange?.(nextSection); };
  const refreshAfterChange = async () => { await loadMemberData(); };
  const profileIsComplete = home ? Boolean(home.member.projectRole && home.member.bio && home.member.technicalSkills.length && home.member.responsibilities.length) : true;

  const removeUpdate = async (update: MemberWorkUpdate) => {
    if (!window.confirm(`Delete “${update.title}”? This cannot be undone.`)) return;
    setActionError(null);
    try {
      const deleted = await repository.deleteUpdate(memberId, update.id);
      if (!deleted) throw new Error('Update unavailable');
      await refreshAfterChange();
      setToastMessage('Update deleted successfully.');
    } catch { setActionError('The update could not be deleted. Please try again.'); }
  };

  if (loading) return <div className="page-body"><LoadingState label="Loading your workspace…" /></div>;
  if (error || !home) return <div className="page-body"><EmptyState title="Workspace unavailable" description={error ?? 'Please try again.'} icon={<AlertCircle size={24} />} action={<button type="button" className="btn btn-primary" onClick={() => void loadMemberData()}>Try again</button>} /></div>;

  const updateActions = (update: MemberWorkUpdate) => <div className={styles.updateActions}><button type="button" className="btn btn-secondary btn-sm" onClick={(event) => { drawerTriggerRef.current = event.currentTarget; setUpdateToEdit(update); }}><Edit3 size={14} />Edit</button><button type="button" className={styles.deleteButton} onClick={() => void removeUpdate(update)} aria-label={`Delete ${update.title}`}><Trash2 size={15} /></button></div>;

  const renderProfile = () => <>
    <PageHeader eyebrow="Member workspace" title="My profile" description="Keep your role and technical context clear for your mentor and team." actions={<><button type="button" className="btn btn-secondary" onClick={(event) => { drawerTriggerRef.current = event.currentTarget; setIsProfileEditorOpen(true); }}><Pencil size={16} />Edit profile</button><button type="button" className="btn btn-primary" onClick={(event) => { drawerTriggerRef.current = event.currentTarget; setUpdateToEdit(null); }}><Plus size={16} />Add update</button></>} />
    {!profileIsComplete && <ProfileCompletionPrompt action={<button type="button" className="btn btn-primary btn-sm" onClick={(event) => { drawerTriggerRef.current = event.currentTarget; setIsProfileEditorOpen(true); }}>Complete profile</button>} />}
    <ProfileSummaryCard name={memberName} role={home.member.projectRole || 'Role not added yet'} teamName={home.project.teamName} projectName={home.project.projectName} bio={home.member.bio} skills={home.member.technicalSkills} responsibilities={home.member.responsibilities} professionalLinks={home.member.professionalLinks} headerAction={<span className={styles.projectBadge}>My team</span>} />
    <section className={styles.latestSection}><div className={styles.sectionHeading}><div><h2>Latest update</h2><p>{home.updateCount ? 'Your most recent work shared with the team.' : 'Start documenting your progress.'}</p></div><button type="button" className={styles.textButton} onClick={() => goTo('updates')}>View all updates</button></div>{home.latestUpdate ? <UpdateCard title={home.latestUpdate.title} dateLabel={formatDate(home.latestUpdate.createdAt)} summary={home.latestUpdate.whatWorkedOn} technicalContribution={home.latestUpdate.technicalContribution} nextStep={home.latestUpdate.nextStep} evidenceUrl={home.latestUpdate.evidenceUrl} evidenceFile={home.latestUpdate.evidenceFile} /> : <UpdatesEmptyState action={<button type="button" className="btn btn-primary" onClick={(event) => { drawerTriggerRef.current = event.currentTarget; setUpdateToEdit(null); }}>Add your first update</button>} />}</section>
  </>;

  const renderUpdates = () => <>
    <PageHeader eyebrow="Member workspace" title="My updates" description={`${updates.length} update${updates.length === 1 ? '' : 's'} documenting your work and technical progress.`} actions={<button type="button" className="btn btn-primary" onClick={(event) => { drawerTriggerRef.current = event.currentTarget; setUpdateToEdit(null); }}><Plus size={16} />Add update</button>} />
    {updates.length ? <div className={styles.updatesList}>{updates.map((update) => <UpdateCard key={update.id} title={update.title} dateLabel={formatDate(update.createdAt)} summary={update.whatWorkedOn} technicalContribution={update.technicalContribution} challenges={update.challenges} nextStep={update.nextStep} evidenceUrl={update.evidenceUrl} evidenceFile={update.evidenceFile} action={updateActions(update)} />)}</div> : <UpdatesEmptyState action={<button type="button" className="btn btn-primary" onClick={(event) => { drawerTriggerRef.current = event.currentTarget; setUpdateToEdit(null); }}><Plus size={16} />Add your first update</button>} />}
  </>;

  return <div className={`page-body ${styles.workspaceRoot}`}>
    {actionError && <p className={styles.actionError} role="alert"><AlertCircle size={17} />{actionError}</p>}
    {section === 'profile' ? renderProfile() : renderUpdates()}
    {isProfileEditorOpen && <ProfileEditor home={home} repository={repository} memberId={memberId} returnFocusTarget={drawerTriggerRef} onClose={() => setIsProfileEditorOpen(false)} onSaved={async () => { await refreshAfterChange(); setToastMessage('Profile updated successfully.'); }} />}
    {updateToEdit !== undefined && <UpdateEditor update={updateToEdit ?? undefined} repository={repository} memberId={memberId} returnFocusTarget={drawerTriggerRef} onClose={() => setUpdateToEdit(undefined)} onSaved={async (kind) => { await refreshAfterChange(); setToastMessage(kind === 'created' ? 'Update published successfully.' : 'Update updated successfully.'); }} />}
    {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />}
  </div>;
}
