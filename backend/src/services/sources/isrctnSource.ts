import { toFeedStatus, phaseLabel } from '../studyMapper.js';
import type { StudyCard } from '../../types/studyfinder.js';
import type { StudyPhase, StudyStatus } from '../../types/clinicalTrials.js';
import type { StudySource, SourceSearchInput, SourceSearchResult } from './types.js';

const BASE_URL = 'https://www.isrctn.com/api/query/format/default';
// ISRCTN's query API returns a hard-capped batch and ignores page/offset params,
// so we fetch a single window and don't advertise deeper pagination.
const MAX_PAGE_SIZE = 50;

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
    .trim();
}

/** First inner text of <tag> within a scope, entity-decoded. */
function tag(scope: string, name: string): string | undefined {
  const m = scope.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decodeEntities(m[1]) : undefined;
}

/** All inner texts of a repeated <tag>. */
function tagAll(scope: string, name: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(scope))) out.push(decodeEntities(m[1]));
  return out;
}

/** Map an ISRCTN phase string ("Phase III", "Phase I/II", "Not Specified") to codes. */
function parsePhases(raw?: string): StudyPhase[] {
  if (!raw) return [];
  const s = raw.toLowerCase();
  const phases: StudyPhase[] = [];
  // Order matters: check IV/III/II before I so "III" isn't caught as "I".
  if (/phase\s*iv|phase\s*4/.test(s)) phases.push('PHASE4');
  if (/phase\s*iii|phase\s*3/.test(s)) phases.push('PHASE3');
  if (/phase\s*ii(?!i)|phase\s*2/.test(s)) phases.push('PHASE2');
  if (/phase\s*i(?!i|v)|phase\s*1/.test(s)) phases.push('PHASE1');
  return phases.length ? Array.from(new Set(phases)) : [];
}

/** Derive a registry status from recruitment dates (ISRCTN has no status field). */
function deriveStatus(start?: string, end?: string): StudyStatus {
  const now = Date.now();
  const s = start ? Date.parse(start) : NaN;
  const e = end ? Date.parse(end) : NaN;
  if (!isNaN(s) && now < s) return 'NOT_YET_RECRUITING';
  if (!isNaN(e) && now > e) return 'COMPLETED';
  if (!isNaN(s) && now >= s) return 'RECRUITING';
  return 'UNKNOWN';
}

/** Build ISRCTN query text from the normalized filters (empty ⇒ browse recent). */
function buildQuery(input: SourceSearchInput): string {
  // ISRCTN can't negate, so 'world' is a no-op; 'us' narrows via free-text.
  const regionTerm = input.region === 'us' ? 'United States' : undefined;
  return [input.condition, input.term, input.sponsor, input.country, regionTerm]
    .filter((v): v is string => !!v && v.trim().length > 0)
    .join(' ')
    .trim();
}

function trialToCard(block: string): StudyCard | null {
  const idMatch = block.match(/publicIdentifierCanonical="([^"]+)"/);
  const id = idMatch?.[1];
  if (!id) return null;

  const lastUpdated = block.match(/lastUpdated="([^"]+)"/)?.[1];
  const title = tag(block, 'title') || tag(block, 'scientificTitle') || '(untitled)';
  const phaseRaw = tag(block, 'phase');
  const phases = parsePhases(phaseRaw);
  const start = tag(block, 'recruitmentStart');
  const end = tag(block, 'recruitmentEnd');
  const status = deriveStatus(start, end);
  const enrolRaw = tag(block, 'targetEnrolment');
  const enrollment = enrolRaw && /^\d+$/.test(enrolRaw) ? Number(enrolRaw) : undefined;
  const sponsor = tag(block, 'organisation');

  // Conditions live as <condition><description>…</description></condition>.
  const conditions: string[] = [];
  const condRe = /<condition>([\s\S]*?)<\/condition>/g;
  let cm: RegExpExecArray | null;
  while ((cm = condRe.exec(block))) {
    const desc = tag(cm[1], 'description');
    if (desc) conditions.push(desc);
  }

  return {
    nctId: id, // registry id; ISRCTN ids are globally unique (e.g. ISRCTN34498249)
    title,
    phase: phases.length ? phaseLabel(phases) : phaseRaw || 'N/A',
    phases,
    status,
    feedStatus: toFeedStatus(status),
    enrollment,
    sponsor,
    conditions: Array.from(new Set(conditions)),
    source: 'ISRCTN',
    sourceUrl: `https://www.isrctn.com/${id}`,
    dateAdded: lastUpdated || start || new Date().toISOString(),
    startDate: start,
    lastUpdated,
  };
}

/**
 * ISRCTN — UK-based international registry (BioMed Central). Keyless XML query API.
 * No usable server-side pagination, so we return a single capped batch.
 */
export const isrctnSource: StudySource = {
  id: 'isrctn',
  label: 'ISRCTN',
  hasDetail: false,

  async search(input: SourceSearchInput): Promise<SourceSearchResult> {
    const pageSize = Math.min(input.pageSize || 24, MAX_PAGE_SIZE);
    const url = new URL(BASE_URL);
    url.searchParams.set('q', buildQuery(input));
    url.searchParams.set('pageSize', String(pageSize));

    const res = await fetch(url.toString(), { headers: { Accept: 'application/xml' } });
    if (!res.ok) throw new Error(`ISRCTN API error: ${res.status}`);
    const xml = await res.text();

    const totalCount = Number(xml.match(/totalCount="(\d+)"/)?.[1] || 0);
    const cards: StudyCard[] = [];
    const re = /<fullTrial>([\s\S]*?)<\/fullTrial>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml))) {
      const card = trialToCard(m[1]);
      if (card) cards.push(card);
    }
    return { cards, totalCount };
  },
};
