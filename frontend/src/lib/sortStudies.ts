import type { StudyCard, SortOption } from '@/types';

export type SortOrder = 'asc' | 'desc';

export interface SortFieldOption {
  value: SortOption;
  label: string;
}

// Sort fields available for study result lists (map to ClinicalTrials.gov sort).
export const STUDY_SORT_FIELDS: SortFieldOption[] = [
  { value: 'LastUpdatePostDate', label: 'Last updated' },
  { value: 'StartDate', label: 'Start date' },
  { value: 'StudyFirstPostDate', label: 'Date added' },
  { value: 'EnrollmentCount', label: 'Enrollment' },
];

const time = (s?: string) => (s ? new Date(s).getTime() : 0);

function fieldValue(card: StudyCard, field: SortOption): number {
  switch (field) {
    case 'EnrollmentCount':
      return card.enrollment ?? 0;
    case 'StartDate':
      return time(card.startDate);
    case 'StudyFirstPostDate':
      return time(card.dateAdded);
    case 'LastUpdatePostDate':
    default:
      return time(card.lastUpdated);
  }
}

/** Client-side sort of study cards, matching the server-side registry sort. */
export function sortStudyCards(cards: StudyCard[], field: SortOption, order: SortOrder): StudyCard[] {
  const dir = order === 'asc' ? 1 : -1;
  return [...cards].sort((a, b) => (fieldValue(a, field) - fieldValue(b, field)) * dir);
}
