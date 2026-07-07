'use client';

import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ChangelogModal from './ChangelogModal';
import UserGuideModal from './UserGuideModal';
import OutreachPanel from '@/components/OutreachPanel';
import AlertsPanel from '@/components/AlertsPanel';
import { getAccount, getMe, type AuthUser } from '@/lib/api';
import type { Account } from '@/types';

interface ShellContextValue {
  account: Account | null;
  user: AuthUser | null;
  refreshAccount: () => void;
  openOutreach: () => void;
  openAlerts: () => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used within AppShell');
  return ctx;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // The login page renders itself, outside the authenticated shell chrome.
  const isAuthRoute = pathname === '/login';

  const [account, setAccount] = useState<Account | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authState, setAuthState] = useState<'loading' | 'authed' | 'anon'>('loading');
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const refreshAccount = useCallback(() => {
    getAccount().then(setAccount).catch(console.error);
  }, []);

  // Check the session once (the login route manages its own auth).
  useEffect(() => {
    if (isAuthRoute) return;
    let cancelled = false;
    getMe()
      .then((u) => {
        if (!cancelled) {
          setUser(u);
          setAuthState('authed');
        }
      })
      .catch(() => {
        if (!cancelled) setAuthState('anon');
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthRoute, pathname]);

  // Redirect unauthenticated visitors to the login page.
  useEffect(() => {
    if (authState === 'anon' && !isAuthRoute) router.replace('/login');
  }, [authState, isAuthRoute, router]);

  // Load the account only once we know the user is signed in.
  useEffect(() => {
    if (authState === 'authed') refreshAccount();
  }, [authState, refreshAccount]);

  // The login page: render bare, no shell.
  if (isAuthRoute) return <>{children}</>;

  // Session unknown or bouncing to /login: show a lightweight loader.
  if (authState !== 'authed') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-primary-600" />
      </div>
    );
  }

  const value: ShellContextValue = {
    account,
    user,
    refreshAccount,
    openOutreach: () => setOutreachOpen(true),
    openAlerts: () => setAlertsOpen(true),
  };

  return (
    <ShellContext.Provider value={value}>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar onOpenOutreach={() => setOutreachOpen(true)} onOpenAlerts={() => setAlertsOpen(true)} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar
            account={account}
            user={user}
            onOpenChangelog={() => setChangelogOpen(true)}
            onOpenGuide={() => setGuideOpen(true)}
            onTierChange={refreshAccount}
          />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>

      {changelogOpen && <ChangelogModal onClose={() => setChangelogOpen(false)} />}
      {guideOpen && <UserGuideModal onClose={() => setGuideOpen(false)} />}
      <OutreachPanel isOpen={outreachOpen} onClose={() => setOutreachOpen(false)} />
      <AlertsPanel isOpen={alertsOpen} onClose={() => setAlertsOpen(false)} />
    </ShellContext.Provider>
  );
}
