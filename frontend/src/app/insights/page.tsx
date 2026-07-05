'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { NewsSection, StudySignalList } from '@/components/studyfinder/InsightsPanel';
import { getGlobalInsights } from '@/lib/api';
import type { GlobalInsights } from '@/types';

export default function InsightsPage() {
  const [data, setData] = useState<GlobalInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getGlobalInsights()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load insights'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Insights</h1>
        <p className="text-sm text-slate-500">
          Latest studies, protocol updates, and US news across your scouts — from ClinicalTrials.gov and the web.
        </p>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="py-20 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600" />
          <p className="mt-3 text-sm text-slate-500">Gathering studies &amp; news…</p>
        </div>
      ) : !data ? null : (
        <div className="space-y-6">
          <NewsSection news={data.news} />

          {data.scouts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-500">
              No scouts yet. Create a scout to see tailored insights here.
            </div>
          ) : (
            data.scouts.map((s) => (
              <div key={s.scoutId}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color || '#2563eb' }} />
                  <h2 className="text-sm font-semibold text-slate-900">{s.scoutName}</h2>
                  {s.indication && <span className="text-xs text-slate-400">{s.indication}</span>}
                  <Link href={`/scouts/${s.scoutId}?view=insights`} className="ml-auto text-xs text-primary-600 hover:underline">
                    Open scout insights →
                  </Link>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <StudySignalList title="🆕 Newly posted" cards={s.newStudies} />
                  <StudySignalList title="🔄 Recently updated" cards={s.updatedStudies} />
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
