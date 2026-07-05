import twilio from 'twilio';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

let twilioClient: twilio.Twilio | null = null;

if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

export class SmsService {
  isConfigured(): boolean {
    return Boolean(twilioClient && TWILIO_PHONE_NUMBER);
  }

  async sendSms(
    to: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Twilio is not configured',
      };
    }

    try {
      // Ensure phone number is in E.164 format
      const formattedPhone = this.formatPhoneNumber(to);

      const result = await twilioClient!.messages.create({
        body: message,
        from: TWILIO_PHONE_NUMBER,
        to: formattedPhone,
      });

      return {
        success: true,
        messageId: result.sid,
      };
    } catch (error: any) {
      console.error('Twilio SMS error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send SMS',
      };
    }
  }

  formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters except leading +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // If no country code, assume US (+1)
    if (!cleaned.startsWith('+')) {
      if (cleaned.length === 10) {
        cleaned = '+1' + cleaned;
      } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
        cleaned = '+' + cleaned;
      } else {
        cleaned = '+' + cleaned;
      }
    }

    return cleaned;
  }

  truncateMessage(message: string, maxLength: number = 1600): string {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength - 3) + '...';
  }
}

export const smsService = new SmsService();
