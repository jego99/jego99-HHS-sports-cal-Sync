import { useEffect, useMemo } from 'react';
import type { GenesisNode } from '@/lib/genesis-data';
import { getTitle } from '@/lib/genesis-data';
import { useLiveNodes } from '@/hooks/use-live-nodes';
import { PageTopBar } from '@/components/PageTopBar';
import { ScheduleCalendar } from '@/components/ScheduleCalendar';
import { SiteBanner } from '@/components/SiteBanner';
import { UserPageNav } from '@/components/UserPageNav';
import { CalendarDays } from '@/lib/icons';

const DIRECTORY_ID = 'V9NRsAo6RidHoU2X';

export default function CalendarPage() {
  const directory = useLiveNodes(DIRECTORY_ID);
  const activityOptions = useMemo(() => directory.nodes.map((row: GenesisNode) => ({ id: row.id, name: getTitle(row, 'Name') ?? 'Activity' })).filter((activity) => activity.name.trim() !== ''), [directory.nodes]);
  const activityCount = activityOptions.length;

  useEffect(() => {
    document.title = 'Master Calendar | Hermiston High School';
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
            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-6xl">Master calendar</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">One schedule for every extracurricular activity, fed by the calendars on each activity page.</p>
          </div>
          <div className="site-card site-card-gold flex items-center gap-3 px-4 py-3 text-sm font-semibold"><CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" /><span>{activityCount} activities connected</span></div>
        </header>
        <ScheduleCalendar master editable={false} activityOptions={activityOptions} />
      </div>
    </main>
  );
}
