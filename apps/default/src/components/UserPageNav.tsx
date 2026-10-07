import { Link } from 'react-router-dom';

import { CalendarCheck, CalendarDays } from '@/lib/icons';

export function UserPageNav() {
  return (
    <nav aria-label="Calendar navigation" className="relative left-1/2 grid w-screen -translate-x-1/2 grid-cols-2 items-stretch gap-2 px-4 py-2 sm:gap-3 sm:px-6 sm:py-3 lg:px-8">
      <Link to="/calendar" className="inline-flex min-h-12 min-w-0 w-full items-center justify-center gap-0 rounded-2xl border border-primary/40 bg-accent px-1 text-center text-[0.6rem] font-black leading-tight text-accent-foreground transition hover:-translate-y-0.5 hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50 sm:min-h-14 sm:gap-3 sm:px-6 sm:text-base"><CalendarDays className="hidden h-3.5 w-3.5 shrink-0 sm:block sm:h-5 sm:w-5" aria-hidden="true" /> <span className="truncate whitespace-nowrap">Master calendar</span></Link>
      <Link to="/weekly-activities" className="inline-flex min-h-12 min-w-0 w-full items-center justify-center gap-0 rounded-2xl border border-primary/40 bg-accent px-1 text-center text-[0.6rem] font-black leading-tight text-accent-foreground transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50 sm:min-h-14 sm:gap-3 sm:px-5 sm:text-sm"><CalendarCheck className="hidden h-3.5 w-3.5 shrink-0 sm:block sm:h-5 sm:w-5" aria-hidden="true" /> <span className="truncate whitespace-nowrap">Weekly activities</span></Link>
    </nav>
  );
}
