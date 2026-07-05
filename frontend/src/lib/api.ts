import type {
  SearchParams,
  SearchResponse,
  SortOption,
  Study,
  FilterOptions,
  SavedSearch,
  TrialContact,
  OutreachRecord,
  EmailTemplate,
  EmailStats,
  OrganizationSettings,
  ResearchAlert,
  AlertNotification,
  AlertStats,
  ServiceStatus,
  NotificationChannel,
  AlertFrequency,
  FeedResponse,
  FeedFilters,
  StudySourceMeta,
  Note,
  NoteEntityType,
  Insights,
  GlobalInsights,
  StudyCard,
  Scout,
  ScoutCriteria,
  WeeklyReport,
  DiscoveredContact,
  PipelineOpportunity,
  Account,
  AccountTier,
  ChangelogEntry,
  Board,
  Task,
  TaskStatus,
  CrmCompany,
  ReportSummary,
  ReportFilterOptions,
  CompanySummary,
  CompanyDetail,
  Sequence,
  SequenceStep,
  SequenceEnrollment,
  Signature,
  Mailbox,
  SequenceMetrics,
} from '@/types';

const API_BASE = '/api';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `API error: ${response.status}`);
  }

  return response.json();
}

export async function searchTrials(params: SearchParams): Promise<SearchResponse> {
  const searchParams = new URLSearchParams();

  if (params.condition) searchParams.set('condition', params.condition);
  if (params.intervention) searchParams.set('intervention', params.intervention);
  if (params.location) searchParams.set('location', params.location);
  if (params.sponsor) searchParams.set('sponsor', params.sponsor);
  if (params.term) searchParams.set('term', params.term);
  if (params.status?.length) searchParams.set('status', params.status.join(','));
  if (params.phase?.length) searchParams.set('phase', params.phase.join(','));
  if (params.sort) searchParams.set('sort', params.sort);
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
  if (params.pageToken) searchParams.set('pageToken', params.pageToken);

  const queryString = searchParams.toString();
  return fetchApi<SearchResponse>(`/trials/search${queryString ? `?${queryString}` : ''}`);
}

export async function getStudy(nctId: string): Promise<Study> {
  return fetchApi<Study>(`/trials/study/${nctId}`);
}

export async function getFilterOptions(): Promise<FilterOptions> {
  return fetchApi<FilterOptions>('/trials/options');
}

export async function getSavedSearches(): Promise<{ searches: SavedSearch[] }> {
  return fetchApi<{ searches: SavedSearch[] }>('/saved-searches');
}

export async function createSavedSearch(
  name: string,
  params: SearchParams
): Promise<SavedSearch> {
  return fetchApi<SavedSearch>('/saved-searches', {
    method: 'POST',
    body: JSON.stringify({ name, params }),
  });
}

export async function deleteSavedSearch(id: string): Promise<void> {
  await fetch(`${API_BASE}/saved-searches/${id}`, { method: 'DELETE' });
}

// ============ OUTREACH API ============

// Contacts
export async function getContacts(): Promise<{ contacts: TrialContact[]; total: number }> {
  return fetchApi<{ contacts: TrialContact[]; total: number }>('/outreach/contacts');
}

export async function addContact(contact: Omit<TrialContact, 'id' | 'addedAt'>): Promise<TrialContact> {
  return fetchApi<TrialContact>('/outreach/contacts', {
    method: 'POST',
    body: JSON.stringify(contact),
  });
}

export async function addContactsBulk(
  contactsData: Omit<TrialContact, 'id' | 'addedAt'>[]
): Promise<{ added: TrialContact[]; skipped: any[]; addedCount: number; skippedCount: number }> {
  return fetchApi('/outreach/contacts/bulk', {
    method: 'POST',
    body: JSON.stringify({ contactsData }),
  });
}

export async function deleteContact(id: string): Promise<void> {
  await fetch(`${API_BASE}/outreach/contacts/${id}`, { method: 'DELETE' });
}

