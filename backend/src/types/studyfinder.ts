// StudyFinder domain types (feed cards, scouts, contacts, pipeline).
import type { SearchParams, Study, StudyPhase } from './clinicalTrials.js';

export type FeedStatus = 'Upcoming' | 'Active' | 'Closed';

/** Compact study representation used by the Discover feed cards. */
export interface StudyCard {
  nctId: string;
  title: string;
  phase: string; // human label, e.g. "Phase 2"
  phases: string[];
  status: string; // raw overallStatus
  feedStatus: FeedStatus;
  enrollment?: number;
  sponsor?: string;
  sponsorType?: string;
  conditions: string[];
  source: string; // 'ClinicalTrials.gov' | 'News' | scout name
  sourceUrl?: string;
  dateAdded: string;
  startDate?: string;
  lastUpdated?: string;
  // Local state flags (merged per request)
  bookmarked?: boolean;
  hidden?: boolean;
  inPipeline?: boolean;
}

/** A condition (or category reference) chosen in the Scout wizard. */
export interface ScoutConditionRef {
  id: string;
  label: string;
  areaId: string;
  areaName: string;
  isCategoryReference?: boolean;
}

/** The full, structured criteria captured by the 4-step Scout wizard. */
export interface ScoutCriteria {
  conditions: ScoutConditionRef[];
  phases: StudyPhase[];
  keywords: string[];
  excludeKeywords: string[];
  locations: string[];
  /** Geographic scope: 'us' | 'world' (ex-US); undefined ⇒ worldwide. */
  region?: 'us' | 'world';
}

export interface Scout {
  id: string;
  name: string;
  params: SearchParams;
  criteria?: ScoutCriteria;
  indication?: string;
  color?: string;
  shared: boolean;
  weeklyReport: boolean;
  seenNctIds: string[];
  matchCount?: number; // size of the tracked (seen) set
  matchTotal?: number; // true # of studies matching in the registry (cached)
  createdAt: string;
  updatedAt: string;
}

export interface DiscoveredContact {
  id: string;
  nctId?: string;
  company?: string;
  name: string;
  jobTitle?: string;
  location?: string;
  status: string; // 'Not Contacted' | 'In Sequence' | ...
  email?: string;
  linkedin?: string;
  enriched: boolean;
  enrichmentConfidence?: 'verified' | 'guessed';
  source?: string;
  createdAt: string;
}

export interface PipelineOpportunity {
  id: string;
  nctId?: string;
  title: string;
  sponsor?: string;
  indications: string[];
  cro?: string;
  pi?: string;
  stage: string;
  board: string;
  assignee?: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyReport {
  id: string;
  scoutId: string;
  scoutName?: string;
  weekOf: string;
  nctIds: string[];
  studyCount: number;
  createdAt: string;
}

export interface SequenceStep {
  subject: string;
  body: string;
  delayDays: number;
}

export interface Sequence {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused';
  steps: SequenceStep[];
  enrolledCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SequenceEnrollment {
  id: string;
  sequenceId: string;
  contactId?: string;
  contactName?: string;
  contactEmail: string;
  currentStep: number;
  status: 'active' | 'completed' | 'stopped';
  enrolledAt: string;
  nextSendAt?: string;
}

export interface Signature {
  id: string;
  name: string;
  body: string;
  isDefault: boolean;
  createdAt: string;
}

export interface Mailbox {
  connected: boolean;
  fromEmail?: string;
  fromName?: string;
  provider?: string;
}

export interface SequenceMetrics {
  activeSequences: number;
  emailsSent: number;
  inQueue: number;
  bounced: number;
  opened: number;
  replied: number;
  avgOpenRate: number; // 0-100
}

export type { SearchParams, Study };
