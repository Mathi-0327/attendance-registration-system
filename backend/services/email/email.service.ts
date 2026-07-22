/**
 * @file backend/services/email/email.service.ts
 * @description Professional email service using Nodemailer.
 * Supports SMTP (Gmail, Outlook, custom) with HTML templates.
 * Designed to be swapped for SendGrid/Resend via environment config.
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { NotificationType } from "@shared/types";
import { renderEmailTemplate } from "./email.templates";

// ─────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────

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
  return {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    password: process.env.SMTP_PASSWORD || "",
    fromEmail: process.env.FROM_EMAIL || process.env.SMTP_USER || "noreply@attendreg.edu",
    fromName: process.env.FROM_NAME || "AttendReg System",
  };
}

// ─────────────────────────────────────────────
// EMAIL SERVICE CLASS
// ─────────────────────────────────────────────

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

    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.user,
        pass: this.config.password,
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === "production",
      },
    });

    this.isConfigured = true;
    console.log(`[email] Service initialized with SMTP: ${this.config.host}:${this.config.port}`);
  }

  /**
   * Reload config (e.g. after settings change).
   */
  reload(): void {
    this.config = getEmailConfig();
    this.transporter = null;
    this.initialize();
  }

  /**
   * Send a single email.
   */
  async sendEmail(options: {
    to: string;
    toName?: string;
    cc?: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isConfigured || !this.transporter) {
      console.log(
        `[email] DEV MODE (not sent) → To: ${options.to} | Subject: ${options.subject}`
      );
      return { success: true, messageId: "dev-mode-no-email" };
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"${this.config.fromName}" <${this.config.fromEmail}>`,
        to: options.toName ? `"${options.toName}" <${options.to}>` : options.to,
        cc: options.cc,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
      });

      console.log(`[email] Sent successfully → ${options.to} | ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      console.error(`[email] Failed → ${options.to} |`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send a typed notification email using templates.
   */
  async sendNotificationEmail(options: {
    to: string;
    toName?: string;
    cc?: string;
    type: NotificationType;
    data: Record<string, any>;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { subject, html } = renderEmailTemplate(options.type, options.data);
    return this.sendEmail({
      to: options.to,
      toName: options.toName,
      cc: options.cc,
      subject,
      html,
    });
  }

  /**
   * Verify SMTP connection (for settings page test).
   */
  async verifyConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured || !this.transporter) {
      return { success: false, error: "Email service not configured" };
    }
    try {
      await this.transporter.verify();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Strip HTML for plain text fallback.
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  }

  get configured(): boolean {
    return this.isConfigured;
  }
}

export const emailService = new EmailService();
