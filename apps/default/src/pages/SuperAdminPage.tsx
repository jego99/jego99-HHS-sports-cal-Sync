import { useMemo, useState, type FormEvent } from 'react';
import { addDays, format, isValid, parseISO, startOfWeek } from 'date-fns';
import { unparse } from 'papaparse';
import { Link } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';

import { PageTopBar } from '@/components/PageTopBar';
import { SiteBanner } from '@/components/SiteBanner';
import { useLiveNodes } from '@/hooks/use-live-nodes';
import { createNode, deleteNode, getFieldValue, getTitle, updateNode, type GenesisNode } from '@/lib/genesis-data';
import { isActiveSuperAdmin, readSuperAdmin, SUPER_ADMINS_PROJECT_ID } from '@/lib/super-admin';
import { syncArbiterCalendar } from '@/lib/arbiter-calendar';
import { runFlow } from '@/lib/genesis-flows';
import { formatTime12Hour } from '@/lib/time-format';
import { ACCESS_PROJECT_ID, DIRECTORY_PROJECT_ID } from '@/lib/access-control';
import { ArrowLeft, Check, KeyRound, Pencil, Plus, Save, ShieldCheck, Trash2, X } from '@/lib/icons';

const CALENDAR_PROJECT_ID = 'iG1Cr94QBuatx9yK';
const ALL_SPORTS_ACTIVITY_ID = '0b3d1fa5-c43e-45a5-aac4-91d8cd261a40';
const UPDATES_PROJECT_ID = 'Yx8iqKvUPFu6Zg5b';
const WEEKLY_CSV_EMAIL_FLOW_ID = '01M4BKHHE22HE4J8CCFCWZHVQ9';

type ControlSection = 'admins' | 'activities' | 'access' | 'calendar' | 'updates';
type FieldDefinition = { key: string; label: string; multiline?: boolean; type?: string };

type EditableProject = {
  id: string;
  name: string;
  fields: FieldDefinition[];
};

const projectSections: Record<Exclude<ControlSection, 'admins'>, EditableProject> = {
  activities: {
    id: DIRECTORY_PROJECT_ID,
    name: 'Activities directory',
    fields: [
      { key: 'Name', label: 'Name' },
      { key: 'Category', label: 'Category' },
      { key: 'Description', label: 'Description', multiline: true },
      { key: 'Advisor', label: 'Advisor' },
      { key: 'Meeting Period', label: 'Meeting period' },
    ],
  },
  access: {
    id: ACCESS_PROJECT_ID,
    name: 'Editor access',
    fields: [
      { key: 'Email', label: 'Email' },
      { key: 'Display Name', label: 'Display name' },
      { key: 'Role', label: 'Role' },
      { key: 'Allowed Categories', label: 'Allowed activities', multiline: true },
      { key: 'Access', label: 'Access' },
      { key: 'Owner Email', label: 'Owner email' },
    ],
  },
  calendar: {
    id: CALENDAR_PROJECT_ID,
    name: 'Calendar events',
    fields: [
      { key: 'Event Title', label: 'Event title' },
      { key: 'Activity Name', label: 'Activity' },
      { key: 'Date', label: 'Date' },
      { key: 'Start Time', label: 'Start time' },
      { key: 'End Time', label: 'End time' },
      { key: 'Location', label: 'Location' },
      { key: 'Notes', label: 'Notes', multiline: true },
      { key: 'Activity ID', label: 'Activity ID' },
    ],
  },
  updates: {
    id: UPDATES_PROJECT_ID,
    name: 'Weekly updates',
    fields: [
      { key: 'Update Title', label: 'Update title' },
      { key: 'Update Body', label: 'Update body', multiline: true },
      { key: 'Week', label: 'Week' },
    ],
  },
};

function valueFor(row: GenesisNode, key: string) {
  return getFieldValue(row, key) ?? '';
}

function isAllSportsRow(project: EditableProject, row: GenesisNode, name = valueFor(row, 'Name')) {
  return project.id === DIRECTORY_PROJECT_ID && (row.id === ALL_SPORTS_ACTIVITY_ID || name.trim().toLowerCase() === 'all-sports');
}

function fieldsForRow(project: EditableProject, row: GenesisNode, draftName?: string): FieldDefinition[] {
  const isAllSports = isAllSportsRow(project, row, draftName ?? valueFor(row, 'Name'));
  return isAllSports ? [...project.fields, { key: 'Calendar URL', label: 'Calendar URL', type: 'url' }] : project.fields;
}

