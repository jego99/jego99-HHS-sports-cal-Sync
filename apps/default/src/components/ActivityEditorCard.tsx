import { useState } from 'react';
import { updateNode } from '@/lib/genesis-data';
import { ArrowUpRight, Check, Pencil, X } from '@/lib/icons';
import { Link } from 'react-router-dom';

type Activity = { id: string; name: string; description: string; advisor: string; meeting: string; icon: string | null; section: string; category: string; keywords: string };

export function ActivityEditorCard({ activity, Icon, editable, onSaved, onCardClick }: { activity: Activity; Icon: typeof import('lucide-react').Star; editable: boolean; onSaved: () => void; onCardClick?: () => void }) {
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(activity.description);
  const [advisor, setAdvisor] = useState(activity.advisor);
  const [meeting, setMeeting] = useState(activity.meeting);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function handleCardClick(event: React.MouseEvent<HTMLElement>) {
    if (onCardClick == null) return;
    if (event.target instanceof HTMLElement && event.target.closest('a,button,input,textarea,select') != null) return;
    onCardClick();
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const result = await updateNode('V9NRsAo6RidHoU2X', activity.id, { Description: description.trim(), Advisor: advisor.trim(), 'Meeting Period': meeting.trim() });
      if (result.ignoredKeys.length > 0) throw new Error(`Some fields were not saved: ${result.ignoredKeys.join(', ')}`);
      setEditing(false);
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The activity could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return <article onClick={handleCardClick} className="site-card site-card-purple group flex min-h-[250px] cursor-pointer flex-col p-5 hover:-translate-y-0.5 hover:shadow-lg"><div className="mb-7 flex items-start justify-between gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Icon className="h-6 w-6" aria-hidden={true} /></div><div className="flex items-center gap-2"><span className="rounded-full bg-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Extracurricular</span>{editable && <button type="button" onClick={() => setEditing((value) => !value)} aria-label={`Edit ${activity.name}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{editing ? <X className="h-4 w-4" aria-hidden="true" /> : <Pencil className="h-4 w-4" aria-hidden="true" />}</button>}</div></div><h3 className="text-xl font-bold tracking-tight text-card-foreground">{activity.name}</h3>{editing ? <div className="mt-4 space-y-3"><label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label><label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Advisor<input value={advisor} onChange={(event) => setAdvisor(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label><label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Meeting period<input value={meeting} onChange={(event) => setMeeting(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label><button type="button" disabled={saving} onClick={() => void save()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60"><Check className="h-4 w-4" aria-hidden="true" /> {saving ? 'Saving...' : 'Save changes'}</button>{error && <p className="text-xs text-destructive" role="alert">{error}</p>}</div> : <><p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{activity.description}</p><div className="mt-auto border-t border-border/60 pt-4"><div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span><strong className="font-semibold text-card-foreground">Advisor</strong> {activity.advisor}</span><span><strong className="font-semibold text-card-foreground">Meets</strong> {activity.meeting}</span></div><Link to={`/activities/${activity.id}`} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary transition hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View Activity <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link></div></>}</article>;
}
