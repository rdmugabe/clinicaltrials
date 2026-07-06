import sgMail from '@sendgrid/mail';
import nodemailer, { type Transporter } from 'nodemailer';
import { db } from '../db/database.js';
import { suppressionService } from './suppressionService.js';
import type { OutreachRecord, EmailTemplate, OrganizationSettings } from '../types/outreach.js';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---- Provider configuration ----------------------------------------------
// Any SMTP provider (Mailtrap, Gmail, Brevo, Resend, SendGrid SMTP, …) can be
// used by setting SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS. SMTP takes
// precedence when configured; otherwise we fall back to the SendGrid API.
//
// IMPORTANT: env is read at call time (not module load) — dotenv.config() runs
// after this module is first imported, so reading at load time would miss it.
function smtpEnv() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  // Default: implicit TLS on 465, STARTTLS otherwise. Override with SMTP_SECURE.
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
  return { host, user, pass, port, secure, ready: !!(host && user && pass) };
}

/** The SendGrid key, but only if it's real (starts with "SG.") — ignores the .env placeholder. */
function sendgridKey(): string | null {
  const k = process.env.SENDGRID_API_KEY;
  return k && k.startsWith('SG.') ? k : null;
}

export class EmailService {
  private smtp: Transporter | null = null;

  /** Sender the user set in the Mailbox tab wins; then env; then a default. */
  private mailboxSender(): { email?: string; name?: string } {
    try {
      const r = db.prepare('SELECT from_email, from_name FROM mailbox WHERE id = 1').get() as
        | { from_email?: string; from_name?: string }
        | undefined;
      return { email: r?.from_email || undefined, name: r?.from_name || undefined };
    } catch {
      return {};
    }
  }
  private get fromEmail(): string {
    return this.mailboxSender().email || process.env.FROM_EMAIL || 'noreply@example.com';
  }
  private get fromName(): string {
    return this.mailboxSender().name || process.env.FROM_NAME || 'Clinical Trials Research';
  }

  /** Which provider will actually send: 'smtp' | 'sendgrid' | 'none'. */
  provider(): 'smtp' | 'sendgrid' | 'none' {
    if (smtpEnv().ready) return 'smtp';
    if (sendgridKey()) return 'sendgrid';
    return 'none';
  }

  isConfigured(): boolean {
    return this.provider() !== 'none';
  }

  /** Lazily build (and reuse) the SMTP transport. */
  private getSmtp(): Transporter {
    if (!this.smtp) {
      const { host, port, secure, user, pass } = smtpEnv();
      this.smtp = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    }
    return this.smtp;
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
  ): Promise<{ success: boolean; messageId?: string; error?: string; suppressed?: boolean }> {
    // Never email an address that has opted out.
    if (suppressionService.isSuppressed(to)) {
      return { success: false, suppressed: true, error: 'Recipient has unsubscribed' };
    }

    const provider = this.provider();
    if (provider === 'none') {
      return {
        success: false,
        error: 'No email provider configured (set SMTP_* or SENDGRID_API_KEY)',
      };
    }

    // Append a per-recipient unsubscribe footer + List-Unsubscribe header (CAN-SPAM
    // + one-click unsubscribe for deliverability).
    const unsubUrl = suppressionService.unsubscribeUrl(to);
    const textBody = `${body}\n\n—\nYou received this from ${this.fromName}. Unsubscribe: ${unsubUrl}`;
    const htmlBody =
      `${body.replace(/\n/g, '<br>')}` +
      `<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0 8px"><p style="font-size:12px;color:#8a94a6;font-family:sans-serif">` +
      `You received this from ${escapeHtml(this.fromName)}. <a href="${unsubUrl}" style="color:#8a94a6">Unsubscribe</a>.</p>`;
    const listHeaders = {
      'List-Unsubscribe': `<${unsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };

    // SMTP path (Mailtrap, Gmail, Brevo, etc.).
    if (provider === 'smtp') {
      try {
        const info = await this.getSmtp().sendMail({
          from: { address: this.fromEmail, name: this.fromName },
          to,
          subject,
          text: textBody,
          html: htmlBody,
          replyTo: options?.replyTo,
          headers: listHeaders,
        });
        return { success: true, messageId: info.messageId };
      } catch (error: any) {
        console.error('SMTP error:', error);
        return { success: false, error: error.message || 'SMTP send failed' };
      }
    }

    // SendGrid API path.
    try {
      sgMail.setApiKey(sendgridKey()!);
      const msg = {
        to,
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        subject,
        html: htmlBody,
        text: textBody,
        headers: listHeaders,
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
