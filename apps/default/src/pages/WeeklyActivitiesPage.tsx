import { useEffect, useMemo } from 'react';
import { format, isValid, parseISO, startOfWeek } from 'date-fns';
import { Link } from 'react-router-dom';

import { PageTopBar } from '@/components/PageTopBar';
import { SiteBanner } from '@/components/SiteBanner';
import { UserPageNav } from '@/components/UserPageNav';
import { useLiveNodes } from '@/hooks/use-live-nodes';
import { CalendarCheck, MapPin, RefreshCw } from '@/lib/icons';
import { getFieldValue, getTitle, type GenesisNode } from '@/lib/genesis-data';
import { formatTimeRange } from '@/lib/time-format';

const CALENDAR_PROJECT_ID = 'iG1Cr94QBuatx9yK';
const UPDATES_PROJECT_ID = 'Yx8iqKvUPFu6Zg5b';

type ScheduledActivity = {
  id: string;
  title: string;
  activityName: string;
  date: Date;
  weekKey: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
};

type WeeklyUpdate = {
  id: string;
  title: string;
  body: string;
  week: string;
  weekDate: Date | null;
};

function readScheduledActivity(row: GenesisNode): ScheduledActivity | null {
  const dateValue = getFieldValue(row, 'Date') ?? '';
  const title = getTitle(row, 'Event Title', 'Title') ?? '';
  if (dateValue.trim() === '' || title.trim() === '') return null;
  const date = parseISO(dateValue.slice(0, 10));
  if (!isValid(date)) return null;
  const weekDate = startOfWeek(date, { weekStartsOn: 1 });
  return {
    id: row.id,
    title,
    activityName: getFieldValue(row, 'Activity Name') ?? 'Extracurricular activity',
    date,
    weekKey: format(weekDate, 'yyyy-MM-dd'),
    startTime: getFieldValue(row, 'Start Time') ?? '',
    endTime: getFieldValue(row, 'End Time') ?? '',
    location: getFieldValue(row, 'Location') ?? '',
    notes: getFieldValue(row, 'Notes') ?? '',
  };
}

function readWeeklyUpdate(row: GenesisNode): WeeklyUpdate {
  const week = getFieldValue(row, 'Week') ?? '';
  const parsedWeek = week.length > 0 ? parseISO(week.slice(0, 10)) : null;
  return {
    id: row.id,
    title: getTitle(row, 'Update Title', 'Title') ?? 'Weekly activities',
    body: getFieldValue(row, 'Update Body') ?? '',
    week,
    weekDate: parsedWeek != null && isValid(parsedWeek) ? parsedWeek : null,
  };
}

function formatUpdateDate(weekDate: Date | null, fallback: string) {
  if (weekDate != null) return format(weekDate, 'MMMM d, yyyy');
  return fallback.length > 0 ? fallback.slice(0, 10) : 'Not available';
}

