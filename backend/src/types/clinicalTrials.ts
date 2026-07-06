// ClinicalTrials.gov API v2 Types

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
  /** Raw Essie expression passed through as filter.advanced (e.g. geo filters). */
  advanced?: string;
  /** Restrict the returned fields (v2 `fields=`) for lightweight sweeps. */
  fields?: string[];
  status?: StudyStatus[];
  phase?: StudyPhase[];
  sort?: SortOption;
  sortOrder?: 'asc' | 'desc';
  pageSize?: number;
  pageToken?: string;
}

export interface IdentificationModule {
  nctId: string;
  orgStudyIdInfo?: {
    id: string;
  };
  organization?: {
    fullName: string;
    class: string;
  };
  briefTitle: string;
  officialTitle?: string;
  acronym?: string;
}

export interface StatusModule {
  statusVerifiedDate?: string;
  overallStatus: StudyStatus;
  expandedAccessInfo?: {
    hasExpandedAccess: boolean;
  };
  startDateStruct?: {
    date: string;
    type: string;
  };
  primaryCompletionDateStruct?: {
    date: string;
    type: string;
  };
  completionDateStruct?: {
    date: string;
    type: string;
  };
  studyFirstSubmitDate?: string;
  studyFirstPostDateStruct?: {
    date: string;
    type: string;
  };
  lastUpdateSubmitDate?: string;
  lastUpdatePostDateStruct?: {
    date: string;
    type: string;
  };
}

export interface SponsorCollaboratorsModule {
  responsibleParty?: {
    type: string;
    investigatorFullName?: string;
    investigatorTitle?: string;
    investigatorAffiliation?: string;
  };
  leadSponsor?: {
    name: string;
    class: string;
  };
  collaborators?: Array<{
    name: string;
    class: string;
  }>;
}

export interface DescriptionModule {
  briefSummary?: string;
  detailedDescription?: string;
}

export interface ConditionsModule {
  conditions?: string[];
  keywords?: string[];
}

export interface DesignModule {
  studyType?: string;
  phases?: StudyPhase[];
  designInfo?: {
    allocation?: string;
    interventionModel?: string;
    primaryPurpose?: string;
    maskingInfo?: {
      masking?: string;
      whoMasked?: string[];
    };
  };
  enrollmentInfo?: {
    count: number;
    type: string;
  };
}

export interface Intervention {
  type: string;
  name: string;
  description?: string;
  armGroupLabels?: string[];
}

export interface ArmGroup {
  label: string;
  type?: string;
  description?: string;
  interventionNames?: string[];
}

export interface ArmsInterventionsModule {
  armGroups?: ArmGroup[];
  interventions?: Intervention[];
}

export interface EligibilityModule {
  eligibilityCriteria?: string;
  healthyVolunteers?: boolean;
  sex?: string;
  minimumAge?: string;
  maximumAge?: string;
  stdAges?: string[];
}

export interface Contact {
  name?: string;
  role?: string;
  phone?: string;
  email?: string;
}

export interface Location {
  facility?: string;
  status?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  contacts?: Contact[];
  geoPoint?: {
    lat: number;
    lon: number;
  };
}

export interface ContactsLocationsModule {
  centralContacts?: Contact[];
  overallOfficials?: Array<{
    name: string;
    affiliation?: string;
    role: string;
  }>;
  locations?: Location[];
}

export interface ProtocolSection {
  identificationModule: IdentificationModule;
  statusModule: StatusModule;
  sponsorCollaboratorsModule?: SponsorCollaboratorsModule;
  descriptionModule?: DescriptionModule;
  conditionsModule?: ConditionsModule;
  designModule?: DesignModule;
  armsInterventionsModule?: ArmsInterventionsModule;
  eligibilityModule?: EligibilityModule;
  contactsLocationsModule?: ContactsLocationsModule;
}

export interface Study {
  protocolSection: ProtocolSection;
  derivedSection?: {
    miscInfoModule?: {
      versionHolder?: string;
    };
    conditionBrowseModule?: {
      meshes?: Array<{ id: string; term: string }>;
      ancestors?: Array<{ id: string; term: string }>;
      browseLeaves?: Array<{ id: string; name: string; relevance: string }>;
      browseBranches?: Array<{ abbrev: string; name: string }>;
    };
    interventionBrowseModule?: {
      meshes?: Array<{ id: string; term: string }>;
      ancestors?: Array<{ id: string; term: string }>;
      browseLeaves?: Array<{ id: string; name: string; relevance: string }>;
      browseBranches?: Array<{ abbrev: string; name: string }>;
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
