import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import type { GenesisNode } from '@/lib/genesis-data';
import { getFieldValue, getTitle } from '@/lib/genesis-data';
import { useLiveNodes } from '@/hooks/use-live-nodes';
import { PageTopBar } from '@/components/PageTopBar';
import { UserPageNav } from '@/components/UserPageNav';
import {
  BookOpen,
  Bot,
  CircleDot,
  HeartHandshake,
  Music,
  Sparkles,
  Star,
  Users,
} from '@/lib/icons';

const DIRECTORY_ID = 'V9NRsAo6RidHoU2X';
const UPDATES_ID = 'Yx8iqKvUPFu6Zg5b';
const PUBLIC_AGENT_ID = 'hermiston-activities-guide-01M3DED0D8X988RQW6MP6AXF44';
const AGENT_ID = '01M3DED0CN4FZCHGC8CBEXP1J3';

const iconByName = {
  Users,
  Sparkles,
  Music,
  Bot,
  HeartHandshake,
  BookOpen,
  CircleDot,
  Star,
};

function iconFor(name: string | null, fallback: LucideIcon = Star) {
  if (name != null && name in iconByName) {
    return iconByName[name as keyof typeof iconByName];
  }
  return fallback;
}

function readActivity(row: GenesisNode) {
  const name = getTitle(row, 'Name') ?? 'Activity';
  return {
    id: row.id,
    name,
    category: getFieldValue(row, 'Category') ?? 'Clubs',
    keywords: getFieldValue(row, 'Keywords') ?? '',
    description: getFieldValue(row, 'Description') ?? 'Find your place and get involved at Hermiston High School.',
    advisor: getFieldValue(row, 'Advisor') ?? 'Hermiston High School',
    meeting: getFieldValue(row, 'Meeting Period') ?? 'See advisor for details',
    icon: getFieldValue(row, 'Icon'),
    section: 'extracurriculars',
  };
}

function ActivityCard({ activity }: { activity: ReturnType<typeof readActivity> }) {
  const Icon = iconFor(activity.icon);
  return <Link to={`/activities/${activity.id}`} aria-label={`Open ${activity.name} activity`} className="group flex min-h-14 items-center gap-3 rounded-xl border border-primary/25 bg-card px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:bg-accent hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground transition group-hover:bg-primary group-hover:text-primary-foreground"><Icon className="h-4 w-4" aria-hidden="true" /></span><span className="min-w-0 truncate text-sm font-bold text-card-foreground">{activity.name}</span></Link>;
}

export default function HomePage() {
  const directory = useLiveNodes(DIRECTORY_ID);
  const updates = useLiveNodes(UPDATES_ID);

  useEffect(() => {
    document.title = 'Activities | Hermiston High School';
  }, []);

  const activities = useMemo(() => directory.nodes.map(readActivity).sort((left, right) => left.name.localeCompare(right.name)), [directory.nodes]);
  const hasResults = activities.length > 0;
  const loading = directory.loading && directory.updatedAt == null;
  const initialError = directory.error != null && directory.updatedAt == null;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <PageTopBar showDashboard={false} />
        <section aria-label="Dawg Clubs and Activities" className="relative left-1/2 mt-4 w-screen max-w-none -translate-x-1/2 overflow-hidden rounded-3xl border border-transparent bg-transparent shadow-none sm:mt-6">
          <img src="https://files.taskade.com/space-files/19e2dd0e-8fc5-43a4-9bd5-e67c05aad7ff/original/Clubs%20and%20Activities%20Logo.png" alt="Dawg Clubs and Activities" className="block h-auto w-screen max-w-none object-contain" />
        </section>

        <PageTopBar showAccountControls={false} fullWidth />
        <UserPageNav />

        <section className="relative overflow-hidden pb-8 pt-1 text-center sm:pb-10 sm:pt-4">
          <div className="pointer-events-none absolute right-0 top-4 h-48 w-48 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
          <a href="https://www.hhsdawgs.com/calendar" className="mb-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-accent px-4 text-sm font-bold text-accent-foreground transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Sports</a>
          <p className="relative text-sm font-bold uppercase tracking-[0.24em] text-primary">Find your place</p>
          <h1 className="relative mx-auto mt-3 max-w-3xl text-5xl font-black tracking-[-0.05em] text-foreground sm:text-7xl">ACTIVITIES</h1>
        </section>

        <section aria-labelledby="directory-heading" className="pt-4">
          <div><p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">Browse opportunities</p><h2 id="directory-heading" className="mt-2 text-3xl font-bold tracking-tight">Activity directory</h2></div>

          {initialError ? <div className="mt-8 rounded-2xl border border-destructive/40 bg-destructive/10 p-6"><h3 className="font-bold">Activities are taking a moment to load</h3><p className="mt-2 text-sm text-muted-foreground">Refresh the directory to try again.</p><button type="button" onClick={() => void directory.refresh()} className="mt-4 min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Refresh directory</button></div> : loading ? <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"><div className="h-14 animate-pulse rounded-xl bg-muted" /><div className="h-14 animate-pulse rounded-xl bg-muted" /><div className="h-14 animate-pulse rounded-xl bg-muted" /></div> : hasResults ? <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{activities.map((activity) => <ActivityCard key={activity.id} activity={activity} />)}</div> : <div className="site-card site-card-silver mt-8 rounded-2xl border-dashed p-10 text-center"><Star className="mx-auto h-8 w-8 text-primary" aria-hidden="true" /><h3 className="mt-4 text-xl font-bold">No activities are available yet</h3><p className="mt-2 text-muted-foreground">Check back soon for the activity directory.</p></div>}
        </section>

        <footer className="mt-16 border-t border-border/70 pt-8 text-sm text-muted-foreground"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p>Hermiston High School Activities</p><p>Built for students, families, and the Bulldog community.</p></div></footer>
      </div>
      <div className="sr-only" aria-live="polite">{updates.error != null && updates.updatedAt != null ? 'The weekly update did not refresh.' : ''}</div>
      <div data-agent-id={AGENT_ID} data-public-agent-id={PUBLIC_AGENT_ID} className="hidden" />
    </main>
  );
}
