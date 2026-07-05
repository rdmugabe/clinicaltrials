'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import FeedCard from '@/components/studyfinder/FeedCard';
import StudyDetailPanel from '@/components/studyfinder/StudyDetailPanel';
import MultiSelectFilter from '@/components/studyfinder/MultiSelectFilter';
import SortControl from '@/components/studyfinder/SortControl';
import InsightsPanel from '@/components/studyfinder/InsightsPanel';
import { sortStudyCards, type SortOrder } from '@/lib/sortStudies';
import {
  getScout,
  getWeeklyReports,
  getStudiesByIds,
  getScoutStudies,
  getScoutInsights,
  bookmarkStudy,
  removeBookmark,
  hideStudy,
  unhideStudy,
  pushToPipeline,
} from '@/lib/api';
import type { Scout, WeeklyReport, StudyCard, StudyStatus, StudyPhase, SortOption, FeedRegion, Insights } from '@/types';

const REGION_OPTIONS: { value: 'all' | FeedRegion; label: string }[] = [
  { value: 'all', label: 'Worldwide' },
  { value: 'us', label: 'USA' },
  { value: 'world', label: 'Ex-US' },
];

/** Default the region toggle from the scout's saved scope (region, else a US-only location). */
function inferRegion(s: Scout): 'all' | FeedRegion {
  if (s.criteria?.region) return s.criteria.region;
  const locs = s.criteria?.locations ?? [];
  if (locs.length === 1 && /^(united states|usa|u\.?s\.?a?\.?)$/i.test(locs[0].trim())) return 'us';
  return 'all';
}

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
  { value: 'NA', label: 'N/A' },
];

function ScoutTrackedInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const scoutId = params.id as string;

  const [scout, setScout] = useState<Scout | null>(null);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  // View mode: 'live' (all matching, paginated) | 'tracked' (seen set) | a report id.
  const viewParam = searchParams.get('view');
  const initialMode =
    searchParams.get('report') ||
    (viewParam === 'tracked' ? 'tracked' : viewParam === 'insights' ? 'insights' : 'live');
  const [reportId, setReportId] = useState<string>(initialMode);
  const [studies, setStudies] = useState<StudyCard[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  // Filters + sort
  const [query, setQuery] = useState('');
  const [statuses, setStatuses] = useState<StudyStatus[]>([]);
  const [phases, setPhases] = useState<StudyPhase[]>([]);
  const [sortField, setSortField] = useState<SortOption>('LastUpdatePostDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  // Region view override (live mode): 'all' | 'us' | 'world'. Defaults to the
  // scout's own saved region once it loads.
  const [region, setRegion] = useState<'all' | FeedRegion>('all');

  useEffect(() => {
    Promise.all([getScout(scoutId), getWeeklyReports(scoutId)])
      .then(([s, r]) => {
        setScout(s);
        setReports(r.reports);
        // Seed the region view from the scout's saved geographic scope.
        setRegion(inferRegion(s));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load scout'));
  }, [scoutId]);

  const nctIds = useMemo(() => {
    if (reportId === 'live') return [];
    if (reportId === 'tracked') return scout?.seenNctIds || [];
    return reports.find((r) => r.id === reportId)?.nctIds || [];
  }, [reportId, scout, reports]);

  useEffect(() => {
    if (!scout) return;
    setLoading(true);
    setError(null);
    setNextPageToken(undefined);
    if (reportId === 'insights') {
      getScoutInsights(scoutId)
        .then((d) => setInsights(d))
        .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load insights'))
        .finally(() => setLoading(false));
    } else if (reportId === 'live') {
      getScoutStudies(scoutId, { sort: sortField, sortOrder, region })
        .then((d) => {
          setStudies(d.studies);
          setTotalCount(d.totalCount);
          setNextPageToken(d.nextPageToken);
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load studies'))
        .finally(() => setLoading(false));
    } else {
      getStudiesByIds(nctIds)
        .then((d) => {
          setStudies(d.studies);
          setTotalCount(d.studies.length);
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load studies'))
        .finally(() => setLoading(false));
    }
    // In live mode the server sorts globally so pagination stays consistent.
  }, [reportId, nctIds, scout, scoutId, sortField, sortOrder, region]);

  const loadMore = async () => {
    if (!nextPageToken) return;
    setLoadingMore(true);
    try {
      const d = await getScoutStudies(scoutId, { pageToken: nextPageToken, sort: sortField, sortOrder, region });
      setStudies((prev) => [...prev, ...d.studies]);
      setNextPageToken(d.nextPageToken);
    } finally {
      setLoadingMore(false);
    }
  };

  const filtered = useMemo(() => {
    return studies.filter((s) => {
      if (statuses.length > 0 && !statuses.includes(s.status)) return false;
      if (phases.length > 0 && !phases.some((p) => s.phases.includes(p))) return false;
      if (query) {
        const q = query.toLowerCase();
        const hay = [s.title, s.nctId, s.sponsor, ...s.conditions].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [studies, statuses, phases, query]);

  const sortedFiltered = useMemo(
    () => sortStudyCards(filtered, sortField, sortOrder),
    [filtered, sortField, sortOrder]
  );

  const patch = useCallback(
    (id: string, p: Partial<StudyCard>) => setStudies((prev) => prev.map((s) => (s.nctId === id ? { ...s, ...p } : s))),
    []
  );

  const handleBookmark = async (study: StudyCard) => {
    if (study.bookmarked) {
      patch(study.nctId, { bookmarked: false });
      await removeBookmark(study.nctId);
    } else {
      patch(study.nctId, { bookmarked: true });
      await bookmarkStudy({ ...study, bookmarked: true });
    }
  };
  const handleHide = async (study: StudyCard) => {
    patch(study.nctId, { hidden: !study.hidden });
    study.hidden ? await unhideStudy(study.nctId) : await hideStudy(study.nctId);
  };
  const handlePush = async (study: StudyCard) => {
    patch(study.nctId, { inPipeline: true });
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
      {/* Header */}
      <Link href="/scouts" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Scouts
      </Link>

      <div className="mb-5 flex items-center gap-2">
        {scout && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: scout.color || '#2563eb' }} />}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{scout ? `Tracked by ${scout.name}` : 'Tracked studies'}</h1>
          <p className="text-sm text-slate-500">
            {scout?.indication ? `${scout.indication} · ` : ''}
            {reportId === 'live'
              ? 'All studies matching this Scout, live from ClinicalTrials.gov'
              : reportId === 'tracked'
                ? "Studies captured in this Scout's tracked set"
                : reportId === 'insights'
                  ? 'Latest studies, updates & US news for this Scout'
                  : 'New studies in the selected report'}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={reportId} onChange={(e) => setReportId(e.target.value)} className={inputCls}>
          <option value="live">
            All matching studies{scout?.matchTotal != null ? ` (${scout.matchTotal.toLocaleString()})` : ''}
          </option>
          <option value="tracked">Tracked set ({scout?.seenNctIds.length ?? 0})</option>
          <option value="insights">✨ Insights &amp; news</option>
          {reports.map((r) => (
            <option key={r.id} value={r.id}>
              Week of {r.weekOf} ({r.studyCount})
            </option>
          ))}
        </select>
        {reportId === 'live' && (
          <div className="inline-flex rounded-lg border border-slate-300 p-0.5" role="radiogroup" aria-label="Geographic scope">
            {REGION_OPTIONS.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={region === r.value}
                onClick={() => setRegion(r.value)}
                className={`rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${
                  region === r.value ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
        {reportId !== 'insights' && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, NCT, sponsor, condition"
          className={`${inputCls} w-64`}
        />
        )}
        {reportId !== 'insights' && (
        <>
        <MultiSelectFilter
          allLabel="All statuses"
          countNoun="statuses"
          heading="Study status"
          options={STATUS_OPTIONS}
          selected={statuses}
          onChange={(next) => setStatuses(next as StudyStatus[])}
          width="w-60"
        />
        <MultiSelectFilter
          allLabel="All phases"
          countNoun="phases"
          heading="Phase"
          options={PHASE_OPTIONS}
          selected={phases}
          onChange={(next) => setPhases(next as StudyPhase[])}
          width="w-52"
        />
        {(query || statuses.length > 0 || phases.length > 0) && (
          <button
            onClick={() => {
              setQuery('');
              setStatuses([]);
              setPhases([]);
            }}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            Clear
          </button>
        )}
        <div className="ml-auto flex items-center gap-3">
          <SortControl field={sortField} order={sortOrder} onChange={(f, o) => { setSortField(f); setSortOrder(o); }} />
          <span className="text-sm text-slate-400">
            {reportId === 'live'
              ? `${filtered.length} shown${totalCount ? ` · ${totalCount.toLocaleString()} matching` : ''}`
              : `${filtered.length} of ${studies.length}`}
          </span>
        </div>
        </>
        )}
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {reportId === 'insights' ? (
        loading ? (
          <div className="py-20 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600" />
            <p className="mt-3 text-sm text-slate-500">Gathering studies &amp; news…</p>
          </div>
        ) : insights ? (
          <InsightsPanel news={insights.news} newStudies={insights.newStudies} updatedStudies={insights.updatedStudies} />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-500">
            No insights available.
          </div>
        )
      ) : loading ? (
        <div className="py-20 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600" />
          <p className="mt-3 text-sm text-slate-500">Loading studies…</p>
        </div>
      ) : studies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-500">
          {reportId === 'live'
            ? 'No matching studies found for this Scout.'
            : 'No tracked studies yet. Generate a report for this Scout to populate its tracked set.'}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-500">
          No studies match your filters.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedFiltered.map((s) => (
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
          {reportId === 'live' && nextPageToken && (
            <div className="mt-6 text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-lg border border-slate-300 bg-white px-6 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}

      {selected && <StudyDetailPanel nctId={selected} onClose={() => setSelected(null)} onPushed={() => patch(selected, { inPipeline: true })} />}
    </div>
  );
}

export default function ScoutTrackedPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading…</div>}>
      <ScoutTrackedInner />
    </Suspense>
  );
}
