import { useEffect, useMemo } from 'react';
import { useAuth } from 'react-oidc-context';
import { Link, useParams } from 'react-router-dom';

import { PageTopBar } from '@/components/PageTopBar';
import { SiteBanner } from '@/components/SiteBanner';
import { UserPageNav } from '@/components/UserPageNav';
import { ScheduleCalendar } from '@/components/ScheduleCalendar';
import type { GenesisNode } from '@/lib/genesis-data';
import { getTitle } from '@/lib/genesis-data';
import { useLiveNodes } from '@/hooks/use-live-nodes';
import { ACCESS_PROJECT_ID, canEditActivity, findAccessRecord, isAdministrator } from '@/lib/access-control';
import { ArrowLeft } from '@/lib/icons';

const DIRECTORY_ID = 'V9NRsAo6RidHoU2X';

function readActivity(row: GenesisNode) {
  return {
    id: row.id,
    name: getTitle(row, 'Name') ?? 'Activity',
  };
}

export default function ActivityPage() {
  const auth = useAuth();
  const { activityId } = useParams<{ activityId: string }>();
  const directory = useLiveNodes(DIRECTORY_ID);
  const access = useLiveNodes(auth.isAuthenticated ? ACCESS_PROJECT_ID : null, { refreshEveryMs: 60000 });
  const activity = useMemo(() => {
    const row = directory.nodes.find((item) => item.id === activityId);
    return row == null ? null : readActivity(row);
  }, [activityId, directory.nodes]);
  const loading = directory.loading && directory.updatedAt == null;
  const signedInEmail = auth.user?.profile.email ?? auth.user?.profile.preferred_username;
  const accessRecord = useMemo(() => findAccessRecord(access.nodes, signedInEmail), [access.nodes, signedInEmail]);
  const editable = auth.isAuthenticated && (isAdministrator(signedInEmail) || canEditActivity(signedInEmail, accessRecord, activity?.name ?? ''));

  useEffect(() => {
    document.title = activity == null ? 'Activity | Hermiston High School' : `${activity.name} | Hermiston High School`;
  }, [activity]);

  if (loading) {
    return <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6"><PageTopBar showDashboard={false} /><SiteBanner /><PageTopBar calendarPage showAccountControls={false} /><div className="mx-auto max-w-4xl animate-pulse rounded-3xl bg-muted p-10"><div className="h-8 w-56 rounded bg-background/70" /><div className="mt-4 h-4 w-full rounded bg-background/70" /><div className="mt-8 h-40 rounded-2xl bg-background/70" /></div></main>;
  }

  if (activity == null) {
    return <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6"><PageTopBar showDashboard={false} /><SiteBanner /><PageTopBar calendarPage showAccountControls={false} /><div className="site-card site-card-white mx-auto max-w-xl rounded-3xl p-8 text-center sm:p-12"><h1 className="text-3xl font-black tracking-tight">Activity not found</h1><p className="mt-3 text-muted-foreground">Return to the directory to choose an activity.</p><Link to="/" className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to activities</Link></div></main>;
  }

  return (
    <main className="min-h-screen bg-background px-4 py-3 text-foreground sm:px-6 sm:py-5 lg:px-8">
      <div className="mx-auto w-full max-w-5xl pb-8">
        <PageTopBar showDashboard={false} />
        <SiteBanner />
        <PageTopBar calendarPage showAccountControls={false} />
        <UserPageNav />
        <ScheduleCalendar activityId={activity.id} activityName={activity.name} editable={editable} />

      </div>
    </main>
  );
}
