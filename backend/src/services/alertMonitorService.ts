import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { clinicalTrialsService } from './clinicalTrialsService.js';
import { notificationService, type TrialInfo } from './notificationService.js';
import type {
  ResearchAlert,
  AlertNotification,
  AlertFrequency,
} from '../types/alerts.js';

// In-memory storage (replace with database in production)
const alerts: Map<string, ResearchAlert> = new Map();
const notifications: Map<string, AlertNotification> = new Map();

// Track scheduled jobs
const scheduledJobs: Map<string, cron.ScheduledTask> = new Map();

export class AlertMonitorService {
  private isRunning = false;

  constructor() {
    this.startScheduler();
  }

  private getCronExpression(frequency: AlertFrequency): string {
    switch (frequency) {
      case 'hourly':
        return '0 * * * *'; // Every hour at minute 0
      case 'every6hours':
        return '0 */6 * * *'; // Every 6 hours
      case 'daily':
        return '0 9 * * *'; // Daily at 9 AM
      case 'weekly':
        return '0 9 * * 1'; // Weekly on Monday at 9 AM
      default:
        return '0 * * * *';
    }
  }

  private startScheduler(): void {
    // Main scheduler that checks all alerts every minute
    // and runs checks based on individual alert frequencies
    cron.schedule('* * * * *', () => {
      this.runScheduledChecks();
    });

    console.log('📅 Alert monitor scheduler started');
  }

