import { useMemo, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { addDays, addMonths, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import type { GenesisNode } from '@/lib/genesis-data';
import { createNode, deleteNode, getFieldValue, updateNode } from '@/lib/genesis-data';
import { useLiveNodes } from '@/hooks/use-live-nodes';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Pencil, Plus, Trash2, X } from '@/lib/icons';
import { formatTimeRange } from '@/lib/time-format';

export const CALENDAR_PROJECT_ID = 'iG1Cr94QBuatx9yK';

type CalendarEvent = {
  id: string;
  activityId: string;
  activityName: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
};

type EventForm = Omit<CalendarEvent, 'id' | 'activityId' | 'activityName'>;

type ActivityOption = { id: string; name: string };

function readEvent(row: GenesisNode): CalendarEvent | null {
  const date = getFieldValue(row, 'Date');
  const title = getFieldValue(row, 'Event Title');
  const activityId = getFieldValue(row, 'Activity ID');
  if (date == null || date.trim() === '' || title == null || title.trim() === '' || activityId == null || activityId.trim() === '') return null;
  return {
    id: row.id,
    activityId,
    activityName: getFieldValue(row, 'Activity Name') ?? 'Extracurricular activity',
    title,
    date: date.slice(0, 10),
    startTime: getFieldValue(row, 'Start Time') ?? '',
    endTime: getFieldValue(row, 'End Time') ?? '',
    location: getFieldValue(row, 'Location') ?? '',
    notes: getFieldValue(row, 'Notes') ?? '',
  };
}

const emptyForm = (date: string): EventForm => ({ title: '', date, startTime: '', endTime: '', location: '', notes: '' });

function eventFields(form: EventForm, activityId: string, activityName: string) {
  const fields: Record<string, string> = {
    'Activity ID': activityId,
    'Activity Name': activityName,
    'Event Title': form.title.trim(),
    Date: form.date,
  };
  if (form.startTime.trim() !== '') fields['Start Time'] = form.startTime.trim();
  if (form.endTime.trim() !== '') fields['End Time'] = form.endTime.trim();
  if (form.location.trim() !== '') fields.Location = form.location.trim();
  if (form.notes.trim() !== '') fields.Notes = form.notes.trim();
  return fields;
}

function dateKey(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

export function ScheduleCalendar({ activityId, activityName, editable, master = false, activityOptions = [] }: { activityId?: string; activityName?: string; editable: boolean; master?: boolean; activityOptions?: ActivityOption[] }) {
  const auth = useAuth();
  const canEdit = editable && auth.isAuthenticated;
  const calendar = useLiveNodes(CALENDAR_PROJECT_ID);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [newActivityId, setNewActivityId] = useState(activityId ?? activityOptions[0]?.id ?? '');
  const [form, setForm] = useState<EventForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const events = useMemo(() => calendar.nodes.map(readEvent).filter((event): event is CalendarEvent => event != null).filter((event) => master || event.activityId === activityId), [activityId, calendar.nodes, master]);
  const selectedEvent = selectedEventId == null ? null : events.find((event) => event.id === selectedEventId) ?? null;
  const selectedDateEvents = selectedDateKey == null ? [] : events.filter((event) => event.date === selectedDateKey);
  const monthStart = startOfMonth(month);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const days = Array.from({ length: 42 }, (_, index) => addDays(calendarStart, index));
  const visibleMonthLabel = format(month, 'MMMM yyyy');
  const hasEvents = events.length > 0;
  const loading = calendar.loading && calendar.updatedAt == null;
  const initialError = calendar.error != null && calendar.updatedAt == null;
  const canCreateForActivity = canEdit && activityId != null && activityName != null;
  const canCreateEvent = canEdit && (canCreateForActivity || (master && activityOptions.length > 0));
  const formIsValid = form != null && form.title.trim() !== '' && form.date !== '';

  function openDate(key: string) {
    setSelectedDateKey(key);
    if (canCreateEvent) startNewEvent(key);
  }

  function startNewEvent(date = dateKey(new Date())) {
    if (!canCreateEvent) return;
    if (activityId == null && activityOptions[0] != null) setNewActivityId(activityOptions[0].id);
    setSelectedEventId(null);
    setError('');
    setForm(emptyForm(date));
  }

  function startEdit(event: CalendarEvent) {
    setSelectedDateKey(event.date);
    setSelectedEventId(event.id);
    if (!canEdit) return;
    setError('');
    setForm({ title: event.title, date: event.date, startTime: event.startTime, endTime: event.endTime, location: event.location, notes: event.notes });
  }

  async function saveEvent() {
    if (!formIsValid || form == null) return;
    const selectedActivity = activityOptions.find((option) => option.id === newActivityId);
    const targetActivityId = selectedEvent?.activityId ?? activityId ?? selectedActivity?.id;
    const targetActivityName = selectedEvent?.activityName ?? activityName ?? selectedActivity?.name;
    if (targetActivityId == null || targetActivityName == null) {
      setError('Choose an activity calendar before adding an event.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = selectedEvent == null
        ? await createNode(CALENDAR_PROJECT_ID, eventFields(form, targetActivityId, targetActivityName))
        : await updateNode(CALENDAR_PROJECT_ID, selectedEvent.id, eventFields(form, targetActivityId, targetActivityName));
      if (result.ignoredKeys.length > 0) throw new Error(`Some calendar fields were not saved: ${result.ignoredKeys.join(', ')}`);
      setForm(null);
      setSelectedEventId(null);
      await calendar.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The calendar event could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function removeEvent(event: CalendarEvent) {
    if (!canEdit) return;
    const confirmed = window.confirm(`Delete ${event.title}?`);
    if (!confirmed) return;
    setSaving(true);
    setError('');
    try {
      await deleteNode(CALENDAR_PROJECT_ID, event.id);
      setSelectedEventId(null);
      setForm(null);
      await calendar.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'The calendar event could not be deleted.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="site-card site-card-white relative left-1/2 mt-8 w-screen max-w-none -translate-x-1/2 rounded-3xl p-4 sm:p-8 lg:p-10" aria-labelledby="schedule-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3 text-primary"><CalendarDays className="h-5 w-5" aria-hidden="true" /><p className="text-xs font-bold uppercase tracking-[0.18em]">{master ? 'All activities' : 'Activity schedule'}</p></div>
          <h2 id="schedule-heading" className="mt-2 text-2xl font-black tracking-tight">{master ? 'Master calendar' : `${activityName ?? 'Activity'} calendar`}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{master ? (canCreateEvent ? 'Every dated event from each extracurricular calendar appears here. Click a date to add an event or select an existing event to edit it.' : 'Every dated event from each extracurricular calendar appears here. Select an existing event to view its details.') : (canCreateEvent ? 'Add meetings, performances, deadlines, and other dates for this activity by clicking a date.' : 'View meetings, performances, deadlines, and other dates for this activity.')}</p>
        </div>
        {canCreateEvent ? <button type="button" onClick={() => startNewEvent()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Plus className="h-4 w-4" aria-hidden="true" /> Add event</button> : !auth.isAuthenticated && <button type="button" onClick={() => void auth.signinRedirect()} disabled={auth.isLoading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-accent px-4 text-sm font-bold text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"><Plus className="h-4 w-4" aria-hidden="true" /> Sign in to add event</button>}
      </div>

      {initialError ? <div className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/10 p-5" role="alert"><p className="font-bold">The calendar could not load.</p><button type="button" onClick={() => void calendar.refresh()} className="mt-3 min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">Refresh calendar</button></div> : loading ? <div className="mt-6 h-80 animate-pulse rounded-2xl bg-muted" aria-label="Loading calendar" /> : <>
        <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl bg-accent/50 p-3"><button type="button" onClick={() => setMonth((current) => subMonths(current, 1))} aria-label="Previous month" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-primary hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button><p className="text-lg font-black tracking-tight">{visibleMonthLabel}</p><button type="button" onClick={() => setMonth((current) => addMonths(current, 1))} aria-label="Next month" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-primary hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronRight className="h-5 w-5" aria-hidden="true" /></button></div>
        <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-border bg-border" role="grid" aria-label={visibleMonthLabel}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day} className="bg-muted px-2 py-4 text-center text-xs sm:py-5 sm:text-sm font-bold uppercase tracking-wide text-muted-foreground">{day}</div>)}
          {days.map((day) => {
            const key = dateKey(day);
            const dayEvents = events.filter((event) => event.date === key);
            const hasDayEvents = dayEvents.length > 0;
            const currentMonth = isSameMonth(day, month);
            const isSelected = selectedDateKey === key;
            return <div key={key} className={`min-h-40 bg-card p-3 sm:min-h-56 sm:p-4 lg:min-h-72 ${currentMonth ? '' : 'opacity-45'}`} role="gridcell"><div className="flex items-center justify-between gap-2"><button type="button" onClick={() => openDate(key)} aria-label={`Open activities for ${format(day, 'MMMM d')}`} className={`text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isSelected ? 'rounded-lg bg-primary px-2 py-1 text-primary-foreground' : isSameDay(day, new Date()) ? 'flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-primary'}`}>{format(day, 'd')}</button></div>{hasDayEvents && <div className="mt-2 space-y-1.5">{dayEvents.map((event) => <button type="button" key={event.id} onClick={() => startEdit(event)} className="block w-full rounded-lg bg-primary/10 px-3 py-2 text-left text-xs font-bold leading-5 text-foreground transition hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="block truncate">{event.title}</span>{master && <span className="block truncate font-medium text-muted-foreground">{event.activityName}</span>}</button>)}</div>}</div>;
          })}
        </div>
        {selectedDateKey != null && form == null && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="opened-date-title"><div className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 shadow-2xl sm:max-w-3xl sm:rounded-3xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Opened date</p><h3 id="opened-date-title" className="mt-1 text-2xl font-black">{format(parseISO(selectedDateKey), 'EEEE, MMMM d')}</h3><p className="mt-1 text-sm text-muted-foreground">{selectedDateEvents.length === 0 ? 'No activities are scheduled for this date.' : `${selectedDateEvents.length} ${selectedDateEvents.length === 1 ? 'activity' : 'activities'} scheduled`}</p></div><button type="button" onClick={() => { setSelectedDateKey(null); setSelectedEventId(null); }} aria-label="Close opened date" className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-5 w-5" aria-hidden="true" /></button></div>{selectedEvent != null ? <div className="mt-6 rounded-2xl border border-primary/30 bg-accent/35 p-5 sm:p-6"><button type="button" onClick={() => setSelectedEventId(null)} className="min-h-11 rounded-xl px-3 text-sm font-bold text-primary hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">← Back to all activities</button><div className="mt-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Event details</p><h4 className="mt-1 break-words text-2xl font-black">{selectedEvent.title}</h4><p className="mt-2 text-sm font-semibold text-foreground">{selectedEvent.activityName}</p><p className="mt-1 text-sm text-muted-foreground">{format(parseISO(selectedEvent.date), 'EEEE, MMMM d, yyyy')}</p>{(selectedEvent.startTime || selectedEvent.endTime) && <p className="mt-1 text-sm text-muted-foreground">{formatTimeRange(selectedEvent.startTime, selectedEvent.endTime, 'Time not set')}</p>}{selectedEvent.location && <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" aria-hidden="true" /> {selectedEvent.location}</p>}{selectedEvent.notes && <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{selectedEvent.notes}</p>}</div></div> : selectedDateEvents.length > 0 ? <div className="mt-6 grid gap-4 sm:grid-cols-2">{selectedDateEvents.map((event) => <button type="button" key={event.id} onClick={() => startEdit(event)} className="min-h-28 rounded-2xl border border-border bg-background p-5 text-left transition hover:border-primary/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><p className="text-lg font-bold text-foreground">{event.title}</p>{master && <p className="mt-1 text-sm font-semibold text-primary">{event.activityName}</p>}{(event.startTime || event.endTime) && <p className="mt-3 text-sm text-muted-foreground">{formatTimeRange(event.startTime, event.endTime, 'Time not set')}</p>}{event.location && <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {event.location}</p>}{event.notes && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{event.notes}</p>}</button>)}</div> : <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center"><CalendarDays className="mx-auto h-9 w-9 text-primary" aria-hidden="true" /><p className="mt-3 font-bold">No activities on this date</p><p className="mt-1 text-sm text-muted-foreground">Choose another date to view its schedule.</p></div>}</div></div>}
        {!hasEvents && <div className="mt-5 rounded-2xl border border-dashed border-border p-6 text-center"><CalendarDays className="mx-auto h-8 w-8 text-primary" aria-hidden="true" /><p className="mt-3 font-bold">No dated events yet</p><p className="mt-1 text-sm text-muted-foreground">{canCreateEvent ? 'Click a date or add an event to start this calendar.' : 'Add an activity calendar before creating events here.'}</p></div>}
      </>}

      {form != null && canEdit && <div className="mt-6 rounded-2xl border border-primary/30 bg-accent/40 p-5" aria-label="Calendar event editor"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{selectedEvent == null ? 'New event' : 'Edit event'}</p><p className="mt-1 text-sm text-muted-foreground">Changes feed into the master calendar automatically.</p></div><button type="button" onClick={() => { setForm(null); setSelectedEventId(null); setError(''); }} aria-label="Close event editor" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-4 w-4" aria-hidden="true" /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2">{master && selectedEvent == null && <label className="sm:col-span-2"><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Activity calendar</span><select value={newActivityId} onChange={(event) => setNewActivityId(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">{activityOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>}<label className="sm:col-span-2"><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Event title</span><input value={form.title} onChange={(event) => setForm((current) => current == null ? current : { ...current, title: event.target.value })} autoComplete="off" className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label><label><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Date</span><input type="date" value={form.date} onChange={(event) => setForm((current) => current == null ? current : { ...current, date: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label><label><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Start time</span><input type="time" value={form.startTime} onChange={(event) => setForm((current) => current == null ? current : { ...current, startTime: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label><label><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">End time</span><input type="time" value={form.endTime} onChange={(event) => setForm((current) => current == null ? current : { ...current, endTime: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label><label><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Location</span><input value={form.location} onChange={(event) => setForm((current) => current == null ? current : { ...current, location: event.target.value })} autoComplete="off" className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label><label className="sm:col-span-2"><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Notes</span><textarea value={form.notes} onChange={(event) => setForm((current) => current == null ? current : { ...current, notes: event.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label></div>{error && <p className="mt-4 text-sm text-destructive" role="alert">{error}</p>}<div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" disabled={!formIsValid || saving} onClick={() => void saveEvent()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"><CheckIcon /> {saving ? 'Saving...' : 'Save event'}</button>{selectedEvent != null && <button type="button" disabled={saving} onClick={() => void removeEvent(selectedEvent)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-destructive/40 px-4 text-sm font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50"><Trash2 className="h-4 w-4" aria-hidden="true" /> Delete event</button>}</div></div>}
      {selectedEvent != null && form == null && <div className="mt-5 rounded-2xl border border-primary/30 bg-accent/35 p-5 sm:p-6" aria-live="polite"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Event details</p><h3 className="mt-1 break-words text-xl font-black">{selectedEvent.title}</h3><p className="mt-2 text-sm font-semibold text-foreground">{selectedEvent.activityName}</p><p className="mt-1 text-sm text-muted-foreground">{format(parseISO(selectedEvent.date), 'EEEE, MMMM d, yyyy')}</p>{(selectedEvent.startTime || selectedEvent.endTime) && <p className="mt-1 text-sm text-muted-foreground">{formatTimeRange(selectedEvent.startTime, selectedEvent.endTime, 'Time not set')}</p>}{selectedEvent.location && <p className="mt-3 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {selectedEvent.location}</p>}{selectedEvent.notes && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{selectedEvent.notes}</p>}</div><div className="flex shrink-0 items-center gap-2">{canEdit && <button type="button" onClick={() => startEdit(selectedEvent)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-bold hover:bg-background"><Pencil className="h-4 w-4" aria-hidden="true" /> Edit</button>}<button type="button" onClick={() => { setSelectedEventId(null); setSelectedDateKey(null); }} aria-label="Close event details" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-4 w-4" aria-hidden="true" /></button></div></div></div>}
      {calendar.error != null && calendar.updatedAt != null && <p className="mt-4 text-xs text-muted-foreground">The last refresh did not complete. <button type="button" onClick={() => void calendar.refresh()} className="font-bold text-primary underline">Refresh now</button></p>}
    </section>
  );
}

function CheckIcon() {
  return <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-primary-foreground text-[9px]" aria-hidden="true">✓</span>;
}
