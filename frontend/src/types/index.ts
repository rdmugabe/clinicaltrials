export type StudyStatus =
  | 'RECRUITING'
  | 'NOT_YET_RECRUITING'
  | 'ENROLLING_BY_INVITATION'
  | 'ACTIVE_NOT_RECRUITING'
  | 'SUSPENDED'
  | 'TERMINATED'
  | 'COMPLETED'
  | 'WITHDRAWN'
  | 'UNKNOWN';

export type StudyPhase =
  | 'EARLY_PHASE1'
  | 'PHASE1'
  | 'PHASE2'
  | 'PHASE3'
  | 'PHASE4'
  | 'NA';

export type SortOption =
  | 'LastUpdatePostDate'
  | 'EnrollmentCount'
  | 'StartDate'
  | 'StudyFirstPostDate';

export interface SearchParams {
  condition?: string;
  intervention?: string;
  location?: string;
  sponsor?: string;
  term?: string;
  status?: StudyStatus[];
  phase?: StudyPhase[];
  sort?: SortOption;
  sortOrder?: 'asc' | 'desc';
  pageSize?: number;
  pageToken?: string;
}

export interface StudyOutcome {
  measure?: string;
  description?: string;
  timeFrame?: string;
}

export interface StudyReference {
  pmid?: string;
  type?: string;
  citation?: string;
}

export interface Study {
  protocolSection: {
    identificationModule: {
      nctId: string;
      briefTitle: string;
      officialTitle?: string;
      acronym?: string;
      organization?: {
        fullName?: string;
        class?: string;
      };
    };
    statusModule: {
      overallStatus: StudyStatus;
      statusVerifiedDate?: string;
      startDateStruct?: { date: string; type?: string };
      primaryCompletionDateStruct?: { date: string; type?: string };
      completionDateStruct?: { date: string; type?: string };
      studyFirstSubmitDate?: string;
      studyFirstPostDateStruct?: { date: string; type?: string };
      lastUpdateSubmitDate?: string;
      lastUpdatePostDateStruct?: { date: string; type?: string };
    };
    sponsorCollaboratorsModule?: {
      leadSponsor?: { name: string; class?: string };
      responsibleParty?: {
        type?: string;
        investigatorFullName?: string;
        investigatorTitle?: string;
        investigatorAffiliation?: string;
      };
      collaborators?: Array<{ name: string; class?: string }>;
    };
    descriptionModule?: {
      briefSummary?: string;
      detailedDescription?: string;
    };
    conditionsModule?: {
      conditions?: string[];
      keywords?: string[];
    };
    designModule?: {
      studyType?: string;
      phases?: StudyPhase[];
      designInfo?: {
        allocation?: string;
        interventionModel?: string;
        primaryPurpose?: string;
        maskingInfo?: { masking?: string; whoMasked?: string[] };
      };
      enrollmentInfo?: { count: number; type?: string };
    };
    armsInterventionsModule?: {
      armGroups?: Array<{ label: string; type?: string; description?: string; interventionNames?: string[] }>;
      interventions?: Array<{
        type: string;
        name: string;
        description?: string;
        armGroupLabels?: string[];
      }>;
    };
    eligibilityModule?: {
      eligibilityCriteria?: string;
      healthyVolunteers?: boolean;
      sex?: string;
      minimumAge?: string;
      maximumAge?: string;
      stdAges?: string[];
    };
    outcomesModule?: {
      primaryOutcomes?: StudyOutcome[];
      secondaryOutcomes?: StudyOutcome[];
    };
    contactsLocationsModule?: {
      overallOfficials?: Array<{ name: string; affiliation?: string; role?: string }>;
      centralContacts?: Array<{ name?: string; role?: string; phone?: string; email?: string }>;
      locations?: Array<{
        facility?: string;
        status?: string;
        city?: string;
        state?: string;
        zip?: string;
        country?: string;
      }>;
    };
    referencesModule?: {
      references?: StudyReference[];
    };
  };
  hasResults: boolean;
}

