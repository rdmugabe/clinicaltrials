import { db } from '../db/database.js';
import { clinicalTrialsService } from './clinicalTrialsService.js';

// Full-registry sweep to enumerate every lead sponsor (~50k). Lightweight
// fields keep each 1,000-study page small; we page until the registry is done.
const PAGE_SIZE = 1000;
const FIELDS = ['LeadSponsorName', 'LeadSponsorClass'];
const MAX_PAGES = 2000; // safety cap (~2M studies) — the registry is far smaller

export interface SponsorRow {
  name: string;
  class?: string;
  type: string;
  studyCount: number;
}

export interface SponsorSyncStatus {
  status: 'idle' | 'running' | 'done' | 'error';
  scanned: number;
  total: number;
  uniqueCount: number; // sponsors currently in the index
  sweepUnique: number; // distinct sponsors seen in the in-progress/last sweep
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

const CLASS_TYPE: Record<string, string> = {
  INDUSTRY: 'Industry / Biopharma',
  NIH: 'NIH',
  FED: 'Federal',
  OTHER_GOV: 'Government',
  NETWORK: 'Research Network',
  ACADEMIC: 'Academic',
  OTHER: 'Other',
  INDIV: 'Individual',
  UNKNOWN: 'Unknown',
};
const typeForClass = (cls?: string) => (cls && CLASS_TYPE[cls]) || 'Other';

let running = false;

async function fetchPageWithRetry(pageToken: string | undefined, tries = 3): Promise<Awaited<ReturnType<typeof clinicalTrialsService.searchStudies>>> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await clinicalTrialsService.searchStudies({
        sort: 'LastUpdatePostDate',
        sortOrder: 'desc',
        pageSize: PAGE_SIZE,
        pageToken,
        fields: FIELDS,
      });
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

async function runSweep(): Promise<void> {
  const started = new Date().toISOString();
  db.prepare(
    `UPDATE sponsor_sync SET status='running', scanned=0, total=0, unique_count=unique_count, started_at=?, finished_at=NULL, error=NULL WHERE id=1`
  ).run(started);

  const map = new Map<string, { name: string; class?: string; count: number }>();
  let scanned = 0;
  let total = 0;
  let pageToken: string | undefined;
  let pages = 0;

  try {
    do {
      const res = await fetchPageWithRetry(pageToken);
      total = res.totalCount || total;
      for (const s of res.studies) {
        const sp = s.protocolSection?.sponsorCollaboratorsModule?.leadSponsor;
        if (!sp?.name) continue;
        const key = sp.name.toLowerCase();
        const agg = map.get(key);
        if (agg) agg.count += 1;
        else map.set(key, { name: sp.name, class: sp.class, count: 1 });
      }
      scanned += res.studies.length;
      pageToken = res.nextPageToken;
      pages += 1;
      db.prepare('UPDATE sponsor_sync SET scanned=?, total=?, unique_count=? WHERE id=1').run(scanned, total, map.size);
      if (pageToken) await new Promise((r) => setTimeout(r, 120)); // be polite to the registry
    } while (pageToken && pages < MAX_PAGES);

    // Replace the index atomically.
    const now = new Date().toISOString();
    const insert = db.prepare('INSERT INTO sponsors (name_key, name, class, study_count, synced_at) VALUES (?, ?, ?, ?, ?)');
    const write = db.transaction(() => {
      db.prepare('DELETE FROM sponsors').run();
      for (const [key, v] of map) insert.run(key, v.name, v.class || null, v.count, now);
    });
    write();

    db.prepare(`UPDATE sponsor_sync SET status='done', scanned=?, total=?, unique_count=?, finished_at=? WHERE id=1`).run(
      scanned,
      total,
      map.size,
      now
    );
  } catch (err) {
    db.prepare(`UPDATE sponsor_sync SET status='error', error=?, finished_at=? WHERE id=1`).run(
      err instanceof Error ? err.message : 'sweep failed',
      new Date().toISOString()
    );
  } finally {
    running = false;
  }
}

export const sponsorIndexService = {
  /** Kick off a full sweep in the background (no-op if already running). */
  startSync(): SponsorSyncStatus {
    if (!running) {
      running = true;
      // Fire and forget — runs across many CT.gov pages.
      void runSweep();
    }
    return this.status();
  },

  status(): SponsorSyncStatus {
    const r = db.prepare('SELECT * FROM sponsor_sync WHERE id=1').get() as Record<string, unknown>;
    const inIndex = (db.prepare('SELECT COUNT(*) AS n FROM sponsors').get() as { n: number }).n;
    return {
      status: (r.status as SponsorSyncStatus['status']) || 'idle',
      scanned: (r.scanned as number) || 0,
      total: (r.total as number) || 0,
      uniqueCount: inIndex,
      sweepUnique: (r.unique_count as number) || 0,
      startedAt: (r.started_at as string) || undefined,
      finishedAt: (r.finished_at as string) || undefined,
      error: (r.error as string) || undefined,
    };
  },

  /** Paginated, searchable read of the cached sponsor index. */
  list(opts: { query?: string; page?: number; pageSize?: number }): { sponsors: SponsorRow[]; total: number } {
    const page = Math.max(1, opts.page || 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize || 24));
    const q = (opts.query || '').trim();
    const where = q ? 'WHERE name LIKE ?' : '';
    const like = `%${q}%`;
    const total = (
      db.prepare(`SELECT COUNT(*) AS n FROM sponsors ${where}`).get(...(q ? [like] : [])) as { n: number }
    ).n;
    const rows = db
      .prepare(`SELECT name, class, study_count FROM sponsors ${where} ORDER BY study_count DESC, name ASC LIMIT ? OFFSET ?`)
      .all(...(q ? [like] : []), pageSize, (page - 1) * pageSize) as {
      name: string;
      class: string | null;
      study_count: number;
    }[];
    return {
      total,
      sponsors: rows.map((r) => ({
        name: r.name,
        class: r.class || undefined,
        type: typeForClass(r.class || undefined),
        studyCount: r.study_count,
      })),
    };
  },
};
