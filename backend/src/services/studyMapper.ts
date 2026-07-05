import type { Study, StudyPhase } from '../types/clinicalTrials.js';
import type { StudyCard, FeedStatus } from '../types/studyfinder.js';

const PHASE_LABELS: Record<StudyPhase, string> = {
  EARLY_PHASE1: 'Early Phase 1',
  PHASE1: 'Phase 1',
  PHASE2: 'Phase 2',
  PHASE3: 'Phase 3',
  PHASE4: 'Phase 4',
  NA: 'N/A',
};

/** Map a raw overallStatus into the feed's Upcoming / Active / Closed buckets. */
export function toFeedStatus(status: string): FeedStatus {
  switch (status) {
    case 'NOT_YET_RECRUITING':
      return 'Upcoming';
    case 'RECRUITING':
    case 'ENROLLING_BY_INVITATION':
    case 'ACTIVE_NOT_RECRUITING':
      return 'Active';
    case 'COMPLETED':
    case 'TERMINATED':
    case 'SUSPENDED':
    case 'WITHDRAWN':
      return 'Closed';
    default:
      return 'Active';
  }
}

export function phaseLabel(phases?: StudyPhase[]): string {
  if (!phases || phases.length === 0) return 'N/A';
  return phases.map((p) => PHASE_LABELS[p] || p).join(' / ');
}

/**
 * Convert a full ClinicalTrials.gov Study into the compact card the feed uses.
 * `source`/`dateAdded` come from our local feed ledger when available; otherwise
 * we fall back to the registry's first-post date.
 */
export function toStudyCard(
  study: Study,
  opts: { source?: string; sourceUrl?: string; dateAdded?: string } = {}
): StudyCard {
  const p = study.protocolSection;
  const id = p.identificationModule;
  const status = p.statusModule;
  const design = p.designModule;
  const sponsor = p.sponsorCollaboratorsModule?.leadSponsor;

  const firstPost = status.studyFirstPostDateStruct?.date;
  const lastUpdate = status.lastUpdatePostDateStruct?.date;

  return {
    nctId: id.nctId,
    title: id.briefTitle,
    phase: phaseLabel(design?.phases),
    phases: design?.phases || [],
    status: status.overallStatus,
    feedStatus: toFeedStatus(status.overallStatus),
    enrollment: design?.enrollmentInfo?.count,
    sponsor: sponsor?.name,
    sponsorType: sponsor?.class,
    conditions: p.conditionsModule?.conditions || [],
    source: opts.source || 'ClinicalTrials.gov',
    sourceUrl: opts.sourceUrl || `https://clinicaltrials.gov/study/${id.nctId}`,
    dateAdded: opts.dateAdded || firstPost || new Date().toISOString(),
    startDate: status.startDateStruct?.date,
    lastUpdated: lastUpdate,
  };
}
