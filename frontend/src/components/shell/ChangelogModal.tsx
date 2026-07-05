'use client';

import { useEffect, useState } from 'react';
import { getChangelog } from '@/lib/api';
import type { ChangelogEntry } from '@/types';

export default function ChangelogModal({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);

  useEffect(() => {
    getChangelog()
      .then((d) => setEntries(d.changelog))
      .catch(console.error);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">What&apos;s New</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-6 px-6 py-5">
          {entries.map((e) => (
            <div key={e.version}>
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700">
                  v{e.version}
                </span>
                <span className="text-sm font-semibold text-slate-900">{e.title}</span>
                <span className="ml-auto text-xs text-slate-400">{e.date}</span>
              </div>
              <ul className="space-y-1">
                {e.items.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-600">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
