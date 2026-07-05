'use client';

import { useState } from 'react';
import { setAccountTier } from '@/lib/api';
import type { Account, AccountTier } from '@/types';

interface TopBarProps {
  account: Account | null;
  onOpenChangelog: () => void;
  onOpenGuide: () => void;
  onTierChange: () => void;
}

const TIERS: { value: AccountTier; label: string }[] = [
  { value: 'starter', label: 'Starter' },
  { value: 'growth', label: 'Growth' },
  { value: 'enterprise', label: 'Enterprise' },
];

export default function TopBar({ account, onOpenChangelog, onOpenGuide, onTierChange }: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const used = account?.credits.used ?? 0;
  const total = account?.credits.total ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const low = total > 0 && used / total > 0.85;

  const handleTier = async (tier: AccountTier) => {
    await setAccountTier(tier);
    setMenuOpen(false);
    onTierChange();
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="text-sm text-slate-500">
        <span className="font-medium text-slate-700">StudyFinder</span> &middot; discover, prospect & track
      </div>

      <div className="flex items-center gap-3">
        {/* Credits / usage counter */}
        <div className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 sm:flex">
          <div className="text-xs">
            <div className="font-semibold text-slate-700">
              {used.toLocaleString()} / {total.toLocaleString()}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">Credits</div>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${low ? 'bg-amber-500' : 'bg-primary-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <button
          onClick={onOpenGuide}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          User Guide
        </button>
        <button
          onClick={onOpenChangelog}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          What&apos;s New
        </button>

        {/* Account menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 py-1 pl-1 pr-2 hover:bg-slate-50"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
              {(account?.name || 'U').charAt(0)}
            </div>
            <span className="hidden text-sm font-medium text-slate-700 md:inline">{account?.plan}</span>
            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                <div className="px-3 py-2">
                  <div className="text-sm font-semibold text-slate-900">{account?.name}</div>
                  <div className="text-xs text-slate-500">{account?.plan} plan</div>
                </div>
                <div className="my-1 border-t border-slate-100" />
                <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Switch plan (demo)
                </div>
                {TIERS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => handleTier(t.value)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-slate-50 ${
                      account?.tier === t.value ? 'text-primary-700' : 'text-slate-700'
                    }`}
                  >
                    {t.label}
                    {account?.tier === t.value && (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