  private async runScheduledChecks(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const now = new Date();
      const activeAlerts = Array.from(alerts.values()).filter((a) => a.isActive);

      for (const alert of activeAlerts) {
        if (this.shouldRunCheck(alert, now)) {
          await this.checkAlert(alert);
        }
      }
    } catch (error) {
      console.error('Error in scheduled checks:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private shouldRunCheck(alert: ResearchAlert, now: Date): boolean {
    if (!alert.lastChecked) return true;

    const lastCheck = new Date(alert.lastChecked);
    const diffMs = now.getTime() - lastCheck.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    switch (alert.frequency) {
      case 'hourly':
        return diffHours >= 1;
      case 'every6hours':
        return diffHours >= 6;
      case 'daily':
        return diffHours >= 24;
      case 'weekly':
        return diffHours >= 168; // 7 * 24
      default:
        return diffHours >= 1;
    }
  }

  async checkAlert(alert: ResearchAlert): Promise<{
    newTrials: TrialInfo[];
    notificationSent: boolean;
  }> {
    console.log(`🔍 Checking alert: ${alert.name}`);

    try {
      // Search for trials matching the criteria
      const results = await clinicalTrialsService.searchStudies({
        ...alert.searchParams,
        pageSize: 100,
        sort: 'StudyFirstPostDate',
        sortOrder: 'desc',
      });

      // Find new trials (not in seenTrialIds)
      const newTrials: TrialInfo[] = [];
      const seenIds = new Set(alert.seenTrialIds);

      for (const study of results.studies) {
        const nctId = study.protocolSection.identificationModule.nctId;

        if (!seenIds.has(nctId)) {
          newTrials.push({
            nctId,
            title: study.protocolSection.identificationModule.briefTitle,
            status: study.protocolSection.statusModule.overallStatus,
            conditions: study.protocolSection.conditionsModule?.conditions || [],
            sponsor: study.protocolSection.sponsorCollaboratorsModule?.leadSponsor?.name,
            url: `https://clinicaltrials.gov/study/${nctId}`,
          });

          // Add to seen list
          seenIds.add(nctId);
        }
      }

      // Update alert
      alert.lastChecked = new Date().toISOString();
      alert.seenTrialIds = Array.from(seenIds);
      alert.matchCount = results.totalCount;
      alert.updatedAt = new Date().toISOString();
      alerts.set(alert.id, alert);

      let notificationSent = false;

      // Send notifications if there are new trials
      if (newTrials.length > 0) {
        console.log(`📬 Found ${newTrials.length} new trials for alert: ${alert.name}`);

        const notifyResult = await notificationService.sendAlertNotification({
          alertName: alert.name,
          channels: alert.notificationChannels,
          email: alert.email,
          phone: alert.phone,
          trials: newTrials,
        });

        // Record notification
        const notification: AlertNotification = {
          id: uuidv4(),
          alertId: alert.id,
          alertName: alert.name,
          trialIds: newTrials.map((t) => t.nctId),
          trialCount: newTrials.length,
          sentVia: [
            ...(notifyResult.emailSent ? ['email' as const] : []),
            ...(notifyResult.smsSent ? ['sms' as const] : []),
          ],
          sentAt: new Date().toISOString(),
          success: notifyResult.emailSent || notifyResult.smsSent,
          errorMessage: notifyResult.errors.length > 0 ? notifyResult.errors.join('; ') : undefined,
        };

        notifications.set(notification.id, notification);
        alert.lastNotified = notification.sentAt;
        alerts.set(alert.id, alert);

        notificationSent = notification.success;
      }

      return { newTrials, notificationSent };
    } catch (error) {
      console.error(`Error checking alert ${alert.name}:`, error);
      return { newTrials: [], notificationSent: false };
    }
  }

  // CRUD Operations
  createAlert(data: Omit<ResearchAlert, 'id' | 'seenTrialIds' | 'matchCount' | 'createdAt' | 'updatedAt'>): ResearchAlert {
    const now = new Date().toISOString();
    const alert: ResearchAlert = {
      ...data,
      id: uuidv4(),
      seenTrialIds: [],
      matchCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    alerts.set(alert.id, alert);
    console.log(`✅ Created alert: ${alert.name}`);

    // Run initial check
    this.checkAlert(alert);

    return alert;
  }

  getAlerts(): ResearchAlert[] {
    return Array.from(alerts.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getAlert(id: string): ResearchAlert | undefined {
    return alerts.get(id);
  }

  updateAlert(id: string, data: Partial<ResearchAlert>): ResearchAlert | null {
    const existing = alerts.get(id);
    if (!existing) return null;

    const updated: ResearchAlert = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    alerts.set(id, updated);
    return updated;
  }

  deleteAlert(id: string): boolean {
    return alerts.delete(id);
  }

  toggleAlert(id: string): ResearchAlert | null {
    const alert = alerts.get(id);
    if (!alert) return null;

    alert.isActive = !alert.isActive;
    alert.updatedAt = new Date().toISOString();
    alerts.set(id, alert);

    console.log(`${alert.isActive ? '▶️' : '⏸️'} Alert ${alert.name} ${alert.isActive ? 'activated' : 'paused'}`);
    return alert;
  }

  // Manually trigger a check
  async triggerCheck(id: string): Promise<{ newTrials: TrialInfo[]; notificationSent: boolean } | null> {
    const alert = alerts.get(id);
    if (!alert) return null;

    return this.checkAlert(alert);
  }

  // Get notification history
  getNotifications(alertId?: string): AlertNotification[] {
    let notificationList = Array.from(notifications.values());

    if (alertId) {
      notificationList = notificationList.filter((n) => n.alertId === alertId);
    }

    return notificationList.sort(
      (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
    );
  }

  // Get stats
  getStats(): {
    totalAlerts: number;
    activeAlerts: number;
    totalNotifications: number;
    recentNotifications: number;
  } {
    const allAlerts = Array.from(alerts.values());
    const allNotifications = Array.from(notifications.values());
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    return {
      totalAlerts: allAlerts.length,
      activeAlerts: allAlerts.filter((a) => a.isActive).length,
      totalNotifications: allNotifications.length,
      recentNotifications: allNotifications.filter(
        (n) => new Date(n.sentAt).getTime() > oneDayAgo
      ).length,
    };
  }
}

export const alertMonitorService = new AlertMonitorService();
