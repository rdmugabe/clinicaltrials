import { toFeedStatus, phaseLabel } from '../studyMapper.js';
import type { StudyCard } from '../../types/studyfinder.js';
import type { StudyPhase, StudyStatus } from '../../types/clinicalTrials.js';
import type { StudySource, SourceSearchInput, SourceSearchResult } from './types.js';

const SEARCH_URL = 'https://euclinicaltrials.eu/ctis-public-api/search';

interface CtisRow {
  ctNumber?: string;
  ctStatus?: number;
  ctTitle?: string;
  shortTitle?: string;
  conditions?: string;
  trialCountries?: string[];
  decisionDateOverall?: string;
  sponsor?: string;
  sponsorType?: string;
  trialPhase?: string;
}

/**
 * CTIS exposes a numeric ctStatus. The public portal's labels aren't published
 * as a stable enum, so this maps the common values onto the nearest CT.gov
 * status for consistent feed bucketing; unknowns fall back to a neutral active.
 */
function mapStatus(code?: number): StudyStatus {
  switch (code) {
    case 1:
      return 'NOT_YET_RECRUITING'; // under evaluation / not authorised yet
    case 2:
      return 'ACTIVE_NOT_RECRUITING'; // authorised
    case 3:
      return 'RECRUITING'; // ongoing
    case 4:
      return 'SUSPENDED';
    case 5:
      return 'COMPLETED'; // ended
    case 6:
      return 'TERMINATED';
    default:
      return 'ACTIVE_NOT_RECRUITING';
  }
}

/** Extract phase codes from CTIS phase strings like "Human Pharmacology (Phase I)-…". */
function parsePhases(raw?: string): StudyPhase[] {
  if (!raw) return [];
  const s = raw.toLowerCase();
  const phases: StudyPhase[] = [];
  if (/phase\s*iv|phase\s*4/.test(s)) phases.push('PHASE4');
  if (/phase\s*iii|phase\s*3/.test(s)) phases.push('PHASE3');
  if (/phase\s*ii(?!i)|phase\s*2/.test(s)) phases.push('PHASE2');
  if (/phase\s*i(?!i|v)|phase\s*1/.test(s)) phases.push('PHASE1');
  return phases.length ? Array.from(new Set(phases)) : [];
}

/** CTIS dates are dd/mm/yyyy; convert to ISO for consistent sorting. */
function toIso(ddmmyyyy?: string): string | undefined {
  if (!ddmmyyyy) return undefined;
  const m = ddmmyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return undefined;
  return `${m[3]}-${m[2]}-${m[1]}T00:00:00.000Z`;
}

function rowToCard(r: CtisRow): StudyCard | null {
  const id = r.ctNumber;
  if (!id) return null;
  const phases = parsePhases(r.trialPhase);
  const status = mapStatus(r.ctStatus);
  const decided = toIso(r.decisionDateOverall);

  // `conditions` is a single free-text string; drop the boilerplate placeholders.
  const cond = (r.conditions || '').trim();
  const conditions = cond && !/^not applicable/i.test(cond) ? [cond] : [];

  const countries = (r.trialCountries || [])
    .map((c) => c.split(':')[0].trim())
    .filter(Boolean);

  return {
    nctId: id, // CTIS ct number, e.g. 2026-526840-10-00 (globally unique)
    title: r.ctTitle || r.shortTitle || '(untitled)',
    phase: phases.length ? phaseLabel(phases) : r.trialPhase || 'N/A',
    phases,
    status,
    feedStatus: toFeedStatus(status),
    enrollment: undefined, // not present in the CTIS search payload
    sponsor: r.sponsor,
    sponsorType: r.sponsorType,
    conditions: conditions.length ? conditions : countries.length ? [`EU: ${countries.join(', ')}`] : [],
    source: 'EU CTIS',
    sourceUrl: `https://euclinicaltrials.eu/ctis-public/view/${id}`,
    dateAdded: decided || new Date().toISOString(),
    startDate: decided,
    lastUpdated: decided,
  };
}

/** Build the CTIS free-text search term from the normalized filters. */
function buildTerm(input: SourceSearchInput): string {
  return [input.condition, input.term, input.sponsor]
    .filter((v): v is string => !!v && v.trim().length > 0)
    .join(' ')
    .trim();
}

/**
 * EU CTIS — the EU/EEA Clinical Trials Information System public API. Keyless
 * JSON search with true page-based pagination.
 */
export const ctisSource: StudySource = {
  id: 'ctis',
  label: 'EU CTIS',
  hasDetail: false,

  async search(input: SourceSearchInput): Promise<SourceSearchResult> {
    // CTIS covers EU/EEA trials only — there are no US-based studies here, so a
    // US region filter yields nothing rather than misleading EU results.
    if (input.region === 'us') return { cards: [], totalCount: 0 };

    const size = input.pageSize || 24;
    const page = input.cursor ? Number(input.cursor) : 1;
    const term = buildTerm(input);

    const res = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        pagination: { page, size },
        sort: { property: 'decisionDate', direction: 'DESC' },
        searchCriteria: term ? { containAll: term } : {},
      }),
    });
    if (!res.ok) throw new Error(`CTIS API error: ${res.status}`);
    const data = (await res.json()) as {
      pagination?: { totalRecords?: number; totalPages?: number; nextPage?: boolean };
      data?: CtisRow[];
    };

    const cards = (data.data || [])
      .map(rowToCard)
      .filter((c): c is StudyCard => !!c);
    const totalCount = data.pagination?.totalRecords || 0;
    const nextCursor = data.pagination?.nextPage ? String(page + 1) : undefined;
    return { cards, totalCount, nextCursor };
  },
};
