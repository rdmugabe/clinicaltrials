'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import FeedCard from '@/components/studyfinder/FeedCard';
import StudyDetailPanel from '@/components/studyfinder/StudyDetailPanel';
import SortControl from '@/components/studyfinder/SortControl';
import { sortStudyCards, type SortOrder } from '@/lib/sortStudies';
import {
  getFeed,
  getFeedSources,
  syncFeed,
  bookmarkStudy,
  removeBookmark,
  hideStudy,
  unhideStudy,
  pushToPipeline,
  getScouts,
} from '@/lib/api';
import type {
  FeedTab,
  FeedFilters,
  FeedSource,
  FeedRegion,
  StudySourceMeta,
  StudyCard,
  StudyPhase,
  StudyStatus,
  Scout,
  SortOption,
} from '@/types';

const REGION_OPTIONS: { value: '' | FeedRegion; label: string }[] = [
  { value: '', label: 'Worldwide' },
  { value: 'us', label: 'USA' },
  { value: 'world', label: 'Ex-US' },
];

const TABS: { key: FeedTab; label: string }[] = [
  { key: 'foryou', label: 'For You' },
  { key: 'all', label: 'All Studies' },
  { key: 'bookmarks', label: 'Bookmarks' },
];

// Granular registry statuses for the status filter.
const STATUS_OPTIONS: { value: StudyStatus; label: string }[] = [
  { value: 'RECRUITING', label: 'Recruiting' },
  { value: 'NOT_YET_RECRUITING', label: 'Not yet recruiting' },
  { value: 'ENROLLING_BY_INVITATION', label: 'Enrolling by invitation' },
  { value: 'ACTIVE_NOT_RECRUITING', label: 'Active, not recruiting' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'TERMINATED', label: 'Terminated' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
  { value: 'UNKNOWN', label: 'Unknown status' },
];
const PHASE_OPTIONS: { value: StudyPhase; label: string }[] = [
  { value: 'EARLY_PHASE1', label: 'Early Phase 1' },
  { value: 'PHASE1', label: 'Phase 1' },
  { value: 'PHASE2', label: 'Phase 2' },
  { value: 'PHASE3', label: 'Phase 3' },
  { value: 'PHASE4', label: 'Phase 4' },
  { value: 'NA', label: 'Not applicable' },
];

export default function DiscoverPage() {
  const [tab, setTab] = useState<FeedTab>('foryou');
  const [studies, setStudies] = useState<StudyCard[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Scouts (for the For You scout filter)
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [scoutId, setScoutId] = useState('');

  // Study source (All Studies tab): ctgov | isrctn | ctis | all
  const [source, setSource] = useState<FeedSource>('ctgov');
  const [sources, setSources] = useState<StudySourceMeta[]>([]);

  // Geographic scope (All Studies tab): '' = worldwide | 'us' | 'world' (ex-US)
  const [region, setRegion] = useState<'' | FeedRegion>('');

  // Filters
  const [statuses, setStatuses] = useState<StudyStatus[]>([]);
  const [statusOpen, setStatusOpen] = useState(false);
  const [sponsor, setSponsor] = useState('');
  const [phases, setPhases] = useState<StudyPhase[]>([]);
  const [phaseOpen, setPhaseOpen] = useState(false);
  const [country, setCountry] = useState('');
  const [enrollmentMin, setEnrollmentMin] = useState('');
  const [enrollmentMax, setEnrollmentMax] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [sortField, setSortField] = useState<SortOption>('LastUpdatePostDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const buildFilters = useCallback(
    (pageToken?: string): FeedFilters => ({
      tab,
      source: tab === 'all' ? source : undefined,
      region: tab === 'all' && region ? region : undefined,
      scoutId: tab === 'foryou' && scoutId ? scoutId : undefined,
      statuses: statuses.length ? statuses : undefined,
      sponsor: sponsor.trim() || undefined,
      phases: phases.length ? phases : undefined,
      country: country.trim() || undefined,
      enrollmentMin: enrollmentMin ? Number(enrollmentMin) : undefined,
      enrollmentMax: enrollmentMax ? Number(enrollmentMax) : undefined,
      showHidden,
      sort: sortField,
      sortOrder,
      pageToken,
    }),
    [tab, source, region, scoutId, statuses, sponsor, phases, country, enrollmentMin, enrollmentMax, showHidden, sortField, sortOrder]
  );

  // Client-side sort of the displayed cards (server also sorts registry queries).
  const sortedStudies = useMemo(
    () => sortStudyCards(studies, sortField, sortOrder),
    [studies, sortField, sortOrder]
  );

  const toggleStatus = (value: StudyStatus) =>
    setStatuses((prev) => (prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]));

  const togglePhase = (value: StudyPhase) =>
    setPhases((prev) => (prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getFeed(buildFilters());
      setStudies(res.studies);
      setTotalCount(res.totalCount);
      setNextPageToken(res.nextPageToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed');
      setStudies([]);
    } finally {
      setLoading(false);
    }
  }, [buildFilters]);

  useEffect(() => {
    load();
  }, [load]);

  // Load scouts + available sources once.
  useEffect(() => {
    getScouts()
      .then((d) => setScouts(d.scouts))
      .catch(() => {});
    getFeedSources()
      .then((d) => setSources(d.sources))
      .catch(() => {});
  }, []);

  const loadMore = async () => {
    if (!nextPageToken) return;
    setLoading(true);
    try {
      const res = await getFeed(buildFilters(nextPageToken));
      setStudies((prev) => [...prev, ...res.studies]);
      setNextPageToken(res.nextPageToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncFeed();
      await load();
    } finally {
      setSyncing(false);
    }
  };

  // Optimistic local mutation helper.
  const patchStudy = (nctId: string, patch: Partial<StudyCard>) => {
    setStudies((prev) => prev.map((s) => (s.nctId === nctId ? { ...s, ...patch } : s)));
  };

  const handleBookmark = async (study: StudyCard) => {
    if (study.bookmarked) {
      patchStudy(study.nctId, { bookmarked: false });
      await removeBookmark(study.nctId);
      if (tab === 'bookmarks') setStudies((prev) => prev.filter((s) => s.nctId !== study.nctId));
    } else {
      patchStudy(study.nctId, { bookmarked: true });
      await bookmarkStudy({ ...study, bookmarked: true });
    }
  };

  const handleHide = async (study: StudyCard) => {
    if (study.hidden) {
      patchStudy(study.nctId, { hidden: false });
      await unhideStudy(study.nctId);
    } else {
      patchStudy(study.nctId, { hidden: true });
      await hideStudy(study.nctId);
      if (!showHidden) setStudies((prev) => prev.filter((s) => s.nctId !== study.nctId));
    }
  };

  const handlePush = async (study: StudyCard) => {
    patchStudy(study.nctId, { inPipeline: true });
    await pushToPipeline({
      nctId: study.nctId,
      title: study.title,
      sponsor: study.sponsor,
      indications: study.conditions,
    });
  };

  const inputCls =
    'rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Discover Studies</h1>
        <p className="text-sm text-slate-500">
          Clinical studies aggregated from ClinicalTrials.gov, ISRCTN, and the EU CTIS registry.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex items-center gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Quick filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Source selector — All Studies tab only */}
        {tab === 'all' && sources.length > 0 && (
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as FeedSource)}
            className={inputCls}
            title="Study registry source"
          >
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
            <option value="all">All sources</option>
          </select>
        )}
        {/* Region segmented control — All Studies tab only */}
        {tab === 'all' && (
          <div className="inline-flex rounded-lg border border-slate-300 p-0.5" role="radiogroup" aria-label="Geographic scope">
            {REGION_OPTIONS.map((r) => (
              <button
                key={r.value || 'all'}
                type="button"
                role="radio"
                aria-checked={region === r.value}
                onClick={() => setRegion(r.value)}
                className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                  region === r.value ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
        {/* Scout filter — For You tab only */}
        {tab === 'foryou' && scouts.length > 0 && (
          <select value={scoutId} onChange={(e) => setScoutId(e.target.value)} className={inputCls}>
            <option value="">All scouts</option>
            {scouts.map((s) => (
              <option key={s.id} value={s.id}>
                Scout: {s.name}
              </option>
            ))}
          </select>
        )}
        {/* Granular status multi-select */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setStatusOpen((o) => !o)}
            className={`${inputCls} flex items-center gap-1.5`}
          >
            {statuses.length === 0
              ? 'All statuses'
              : statuses.length === 1
                ? STATUS_OPTIONS.find((s) => s.value === statuses[0])?.label
                : `${statuses.length} statuses`}
            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {statusOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setStatusOpen(false)} />
              <div className="absolute z-20 mt-1 w-60 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Study status</span>
                  {statuses.length > 0 && (
                    <button onClick={() => setStatuses([])} className="text-xs text-primary-600 hover:underline">
                      Clear
                    </button>
                  )}
                </div>
                {STATUS_OPTIONS.map((s) => (
                  <label key={s.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
                    <input type="checkbox" checked={statuses.includes(s.value)} onChange={() => toggleStatus(s.value)} />
                    {s.label}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        {/* Phase multi-select */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setPhaseOpen((o) => !o)}
            className={`${inputCls} flex items-center gap-1.5`}
          >
            {phases.length === 0
              ? 'All phases'
              : phases.length === 1
                ? PHASE_OPTIONS.find((p) => p.value === phases[0])?.label
                : `${phases.length} phases`}
            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {phaseOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setPhaseOpen(false)} />
              <div className="absolute z-20 mt-1 w-52 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Phase</span>
                  {phases.length > 0 && (
                    <button onClick={() => setPhases([])} className="text-xs text-primary-600 hover:underline">
                      Clear
                    </button>
                  )}
                </div>
                {PHASE_OPTIONS.map((p) => (
                  <label key={p.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
                    <input type="checkbox" checked={phases.includes(p.value)} onChange={() => togglePhase(p.value)} />
                    {p.label}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <input
          value={sponsor}
          onChange={(e) => setSponsor(e.target.value)}
          placeholder="Sponsor"
          className={`${inputCls} w-40`}
        />
        <label className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
          Show hidden
        </label>
        <button
          onClick={() => setShowAdvanced((s) => !s)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          {showAdvanced ? 'Hide advanced' : 'Advanced filters'}
        </button>
        <div className="ml-auto">
          <SortControl field={sortField} order={sortOrder} onChange={(f, o) => { setSortField(f); setSortOrder(o); }} />
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <svg className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {syncing ? 'Syncing…' : 'Refresh / Sync'}
        </button>
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Country</label>
            <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. United States" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Min enrollment</label>
            <input type="number" value={enrollmentMin} onChange={(e) => setEnrollmentMin(e.target.value)} className={`${inputCls} w-32`} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Max enrollment</label>
            <input type="number" value={enrollmentMax} onChange={(e) => setEnrollmentMax(e.target.value)} className={`${inputCls} w-32`} />
          </div>
        </div>
      )}

      {/* Result count */}
      <div className="mb-3 text-sm text-slate-500">
        {tab === 'all' && totalCount > 0
          ? `${totalCount.toLocaleString()} studies · showing ${studies.length}`
          : `${studies.length} ${studies.length === 1 ? 'study' : 'studies'}`}
      </div>

      {/* Non-CT.gov source caveat */}
      {tab === 'all' && source !== 'ctgov' && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            {source === 'isrctn'
              ? 'ISRCTN returns a single batch (no deep pagination). '
              : source === 'ctis'
                ? 'EU CTIS results open on the CTIS portal — no in-app detail view. '
                : 'Merged view interleaves all registries by date. '}
            Status, phase, and enrollment filters are applied to the loaded results for these registries (they aren’t filtered server-side), and non-ClinicalTrials.gov cards open in their source registry.
          </span>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Grid */}
      {loading && studies.length === 0 ? (
        <div className="py-20 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600" />
          <p className="mt-3 text-sm text-slate-500">Loading feed…</p>
        </div>
      ) : studies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="text-slate-600">
            {tab === 'bookmarks' ? 'No bookmarked studies yet.' : 'No studies match your filters.'}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {tab === 'bookmarks'
              ? 'Bookmark studies from the feed to see them here.'
              : 'Try adjusting your filters or syncing the feed.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedStudies.map((s) => (
              <FeedCard
                key={s.nctId}
                study={s}
                onSelect={setSelected}
                onBookmark={handleBookmark}
                onHide={handleHide}
                onPush={handlePush}
              />
            ))}
          </div>
          {tab === 'all' && nextPageToken && (
            <div className="mt-6 text-center">
              <button
                onClick={loadMore}
                disabled={loading}
                className="rounded-lg border border-slate-300 bg-white px-6 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}

      {selected && (
        <StudyDetailPanel
          nctId={selected}
          onClose={() => setSelected(null)}
          onPushed={() => patchStudy(selected, { inPipeline: true })}
        />
      )}
    </div>
  );
}