export default function SuperAdminPage() {
  const auth = useAuth();
  const admins = useLiveNodes(SUPER_ADMINS_PROJECT_ID);
  const [section, setSection] = useState<ControlSection>('admins');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const email = typeof auth.user?.profile.email === 'string' ? auth.user.profile.email : '';
  const authorized = auth.isAuthenticated && isActiveSuperAdmin(admins.nodes, email);

  if (!auth.isAuthenticated) {
    return <AccessGate title="Sign in required" message="Sign in with a super-admin account to open the master controller." onSignIn={() => void auth.signinRedirect()} />;
  }

  if (admins.updatedAt == null && admins.loading) {
    return <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8"><PageTopBar showDashboard={false} /><SiteBanner /><PageTopBar showAccountControls={false} /><div className="mx-auto mt-8 max-w-7xl animate-pulse rounded-3xl bg-muted p-8"><div className="h-8 w-64 rounded bg-background/70" /><div className="mt-5 h-4 w-full rounded bg-background/70" /><div className="mt-8 h-72 rounded-2xl bg-background/70" /></div></main>;
  }

  if (!authorized) {
    return <AccessGate title="Super-admin access only" message="This page is limited to active super admins. Ask an existing super admin to add your account." onSignIn={() => void auth.signoutRedirect()} signOut />;
  }

  async function saveAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const adminEmail = String(form.get('email') ?? '').trim().toLowerCase();
    const displayName = String(form.get('displayName') ?? '').trim();
    if (adminEmail.length === 0 || displayName.length === 0) {
      setMessage('Add an email and display name before saving.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const result = await createNode(SUPER_ADMINS_PROJECT_ID, { Email: adminEmail, 'Display Name': displayName, Status: 'active' });
      if (result.ignoredKeys.length > 0) throw new Error(`Some fields were not saved: ${result.ignoredKeys.join(', ')}`);
      formElement.reset();
      await admins.refresh();
      setMessage(`${adminEmail} is now an active super admin.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The super admin could not be added.');
    } finally {
      setSaving(false);
    }
  }

  async function setAdminStatus(row: GenesisNode, status: 'active' | 'revoked') {
    setSaving(true);
    setMessage('');
    try {
      const result = await updateNode(SUPER_ADMINS_PROJECT_ID, row.id, { Status: status });
      if (result.ignoredKeys.length > 0) throw new Error(`Status was not saved: ${result.ignoredKeys.join(', ')}`);
      await admins.refresh();
      setMessage(status === 'active' ? 'Super admin restored.' : 'Super admin access revoked.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The status could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <PageTopBar showDashboard={false} />
      <SiteBanner />
      <PageTopBar showAccountControls={false} />
      <div className="mx-auto w-full max-w-7xl">
        <section className="border-b border-border/70 py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Restricted control room</p><h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">Super-admin controller</h1><p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">Manage the people and records that power the entire Activities portal without opening the workspace.</p></div>
            <div className="site-card site-card-purple flex items-center gap-3 px-5 py-4 text-sm font-bold"><ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" /><span>{admins.nodes.length} super admins</span></div>
          </div>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <nav aria-label="Super-admin controls" className="site-card site-card-white h-fit rounded-3xl p-3">
            {(['admins', 'activities', 'access', 'calendar', 'updates'] as ControlSection[]).map((item) => {
              const active = item === section;
              const labels: Record<ControlSection, string> = { admins: 'Super admins', activities: 'Activities', access: 'Editor access', calendar: 'Calendar events', updates: 'Weekly updates' };
              return <button key={item} type="button" onClick={() => setSection(item)} className={`flex min-h-11 w-full items-center rounded-xl px-4 text-left text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{labels[item]}</button>;
            })}
            <Link to="/" className="mt-3 flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Return to app</Link>
          </nav>

          <section className="min-w-0">
            {section === 'admins' ? <AdminRegistry rows={admins.nodes} saving={saving} message={message} onAdd={saveAdmin} onSetStatus={setAdminStatus} /> : <ProjectController project={projectSections[section]} message={message} setMessage={setMessage} signedInEmail={email} />}
          </section>
        </div>
      </div>
    </main>
  );
}

