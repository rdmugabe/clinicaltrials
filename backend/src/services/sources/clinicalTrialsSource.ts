import { clinicalTrialsService } from '../clinicalTrialsService.js';
import { toStudyCard } from '../studyMapper.js';
import { regionAdvanced } from './geo.js';
import type { SearchParams } from '../../types/clinicalTrials.js';
import type { StudySource, SourceSearchInput, SourceSearchResult } from './types.js';

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
      advanced: regionAdvanced(input.region),
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
