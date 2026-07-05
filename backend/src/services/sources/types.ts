import type { StudyCard } from '../../types/studyfinder.js';
import type { StudyStatus, StudyPhase, SortOption } from '../../types/clinicalTrials.js';

/** Registries the Discover feed can pull studies from. */
export type StudySourceId = 'ctgov' | 'isrctn' | 'ctis';

/**
 * Normalized search input passed to every source. Each adapter maps these onto
 * its own registry's query language as best it can; filters a registry can't
 * express server-side are applied downstream in feedService.applyLocalFilters.
 */
export interface SourceSearchInput {
  condition?: string;
  term?: string;
  sponsor?: string;
  country?: string;
  statuses?: StudyStatus[];
  phases?: StudyPhase[];
  sort?: SortOption;
  sortOrder?: 'asc' | 'desc';
  pageSize?: number;
  /** Opaque, source-specific pagination cursor (a pageToken, a page number, …). */
  cursor?: string;
}

export interface SourceSearchResult {
  cards: StudyCard[];
  totalCount: number;
  /** Undefined when the source has no further pages (or can't paginate). */
  nextCursor?: string;
}

export interface StudySource {
  id: StudySourceId;
  /** Human label shown in the UI and used as the card's `source`. */
  label: string;
  /** True only when in-app detail (the 10-tab panel) is available; others link out. */
  hasDetail: boolean;
  search(input: SourceSearchInput): Promise<SourceSearchResult>;
}
