import { clinicalTrialsService } from './clinicalTrialsService.js';
import { toStudyCard } from './studyMapper.js';
import type { SearchParams, Study } from '../types/clinicalTrials.js';
import type { StudyCard } from '../types/studyfinder.js';

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

export interface CompanyDetail extends CompanySummary {
  studies: StudyCard[];
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

export const companyDirectoryService = {
  /**
   * Aggregate a company directory from the registry. We pull a batch of studies
   * (optionally filtered by indication/free text) and roll them up by lead
   * sponsor + collaborators.
   */
  async search(opts: { query?: string; indication?: string; limit?: number }): Promise<CompanySummary[]> {
    const params: SearchParams = {
      sort: 'LastUpdatePostDate',
      sortOrder: 'desc',
      pageSize: 200,
    };
    if (opts.indication) params.condition = opts.indication;
    if (opts.query) params.sponsor = opts.query;
    if (!opts.indication && !opts.query) params.term = ''; // recent studies

    const res = await clinicalTrialsService.searchStudies(params);

    interface Agg {
      name: string;
      class?: string;
      studyCount: number;
      conditions: Map<string, number>;
    }
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
      for (const c of conditions) agg.conditions.set(c, (agg.conditions.get(c) || 0) + 1);
    };

    for (const s of res.studies as Study[]) {
      const sc = s.protocolSection.sponsorCollaboratorsModule;
      const conditions = s.protocolSection.conditionsModule?.conditions || [];
      add(sc?.leadSponsor?.name, sc?.leadSponsor?.class, conditions);
      for (const collab of sc?.collaborators || []) add(collab.name, collab.class, conditions);
    }

    const companies = Array.from(map.values())
      .map((a) => ({
        name: a.name,
        type: typeForClass(a.class),
        class: a.class,
        studyCount: a.studyCount,
        indications: topN(a.conditions, 4),
      }))
      .sort((a, b) => b.studyCount - a.studyCount);

    return companies.slice(0, opts.limit || 60);
  },

  /** Detail for a single company, keyed by sponsor name (queried live). */
  async getCompany(name: string): Promise<CompanyDetail> {
    const res = await clinicalTrialsService.searchStudies({
      sponsor: name,
      sort: 'LastUpdatePostDate',
      sortOrder: 'desc',
      pageSize: 50,
    });

    const conditions = new Map<string, number>();
    const countries = new Set<string>();
    let cls: string | undefined;

    for (const s of res.studies as Study[]) {
      const sc = s.protocolSection.sponsorCollaboratorsModule;
      // Confirm this study's lead sponsor matches (query.spons is fuzzy).
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
