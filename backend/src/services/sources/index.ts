import { clinicalTrialsSource } from './clinicalTrialsSource.js';
import { isrctnSource } from './isrctnSource.js';
import { ctisSource } from './ctisSource.js';
import type { StudySource, StudySourceId } from './types.js';

/** All wired study sources, in default display/merge order. */
export const SOURCES: StudySource[] = [clinicalTrialsSource, isrctnSource, ctisSource];

export const DEFAULT_SOURCE: StudySourceId = 'ctgov';

export function getSource(id?: string): StudySource | undefined {
  return SOURCES.find((s) => s.id === id);
}

/** Lightweight metadata for the frontend source selector. */
export function sourceCatalog(): { id: StudySourceId; label: string; hasDetail: boolean }[] {
  return SOURCES.map((s) => ({ id: s.id, label: s.label, hasDetail: s.hasDetail }));
}

export { clinicalTrialsSource, isrctnSource, ctisSource };
export type { StudySource, StudySourceId, SourceSearchInput, SourceSearchResult } from './types.js';