// Templates
export async function getTemplates(): Promise<{ templates: EmailTemplate[] }> {
  return fetchApi<{ templates: EmailTemplate[] }>('/outreach/templates');
}

export async function createTemplate(
  template: Pick<EmailTemplate, 'name' | 'subject' | 'body'>
): Promise<EmailTemplate> {
  return fetchApi<EmailTemplate>('/outreach/templates', {
    method: 'POST',
    body: JSON.stringify(template),
  });
}

export async function updateTemplate(
  id: string,
  template: Partial<Pick<EmailTemplate, 'name' | 'subject' | 'body'>>
): Promise<EmailTemplate> {
  return fetchApi<EmailTemplate>(`/outreach/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(template),
  });
}

export async function deleteTemplate(id: string): Promise<void> {
  await fetch(`${API_BASE}/outreach/templates/${id}`, { method: 'DELETE' });
}

// Outreach
export async function getOutreachHistory(params?: {
  contactId?: string;
  status?: string;
}): Promise<{ records: OutreachRecord[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.contactId) searchParams.set('contactId', params.contactId);
  if (params?.status) searchParams.set('status', params.status);
  const query = searchParams.toString();
  return fetchApi(`/outreach/history${query ? `?${query}` : ''}`);
}

export async function getOutreachStats(): Promise<EmailStats> {
  return fetchApi<EmailStats>('/outreach/stats');
}

export async function sendEmail(params: {
  contactId: string;
  templateId?: string;
  subject?: string;
  body?: string;
  variables?: Record<string, string>;
}): Promise<OutreachRecord> {
  return fetchApi<OutreachRecord>('/outreach/send', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function sendBulkEmails(params: {
  contactIds: string[];
  templateId?: string;
  subject?: string;
  body?: string;
  variables?: Record<string, string>;
}): Promise<{
  sent: number;
  failed: number;
  skipped: number;
  details: any;
}> {
  return fetchApi('/outreach/send-bulk', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function previewEmail(params: {
  contactId?: string;
  templateId?: string;
  subject?: string;
  body?: string;
  variables?: Record<string, string>;
}): Promise<{ subject: string; body: string; to: string }> {
  return fetchApi('/outreach/preview', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// Organization Settings
export async function getOrganizationSettings(): Promise<OrganizationSettings> {
  return fetchApi<OrganizationSettings>('/outreach/settings');
}

export async function updateOrganizationSettings(
  settings: OrganizationSettings
): Promise<OrganizationSettings> {
  return fetchApi<OrganizationSettings>('/outreach/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export async function getEmailServiceStatus(): Promise<{ configured: boolean; fromEmail: string }> {
  return fetchApi('/outreach/email-status');
}

// ============ ALERTS API ============

export async function getAlerts(): Promise<{ alerts: ResearchAlert[] }> {
  return fetchApi<{ alerts: ResearchAlert[] }>('/alerts');
}

export async function getAlert(id: string): Promise<ResearchAlert> {
  return fetchApi<ResearchAlert>(`/alerts/${id}`);
}

export async function getAlertStats(): Promise<{ stats: AlertStats; serviceStatus: ServiceStatus }> {
  return fetchApi('/alerts/stats');
}

export async function getAlertNotifications(alertId?: string): Promise<{ notifications: AlertNotification[] }> {
  const query = alertId ? `?alertId=${alertId}` : '';
  return fetchApi(`/alerts/notifications${query}`);
}

export async function createAlert(data: {
  name: string;
  searchParams: SearchParams;
  notificationChannels: NotificationChannel;
  email?: string;
  phone?: string;
  frequency: AlertFrequency;
}): Promise<ResearchAlert> {
  return fetchApi<ResearchAlert>('/alerts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAlert(
  id: string,
  data: Partial<{
    name: string;
    searchParams: SearchParams;
    notificationChannels: NotificationChannel;
    email?: string;
    phone?: string;
    frequency: AlertFrequency;
    isActive: boolean;
  }>
): Promise<ResearchAlert> {
  return fetchApi<ResearchAlert>(`/alerts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function toggleAlert(id: string): Promise<ResearchAlert> {
  return fetchApi<ResearchAlert>(`/alerts/${id}/toggle`, {
    method: 'POST',
  });
}

export async function triggerAlertCheck(id: string): Promise<{
  newTrialsCount: number;
  newTrials: Array<{
    nctId: string;
    title: string;
    status: string;
    conditions: string[];
  }>;
  notificationSent: boolean;
}> {
  return fetchApi(`/alerts/${id}/check`, {
    method: 'POST',
  });
}

export async function deleteAlert(id: string): Promise<void> {
  await fetch(`${API_BASE}/alerts/${id}`, { method: 'DELETE' });
}

export async function testNotification(params: {
  channels: NotificationChannel;
  email?: string;
  phone?: string;
}): Promise<{
  success: boolean;
  emailSent: boolean;
  smsSent: boolean;
  errors: string[];
}> {
  return fetchApi('/alerts/test-notification', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ============ STUDYFINDER: FEED ============

export async function getFeed(filters: FeedFilters): Promise<FeedResponse> {
  const p = new URLSearchParams();
  p.set('tab', filters.tab);
  if (filters.source) p.set('source', filters.source);
  if (filters.region) p.set('region', filters.region);
  if (filters.scoutId) p.set('scoutId', filters.scoutId);
  if (filters.status) p.set('status', filters.status);
  if (filters.statuses?.length) p.set('overallStatus', filters.statuses.join(','));
  if (filters.sponsor) p.set('sponsor', filters.sponsor);
  if (filters.phase) p.set('phase', filters.phase);
  if (filters.phases?.length) p.set('phases', filters.phases.join(','));
  if (filters.country) p.set('country', filters.country);
  if (filters.condition) p.set('condition', filters.condition);
  if (filters.enrollmentMin != null) p.set('enrollmentMin', String(filters.enrollmentMin));
  if (filters.enrollmentMax != null) p.set('enrollmentMax', String(filters.enrollmentMax));
  if (filters.showHidden) p.set('showHidden', 'true');
  if (filters.sort) p.set('sort', filters.sort);
  if (filters.sortOrder) p.set('sortOrder', filters.sortOrder);
  if (filters.pageToken) p.set('pageToken', filters.pageToken);
  return fetchApi<FeedResponse>(`/feed?${p.toString()}`);
}

export async function syncFeed(): Promise<{ added: number; total: number }> {
  return fetchApi('/feed/sync', { method: 'POST' });
}

export async function getFeedSources(): Promise<{ sources: StudySourceMeta[] }> {
  return fetchApi('/feed/sources');
}

// ============ NOTES ============

export async function getNotes(entityType: NoteEntityType, entityId: string): Promise<{ notes: Note[] }> {
  return fetchApi(`/notes?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`);
}
export async function addNote(input: {
  entityType: NoteEntityType;
  entityId: string;
  body: string;
  author?: string;
}): Promise<{ note: Note }> {
  return fetchApi('/notes', { method: 'POST', body: JSON.stringify(input) });
}
export async function deleteNote(id: string): Promise<void> {
  await fetchApi(`/notes/${id}`, { method: 'DELETE' });
}
export async function getNoteCounts(
  entityType: NoteEntityType,
  ids: string[]
): Promise<{ counts: Record<string, number> }> {
  if (ids.length === 0) return { counts: {} };
  return fetchApi(`/notes/counts?entityType=${entityType}&ids=${ids.map(encodeURIComponent).join(',')}`);
}

// ============ INSIGHTS ============

export async function getScoutInsights(id: string): Promise<Insights> {
  return fetchApi(`/insights/scout/${id}`);
}
export async function getGlobalInsights(): Promise<GlobalInsights> {
  return fetchApi('/insights');
}
export async function getQueryInsights(q: string): Promise<Insights> {
  return fetchApi(`/insights/query?q=${encodeURIComponent(q)}`);
}

export async function getStudiesByIds(nctIds: string[]): Promise<{ studies: StudyCard[] }> {
  return fetchApi('/feed/by-ids', { method: 'POST', body: JSON.stringify({ nctIds }) });
}

export async function bookmarkStudy(card: StudyCard): Promise<void> {
  await fetchApi('/feed/bookmark', { method: 'POST', body: JSON.stringify(card) });
}

export async function removeBookmark(nctId: string): Promise<void> {
  await fetch(`${API_BASE}/feed/bookmark/${nctId}`, { method: 'DELETE' });
}

export async function hideStudy(nctId: string): Promise<void> {
  await fetchApi(`/feed/hide/${nctId}`, { method: 'POST' });
}

export async function unhideStudy(nctId: string): Promise<void> {
  await fetch(`${API_BASE}/feed/hide/${nctId}`, { method: 'DELETE' });
}

// ============ STUDYFINDER: SCOUTS ============

export async function getScouts(): Promise<{ scouts: Scout[] }> {
  return fetchApi('/scouts');
}

export async function getScout(id: string): Promise<Scout> {
  return fetchApi(`/scouts/${id}`);
}

export async function getScoutStudies(
  id: string,
  opts?: { pageToken?: string; sort?: SortOption; sortOrder?: 'asc' | 'desc'; region?: 'us' | 'world' | 'all' }
): Promise<FeedResponse> {
  const p = new URLSearchParams();
  if (opts?.pageToken) p.set('pageToken', opts.pageToken);
  if (opts?.sort) p.set('sort', opts.sort);
  if (opts?.sortOrder) p.set('sortOrder', opts.sortOrder);
  if (opts?.region) p.set('region', opts.region);
  const q = p.toString();
  return fetchApi(`/scouts/${id}/studies${q ? `?${q}` : ''}`);
}

export async function createScout(data: {
  name: string;
  params?: SearchParams;
  criteria?: ScoutCriteria;
  indication?: string;
  color?: string;
  weeklyReport?: boolean;
}): Promise<Scout> {
  return fetchApi('/scouts', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateScout(
  id: string,
  data: Partial<Pick<Scout, 'name' | 'params' | 'criteria' | 'indication' | 'color' | 'shared' | 'weeklyReport'>>
): Promise<Scout> {
  return fetchApi(`/scouts/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteScout(id: string): Promise<void> {
  await fetch(`${API_BASE}/scouts/${id}`, { method: 'DELETE' });
}

export async function generateWeeklyReport(id: string): Promise<WeeklyReport> {
  return fetchApi(`/scouts/${id}/report`, { method: 'POST' });
}

export async function getWeeklyReports(scoutId?: string): Promise<{ reports: WeeklyReport[] }> {
  const q = scoutId ? `?scoutId=${scoutId}` : '';
  return fetchApi(`/scouts/reports${q}`);
}

// ============ STUDYFINDER: CONTACT DISCOVERY ============

export async function getDiscoveredContacts(nctId?: string): Promise<{ contacts: DiscoveredContact[] }> {
  const q = nctId ? `?nctId=${nctId}` : '';
  return fetchApi(`/discovery/contacts${q}`);
}

export async function discoverContacts(nctId: string): Promise<{ contacts: DiscoveredContact[] }> {
  return fetchApi(`/discovery/discover/${nctId}`, { method: 'POST' });
}

export async function enrichContact(id: string): Promise<DiscoveredContact> {
  return fetchApi(`/discovery/contacts/${id}/enrich`, { method: 'POST' });
}

export async function setContactStatus(ids: string[], status: string): Promise<{ ok: boolean }> {
  return fetchApi('/discovery/contacts/status', {
    method: 'POST',
    body: JSON.stringify({ ids, status }),
  });
}

export async function getRelevantTitles(): Promise<{ titles: string[] }> {
  return fetchApi('/discovery/relevant-titles');
}

export async function getEnrichmentStatus(): Promise<{ enrichmentConfigured: boolean }> {
  return fetchApi('/discovery/status');
}

// ============ STUDYFINDER: PIPELINE (TrialTrack) ============

export async function getPipeline(board?: string): Promise<{ opportunities: PipelineOpportunity[] }> {
  const q = board ? `?board=${encodeURIComponent(board)}` : '';
  return fetchApi(`/pipeline${q}`);
}

export async function pushToPipeline(data: {
  nctId?: string;
  title: string;
  sponsor?: string;
  indications?: string[];
  cro?: string;
  pi?: string;
  stage?: string;
  board?: string;
  assignee?: string;
  source?: string;
}): Promise<PipelineOpportunity> {
  return fetchApi('/pipeline', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateOpportunityStage(id: string, stage: string): Promise<PipelineOpportunity> {
  return fetchApi(`/pipeline/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage }) });
}

export async function deleteOpportunity(id: string): Promise<void> {
  await fetch(`${API_BASE}/pipeline/${id}`, { method: 'DELETE' });
}

// ============ ACCOUNT / CREDITS ============

export async function getAccount(): Promise<Account> {
  return fetchApi('/account');
}

export async function setAccountTier(tier: AccountTier): Promise<Account> {
  return fetchApi('/account/tier', { method: 'POST', body: JSON.stringify({ tier }) });
}

export async function getChangelog(): Promise<{ changelog: ChangelogEntry[] }> {
  return fetchApi('/account/changelog');
}

// ============ TRIALTRACK: BOARDS ============

export async function getBoards(): Promise<{ boards: Board[] }> {
  return fetchApi('/trialtrack/boards');
}

export async function createBoard(name: string, stages?: string[]): Promise<Board> {
  return fetchApi('/trialtrack/boards', { method: 'POST', body: JSON.stringify({ name, stages }) });
}

export async function updateBoard(id: string, data: { name?: string; stages?: string[] }): Promise<Board> {
  return fetchApi(`/trialtrack/boards/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteBoard(id: string): Promise<void> {
  await fetch(`${API_BASE}/trialtrack/boards/${id}`, { method: 'DELETE' });
}

// ============ TRIALTRACK: TASKS ============

export async function getTasks(filters?: {
  opportunityId?: string;
  category?: string;
  assignee?: string;
}): Promise<{ tasks: Task[] }> {
  const p = new URLSearchParams();
  if (filters?.opportunityId) p.set('opportunityId', filters.opportunityId);
  if (filters?.category) p.set('category', filters.category);
  if (filters?.assignee) p.set('assignee', filters.assignee);
  const q = p.toString();
  return fetchApi(`/trialtrack/tasks${q ? `?${q}` : ''}`);
}

export async function createTask(data: {
  title: string;
  description?: string;
  status?: TaskStatus;
  assignee?: string;
  category?: string;
  opportunityId?: string;
  dueDate?: string;
}): Promise<Task> {
  return fetchApi('/trialtrack/tasks', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateTask(id: string, data: Partial<Task>): Promise<Task> {
  return fetchApi(`/trialtrack/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteTask(id: string): Promise<void> {
  await fetch(`${API_BASE}/trialtrack/tasks/${id}`, { method: 'DELETE' });
}

// ============ TRIALTRACK: CRM COMPANIES ============

export async function getCompanies(): Promise<{ companies: CrmCompany[] }> {
  return fetchApi('/trialtrack/companies');
}

export async function createCompany(data: Partial<CrmCompany> & { name: string }): Promise<CrmCompany> {
  return fetchApi('/trialtrack/companies', { method: 'POST', body: JSON.stringify(data) });
}

export async function importCompanies(): Promise<{ added: number }> {
  return fetchApi('/trialtrack/companies/import', { method: 'POST' });
}

export async function deleteCompany(id: string): Promise<void> {
  await fetch(`${API_BASE}/trialtrack/companies/${id}`, { method: 'DELETE' });
}

// ============ TRIALTRACK: REPORTS ============

export async function getReportSummary(filters?: Record<string, string>): Promise<ReportSummary> {
  const p = new URLSearchParams(filters || {});
  const q = p.toString();
  return fetchApi(`/trialtrack/reports/summary${q ? `?${q}` : ''}`);
}

export async function getReportFilters(): Promise<ReportFilterOptions> {
  return fetchApi('/trialtrack/reports/filters');
}

// ============ COMPANIES DIRECTORY (StudyFinder) ============

export async function searchCompanies(opts?: {
  query?: string;
  indication?: string;
}): Promise<{ companies: CompanySummary[] }> {
  const p = new URLSearchParams();
  if (opts?.query) p.set('query', opts.query);
  if (opts?.indication) p.set('indication', opts.indication);
  const q = p.toString();
  return fetchApi(`/companies${q ? `?${q}` : ''}`);
}

export async function getCompanyDetail(name: string): Promise<CompanyDetail> {
  return fetchApi(`/companies/detail?name=${encodeURIComponent(name)}`);
}

// ============ EMAIL SEQUENCES ============

export async function getSequenceMetrics(): Promise<SequenceMetrics> {
  return fetchApi('/sequences/metrics');
}

export async function getSequences(): Promise<{ sequences: Sequence[] }> {
  return fetchApi('/sequences');
}

export async function createSequence(data: { name: string; steps?: SequenceStep[] }): Promise<Sequence> {
  return fetchApi('/sequences', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateSequence(
  id: string,
  data: { name?: string; steps?: SequenceStep[] }
): Promise<Sequence> {
  return fetchApi(`/sequences/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function setSequenceStatus(id: string, status: 'active' | 'paused'): Promise<Sequence> {
  return fetchApi(`/sequences/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
}

export async function deleteSequence(id: string): Promise<void> {
  await fetch(`${API_BASE}/sequences/${id}`, { method: 'DELETE' });
}

export async function getEnrollments(id: string): Promise<{ enrollments: SequenceEnrollment[] }> {
  return fetchApi(`/sequences/${id}/enrollments`);
}

export async function enrollContacts(
  id: string,
  contacts: { contactId?: string; name?: string; email: string }[]
): Promise<{ enrolled: number }> {
  return fetchApi(`/sequences/${id}/enroll`, { method: 'POST', body: JSON.stringify({ contacts }) });
}

export async function getSignatures(): Promise<{ signatures: Signature[] }> {
  return fetchApi('/sequences/signatures/all');
}

export async function createSignature(name: string, body: string): Promise<Signature> {
  return fetchApi('/sequences/signatures', { method: 'POST', body: JSON.stringify({ name, body }) });
}

export async function deleteSignature(id: string): Promise<void> {
  await fetch(`${API_BASE}/sequences/signatures/${id}`, { method: 'DELETE' });
}

export async function getMailbox(): Promise<Mailbox> {
  return fetchApi('/sequences/mailbox/status');
}

export async function connectMailbox(data: {
  fromEmail: string;
  fromName?: string;
  provider?: string;
}): Promise<Mailbox> {
  return fetchApi('/sequences/mailbox/connect', { method: 'POST', body: JSON.stringify(data) });
}

export async function disconnectMailbox(): Promise<Mailbox> {
  return fetchApi('/sequences/mailbox/disconnect', { method: 'POST' });
}

export async function sendTestEmail(to: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return fetchApi('/sequences/mailbox/test', { method: 'POST', body: JSON.stringify({ to }) });
}

// ============ AI (Claude) ============

export async function getAiStatus(): Promise<{ configured: boolean; model: string }> {
  return fetchApi('/ai/status');
}

export async function generateAiSequence(brief: {
  audience?: string;
  offering?: string;
  indication?: string;
  tone?: string;
  steps?: number;
}): Promise<{ name: string; steps: SequenceStep[] }> {
  return fetchApi('/ai/sequence', { method: 'POST', body: JSON.stringify(brief) });
}

export async function generateAiEmail(context: {
  contactName?: string;
  jobTitle?: string;
  company?: string;
  studyTitle?: string;
  indication?: string;
  goal?: string;
}): Promise<{ subject: string; body: string }> {
  return fetchApi('/ai/email', { method: 'POST', body: JSON.stringify(context) });
}
