import type {
  SearchParams,
  SearchResponse,
  Study,
} from '../types/clinicalTrials.js';

const BASE_URL = 'https://clinicaltrials.gov/api/v2';

export class ClinicalTrialsService {
  private buildSearchUrl(params: SearchParams): string {
    const url = new URL(`${BASE_URL}/studies`);

    // Add query parameters
    if (params.condition) {
      url.searchParams.set('query.cond', params.condition);
    }
    if (params.intervention) {
      url.searchParams.set('query.intr', params.intervention);
    }
    if (params.location) {
      url.searchParams.set('query.locn', params.location);
    }
    if (params.sponsor) {
      url.searchParams.set('query.spons', params.sponsor);
    }
    if (params.term) {
      url.searchParams.set('query.term', params.term);
    }

    // Add filters
    if (params.status && params.status.length > 0) {
      url.searchParams.set('filter.overallStatus', params.status.join(','));
    }

    // Advanced Essie expression (used for geo region filtering, e.g.
    // AREA[LocationCountry]United States, or its NOT form for ex-US).
    if (params.advanced) {
      url.searchParams.set('filter.advanced', params.advanced);
    }

    // Phase filter uses aggFilters. Multiple phases must be space-separated
    // VALUES within a single `phase` facet (OR). Using comma-separated
    // `phase:2,phase:3,...` creates separate facets and only the last applies.
    if (params.phase && params.phase.length > 0) {
      const phaseMap: Record<string, string> = {
        'EARLY_PHASE1': 'e1',
        'PHASE1': '1',
        'PHASE2': '2',
        'PHASE3': '3',
        'PHASE4': '4',
        'NA': 'na',
      };
      const values = params.phase.map((p) => phaseMap[p] || p.toLowerCase());
      url.searchParams.set('aggFilters', `phase:${values.join(' ')}`);
    }

    // Add sorting
    if (params.sort) {
      const sortValue = params.sortOrder === 'asc'
        ? `${params.sort}:asc`
        : `${params.sort}:desc`;
      url.searchParams.set('sort', sortValue);
    }

    // Add pagination
    if (params.pageSize) {
      url.searchParams.set('pageSize', String(Math.min(params.pageSize, 1000)));
    } else {
      url.searchParams.set('pageSize', '20');
    }
    if (params.pageToken) {
      url.searchParams.set('pageToken', params.pageToken);
    }

    // Always request JSON format
    url.searchParams.set('format', 'json');
    // v2 only returns totalCount when explicitly asked.
    url.searchParams.set('countTotal', 'true');

    return url.toString();
  }

  async searchStudies(params: SearchParams): Promise<SearchResponse> {
    const url = this.buildSearchUrl(params);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ClinicalTrials.gov API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as {
      studies?: Study[];
      totalCount?: number;
      nextPageToken?: string;
    };

    return {
      studies: data.studies || [],
      totalCount: data.totalCount || 0,
      nextPageToken: data.nextPageToken,
    };
  }

  async getStudyById(nctId: string): Promise<Study> {
    const url = `${BASE_URL}/studies/${nctId}?format=json`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Study not found: ${nctId}`);
      }
      const errorText = await response.text();
      throw new Error(`ClinicalTrials.gov API error: ${response.status} - ${errorText}`);
    }

    return (await response.json()) as Study;
  }

  /** Fetch multiple studies by NCT ID (chunked to respect the registry's limits). */
  async getStudiesByIds(nctIds: string[]): Promise<Study[]> {
    if (nctIds.length === 0) return [];
    const out: Study[] = [];
    const chunkSize = 50;
    for (let i = 0; i < nctIds.length; i += chunkSize) {
      const chunk = nctIds.slice(i, i + chunkSize);
      const url = new URL(`${BASE_URL}/studies`);
      url.searchParams.set('filter.ids', chunk.join(','));
      url.searchParams.set('pageSize', String(chunk.length));
      url.searchParams.set('format', 'json');

      const response = await fetch(url.toString(), { method: 'GET', headers: { Accept: 'application/json' } });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ClinicalTrials.gov API error: ${response.status} - ${errorText}`);
      }
      const data = (await response.json()) as { studies?: Study[] };
      out.push(...(data.studies || []));
    }
    return out;
  }

  async getStudyFields(): Promise<string[]> {
    // Returns commonly used fields for reference
    return [
      'NCTId',
      'BriefTitle',
      'OfficialTitle',
      'Condition',
      'OverallStatus',
      'Phase',
      'StudyType',
      'EnrollmentCount',
      'StartDate',
      'CompletionDate',
      'LeadSponsorName',
      'LocationCity',
      'LocationState',
      'LocationCountry',
      'EligibilityCriteria',
      'MinimumAge',
      'MaximumAge',
      'Sex',
      'HealthyVolunteers',
      'InterventionName',
      'InterventionType',
      'BriefSummary',
    ];
  }
}

export const clinicalTrialsService = new ClinicalTrialsService();
