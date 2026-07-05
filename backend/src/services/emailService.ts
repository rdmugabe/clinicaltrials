import sgMail from '@sendgrid/mail';
import type { OutreachRecord, EmailTemplate, OrganizationSettings } from '../types/outreach.js';

// Initialize SendGrid
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export class EmailService {
  private fromEmail: string;
  private fromName: string;

  constructor() {
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@example.com';
    this.fromName = process.env.FROM_NAME || 'Clinical Trials Research';
  }

  isConfigured(): boolean {
    return Boolean(SENDGRID_API_KEY);
  }

  parseTemplateVariables(template: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;
    while ((match = regex.exec(template)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    return variables;
  }

  replaceVariables(
    template: string,
    variables: Record<string, string>
  ): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
    }
    return result;
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string,
    options?: {
      replyTo?: string;
      trackOpens?: boolean;
      trackClicks?: boolean;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'SendGrid API key not configured',
      };
    }

    try {
      const msg = {
        to,
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        subject,
        html: body.replace(/\n/g, '<br>'),
        text: body,
        trackingSettings: {
          openTracking: {
            enable: options?.trackOpens ?? true,
          },
          clickTracking: {
            enable: options?.trackClicks ?? true,
          },
        },
        replyTo: options?.replyTo,
      };

      const [response] = await sgMail.send(msg);

      return {
        success: true,
        messageId: response.headers['x-message-id'] as string,
      };
    } catch (error: any) {
      console.error('SendGrid error:', error);
      return {
        success: false,
        error: error.response?.body?.errors?.[0]?.message || error.message,
      };
    }
  }

  async sendBulkEmails(
    emails: Array<{
      to: string;
      subject: string;
      body: string;
      contactId: string;
    }>,
    onProgress?: (sent: number, total: number) => void
  ): Promise<{
    successful: Array<{ contactId: string; messageId: string }>;
    failed: Array<{ contactId: string; error: string }>;
  }> {
    const successful: Array<{ contactId: string; messageId: string }> = [];
    const failed: Array<{ contactId: string; error: string }> = [];

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];

      // Rate limiting: SendGrid recommends max 100 emails/second
      if (i > 0 && i % 50 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const result = await this.sendEmail(email.to, email.subject, email.body);

      if (result.success && result.messageId) {
        successful.push({ contactId: email.contactId, messageId: result.messageId });
      } else {
        failed.push({ contactId: email.contactId, error: result.error || 'Unknown error' });
      }

      onProgress?.(i + 1, emails.length);
    }

    return { successful, failed };
  }

  generateDefaultTemplates(): EmailTemplate[] {
    const now = new Date().toISOString();

    return [
      {
        id: 'template_intro',
        name: 'Initial Outreach',
        subject: 'Research Collaboration Inquiry - {{trialTitle}}',
        body: `Dear {{contactName}},

I am reaching out from {{organizationName}} regarding the clinical trial "{{trialTitle}}" ({{nctId}}).

We are interested in learning more about potential collaboration opportunities and how our organization might contribute to this important research.

{{customMessage}}

Would you be available for a brief call to discuss this further?

Best regards,
{{senderName}}
{{organizationName}}
{{senderEmail}}
{{senderPhone}}`,
        variables: ['contactName', 'organizationName', 'trialTitle', 'nctId', 'customMessage', 'senderName', 'senderEmail', 'senderPhone'],
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'template_followup',
        name: 'Follow-up Email',
        subject: 'Following Up - {{trialTitle}}',
        body: `Dear {{contactName}},

I wanted to follow up on my previous message regarding the clinical trial "{{trialTitle}}" ({{nctId}}).

We remain very interested in exploring collaboration opportunities and would welcome the chance to discuss how {{organizationName}} could support this research.

{{customMessage}}

Please let me know if you have any availability in the coming weeks.

Best regards,
{{senderName}}
{{organizationName}}`,
        variables: ['contactName', 'organizationName', 'trialTitle', 'nctId', 'customMessage', 'senderName'],
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'template_partnership',
        name: 'Partnership Proposal',
        subject: 'Partnership Opportunity - {{trialTitle}}',
        body: `Dear {{contactName}},

On behalf of {{organizationName}}, I am writing to propose a potential partnership regarding the clinical trial "{{trialTitle}}" ({{nctId}}).

Our organization specializes in:
{{organizationDescription}}

We believe there may be synergies between our capabilities and your research objectives.

{{customMessage}}

I would be happy to provide additional information about our organization and discuss how we might work together.

Best regards,
{{senderName}}
{{organizationName}}
{{organizationWebsite}}`,
        variables: ['contactName', 'organizationName', 'organizationDescription', 'organizationWebsite', 'trialTitle', 'nctId', 'customMessage', 'senderName'],
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }
}

export const emailService = new EmailService();