export interface SearchResponse {
  studies: Study[];
  totalCount: number;
  nextPageToken?: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  params: SearchParams;
  createdAt: string;
  updatedAt: string;
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterOptions {
  status: FilterOption[];
  phase: FilterOption[];
  sort: FilterOption[];
}

// Outreach Types
export type OutreachStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'replied'
  | 'failed'
  | 'bounced';

export interface TrialContact {
  id: string;
  nctId: string;
  trialTitle: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactRole?: string;
  facility?: string;
  city?: string;
  state?: string;
  country?: string;
  sponsorName?: string;
  addedAt: string;
}

export interface OutreachRecord {
  id: string;
  contactId: string;
  templateId?: string;
  subject: string;
  body: string;
  status: OutreachStatus;
  sentAt?: string;
  openedAt?: string;
  repliedAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContactList {
  id: string;
  name: string;
  description?: string;
  contactIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EmailStats {
  total: number;
  pending: number;
  sent: number;
  delivered: number;
  opened: number;
  replied: number;
  failed: number;
  bounced: number;
}

export interface OrganizationSettings {
  name: string;
  email: string;
  phone?: string;
  website?: string;
  description?: string;
}

// Alert Types
export type NotificationChannel = 'email' | 'sms' | 'both';

export type AlertFrequency = 'hourly' | 'every6hours' | 'daily' | 'weekly';

export interface ResearchAlert {
  id: string;
  name: string;
  searchParams: SearchParams;
  notificationChannels: NotificationChannel;
  email?: string;
  phone?: string;
  frequency: AlertFrequency;
  isActive: boolean;
  lastChecked?: string;
  lastNotified?: string;
  seenTrialIds: string[];
  matchCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AlertNotification {
  id: string;
  alertId: string;
  alertName: string;
  trialIds: string[];
  trialCount: number;
  sentVia: ('email' | 'sms')[];
  sentAt: string;
  success: boolean;
  errorMessage?: string;
}

export interface AlertStats {
  totalAlerts: number;
  activeAlerts: number;
  totalNotifications: number;
  recentNotifications: number;
}

export interface ServiceStatus {
  email: { configured: boolean };
  sms: { configured: boolean };
}

// ============ STUDYFINDER TYPES ============

export type FeedStatus = 'Upcoming' | 'Active' | 'Closed';
export type FeedTab = 'foryou' | 'all' | 'bookmarks';

export interface StudyCard {
  nctId: string;
  title: string;
  phase: string;
  phases: StudyPhase[];
  status: StudyStatus;
  feedStatus: FeedStatus;
  enrollment?: number;
  sponsor?: string;
  sponsorType?: string;
  conditions: string[];
  source: string;
  sourceUrl?: string;
  dateAdded: string;
  startDate?: string;
  lastUpdated?: string;
  bookmarked?: boolean;
  hidden?: boolean;
  inPipeline?: boolean;
}

export interface FeedResponse {
  studies: StudyCard[];
  totalCount: number;
  nextPageToken?: string;
}

/** A study registry the feed can pull from ('all' = every source merged). */
export type StudySourceId = 'ctgov' | 'isrctn' | 'ctis';
export type FeedSource = StudySourceId | 'all';

export interface StudySourceMeta {
  id: StudySourceId;
  label: string;
  hasDetail: boolean;
}

export interface FeedFilters {
  tab: FeedTab;
  source?: FeedSource;
  scoutId?: string;
  status?: FeedStatus;
  statuses?: StudyStatus[];
  sponsor?: string;
  phase?: StudyPhase;
  phases?: StudyPhase[];
  country?: string;
  condition?: string;
  enrollmentMin?: number;
  enrollmentMax?: number;
  showHidden?: boolean;
  sort?: SortOption;
  sortOrder?: 'asc' | 'desc';
  pageToken?: string;
}

export interface ScoutConditionRef {
  id: string;
  label: string;
  areaId: string;
  areaName: string;
  isCategoryReference?: boolean;
}

export interface ScoutCriteria {
  conditions: ScoutConditionRef[];
  phases: StudyPhase[];
  keywords: string[];
  excludeKeywords: string[];
  locations: string[];
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
  matchCount?: number;
  matchTotal?: number;
  createdAt: string;
  updatedAt: string;
}

// Therapeutic-area catalog (seed data for the Scout wizard)
export interface Condition {
  id: string;
  label: string;
}

export interface TherapeuticArea {
  id: string;
  name: string;
  conditionCount: number;
  isCategoryReference?: boolean;
  conditions: Condition[];
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

export interface DiscoveredContact {
  id: string;
  nctId?: string;
  company?: string;
  name: string;
  jobTitle?: string;
  location?: string;
  status: string;
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

export interface Board {
  id: string;
  name: string;
  stages: string[];
  position: number;
  createdAt: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'completed';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assignee?: string;
  category?: string;
  opportunityId?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmCompany {
  id: string;
  name: string;
  type?: string;
  hq?: string;
  website?: string;
  employees?: string;
  founded?: string;
  createdAt: string;
}

export interface ReportSummary {
  totalOpportunities: number;
  avgTimeToCloseDays: number | null;
  closeRatePct: number | null;
  totalCompanies: number;
  totalContacts: number;
  byStage: { stage: string; count: number }[];
  bySource: { source: string; count: number }[];
}

export interface ReportFilterOptions {
  stages: string[];
  assignees: string[];
  sources: string[];
  pis: string[];
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
  firmographics: {
    description: string | null;
    hq: string | null;
    website: string | null;
    employees: string | null;
    founded: string | null;
  };
}

// ============ EMAIL SEQUENCES ============

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
  avgOpenRate: number;
}

export type AccountTier = 'starter' | 'growth' | 'enterprise';

export interface Account {
  name: string;
  plan: string;
  tier: AccountTier;
  credits: { used: number; total: number };
  features: {
    emailSequences: boolean;
    teamManagement: boolean;
    unlimitedScouts: boolean;
  };
}

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  items: string[];
}
