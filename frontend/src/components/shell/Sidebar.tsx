'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href?: string;
  onClick?: () => void;
  icon: string;
  soon?: boolean;
  gated?: boolean;
}

interface SidebarProps {
  onOpenOutreach: () => void;
  onOpenAlerts: () => void;
}

// Minimal inline icon set (Heroicons-style single paths).
const ICONS: Record<string, string> = {
  discover: 'M21 21l-5.2-5.2M17 10a7 7 0 11-14 0 7 7 0 0114 0z',
  scout: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
  contacts: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z',
  building: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h1m-1 4h1m4-4h1m-1 4h1',
  document: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z',
  mail: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  kanban: 'M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v6h-4z',
  bell: 'M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3A6 6 0 006 11v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1',
  check: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  chart: 'M9 19v-6m4 6V5m4 14v-9M5 21h14',
  team: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197',
  spark: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.4 6.6L22 12l-6.6 2.4L13 21l-2.4-6.6L4 12l6.6-2.4L13 3z',
};

function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={ICONS[name] || ''} />
    </svg>
  );
}

export default function Sidebar({ onOpenOutreach, onOpenAlerts }: SidebarProps) {
  const pathname = usePathname();

  const studyFinder: NavItem[] = [
    { label: 'Discover Studies', href: '/discover', icon: 'discover' },
    { label: 'Scouts', href: '/scouts', icon: 'scout' },
    { label: 'Insights', href: '/insights', icon: 'spark' },
    { label: 'Contacts', href: '/contacts', icon: 'contacts' },
    { label: 'Companies', href: '/companies', icon: 'building' },
    { label: 'FQ Filler', icon: 'document', soon: true },
    { label: 'Email Sequences', href: '/sequences', icon: 'mail' },
  ];

  const trialTrack: NavItem[] = [
    { label: 'Study Tracker', href: '/trialtrack', icon: 'kanban' },
    { label: 'Tasks', href: '/tasks', icon: 'check' },
    { label: 'Contacts & Companies', href: '/crm', icon: 'contacts' },
    { label: 'Reports', href: '/reports', icon: 'chart' },
    { label: 'Team', href: '/team', icon: 'team' },
  ];

  const renderItem = (item: NavItem) => {
    const active = item.href ? pathname === item.href : false;
    const base =
      'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors';
    const cls = active
      ? `${base} bg-primary-50 text-primary-700`
      : item.soon
        ? `${base} text-slate-400 cursor-default`
        : `${base} text-slate-600 hover:bg-slate-100 hover:text-slate-900`;

    const inner = (
      <>
        <Icon name={item.icon} className="h-5 w-5 shrink-0" />
        <span className="flex-1">{item.label}</span>
        {item.soon && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 group-hover:bg-slate-200">
            Soon
          </span>
        )}
        {item.gated && !item.soon && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
            Pro
          </span>
        )}
      </>
    );

    if (item.href && !item.soon) {
      return (
        <Link key={item.label} href={item.href} className={cls}>
          {inner}
        </Link>
      );
    }
    return (
      <button key={item.label} onClick={item.onClick} disabled={item.soon} className={`${cls} w-full text-left`}>
        {inner}
      </button>
    );
  };

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white font-bold">
          T
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-slate-900">TrialHub</div>
          <div className="text-[11px] text-slate-400">BD Platform</div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        <div>
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            StudyFinder
          </div>
          <div className="space-y-1">{studyFinder.map(renderItem)}</div>
        </div>

        <div>
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            TrialTrack
          </div>
          <div className="space-y-1">{trialTrack.map(renderItem)}</div>
        </div>

        <div>
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Monitoring
          </div>
          <div className="space-y-1">
            {renderItem({ label: 'Research Alerts', onClick: onOpenAlerts, icon: 'bell' })}
          </div>
        </div>
      </nav>
    </aside>
  );
}
