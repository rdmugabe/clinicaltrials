// Contact and Outreach Types

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
  variables: string[]; // e.g., ['contactName', 'trialTitle', 'organizationName']
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

export interface BulkEmailRequest {
  contactIds: string[];
  templateId?: string;
  subject: string;
  body: string;
  sendAt?: string; // ISO date for scheduled sending
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