function AdminRegistry({ rows, saving, message, onAdd, onSetStatus }: { rows: GenesisNode[]; saving: boolean; message: string; onAdd: (event: FormEvent<HTMLFormElement>) => void; onSetStatus: (row: GenesisNode, status: 'active' | 'revoked') => void }) {
  const records = useMemo(() => rows.map(readSuperAdmin), [rows]);
  return <div className="space-y-6"><section className="site-card site-card-purple rounded-3xl p-6 sm:p-8"><div className="flex items-start gap-4"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Plus className="h-5 w-5" aria-hidden="true" /></div><div><h2 className="text-2xl font-black">Add a super admin</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Active accounts can open this page and manage every portal dataset.</p></div></div><form onSubmit={onAdd} className="mt-6 grid gap-4 sm:grid-cols-[1fr_1fr_auto]"><label className="text-sm font-semibold">Email<input name="email" type="email" required autoComplete="email" placeholder="name@hermiston.k12.or.us" className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label><label className="text-sm font-semibold">Display name<input name="displayName" type="text" required autoComplete="name" placeholder="Staff administrator" className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label><button type="submit" disabled={saving} className="min-h-11 self-end rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:cursor-wait disabled:opacity-60"><Save className="mr-2 inline h-4 w-4" aria-hidden="true" />Add</button></form>{message && <p className="mt-4 rounded-xl bg-muted p-3 text-sm text-muted-foreground" role="status">{message}</p>}</section><section className="site-card site-card-white rounded-3xl p-6 sm:p-8"><h2 className="text-2xl font-black">Access roster</h2><div className="mt-5 space-y-3">{records.map((record) => { const active = record.status.trim().toLowerCase() === 'active'; return <div key={record.id} className="flex flex-col gap-4 rounded-2xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate font-bold">{record.displayName || record.email}</p><p className="truncate text-sm text-muted-foreground">{record.email}</p></div><div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${active ? 'bg-accent text-accent-foreground' : 'bg-destructive/10 text-destructive'}`}>{active ? 'Active' : 'Revoked'}</span><button type="button" disabled={saving} onClick={() => onSetStatus(rows.find((row) => row.id === record.id) as GenesisNode, active ? 'revoked' : 'active')} className="min-h-11 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted disabled:opacity-50">{active ? 'Revoke' : 'Restore'}</button></div></div>; })}</div></section></div>;
}

function ProjectController({ project, message, setMessage, signedInEmail }: { project: EditableProject; message: string; setMessage: (value: string) => void; signedInEmail: string }) {
  const live = useLiveNodes(project.id);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newValues, setNewValues] = useState<Record<string, string>>({});
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  function startEdit(row: GenesisNode) {
    setEditingId(row.id);
    setEditValues(Object.fromEntries(fieldsForRow(project, row).map((field) => [field.key, valueFor(row, field.key)])));
    setMessage('');
  }

  async function saveEdit(row: GenesisNode) {
    setSavingId(row.id);
    setMessage('');
    try {
      const result = await updateNode(project.id, row.id, editValues);
      if (result.ignoredKeys.length > 0) throw new Error(`Some fields were not saved: ${result.ignoredKeys.join(', ')}`);
      setEditingId(null);
      await live.refresh();
      const calendarUrl = (editValues['Calendar URL'] ?? '').trim();
      if (isAllSportsRow(project, row, editValues.Name) && calendarUrl !== '') {
        setMessage('All-Sports details saved. Syncing the Arbiter calendar…');
        try {
          const sync = await syncArbiterCalendar(calendarUrl, row.id, editValues.Name?.trim() || 'All-Sports', (progress) => {
            setMessage(`Syncing Arbiter calendar: ${progress.processed} of ${progress.total} events checked…`);
          });
          setMessage(`All-Sports calendar synced: ${sync.added} added, ${sync.updated} updated, ${sync.unchanged} unchanged${sync.skipped > 0 ? `, ${sync.skipped} skipped` : ''}.`);
        } catch (syncError) {
          setMessage(`All-Sports details saved, but calendar sync stopped: ${syncError instanceof Error ? syncError.message : 'Please try saving again.'} Save again to retry safely.`);
        }
      } else {
        setMessage(`${project.name} record updated.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The record could not be updated.');
    } finally {
      setSavingId(null);
    }
  }

  async function addRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingId('new');
    setMessage('');
    try {
      const result = await createNode(project.id, newValues);
      if (result.ignoredKeys.length > 0) throw new Error(`Some fields were not saved: ${result.ignoredKeys.join(', ')}`);
      setNewValues({});
      setShowAdd(false);
      await live.refresh();
      setMessage(`${project.name} record added.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The record could not be added.');
    } finally {
      setSavingId(null);
    }
  }

  async function removeRecord(row: GenesisNode) {
    setDeletingId(row.id);
    setMessage('');
    try {
      await deleteNode(project.id, row.id);
      await live.refresh();
      setMessage(`${project.name} record deleted.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The record could not be deleted.');
    } finally {
      setDeletingId(null);
    }
  }

  return <div className="site-card site-card-white rounded-3xl p-6 sm:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Master data editor</p><h2 className="mt-2 text-2xl font-black">{project.name}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Edit live records directly from the portal. Changes save immediately to the app data.</p></div><button type="button" onClick={() => { setShowAdd((current) => !current); setNewValues({}); }} className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"><Plus className="h-4 w-4" aria-hidden="true" /> New record</button></div>{project.id === UPDATES_PROJECT_ID && <WeeklyActivitiesCsvExporter recipientEmail={signedInEmail} />}{message && <p className="mt-5 rounded-xl bg-muted p-3 text-sm text-muted-foreground" role="status">{message}</p>}{showAdd && <form onSubmit={addRecord} className="mt-6 rounded-2xl border border-primary/30 bg-accent/30 p-4"><div className="grid gap-4 md:grid-cols-2">{project.fields.map((field) => <FieldInput key={field.key} field={field} value={newValues[field.key] ?? ''} onChange={(value) => setNewValues((current) => ({ ...current, [field.key]: value }))} />)}</div><div className="mt-4 flex gap-2"><button type="submit" disabled={savingId === 'new'} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">Save record</button><button type="button" onClick={() => setShowAdd(false)} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold">Cancel</button></div></form>}<div className="mt-6 space-y-3">{live.nodes.map((row) => { const editing = editingId === row.id; const title = getTitle(row, project.fields[0].key) ?? 'Untitled record'; return <article key={row.id} className="rounded-2xl border border-border p-4">{editing ? <div><div className="grid gap-4 md:grid-cols-2">{fieldsForRow(project, row, editValues.Name).map((field) => <FieldInput key={field.key} field={field} value={editValues[field.key] ?? ''} onChange={(value) => setEditValues((current) => ({ ...current, [field.key]: value }))} />)}</div><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={savingId === row.id} onClick={() => void saveEdit(row)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"><Check className="h-4 w-4" aria-hidden="true" /> Save changes</button><button type="button" onClick={() => setEditingId(null)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold"><X className="h-4 w-4" aria-hidden="true" /> Cancel</button></div></div> : <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0 flex-1"><h3 className="truncate font-bold">{title}</h3><div className="mt-3 grid gap-x-5 gap-y-2 sm:grid-cols-2">{fieldsForRow(project, row).map((field) => <p key={field.key} className="min-w-0 text-sm text-muted-foreground"><span className="font-semibold text-foreground">{field.label}:</span> <span className="break-words">{valueFor(row, field.key) || 'Not set'}</span></p>)}</div></div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => startEdit(row)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted"><Pencil className="h-4 w-4" aria-hidden="true" /> Edit</button><button type="button" disabled={deletingId === row.id} onClick={() => void removeRecord(row)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-destructive/40 px-3 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"><Trash2 className="h-4 w-4" aria-hidden="true" /> Delete</button></div></div>}</article>; })}</div></div>;
}

const WEEKLY_CSV_HEADERS = ['Scheduled Date', 'Start Time', 'End Time', 'Activity Name', 'Event Title', 'Location', 'Notes', 'Activity ID'];

function buildUpcomingActivitiesCsv(rows: GenesisNode[], now = new Date(), weekOffset: 0 | 1 = 1) {
  const weekStart = addDays(startOfWeek(now, { weekStartsOn: 1 }), weekOffset * 7);
  const weekEnd = addDays(weekStart, 6);
  const weekKey = format(weekStart, 'yyyy-MM-dd');
  const csvRows = rows.map((row) => {
    const dateValue = getFieldValue(row, 'Date') ?? '';
    const date = dateValue.trim() === '' ? null : parseISO(dateValue.slice(0, 10));
    if (date == null || !isValid(date) || format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd') !== weekKey) return null;
    return [
      format(date, 'yyyy-MM-dd'),
      formatTime12Hour(getFieldValue(row, 'Start Time') ?? ''),
      formatTime12Hour(getFieldValue(row, 'End Time') ?? ''),
      getFieldValue(row, 'Activity Name') ?? '',
      getTitle(row, 'Event Title', 'Title') ?? '',
      getFieldValue(row, 'Location') ?? '',
      getFieldValue(row, 'Notes') ?? '',
      getFieldValue(row, 'Activity ID') ?? '',
    ];
  }).filter((row): row is string[] => row != null);
  return {
    csv: unparse({ fields: WEEKLY_CSV_HEADERS, data: csvRows }),
    fileName: `weekly-activities-${weekKey}.csv`,
    weekLabel: `${format(weekStart, 'MMMM d')} - ${format(weekEnd, 'MMMM d, yyyy')}`,
    eventCount: csvRows.length,
  };
}

function WeeklyActivitiesCsvExporter({ recipientEmail }: { recipientEmail: string }) {
  const calendar = useLiveNodes(CALENDAR_PROJECT_ID);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');
  const [selectedWeek, setSelectedWeek] = useState<'current' | 'next'>('next');
  const weekOffset = selectedWeek === 'current' ? 0 : 1;
  const exportData = buildUpcomingActivitiesCsv(calendar.nodes, new Date(), weekOffset);
  const initialError = calendar.updatedAt == null && calendar.error != null;
  const initialLoading = calendar.updatedAt == null && calendar.loading;
  const isBusy = sending || initialLoading || initialError;

  async function exportAndEmail() {
    setStatus('');
    setSending(true);
    const blobUrl = URL.createObjectURL(new Blob([exportData.csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = exportData.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    try {
      await runFlow(WEEKLY_CSV_EMAIL_FLOW_ID, {
        csvText: exportData.csv,
        fileName: exportData.fileName,
        recipientEmail,
        weekLabel: `${selectedWeek === 'current' ? 'Current week' : 'Next week'} · ${exportData.weekLabel}`,
      });
      setStatus(`CSV downloaded. Email delivery was requested for ${recipientEmail}.`);
    } catch (error) {
      setStatus(`CSV downloaded, but email delivery could not be requested: ${error instanceof Error ? error.message : 'Please try again.'}`);
    } finally {
      setSending(false);
    }
  }

  return <section className="site-card site-card-purple mt-6 rounded-2xl border border-primary/30 p-5" aria-labelledby="weekly-csv-heading"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h3 id="weekly-csv-heading" className="text-lg font-black">Upcoming activities CSV</h3><p className="mt-1 text-sm text-muted-foreground">{selectedWeek === 'current' ? 'Current week' : 'Next week'} · {exportData.weekLabel} · {exportData.eventCount} {exportData.eventCount === 1 ? 'event' : 'events'}</p><p className="mt-1 text-xs text-muted-foreground">Choose the week to download and email to your signed-in account.</p><fieldset className="mt-4"><legend className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Choose week</legend><div className="mt-2 flex flex-wrap gap-2"><label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold focus-within:ring-2 focus-within:ring-ring"><input type="radio" name="weekly-csv-week" value="current" checked={selectedWeek === 'current'} onChange={() => setSelectedWeek('current')} className="accent-primary" />Current week</label><label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold focus-within:ring-2 focus-within:ring-ring"><input type="radio" name="weekly-csv-week" value="next" checked={selectedWeek === 'next'} onChange={() => setSelectedWeek('next')} className="accent-primary" />Next week</label></div></fieldset></div><button type="button" disabled={isBusy} onClick={() => void exportAndEmail()} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:cursor-wait disabled:opacity-60">{sending ? 'Preparing CSV…' : initialLoading ? 'Loading calendar…' : `Download + email ${selectedWeek === 'current' ? 'current week' : 'next week'} CSV`}</button></div>{initialError && <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert"><p>Calendar data could not be loaded.</p><button type="button" onClick={() => void calendar.refresh()} className="mt-2 min-h-11 font-bold text-primary underline">Refresh calendar</button></div>}{calendar.error != null && calendar.updatedAt != null && <p className="mt-3 text-xs text-muted-foreground">The last calendar refresh did not complete. <button type="button" onClick={() => void calendar.refresh()} className="min-h-11 font-bold text-primary underline">Refresh before exporting</button></p>}{status && <p className="mt-3 rounded-xl bg-background/70 p-3 text-sm" role="status">{status}</p>}</section>;
}

function FieldInput({ field, value, onChange }: { field: FieldDefinition; value: string; onChange: (value: string) => void }) {
  const multiline = field.multiline === true;
  return <label className="text-sm font-semibold">{field.label}{multiline ? <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" /> : <input type={field.type ?? 'text'} autoComplete={field.type === 'url' ? 'url' : undefined} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" />}</label>;
}

function AccessGate({ title, message, onSignIn, signOut = false }: { title: string; message: string; onSignIn: () => void; signOut?: boolean }) {
  return <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8"><PageTopBar showDashboard={false} /><SiteBanner /><PageTopBar showAccountControls={false} /><div className="site-card site-card-white mx-auto mt-10 max-w-xl rounded-3xl p-8 text-center sm:p-12"><KeyRound className="mx-auto h-10 w-10 text-primary" aria-hidden="true" /><h1 className="mt-6 text-3xl font-black tracking-tight">{title}</h1><p className="mt-3 leading-7 text-muted-foreground">{message}</p><button type="button" onClick={onSignIn} className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{signOut ? 'Sign out' : 'Sign in'}</button></div></main>;
}
