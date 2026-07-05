import { db } from '../db/database.js';
import { clinicalTrialsService } from './clinicalTrialsService.js';
import { toStudyCard } from './studyMapper.js';
import type { SearchParams, StudyPhase, StudyStatus, Study, SortOption } from '../types/clinicalTrials.js';
import type { StudyCard, FeedStatus } from '../types/studyfinder.js';

export interface FeedQuery {
  tab: 'all' | 'foryou' | 'bookmarks';
  scoutId?: string; // For You: restrict to a single scout
  status?: FeedStatus; // coarse bucket (legacy)
  statuses?: StudyStatus[]; // granular registry overallStatus values
  sponsor?: string;
  phase?: StudyPhase; // single phase (legacy)
  phases?: StudyPhase[]; // multi-select phases
  country?: string;
  condition?: string;
  enrollmentMin?: number;
  enrollmentMax?: number;
  showHidden?: boolean;
  sort?: SortOption;
  sortOrder?: 'asc' | 'desc';
  pageToken?: string;
  pageSize?: number;
}

export interface FeedResponse {
  studies: StudyCard[];
  totalCount: number;
  nextPageToken?: string;
}

// Map a feed-level status bucket to the registry's overallStatus values.
const FEED_STATUS_TO_REGISTRY: Record<FeedStatus, StudyStatus[]> = {
  Upcoming: ['NOT_YET_RECRUITING'],
  Active: ['RECRUITING', 'ENROLLING_BY_INVITATION', 'ACTIVE_NOT_RECRUITING'],
  Closed: ['COMPLETED', 'TERMINATED', 'SUSPENDED', 'WITHDRAWN'],
};

function bookmarkedIds(): Set<string> {
  const rows = db.prepare('SELECT nct_id FROM bookmarks').all() as { nct_id: string }[];
  return new Set(rows.map((r) => r.nct_id));
}

function hiddenIds(): Set<string> {
  const rows = db.prepare('SELECT nct_id FROM hidden_studies').all() as { nct_id: string }[];
  return new Set(rows.map((r) => r.nct_id));
}

function pipelineIds(): Set<string> {
  const rows = db
    .prepare('SELECT nct_id FROM pipeline_opportunities WHERE nct_id IS NOT NULL')
    .all() as { nct_id: string }[];
  return new Set(rows.map((r) => r.nct_id));
}

function feedLedger(): Map<string, { source: string; sourceUrl?: string; dateAdded: string }> {
  const rows = db
    .prepare('SELECT nct_id, source, source_url, date_added FROM feed_items')
    .all() as { nct_id: string; source: string; source_url?: string; date_added: string }[];
  const map = new Map<string, { source: string; sourceUrl?: string; dateAdded: string }>();
  for (const r of rows) {
    map.set(r.nct_id, { source: r.source, sourceUrl: r.source_url, dateAdded: r.date_added });
  }
  return map;
}

/** Apply client-side filters the registry API can't express (enrollment range, hidden). */
function applyLocalFilters(cards: StudyCard[], q: FeedQuery, hidden: Set<string>): StudyCard[] {
  return cards.filter((c) => {
    if (!q.showHidden && hidden.has(c.nctId)) return false;
    // Granular status filter takes precedence over the coarse bucket.
    if (q.statuses && q.statuses.length > 0) {
      if (!q.statuses.includes(c.status as StudyStatus)) return false;
    } else if (q.status && c.feedStatus !== q.status) {
      return false;
    }
    if (q.phases && q.phases.length > 0 && !q.phases.some((p) => c.phases.includes(p))) return false;
    if (typeof q.enrollmentMin === 'number' && (c.enrollment ?? 0) < q.enrollmentMin) return false;
    if (typeof q.enrollmentMax === 'number' && (c.enrollment ?? Infinity) > q.enrollmentMax) return false;
    return true;
  });
}

function decorate(cards: StudyCard[]): StudyCard[] {
  const bm = bookmarkedIds();
  const hd = hiddenIds();
  const pl = pipelineIds();
  const ledger = feedLedger();
  return cards.map((c) => {
    const led = ledger.get(c.nctId);
    return {
      ...c,
      source: led?.source || c.source,
      sourceUrl: led?.sourceUrl || c.sourceUrl,
      dateAdded: led?.dateAdded || c.dateAdded,
      bookmarked: bm.has(c.nctId),
      hidden: hd.has(c.nctId),
      inPipeline: pl.has(c.nctId),
    };
  });
}

function buildSearchParams(q: FeedQuery): SearchParams {
  const params: SearchParams = {
    sponsor: q.sponsor,
    condition: q.condition,
    location: q.country,
    sort: q.sort || 'LastUpdatePostDate',
    sortOrder: q.sortOrder || 'desc',
    pageSize: q.pageSize || 24,
    pageToken: q.pageToken,
  };
  if (q.phases && q.phases.length > 0) params.phase = q.phases;
  else if (q.phase) params.phase = [q.phase];
  // Granular statuses win; otherwise fall back to the coarse bucket mapping.
  if (q.statuses && q.statuses.length > 0) {
    params.status = q.statuses;
  } else if (q.status) {
    params.status = FEED_STATUS_TO_REGISTRY[q.status];
  }
  return params;
}

