import { useMemo, useState } from 'react';
import { useAuth } from 'react-oidc-context';

import { PageTopBar } from '@/components/PageTopBar';
import { SiteBanner } from '@/components/SiteBanner';
import { useLiveNodes } from '@/hooks/use-live-nodes';
import { createNode, getTitle, updateNode } from '@/lib/genesis-data';
import {
  ACCESS_PROJECT_ID,
  ADMIN_EMAIL,
  DIRECTORY_PROJECT_ID,
  findAccessRecord,
  getAllowedActivities,
  hasPortalAccess,
  normalizeEmail,
  readAccessRecord,
} from '@/lib/access-control';
import { ArrowLeft, LogOut, Search, ShieldCheck, UserPlus, Users } from '@/lib/icons';
import { Link } from 'react-router-dom';

type InviteForm = {
  email: string;
  name: string;
  activities: string[];
};

export default function AccountPage() {
  const auth = useAuth();
  const email = typeof auth.user?.profile.email === 'string' ? auth.user.profile.email : '';
  const access = useLiveNodes(ACCESS_PROJECT_ID, { refreshEveryMs: 60000 });
  const directory = useLiveNodes(DIRECTORY_PROJECT_ID, { refreshEveryMs: 60000 });
  const [form, setForm] = useState<InviteForm>({ email: '', name: '', activities: [] });
  const [activitySearch, setActivitySearch] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const record = useMemo(() => findAccessRecord(access.nodes, email), [access.nodes, email]);
  const administrator = record?.role.trim().toLowerCase() === 'administrator';
  const activities = useMemo(
    () => directory.nodes.map((row) => getTitle(row, 'Name')).filter((name): name is string => name != null).sort(),
    [directory.nodes],
  );
  const visibleActivities = useMemo(() => {
    const query = activitySearch.trim().toLowerCase();
    if (query.length === 0) return activities;
    return activities.filter((activity) => activity.toLowerCase().includes(query));
  }, [activities, activitySearch]);
  const invitedUsers = useMemo(
    () => access.nodes.map(readAccessRecord).filter((item) => normalizeEmail(item.email) !== normalizeEmail(ADMIN_EMAIL)),
    [access.nodes],
  );
  const inventory = useMemo(
    () => activities.map((activity) => ({
      activity,
      owners: invitedUsers
        .filter((user) => getAllowedActivities(user).includes(activity.trim().toLowerCase()))
        .sort((left, right) => left.displayName.localeCompare(right.displayName)),
    })),
    [activities, invitedUsers],
  );
  const hasActivities = activities.length > 0;
  const hasVisibleActivities = visibleActivities.length > 0;
  const hasEditors = invitedUsers.length > 0;

  async function inviteEditor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanEmail = normalizeEmail(form.email);
    if (!cleanEmail || form.name.trim().length === 0 || form.activities.length === 0) {
      setMessage('Add an email, a display name, and at least one activity.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const result = await createNode(ACCESS_PROJECT_ID, {
        Email: cleanEmail,
        'Display Name': form.name.trim(),
        Role: 'Editor',
        'Allowed Categories': form.activities.join(', '),
        Access: 'Invited',
        'Owner Email': ADMIN_EMAIL,
      });
      if (result.ignoredKeys.length > 0) throw new Error(`Some access fields were not saved: ${result.ignoredKeys.join(', ')}`);
      setForm({ email: '', name: '', activities: [] });
      await access.refresh();
      setMessage(`${cleanEmail} can now sign in and edit the selected activities.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The invitation could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function revokeUser(id: string) {
    setSaving(true);
    setMessage('');
    try {
      const result = await updateNode(ACCESS_PROJECT_ID, id, { Access: 'Revoked' });
      if (result.ignoredKeys.length > 0) throw new Error(`Access status was not saved: ${result.ignoredKeys.join(', ')}`);
      await access.refresh();
      setMessage('Access revoked.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Access could not be revoked.');
    } finally {
      setSaving(false);
    }
  }

  function toggleActivity(activity: string) {
    const selected = form.activities.includes(activity);
    setForm((current) => ({
      ...current,
      activities: selected ? current.activities.filter((item) => item !== activity) : [...current.activities, activity],
    }));
  }

  function selectVisibleActivities() {
    setForm((current) => ({ ...current, activities: Array.from(new Set([...current.activities, ...visibleActivities])) }));
  }

  function clearActivities() {
    setForm((current) => ({ ...current, activities: [] }));
  }

  if (!administrator && !record) {
    return <AccessDenied email={email} onSignOut={() => void auth.signoutRedirect()} />;
  }
  if (!administrator && record != null && !hasPortalAccess(record)) {
    return <AccessDenied email={email} onSignOut={() => void auth.signoutRedirect()} revoked />;
  }

  return (
    <main className="min-h-screen bg-background px-4 py-4 text-foreground sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <PageTopBar showDashboard={false} />
        <SiteBanner />
        <PageTopBar showAccountControls={false} />
        <header className="flex flex-col gap-5 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>{administrator ? <><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Administrator invitation page</p><h1 className="mt-2 text-4xl font-black tracking-tight">Assign activity editors</h1><p className="mt-3 max-w-2xl text-muted-foreground">Invite staff members and keep a clear inventory of who can update each activity.</p></> : <><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Account</p><h1 className="mt-2 text-4xl font-black tracking-tight">Activity access</h1></>}</div>
        </header>
        {administrator ? <>
          <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <form onSubmit={inviteEditor} className="site-card site-card-purple rounded-3xl p-6 sm:p-8">
              <div className="flex items-start gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"><UserPlus className="h-5 w-5" aria-hidden="true" /></div><div><h2 className="text-xl font-bold">Invite an editor</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Choose the exact activities this person is responsible for updating.</p></div></div>
              <div className="mt-7 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Email<input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} autoComplete="email" placeholder="advisor@hermiston.k12.or.us" className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label><label className="text-sm font-semibold">Display name<input type="text" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} autoComplete="name" placeholder="Band advisor" className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label></div>
              <fieldset className="mt-6"><legend className="text-sm font-semibold">Selectable activities</legend><p className="mt-1 text-sm text-muted-foreground">The selected names become this editor&apos;s editing privileges.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><label className="relative flex-1"><span className="sr-only">Search activities</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" /><input type="search" value={activitySearch} onChange={(event) => setActivitySearch(event.target.value)} placeholder="Search the activity list" className="min-h-11 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label><button type="button" onClick={selectVisibleActivities} disabled={!hasVisibleActivities} className="min-h-11 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">Select visible</button><button type="button" onClick={clearActivities} disabled={form.activities.length === 0} className="min-h-11 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">Clear</button></div><div className="mt-3 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"><span>{form.activities.length} selected</span><span>{activities.length} available</span></div><div className="mt-2 grid max-h-72 gap-2 overflow-y-auto rounded-2xl border border-border p-3 sm:grid-cols-2">{hasVisibleActivities ? visibleActivities.map((activity) => { const selected = form.activities.includes(activity); return <label key={activity} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm hover:bg-muted"><input type="checkbox" checked={selected} onChange={() => toggleActivity(activity)} className="h-4 w-4 accent-[hsl(var(--primary))]" /><span>{activity}</span></label>; }) : <p className="col-span-full p-3 text-sm text-muted-foreground">No activities match that search.</p>}</div></fieldset>
              <button type="submit" disabled={saving || !hasActivities} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"><UserPlus className="h-4 w-4" aria-hidden="true" /> {saving ? 'Saving...' : 'Invite editor'}</button>
              {message && <p className="mt-4 rounded-xl bg-muted p-3 text-sm text-muted-foreground" role="status">{message}</p>}
            </form>
            <section className="site-card site-card-silver rounded-3xl p-6 sm:p-8"><div className="flex items-start gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Users className="h-5 w-5" aria-hidden="true" /></div><div><h2 className="text-xl font-bold">Invited editors</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Manage invitation status and review each person&apos;s assigned activities.</p></div></div><div className="mt-6 space-y-3">{hasEditors ? invitedUsers.map((user) => <div key={user.id} className="rounded-2xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-bold">{user.displayName || user.email}</p><p className="truncate text-sm text-muted-foreground">{user.email}</p></div><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{user.access}</span></div><p className="mt-3 text-sm text-muted-foreground">{user.allowedCategories || 'No activities assigned'}</p>{user.access !== 'Revoked' && <button type="button" disabled={saving} onClick={() => void revokeUser(user.id)} className="mt-3 min-h-11 text-sm font-semibold text-destructive hover:underline">Revoke access</button>}</div>) : <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">No editors invited yet.</p>}</div></section>
          </section>
          <section className="site-card site-card-gold mt-6 rounded-3xl p-6 sm:p-8"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Privilege inventory</p><h2 className="mt-2 text-2xl font-black tracking-tight">Who owns each activity?</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Each activity is grouped below with the invited editors who can update it. Revoked access remains visible so you can audit the history of assignments.</p></div><span className="rounded-full bg-accent px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-accent-foreground">{activities.length} activities tracked</span></div><div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{inventory.map(({ activity, owners }) => { const hasOwners = owners.length > 0; return <article key={activity} className="rounded-2xl border border-border/80 bg-background/50 p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-bold leading-5">{activity}</h3><span className="tabular-nums text-xs font-bold text-muted-foreground">{owners.length}</span></div>{hasOwners ? <div className="mt-4 space-y-2">{owners.map((owner) => <div key={owner.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2"><span className="min-w-0 truncate text-sm font-semibold">{owner.displayName || owner.email}</span><span className={hasPortalAccess(owner) ? 'shrink-0 text-[11px] font-bold uppercase tracking-wide text-primary' : 'shrink-0 text-[11px] font-bold uppercase tracking-wide text-destructive'}>{owner.access}</span></div>)}</div> : <p className="mt-4 text-sm text-muted-foreground">No editor assigned</p>}</article>; })}</div></section>
        </> : null}
      </div>
    </main>
  );
}

function AccessDenied({ email, onSignOut, revoked = false }: { email: string; onSignOut: () => void; revoked?: boolean }) {
  return <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6"><PageTopBar showDashboard={false} /><SiteBanner /><PageTopBar showAccountControls={false} /><div className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-8 text-center shadow-sm sm:p-12"><ShieldCheck className="mx-auto h-10 w-10 text-primary" aria-hidden="true" /><h1 className="mt-6 text-3xl font-black tracking-tight">{revoked ? 'Access revoked' : 'Invitation required'}</h1><p className="mt-3 leading-7 text-muted-foreground">{revoked ? 'This account no longer has editing access.' : `No invitation was found for ${email || 'this account'}. Ask the activities administrator to invite you.`}</p><div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row"><button type="button" onClick={onSignOut} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted"><LogOut className="h-4 w-4" aria-hidden="true" /> Sign out</button><Link to="/" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to activities</Link></div></div></main>;
}
