import { clinicalTrialsService } from './clinicalTrialsService.js';
import { scoutService } from './scoutService.js';
import { toStudyCard } from './studyMapper.js';
import type { SearchParams, Study } from '../types/clinicalTrials.js';
import type { StudyCard } from '../types/studyfinder.js';

// Sweep depth for the directory aggregation. Sponsor-only fields keep each
// 1,000-study page tiny (~250 KB), so a few pages cover a lot of companies.
const SWEEP_PAGE_SIZE = 1000;
const MAX_SWEEP_STUDIES = 5000;
const SWEEP_FIELDS = ['LeadSponsorName', 'LeadSponsorClass', 'CollaboratorName', 'CollaboratorClass', 'Condition'];

// Map a ClinicalTrials.gov sponsor "class" to a human company type.
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

function typeForClass(cls?: string): string {
  return (cls && CLASS_TYPE[cls]) || 'Other';
}

export interface CompanySummary {
  name: string;
  type: string;
  class?: string;
  studyCount: number;
  indications: string[];
}

export interface CompanyDirectoryResult {
  companies: CompanySummary[];
  /** How many studies were scanned to build this directory. */
  studiesScanned: number;
  /** Total studies matching the query (may exceed studiesScanned). */
  totalMatched: number;
  /** True when there were more matching studies than we scanned. */
  truncated: boolean;
}

export interface CompanyDetail extends CompanySummary {
  studies: StudyCard[];
  nextPageToken?: string;
  countries: string[];
  // Firmographics the public registry does not provide — populated only when an
  // enrichment provider is configured; otherwise null so the UI is honest.
  firmographics: {
    description: string | null;
    hq: string | null;
    website: string | null;
    employees: string | null;
    founded: string | null;
  };
}

function topN<T>(counts: Map<T, number>, n: number): T[] {
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

interface Agg {
  name: string;
  class?: string;
  studyCount: number;
  conditions: Map<string, number>;
}

export const companyDirectoryService = {
  /**
   * Build a company directory by sweeping the studies matching a query (a scout's
   * criteria, an indication, and/or a sponsor name) and rolling them up by lead
   * sponsor + collaborators. Returns the FULL deduped list (paginated by the UI).
   */
  async search(opts: {
    query?: string;
    indication?: string;
    scoutId?: string;
  }): Promise<CompanyDirectoryResult> {
    // Base scope: a scout's own criteria, then optional indication / company refinements.
    let base: SearchParams = {};
    if (opts.scoutId) {
      const scout = scoutService.get(opts.scoutId);
      if (scout) base = { ...scout.params };
    }
    if (opts.indication) base.condition = opts.indication;
    if (opts.query) base.sponsor = opts.query;

    const map = new Map<string, Agg>();
    const add = (name?: string, cls?: string, conditions: string[] = []) => {
      if (!name) return;
      const key = name.toLowerCase();
      let agg = map.get(key);
      if (!agg) {
        agg = { name, class: cls, studyCount: 0, conditions: new Map() };
        map.set(key, agg);
      }
      agg.studyCount += 1;
      if (!agg.class && cls) agg.class = cls;
      for (const c of conditions) agg.conditions.set(c, (agg.conditions.get(c) || 0) + 1);
    };

    let scanned = 0;
    let totalMatched = 0;
    let pageToken: string | undefined;
    do {
      const res = await clinicalTrialsService.searchStudies({
        ...base,
        sort: 'LastUpdatePostDate',
        sortOrder: 'desc',
        pageSize: SWEEP_PAGE_SIZE,
        pageToken,
        fields: SWEEP_FIELDS,
      });
      totalMatched = res.totalCount || totalMatched;
      for (const s of res.studies as Study[]) {
        const sc = s.protocolSection.sponsorCollaboratorsModule;
        const conditions = s.protocolSection.conditionsModule?.conditions || [];
        add(sc?.leadSponsor?.name, sc?.leadSponsor?.class, conditions);
        for (const collab of sc?.collaborators || []) add(collab.name, collab.class, conditions);
      }
      scanned += res.studies.length;
      pageToken = res.nextPageToken;
    } while (pageToken && scanned < MAX_SWEEP_STUDIES);

    const companies = Array.from(map.values())
      .map((a) => ({
        name: a.name,
        type: typeForClass(a.class),
        class: a.class,
        studyCount: a.studyCount,
        indications: topN(a.conditions, 4),
      }))
      .sort((a, b) => b.studyCount - a.studyCount);

    return { companies, studiesScanned: scanned, totalMatched, truncated: scanned < totalMatched };
  },

  /** Detail for a single company, keyed by sponsor name (queried live, paginated). */
  async getCompany(name: string, pageToken?: string): Promise<CompanyDetail> {
    const res = await clinicalTrialsService.searchStudies({
      sponsor: name,
      sort: 'LastUpdatePostDate',
      sortOrder: 'desc',
      pageSize: 24,
      pageToken,
    });

    const conditions = new Map<string, number>();
    const countries = new Set<string>();
    let cls: string | undefined;

    for (const s of res.studies as Study[]) {
      const sc = s.protocolSection.sponsorCollaboratorsModule;
      if (sc?.leadSponsor?.name?.toLowerCase() === name.toLowerCase()) {
        cls = cls || sc.leadSponsor.class;
      }
      for (const c of s.protocolSection.conditionsModule?.conditions || [])
        conditions.set(c, (conditions.get(c) || 0) + 1);
      for (const loc of s.protocolSection.contactsLocationsModule?.locations || [])
        if (loc.country) countries.add(loc.country);
    }

    return {
      name,
      type: typeForClass(cls),
      class: cls,
      studyCount: res.totalCount || res.studies.length,
      indications: topN(conditions, 8),
      studies: (res.studies as Study[]).map((s) => toStudyCard(s)),
      nextPageToken: res.nextPageToken,
      countries: Array.from(countries).sort(),
      firmographics: {
        description: null,
        hq: null,
        website: null,
        employees: null,
        founded: null,
      },
    };
  },
};
