'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { searchCompanies, getScouts } from '@/lib/api';
import CompanyDetailPanel from '@/components/studyfinder/CompanyDetailPanel';
import type { CompanyDirectoryResult, Scout } from '@/types';

const PAGE_SIZE = 24;

export default function CompaniesPage() {
  const [result, setResult] = useState<CompanyDirectoryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [indication, setIndication] = useState('');
  const [scoutId, setScoutId] = useState('');
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await searchCompanies({
        query: query.trim() || undefined,
        indication: indication.trim() || undefined,
        scoutId: scoutId || undefined,
      });
      setResult(res);
      setPage(1);
    } finally {
      setLoading(false);
    }
  }, [query, indication, scoutId]);

  // Reload on mount and whenever the scout scope changes (text filters use Search).
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoutId]);

  useEffect(() => {
    getScouts()
      .then((d) => setScouts(d.scouts))
      .catch(() => {});
  }, []);

  const companies = result?.companies ?? [];
  const totalPages = Math.max(1, Math.ceil(companies.length / PAGE_SIZE));
  const pageItems = useMemo(
    () => companies.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [companies, page]
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  const inputCls =
    'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Companies</h1>
        <p className="text-sm text-slate-500">
          Sponsors &amp; collaborators aggregated from the studies you&apos;re tracking — pick a scout, an indication, or a
          company name.
        </p>
      </div>

      <form onSubmit={submit} className="mb-3 flex flex-wrap items-center gap-2">
        <select value={scoutId} onChange={(e) => setScoutId(e.target.value)} className={inputCls} title="Scope to a scout's matches">
          <option value="">All recent studies</option>
          {scouts.map((s) => (
            <option key={s.id} value={s.id}>
              Scout: {s.name}
            </option>
          ))}
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Company name" className={`${inputCls} w-48`} />
        <input value={indication} onChange={(e) => setIndication(e.target.value)} placeholder="Indication (e.g. oncology)" className={`${inputCls} w-48`} />
        <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
          Search
        </button>
        {(query || indication) && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIndication('');
              setTimeout(load, 0);
            }}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            Clear
          </button>
        )}
      </form>

      {/* Count + coverage line */}
      {result && !loading && (
        <div className="mb-4 text-sm text-slate-500">
          <span className="font-semibold text-slate-700">{companies.length.toLocaleString()}</span> companies from{' '}
          {result.studiesScanned.toLocaleString()} studies
          {result.truncated && (
            <span className="text-amber-600">
              {' '}
              (top of {result.totalMatched.toLocaleString()} matches — refine by scout or indication to cover more)
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600" />
          <p className="mt-3 text-sm text-slate-500">Aggregating companies…</p>
        </div>
      ) : companies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="text-slate-600">No companies found.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pageItems.map((c) => (
              <button
                key={c.name}
                onClick={() => setSelected(c.name)}
                className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">{c.name}</h3>
                </div>
                <div className="mb-3 flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-primary-50 px-2 py-0.5 font-medium text-primary-700">{c.type}</span>
                  <span className="text-slate-500">{c.studyCount} studies</span>
                </div>
                {c.indications.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {c.indications.slice(0, 3).map((i) => (
                      <span key={i} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{i}</span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3 text-sm">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="text-slate-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {selected && <CompanyDetailPanel name={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
