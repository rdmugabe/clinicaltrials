import type { SearchParams } from './clinicalTrials.js';

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

export interface AlertCheckResult {
  alertId: string;
  newTrials: Array<{
    nctId: string;
    title: string;
    status: string;
    conditions: string[];
    sponsor?: string;
  }>;
  checkedAt: string;
}

export interface NotificationSettings {
  email?: string;
  phone?: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
}
