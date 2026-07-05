'use client';

import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ChangelogModal from './ChangelogModal';
import UserGuideModal from './UserGuideModal';
import OutreachPanel from '@/components/OutreachPanel';
import AlertsPanel from '@/components/AlertsPanel';
import { getAccount } from '@/lib/api';
import type { Account } from '@/types';

interface ShellContextValue {
  account: Account | null;
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
  const [account, setAccount] = useState<Account | null>(null);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const refreshAccount = useCallback(() => {
    getAccount().then(setAccount).catch(console.error);
  }, []);

  useEffect(() => {
    refreshAccount();
  }, [refreshAccount]);

  const value: ShellContextValue = {
    account,
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