export default function WeeklyActivitiesPage() {
  const calendar = useLiveNodes(CALENDAR_PROJECT_ID);
  const updates = useLiveNodes(UPDATES_PROJECT_ID);
  const scheduledEvents = useMemo(
    () => calendar.nodes.map(readScheduledActivity).filter((event): event is ScheduledActivity => event != null),
    [calendar.nodes],
  );
  const currentWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
  const nextWeek = new Date(currentWeek);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const currentWeekKey = format(currentWeek, 'yyyy-MM-dd');
  const nextWeekKey = format(nextWeek, 'yyyy-MM-dd');
  const currentWeekEvents = useMemo(
    () => scheduledEvents.filter((event) => event.weekKey === currentWeekKey).sort((a, b) => a.date.getTime() - b.date.getTime() || a.startTime.localeCompare(b.startTime)),
    [currentWeekKey, scheduledEvents],
  );
  const nextWeekEvents = useMemo(
    () => scheduledEvents.filter((event) => event.weekKey === nextWeekKey).sort((a, b) => a.date.getTime() - b.date.getTime() || a.startTime.localeCompare(b.startTime)),
    [nextWeekKey, scheduledEvents],
  );
  const weeklyUpdates = useMemo(
    () => updates.nodes.map(readWeeklyUpdate).filter((update) => update.title.toLowerCase().includes('weekly activities')).sort((a, b) => (b.weekDate?.getTime() ?? 0) - (a.weekDate?.getTime() ?? 0)),
    [updates.nodes],
  );
  const latestUpdate = weeklyUpdates[0] ?? null;
  const calendarInitialError = calendar.error != null && calendar.updatedAt == null;
  const calendarLoading = calendar.loading && calendar.updatedAt == null;
  const upcomingEventCount = currentWeekEvents.length + nextWeekEvents.length;
  const eventCountLabel = `${upcomingEventCount} upcoming ${upcomingEventCount === 1 ? 'event' : 'events'}`;
  const calendarHasStaleError = calendar.error != null && calendar.updatedAt != null;
  const updatesHaveStaleError = updates.error != null && updates.updatedAt != null;
  const activityWeeks = [
    { label: 'Current week', headingId: 'current-week-heading', weekStart: currentWeek, events: currentWeekEvents, emptyMessage: 'No events are scheduled for the current week.' },
    { label: 'Next week', headingId: 'next-week-heading', weekStart: nextWeek, events: nextWeekEvents, emptyMessage: 'No events are scheduled for next week.' },
  ];

  useEffect(() => {
    document.title = 'Weekly Activities | Hermiston High School';
  }, []);

  return (
    <main className="min-h-screen bg-background px-4 py-3 text-foreground sm:px-6 sm:py-5 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <PageTopBar showDashboard={false} />
        <SiteBanner />
        <PageTopBar calendarPage showAccountControls={false} />
        <UserPageNav />
        <header className="flex flex-col gap-6 border-b border-border/70 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-primary sm:mt-5">Hermiston High School</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-6xl">Weekly activities</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">Events are grouped by their scheduled date for the current and next week, regardless of when they were entered. Other weeks remain in the master calendar.</p>
          </div>
          <div className="site-card site-card-gold flex items-center gap-3 px-4 py-3 text-sm font-semibold"><CalendarCheck className="h-5 w-5 text-primary" aria-hidden="true" /><span>{eventCountLabel}</span></div>
        </header>

        {calendarInitialError ? (
          <section className="site-card mt-8 rounded-3xl border border-destructive/40 p-8" aria-live="polite">
            <h2 className="text-xl font-bold">Calendar activities could not load</h2>
            <p className="mt-2 text-muted-foreground">Refresh the calendar data to try again.</p>
            <button type="button" onClick={() => void calendar.refresh()} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh activities</button>
          </section>
        ) : calendarLoading ? (
          <section className="mt-8 space-y-4" aria-label="Loading weekly activities"><div className="h-40 animate-pulse rounded-3xl bg-muted" /><div className="h-32 animate-pulse rounded-3xl bg-muted" /></section>
        ) : (
          <>
            {activityWeeks.map((week) => {
              const hasEvents = week.events.length > 0;
              const eventCount = `${week.events.length} ${week.events.length === 1 ? 'event' : 'events'}`;
              return (
                <section key={week.headingId} className="mt-8" aria-label={`${week.label} activities`}>
                  <article className="site-card site-card-purple rounded-3xl border border-primary/35 p-5 sm:p-7" aria-labelledby={week.headingId}>
                    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{week.label}</p>
                        <h2 id={week.headingId} className="mt-1 text-2xl font-black tracking-tight">Week of {format(week.weekStart, 'MMMM d, yyyy')}</h2>
                      </div>
                      <span className="rounded-full bg-accent px-3 py-1 text-sm font-bold tabular-nums text-accent-foreground">{eventCount}</span>
                    </header>
                    {hasEvents ? (
                      <ul className="divide-y divide-border/70">
                        {week.events.map((event) => {
                          const timeLabel = formatTimeRange(event.startTime, event.endTime);
                          return (
                            <li key={event.id} className="flex min-w-0 flex-col gap-2 py-5 sm:flex-row sm:items-start sm:gap-5">
                              <time dateTime={format(event.date, 'yyyy-MM-dd')} className="shrink-0 text-sm font-bold tabular-nums text-primary sm:w-28">{format(event.date, 'EEE, MMM d')}</time>
                              <div className="min-w-0 flex-1">
                                <h3 className="break-words text-lg font-bold">{event.title}</h3>
                                <p className="mt-1 text-sm font-semibold text-foreground">{event.activityName}</p>
                                {timeLabel && <p className="mt-2 text-sm tabular-nums text-muted-foreground">{timeLabel}</p>}
                                {event.location && <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />{event.location}</p>}
                                {event.notes && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{event.notes}</p>}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="py-5 text-center">
                        <p className="text-sm text-muted-foreground">{week.emptyMessage}</p>
                        <Link to="/calendar" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open master calendar</Link>
                      </div>
                    )}
                  </article>
                </section>
              );
            })}
            {calendarHasStaleError && <p className="mt-5 text-xs text-muted-foreground">The last calendar refresh did not complete. <button type="button" onClick={() => void calendar.refresh()} className="min-h-11 font-bold text-primary underline">Refresh now</button></p>}
          </>
        )}

        {latestUpdate != null && <section className="site-card site-card-silver mt-8 rounded-3xl p-5 sm:p-7" aria-labelledby="sunday-overview-heading"><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Sunday-generated overview</p><h2 id="sunday-overview-heading" className="mt-2 text-xl font-bold">{latestUpdate.title}</h2><p className="mt-1 text-sm text-muted-foreground">Generated {formatUpdateDate(latestUpdate.weekDate, latestUpdate.week)}</p><div className="mt-4 whitespace-pre-wrap rounded-2xl border border-border/70 bg-background/70 p-5 text-sm leading-7 text-foreground">{latestUpdate.body}</div></section>}
        {updatesHaveStaleError && <p className="mt-4 text-xs text-muted-foreground">The last Sunday overview refresh did not complete. <button type="button" onClick={() => void updates.refresh()} className="min-h-11 font-bold text-primary underline">Refresh overview</button></p>}
      </div>
    </main>
  );
}
