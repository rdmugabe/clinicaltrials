'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  searchCompanies,
  getScouts,
  getAllSponsors,
  startSponsorSync,
  getSponsorSyncStatus,
} from '@/lib/api';
import CompanyDetailPanel from '@/components/studyfinder/CompanyDetailPanel';
import type {
  CompanyDirectoryResult,
  AllSponsorsResult,
  SponsorSyncStatus,
  Scout,
} from '@/types';

const PAGE_SIZE = 24;
type Mode = 'tracked' | 'all';

function CompanyCard({
  name,
  type,
  studyCount,
  indications,
  onClick,
}: {
  name: string;
  type: string;
  studyCount: number;
  indications?: string[];
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <h3 className="mb-2 line-clamp-2 text-sm font-semibold text-slate-900">{name}</h3>
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span className="rounded-full bg-primary-50 px-2 py-0.5 font-medium text-primary-700">{type}</span>
        <span className="text-slate-500">{studyCount.toLocaleString()} studies</span>
      </div>
      {indications && indications.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {indications.slice(0, 3).map((i) => (
            <span key={i} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{i}</span>
          ))}
        </div>
      )}
    </button>
  );
}

export default function CompaniesPage() {
  const [mode, setMode] = useState<Mode>('tracked');
  const [selected, setSelected] = useState<string | null>(null);

  // ---- Tracked scope (scouts / discover) ----
  const [result, setResult] = useState<CompanyDirectoryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [indication, setIndication] = useState('');
  const [scoutId, setScoutId] = useState('');
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [page, setPage] = useState(1);

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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoutId]);

  useEffect(() => {
    getScouts().then((d) => setScouts(d.scouts)).catch(() => {});
  }, []);

  const companies = result?.companies ?? [];
  const trackedPages = Math.max(1, Math.ceil(companies.length / PAGE_SIZE));
  const trackedItems = useMemo(() => companies.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [companies, page]);

  // ---- All ClinicalTrials.gov sponsors (cached index) ----
  const [all, setAll] = useState<AllSponsorsResult | null>(null);
  const [allLoading, setAllLoading] = useState(false);
  const [allQuery, setAllQuery] = useState('');
  const [allPage, setAllPage] = useState(1);
  const [sync, setSync] = useState<SponsorSyncStatus | null>(null);

  const loadAll = useCallback(async () => {
    setAllLoading(true);
    try {
      const res = await getAllSponsors({ query: allQuery.trim() || undefined, page: allPage, pageSize: PAGE_SIZE });
      setAll(res);
      setSync(res.sync);
    } finally {
      setAllLoading(false);
    }
  }, [allQuery, allPage]);

  useEffect(() => {
    if (mode === 'all') loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, allPage]);

  // Poll while the sweep runs.
  useEffect(() => {
    if (mode !== 'all' || sync?.status !== 'running') return;
    const t = setInterval(async () => {
      const st = await getSponsorSyncStatus();
      setSync(st);
      if (st.status === 'done' || st.status === 'error') loadAll();
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sync?.status]);

  const build = async () => {
    const st = await startSponsorSync();
    setSync(st);
  };

  const allTotal = all?.total ?? 0;
  const allPages = Math.max(1, Math.ceil(allTotal / PAGE_SIZE));

  const inputCls =
    'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900">Companies</h1>
        <p className="text-sm text-slate-500">
          Sponsors &amp; collaborators from ClinicalTrials.gov — browse your tracked scope or the entire registry.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="mb-4 inline-flex rounded-lg border border-slate-300 p-0.5">
        {(
          [
            ['tracked', 'Tracked scope'],
            ['all', 'All sponsors'],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === m ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'tracked' ? (
        <>
          <form onSubmit={(e) => { e.preventDefault(); load(); }} className="mb-3 flex flex-wrap items-center gap-2">
            <select value={scoutId} onChange={(e) => setScoutId(e.target.value)} className={inputCls} title="Scope to a scout's matches">
              <option value="">All recent studies</option>
              {scouts.map((s) => (
                <option key={s.id} value={s.id}>Scout: {s.name}</option>
              ))}
            </select>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Company name" className={`${inputCls} w-48`} />
            <input value={indication} onChange={(e) => setIndication(e.target.value)} placeholder="Indication (e.g. oncology)" className={`${inputCls} w-48`} />
            <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">Search</button>
          </form>

          {result && !loading && (
            <div className="mb-4 text-sm text-slate-500">
              <span className="font-semibold text-slate-700">{companies.length.toLocaleString()}</span> companies from{' '}
              {result.studiesScanned.toLocaleString()} studies
              {result.truncated && (
                <span className="text-amber-600"> (top of {result.totalMatched.toLocaleString()} matches — refine to cover more)</span>
              )}
            </div>
          )}

          {loading ? (
            <Spinner label="Aggregating companies…" />
          ) : companies.length === 0 ? (
            <Empty />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {trackedItems.map((c) => (
                  <CompanyCard key={c.name} name={c.name} type={c.type} studyCount={c.studyCount} indications={c.indications} onClick={() => setSelected(c.name)} />
                ))}
              </div>
              <Pager page={page} totalPages={trackedPages} onChange={setPage} />
            </>
          )}
        </>
      ) : (
        <>
          {/* All sponsors */}
          {sync && sync.status !== 'done' && all && all.sponsors.length === 0 ? (
            <BuildIndex sync={sync} onBuild={build} />
          ) : (
            <>
              <form
                onSubmit={(e) => { e.preventDefault(); setAllPage(1); loadAll(); }}
                className="mb-3 flex flex-wrap items-center gap-2"
              >
                <input value={allQuery} onChange={(e) => setAllQuery(e.target.value)} placeholder="Search sponsors" className={`${inputCls} w-64`} />
                <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">Search</button>
                <button type="button" onClick={build} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                  {sync?.status === 'running' ? 'Rebuilding…' : 'Rebuild index'}
                </button>
                <span className="ml-auto text-sm text-slate-400">{allTotal.toLocaleString()} sponsors</span>
              </form>

              {sync?.status === 'running' && (
                <div className="mb-4 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  Rebuilding the full index… scanned {sync.scanned.toLocaleString()} of {sync.total.toLocaleString()} studies ·{' '}
                  {sync.sweepUnique.toLocaleString()} sponsors so far.
                </div>
              )}

              {allLoading && !all ? (
                <Spinner label="Loading sponsors…" />
              ) : allTotal === 0 ? (
                <Empty />
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {all?.sponsors.map((s) => (
                      <CompanyCard key={s.name} name={s.name} type={s.type} studyCount={s.studyCount} onClick={() => setSelected(s.name)} />
                    ))}
                  </div>
                  <Pager page={allPage} totalPages={allPages} onChange={setAllPage} />
                </>
              )}
            </>
          )}
        </>
      )}

      {selected && <CompanyDetailPanel name={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="py-16 text-center">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600" />
      <p className="mt-3 text-sm text-slate-500">{label}</p>
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
      <p className="text-slate-600">No companies found.</p>
    </div>
  );
}

function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-6 flex items-center justify-center gap-3 text-sm">
      <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1} className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40">← Prev</button>
      <span className="text-slate-500">Page {page} of {totalPages.toLocaleString()}</span>
      <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40">Next →</button>
    </div>
  );
}

function BuildIndex({ sync, onBuild }: { sync: SponsorSyncStatus; onBuild: () => void }) {
  const running = sync.status === 'running';
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
      <p className="text-slate-700">The full ClinicalTrials.gov sponsor index isn&apos;t built yet.</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">
        This scans the entire registry once (~50,000 sponsors) and caches it so you can browse and search every sponsor.
        It runs in the background and takes a few minutes.
      </p>
      {running && (
        <div className="mt-4 text-sm text-blue-600">
          Building… scanned {sync.scanned.toLocaleString()} of {sync.total.toLocaleString()} studies ·{' '}
          {sync.sweepUnique.toLocaleString()} sponsors so far.
        </div>
      )}
      <button onClick={onBuild} className="mt-4 block mx-auto rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700">
        {running ? 'Restart build' : 'Build full sponsor index'}
      </button>
      {sync.status === 'error' && <p className="mt-2 text-xs text-red-600">Last build failed: {sync.error}</p>}
    </div>
  );
}
