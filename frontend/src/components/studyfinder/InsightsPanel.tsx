'use client';

import type { StudyCard, WebNewsResult } from '@/types';

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_STYLES: Record<string, string> = {
  Upcoming: 'bg-amber-100 text-amber-700',
  Active: 'bg-emerald-100 text-emerald-700',
  Closed: 'bg-slate-100 text-slate-500',
};

/** AI web-search US news block; renders a graceful CTA when unconfigured. */
export function NewsSection({ news }: { news: WebNewsResult }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-900">📰 US news &amp; insights</span>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
          AI web search
        </span>
      </div>

      {!news.enabled ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          {news.reason || 'AI news is not enabled.'}
        </div>
      ) : (
        <>
          {news.summary && <p className="mb-3 text-sm leading-relaxed text-slate-600">{news.summary}</p>}
          {news.items && news.items.length > 0 ? (
            <ul className="space-y-2">
              {news.items.map((n, i) => (
                <li key={i} className="rounded-lg border border-slate-100 p-3 hover:bg-slate-50">
                  <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary-700 hover:underline">
                    {n.title}
                  </a>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
                    {n.source && <span>{n.source}</span>}
                    {n.date && <span>· {n.date}</span>}
                  </div>
                  {n.insight && <p className="mt-1 text-xs text-slate-600">{n.insight}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">No recent news found for this topic.</p>
          )}
        </>
      )}
    </div>
  );
}

/** Compact list of studies (a "signal" list — new or recently updated). */
export function StudySignalList({ title, hint, cards }: { title: string; hint?: string; cards: StudyCard[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2">
        <span className="text-sm font-semibold text-slate-900">{title}</span>
        {hint && <span className="ml-2 text-xs text-slate-400">{hint}</span>}
      </div>
      {cards.length === 0 ? (
        <p className="text-sm text-slate-400">No studies found.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {cards.map((s) => (
            <li key={s.nctId} className="py-2">
              <a
                href={s.sourceUrl || `https://clinicaltrials.gov/study/${s.nctId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-slate-800 hover:text-primary-700 hover:underline"
              >
                {s.title}
              </a>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                {s.phase !== 'N/A' && (
                  <span className="rounded bg-primary-50 px-1.5 py-0.5 font-medium text-primary-700">{s.phase}</span>
                )}
                <span className={`rounded-full px-1.5 py-0.5 font-semibold ${STATUS_STYLES[s.feedStatus] || 'bg-slate-100 text-slate-500'}`}>
                  {s.feedStatus}
                </span>
                <span className="font-mono">{s.nctId}</span>
                {s.sponsor && <span>· {s.sponsor}</span>}
                {(s.lastUpdated || s.startDate) && <span>· {formatDate(s.lastUpdated || s.startDate)}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Full insights panel for a single scope: news + new studies + updated studies. */
export default function InsightsPanel({
  news,
  newStudies,
  updatedStudies,
}: {
  news: WebNewsResult;
  newStudies: StudyCard[];
  updatedStudies: StudyCard[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <NewsSection news={news} />
      </div>
      <StudySignalList title="🆕 Newly posted studies" hint="most recent first-post dates" cards={newStudies} />
      <StudySignalList title="🔄 Recently updated" hint="latest protocol / status changes" cards={updatedStudies} />
    </div>
  );
}
