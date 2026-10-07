import { useMemo } from 'react';
import { useAuth } from 'react-oidc-context';
import { Link } from 'react-router-dom';

import { useLiveNodes } from '@/hooks/use-live-nodes';
import { cn } from '@/lib/utils';
import { Home, KeyRound, LogIn, LogOut } from '@/lib/icons';
import { isActiveSuperAdmin, SUPER_ADMINS_PROJECT_ID } from '@/lib/super-admin';

export function PageTopBar({ calendarPage = false, showDashboard = true, showAccountControls = true, fullWidth = false }: { calendarPage?: boolean; showDashboard?: boolean; showAccountControls?: boolean; fullWidth?: boolean }) {
  const auth = useAuth();
  const superAdmins = useLiveNodes(auth.isAuthenticated ? SUPER_ADMINS_PROJECT_ID : null);
  const canOpenSuperAdmin = useMemo(() => isActiveSuperAdmin(superAdmins.nodes, auth.user?.profile.email), [superAdmins.nodes, auth.user?.profile.email]);

  return (
    <header className={cn('relative z-10 mx-auto flex w-full pb-4', fullWidth ? 'left-1/2 max-w-none -translate-x-1/2 px-4 sm:px-6 lg:px-8' : 'max-w-7xl', calendarPage ? 'flex-col gap-3' : showDashboard ? 'flex-row items-center gap-3' : 'justify-end gap-2')}>
      {showDashboard && <Link to="/" aria-label="Dashboard" title="Dashboard" className={cn('inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-accent px-4 text-sm font-bold text-accent-foreground transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', calendarPage ? 'w-full' : 'min-w-0 flex-1')}>
        <Home className="h-5 w-5" aria-hidden="true" /> Dashboard
      </Link>}
      {showAccountControls && <div className="flex flex-wrap items-center justify-end gap-2">
        {canOpenSuperAdmin && <Link to="/super-admin" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/40 bg-accent px-4 text-sm font-bold text-accent-foreground transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><KeyRound className="h-4 w-4" aria-hidden="true" /> Super admin</Link>}
        {auth.isAuthenticated ? (
          <button type="button" onClick={() => void auth.signoutRedirect()} className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl border border-border bg-card px-4 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <LogOut className="h-4 w-4" aria-hidden="true" /> Log out
          </button>
        ) : (
          <button type="button" onClick={() => void auth.signinRedirect()} disabled={auth.isLoading} className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <LogIn className="h-4 w-4" aria-hidden="true" /> Log in
          </button>
        )}
      </div>}
    </header>
  );
}
