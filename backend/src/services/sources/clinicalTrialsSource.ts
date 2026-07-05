import { clinicalTrialsService } from '../clinicalTrialsService.js';
import { toStudyCard } from '../studyMapper.js';
import type { SearchParams } from '../../types/clinicalTrials.js';
import type { StudySource, SourceSearchInput, SourceSearchResult, Region } from './types.js';

const US_COUNTRY = 'AREA[LocationCountry]United States';

/** Translate a region into a ClinicalTrials.gov advanced (Essie) geo filter. */
function regionFilter(region?: Region): string | undefined {
  if (region === 'us') return US_COUNTRY;
  if (region === 'world') return `NOT ${US_COUNTRY}`;
  return undefined;
}

/**
 * ClinicalTrials.gov — the primary source. Supports the full filter set and
 * globally-ordered pagination server-side (pageToken as the cursor).
 */
export const clinicalTrialsSource: StudySource = {
  id: 'ctgov',
  label: 'ClinicalTrials.gov',
  hasDetail: true,

  async search(input: SourceSearchInput): Promise<SourceSearchResult> {
    const params: SearchParams = {
      condition: input.condition,
      term: input.term,
      sponsor: input.sponsor,
      location: input.country,
      advanced: regionFilter(input.region),
      status: input.statuses,
      phase: input.phases,
      sort: input.sort || 'LastUpdatePostDate',
      sortOrder: input.sortOrder || 'desc',
      pageSize: input.pageSize || 24,
      pageToken: input.cursor,
    };
    const res = await clinicalTrialsService.searchStudies(params);
    return {
      cards: res.studies.map((s) => toStudyCard(s)),
      totalCount: res.totalCount,
      nextCursor: res.nextPageToken,
    };
  },
};
