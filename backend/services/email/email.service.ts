/**
 * @file backend/services/email/email.service.ts
 * @description Professional email service using Nodemailer.
 * Supports Gmail (auto-service) and custom SMTP with HTML templates.
 */

import "../../env";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { NotificationType } from "@shared/types";
import { renderEmailTemplate } from "./email.templates";

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

function getEmailConfig(): EmailConfig {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER || "";
  const password = process.env.SMTP_PASSWORD || process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || "";

  return {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    user,
    password,
    fromEmail: process.env.FROM_EMAIL || user || "noreply@attendreg.edu",
    fromName: process.env.FROM_NAME || "AttendReg System",
  };
}

export class EmailService {
  private transporter: Transporter | null = null;
  private config: EmailConfig;
  private isConfigured: boolean = false;

  constructor() {
    this.config = getEmailConfig();
    this.initialize();
  }

  private initialize(): void {
    if (!this.config.user || !this.config.password) {
      console.warn(
        "[email] SMTP credentials not configured. Email sending disabled. " +
        "Set SMTP_USER and SMTP_PASSWORD environment variables to enable email."
      );
      this.isConfigured = false;
      return;
    }

    try {
      const isGmail = this.config.host.includes("gmail") || this.config.user.includes("@gmail.com");
      this.transporter = nodemailer.createTransport(
        isGmail
          ? {
              service: "gmail",
              auth: {
                user: this.config.user,
                pass: this.config.password,
              },
            }
          : {
              host: this.config.host,
              port: this.config.port,
              secure: this.config.secure,
              auth: {
                user: this.config.user,
                pass: this.config.password,
              },
            }
      );
      this.isConfigured = true;
      console.log(`[email] Email service initialized successfully for ${this.config.user}`);
    } catch (error) {
      console.error("[email] Failed to initialize email transporter:", error);
      this.isConfigured = false;
    }
  }

  reload(): void {
    this.config = getEmailConfig();
    this.initialize();
  }

  async sendEmail(options: {
    to: string;
    toName?: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isConfigured || !this.transporter) {
      this.reload();
      if (!this.isConfigured || !this.transporter) {
        return { success: false, error: "Email service not configured" };
      }
    }

    try {
      const recipient = options.toName ? `"${options.toName}" <${options.to}>` : options.to;
      const info = await this.transporter.sendMail({
        from: `"${this.config.fromName}" <${this.config.fromEmail}>`,
        to: recipient,
        subject: options.subject,
        html: options.html,
        text: options.text || "",
      });

      console.log(`[email] Sent successfully to ${options.to} (ID: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      console.error(`[email] Failed to send email to ${options.to}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  get configured(): boolean {
    return this.isConfigured;
  }
}

export const emailService = new EmailService();
