import { emailService } from './emailService.js';
import { smsService } from './smsService.js';
import type { NotificationChannel } from '../types/alerts.js';

export interface TrialInfo {
  nctId: string;
  title: string;
  status: string;
  conditions: string[];
  sponsor?: string;
  url: string;
}

export class NotificationService {
  async sendAlertNotification(params: {
    alertName: string;
    channels: NotificationChannel;
    email?: string;
    phone?: string;
    trials: TrialInfo[];
  }): Promise<{
    emailSent: boolean;
    smsSent: boolean;
    errors: string[];
  }> {
    const { alertName, channels, email, phone, trials } = params;
    const errors: string[] = [];
    let emailSent = false;
    let smsSent = false;

    const shouldSendEmail = (channels === 'email' || channels === 'both') && email;
    const shouldSendSms = (channels === 'sms' || channels === 'both') && phone;

    // Send email notification
    if (shouldSendEmail) {
      const emailResult = await this.sendEmailNotification(alertName, email!, trials);
      if (emailResult.success) {
        emailSent = true;
      } else {
        errors.push(`Email: ${emailResult.error}`);
      }
    }

    // Send SMS notification
    if (shouldSendSms) {
      const smsResult = await this.sendSmsNotification(alertName, phone!, trials);
      if (smsResult.success) {
        smsSent = true;
      } else {
        errors.push(`SMS: ${smsResult.error}`);
      }
    }

    return { emailSent, smsSent, errors };
  }

  private async sendEmailNotification(
    alertName: string,
    email: string,
    trials: TrialInfo[]
  ): Promise<{ success: boolean; error?: string }> {
    const subject = `🔬 ${trials.length} New Clinical Trial${trials.length > 1 ? 's' : ''} Found - ${alertName}`;

    const trialsList = trials
      .map(
        (trial, idx) => `
${idx + 1}. ${trial.title}
   NCT ID: ${trial.nctId}
   Status: ${trial.status}
   Conditions: ${trial.conditions.join(', ') || 'N/A'}
   ${trial.sponsor ? `Sponsor: ${trial.sponsor}` : ''}
   View: ${trial.url}
`
      )
      .join('\n');

    const body = `Your research alert "${alertName}" found ${trials.length} new clinical trial${trials.length > 1 ? 's' : ''} matching your criteria:

${trialsList}

---
Manage your alerts at: ${process.env.FRONTEND_URL || 'http://localhost:3002'}

This is an automated notification from Clinical Trials Research.`;

    return emailService.sendEmail(email, subject, body);
  }

  private async sendSmsNotification(
    alertName: string,
    phone: string,
    trials: TrialInfo[]
  ): Promise<{ success: boolean; error?: string }> {
    let message: string;

    if (trials.length === 1) {
      const trial = trials[0];
      message = `🔬 New Trial Alert: "${alertName}"

${trial.title}

${trial.nctId} | ${trial.status}
${trial.conditions.slice(0, 2).join(', ')}

${trial.url}`;
    } else {
      // For multiple trials, send a summary
      const trialSummary = trials
        .slice(0, 3)
        .map((t) => `• ${t.nctId}: ${t.title.substring(0, 50)}...`)
        .join('\n');

      message = `🔬 Alert: "${alertName}"

${trials.length} new trials found:

${trialSummary}
${trials.length > 3 ? `\n+${trials.length - 3} more` : ''}

Check email for details.`;
    }

    // Truncate to SMS limit
    message = smsService.truncateMessage(message);

    return smsService.sendSms(phone, message);
  }

  getServiceStatus(): {
    email: { configured: boolean };
    sms: { configured: boolean };
  } {
    return {
      email: { configured: emailService.isConfigured() },
      sms: { configured: smsService.isConfigured() },
    };
  }
}

export const notificationService = new NotificationService();
