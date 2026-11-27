/**
 * @file backend/services/sms/sms.service.ts
 * @description Multi-channel mobile alert gateway supporting Fast2SMS (Free India SMS),
 * WhatsApp (via CallMeBot 100% Free), Twilio, and Textlocal.
 */

import "../../env";

export interface SmsConfig {
  provider: "fast2sms" | "whatsapp" | "twilio" | "textlocal" | "none";
  // Fast2SMS (Free Tier India SMS)
  fast2smsKey?: string;
  // WhatsApp (CallMeBot 100% Free)
  whatsappKey?: string;
  // Twilio
  accountSid?: string;
  authToken?: string;
  fromNumber?: string;
  // Textlocal (India)
  textlocalKey?: string;
  textlocalSender?: string;
}

function getSmsConfig(): SmsConfig {
  if (process.env.FAST2SMS_API_KEY) {
    return {
      provider: "fast2sms",
      fast2smsKey: process.env.FAST2SMS_API_KEY,
    };
  }

  if (process.env.WHATSAPP_API_KEY || process.env.CALLMEBOT_API_KEY) {
    return {
      provider: "whatsapp",
      whatsappKey: process.env.WHATSAPP_API_KEY || process.env.CALLMEBOT_API_KEY,
    };
  }

  if (process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
    return {
      provider: "twilio",
      accountSid: process.env.TWILIO_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromNumber: process.env.TWILIO_PHONE_NUMBER,
    };
  }

  if (process.env.TEXTLOCAL_API_KEY) {
    return {
      provider: "textlocal",
      textlocalKey: process.env.TEXTLOCAL_API_KEY,
      textlocalSender: process.env.TEXTLOCAL_SENDER || "TXTLCL",
    };
  }

  return { provider: "none" };
}

export class SmsService {
  private config: SmsConfig;

  constructor() {
    this.config = getSmsConfig();
    this.logStatus();
  }

  private logStatus(): void {
    if (this.config.provider === "fast2sms") {
      console.log("[sms] Fast2SMS Gateway active for real SMS delivery.");
    } else if (this.config.provider === "whatsapp") {
      console.log("[sms] WhatsApp Gateway active for 100% free mobile messaging.");
    } else if (this.config.provider === "twilio") {
      console.log(`[sms] Twilio SMS Gateway active (From: ${this.config.fromNumber}).`);
    } else if (this.config.provider === "textlocal") {
      console.log("[sms] Textlocal SMS Gateway active.");
    } else {
      console.warn(
        "[sms] No live SMS API key detected. Running in simulated audit mode. " +
        "For 100% free delivery, set FAST2SMS_API_KEY or WHATSAPP_API_KEY in .env"
      );
    }
  }

  reload(): void {
    this.config = getSmsConfig();
    this.logStatus();
  }

  get configured(): boolean {
    return this.config.provider !== "none";
  }

  get providerName(): string {
    return this.config.provider;
  }

  /**
   * Send SMS or WhatsApp alert via the configured channel
   */
  async sendSms(options: {
    to: string;
    body: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string; provider?: string }> {
    const rawNumber = options.to.replace(/\D/g, "");
    const tenDigitNumber = rawNumber.slice(-10); // Indian 10-digit number
    const formattedWithCountry = rawNumber.startsWith("91") ? rawNumber : `91${tenDigitNumber}`;
    const formattedWithPlus = `+${formattedWithCountry}`;

    // 1. Fast2SMS (Free Tier India SMS)
    if (this.config.provider === "fast2sms" && this.config.fast2smsKey) {
      try {
        const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
          method: "POST",
          headers: {
            authorization: this.config.fast2smsKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            route: "q",
            message: options.body,
            language: "english",
            flash: 0,
            numbers: tenDigitNumber,
          }),
        });

        const data = (await response.json()) as any;
        if (data.return === true) {
          console.log(`[sms/fast2sms] Delivered to ${tenDigitNumber} | Request ID: ${data.request_id}`);
          return { success: true, messageId: data.request_id, provider: "fast2sms" };
        } else {
          const errorMsg = Array.isArray(data.message) ? data.message.join(", ") : (data.message || "Fast2SMS dispatch failed");
          throw new Error(errorMsg);
        }
      } catch (err: any) {
        console.error(`[sms/fast2sms] Error sending to ${tenDigitNumber}:`, err.message);
        return { success: false, error: err.message, provider: "fast2sms" };
      }
    }

    // 2. WhatsApp (CallMeBot - 100% Free)
    if (this.config.provider === "whatsapp" && this.config.whatsappKey) {
      try {
        const encodedText = encodeURIComponent(options.body);
        const url = `https://api.callmebot.com/whatsapp.php?phone=+${formattedWithCountry}&text=${encodedText}&apikey=${this.config.whatsappKey}`;
        const response = await fetch(url);
        const text = await response.text();

        if (response.ok && !text.toLowerCase().includes("error")) {
          console.log(`[sms/whatsapp] WhatsApp alert sent to +${formattedWithCountry}`);
          return { success: true, messageId: "whatsapp-sent", provider: "whatsapp" };
        } else {
          throw new Error(text || "WhatsApp delivery failed");
        }
      } catch (err: any) {
        console.error(`[sms/whatsapp] Error sending to +${formattedWithCountry}:`, err.message);
        return { success: false, error: err.message, provider: "whatsapp" };
      }
    }

    // 3. Twilio Provider
    if (this.config.provider === "twilio" && this.config.accountSid && this.config.authToken && this.config.fromNumber) {
      try {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`;
        const auth = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString("base64");

        const params = new URLSearchParams();
        params.append("To", formattedWithPlus);
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

        const data = (await response.json()) as any;
        if (!response.ok) {
          throw new Error(data.message || "Twilio delivery failed");
        }

        console.log(`[sms/twilio] Delivered to ${formattedWithPlus} | SID: ${data.sid}`);
        return { success: true, messageId: data.sid, provider: "twilio" };
      } catch (err: any) {
        console.error(`[sms/twilio] Error sending to ${formattedWithPlus}:`, err.message);
        return { success: false, error: err.message, provider: "twilio" };
      }
    }

    // 4. Textlocal Provider
    if (this.config.provider === "textlocal" && this.config.textlocalKey) {
      try {
        const params = new URLSearchParams();
        params.append("apikey", this.config.textlocalKey);
        params.append("numbers", formattedWithCountry);
        params.append("message", encodeURIComponent(options.body));
        params.append("sender", this.config.textlocalSender || "TXTLCL");

        const response = await fetch("https://api.textlocal.in/send/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        });

        const data = (await response.json()) as any;
        if (data.status === "success") {
          return { success: true, messageId: String(data.batch_id), provider: "textlocal" };
        } else {
          throw new Error(data.errors?.[0]?.message || "Textlocal delivery failed");
        }
      } catch (err: any) {
        console.error(`[sms/textlocal] Error sending to ${formattedWithCountry}:`, err.message);
        return { success: false, error: err.message, provider: "textlocal" };
      }
    }

    // 5. Simulated fallback
    console.log(`[sms/simulation] 📱 To: ${formattedWithPlus} | Content: ${options.body}`);
    return { success: true, messageId: "simulated-dev-sms", provider: "simulated" };
  }
}

export const smsService = new SmsService();