export const feedService = {
  async getFeed(q: FeedQuery): Promise<FeedResponse> {
    if (q.tab === 'bookmarks') {
      const rows = db
        .prepare('SELECT study FROM bookmarks ORDER BY added_at DESC')
        .all() as { study: string | null }[];
      const cards: StudyCard[] = rows
        .map((r) => (r.study ? (JSON.parse(r.study) as StudyCard) : null))
        .filter((c): c is StudyCard => !!c);
      const hd = hiddenIds();
      const filtered = applyLocalFilters(decorate(cards), q, hd);
      return { studies: filtered, totalCount: filtered.length };
    }

    if (q.tab === 'foryou') {
      return this.getForYou(q);
    }

    // 'all' — live registry query.
    const res = await clinicalTrialsService.searchStudies(buildSearchParams(q));
    const cards = res.studies.map((s: Study) => toStudyCard(s));
    const decorated = decorate(cards);
    const hd = hiddenIds();
    const filtered = applyLocalFilters(decorated, q, hd);
    return {
      studies: filtered,
      totalCount: res.totalCount,
      nextPageToken: res.nextPageToken,
    };
  },

  /**
   * "For You" — personalized/curated. Runs each of the user's scouts and merges
   * their most recent matches, tagging the source with the scout name. Falls back
   * to recently updated recruiting studies when no scouts exist yet.
   */
  async getForYou(q: FeedQuery): Promise<FeedResponse> {
    // When a scout is selected, run only that scout (with a deeper page);
    // otherwise aggregate the most recent scouts.
    const scouts = q.scoutId
      ? (db.prepare('SELECT id, name, params FROM scouts WHERE id = ?').all(q.scoutId) as {
          id: string;
          name: string;
          params: string;
        }[])
      : (db.prepare('SELECT id, name, params FROM scouts ORDER BY updated_at DESC LIMIT 6').all() as {
          id: string;
          name: string;
          params: string;
        }[]);
    const perScoutPageSize = q.scoutId ? 30 : 8;

    const seen = new Set<string>();
    const cards: StudyCard[] = [];

    if (scouts.length === 0) {
      const res = await clinicalTrialsService.searchStudies({
        status: ['RECRUITING', 'NOT_YET_RECRUITING'],
        sort: 'LastUpdatePostDate',
        sortOrder: 'desc',
        pageSize: 24,
      });
      for (const s of res.studies) cards.push(toStudyCard(s, { source: 'Curated' }));
    } else {
      for (const scout of scouts) {
        const params = JSON.parse(scout.params) as SearchParams;
        try {
          const res = await clinicalTrialsService.searchStudies({
            ...params,
            sort: 'LastUpdatePostDate',
            sortOrder: 'desc',
            pageSize: perScoutPageSize,
          });
          for (const s of res.studies) {
            const nctId = s.protocolSection.identificationModule.nctId;
            if (seen.has(nctId)) continue;
            seen.add(nctId);
            cards.push(toStudyCard(s, { source: `Scout: ${scout.name}` }));
          }
        } catch (err) {
          console.error(`For You: scout "${scout.name}" failed`, err);
        }
      }
    }

    const decorated = decorate(cards);
    const hd = hiddenIds();
    const filtered = applyLocalFilters(decorated, q, hd);
    // Newest first.
    filtered.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
    return { studies: filtered, totalCount: filtered.length };
  },

  /** Run an arbitrary registry query and return decorated cards + total + next page. */
  async searchCards(params: SearchParams): Promise<FeedResponse> {
    const res = await clinicalTrialsService.searchStudies({
      sort: 'LastUpdatePostDate',
      sortOrder: 'desc',
      pageSize: 24,
      ...params,
    });
    const cards = res.studies.map((s: Study) => toStudyCard(s));
    return { studies: decorate(cards), totalCount: res.totalCount, nextPageToken: res.nextPageToken };
  },

  /** Fetch a specific set of studies by NCT ID (for scout drill-downs), decorated + in input order. */
  async studiesByIds(nctIds: string[]): Promise<StudyCard[]> {
    const studies = await clinicalTrialsService.getStudiesByIds(nctIds);
    const byId = new Map(studies.map((s) => [s.protocolSection.identificationModule.nctId, toStudyCard(s)]));
    const ordered = nctIds.map((id) => byId.get(id)).filter((c): c is StudyCard => !!c);
    return decorate(ordered);
  },

  bookmark(card: StudyCard): void {
    db.prepare(
      `INSERT INTO bookmarks (nct_id, study, added_at)
       VALUES (?, ?, ?)
       ON CONFLICT(nct_id) DO UPDATE SET study = excluded.study`
    ).run(card.nctId, JSON.stringify({ ...card, bookmarked: true }), new Date().toISOString());
  },

  removeBookmark(nctId: string): void {
    db.prepare('DELETE FROM bookmarks WHERE nct_id = ?').run(nctId);
  },

  hide(nctId: string): void {
    db.prepare(
      `INSERT INTO hidden_studies (nct_id, added_at) VALUES (?, ?)
       ON CONFLICT(nct_id) DO NOTHING`
    ).run(nctId, new Date().toISOString());
  },

  unhide(nctId: string): void {
    db.prepare('DELETE FROM hidden_studies WHERE nct_id = ?').run(nctId);
  },

  /**
   * Sync job: pull the most recently updated studies from the registry and
   * record when they entered our feed. Establishes the "date added" ledger.
   */
  async sync(): Promise<{ added: number; total: number }> {
    const res = await clinicalTrialsService.searchStudies({
      sort: 'LastUpdatePostDate',
      sortOrder: 'desc',
      pageSize: 50,
    });
    const now = new Date().toISOString();
    const insert = db.prepare(
      `INSERT INTO feed_items (nct_id, source, source_url, date_added, study)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(nct_id) DO NOTHING`
    );
    let added = 0;
    const tx = db.transaction((studies: Study[]) => {
      for (const s of studies) {
        const card = toStudyCard(s);
        const info = insert.run(card.nctId, 'ClinicalTrials.gov', card.sourceUrl, now, JSON.stringify(card));
        if (info.changes > 0) added++;
      }
    });
    tx(res.studies);
    return { added, total: res.studies.length };
  },
};
