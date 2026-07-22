/**
 * @file backend/services/sms/sms.service.ts
 * @description Standard SMS service using Twilio.
 * Activated via TWILIO_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.
 * Falls back to console logs in development mode.
 */

export interface SmsConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

function getSmsConfig(): SmsConfig {
  return {
    accountSid: process.env.TWILIO_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    fromNumber: process.env.TWILIO_PHONE_NUMBER || "",
  };
}

export class SmsService {
  private config: SmsConfig;
  private isConfigured: boolean = false;

  constructor() {
    this.config = getSmsConfig();
    this.initialize();
  }

  private initialize(): void {
    if (!this.config.accountSid || !this.config.authToken || !this.config.fromNumber) {
      console.warn(
        "[sms] Twilio credentials not fully configured. SMS sending disabled. " +
        "Set TWILIO_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in env."
      );
      this.isConfigured = false;
      return;
    }
    this.isConfigured = true;
    console.log(`[sms] Twilio service initialized (From: ${this.config.fromNumber})`);
  }

  /**
   * Reload configuration.
   */
  reload(): void {
    this.config = getSmsConfig();
    this.initialize();
  }

  /**
   * Send SMS via Twilio API.
   */
  async sendSms(options: {
    to: string;
    body: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const formattedTo = options.to.startsWith("+") ? options.to : `+91${options.to}`; // Default to Indian prefix if missing

    if (!this.isConfigured) {
      console.log(
        `[sms] DEV MODE (not sent) → To: ${formattedTo} | Body: ${options.body}`
      );
      return { success: true, messageId: "dev-mode-no-sms" };
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`;
      const auth = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString("base64");

      const params = new URLSearchParams();
      params.append("To", formattedTo);
      params.append("From", this.config.fromNumber);
      params.append("Body", options.body);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${auth}`,
        },
        body: params.toString(),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        throw new Error(data.message || "Failed to send SMS via Twilio");
      }

      console.log(`[sms] Sent successfully → ${formattedTo} | SID: ${data.sid}`);
      return { success: true, messageId: data.sid };
    } catch (error: any) {
      console.error(`[sms] Failed to send SMS to ${formattedTo}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  get configured(): boolean {
    return this.isConfigured;
  }
}

export const smsService = new SmsService();
