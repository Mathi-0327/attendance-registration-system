/**
 * @file backend/services/email/email.queue.ts
 * @description In-memory email queue with retry logic.
 * Processes emails in background. Redis-ready interface for scaling.
 */

import { db } from "../../../database/db";
import { emailQueue } from "../../../database/schema/auth.schema";
import { eq, and, lt, lte } from "drizzle-orm";
import { emailService } from "./email.service";
import type { NotificationType } from "@shared/types";
import { renderEmailTemplate } from "./email.templates";

// ─────────────────────────────────────────────
// EMAIL QUEUE SERVICE
// ─────────────────────────────────────────────

export class EmailQueueService {
  private processingInterval: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 10;
  private readonly RETRY_DELAY_MINUTES = [1, 5, 30]; // Retry at 1min, 5min, 30min

  constructor() {
    this.startProcessor();
  }

  /**
   * Add an email to the queue (persistent via DB).
   */
  async queueEmail(options: {
    toEmail: string;
    toName?: string;
    ccEmail?: string;
    type: NotificationType;
    data: Record<string, any>;
    scheduledAt?: Date;
  }): Promise<void> {
    const { subject, html } = renderEmailTemplate(options.type, options.data);

    await db.insert(emailQueue).values({
      toEmail: options.toEmail,
      toName: options.toName,
      ccEmail: options.ccEmail,
      subject,
      htmlBody: html,
      type: options.type,
      status: "pending",
      retryCount: 0,
      maxRetries: 3,
      scheduledAt: options.scheduledAt || new Date(),
      createdAt: new Date(),
    });
  }

  /**
   * Queue multiple emails at once (bulk).
   */
  async queueBulkEmail(
    recipients: Array<{ email: string; name?: string; data: Record<string, any> }>,
    type: NotificationType
  ): Promise<void> {
    const inserts = recipients.map((r) => {
      const { subject, html } = renderEmailTemplate(type, r.data);
      return {
        toEmail: r.email,
        toName: r.name,
        subject,
        htmlBody: html,
        type,
        status: "pending" as const,
        retryCount: 0,
        maxRetries: 3,
        scheduledAt: new Date(),
        createdAt: new Date(),
      };
    });

    if (inserts.length > 0) {
      await db.insert(emailQueue).values(inserts as any);
    }
  }

  /**
   * Process pending emails in queue (runs every 30 seconds).
   */
  private async processPendingEmails(): Promise<void> {
    try {
      const now = new Date();
      const pending = await db
        .select()
        .from(emailQueue)
        .where(
          and(
            eq(emailQueue.status, "pending"),
            lte(emailQueue.scheduledAt, now)
          )
        )
        .limit(this.BATCH_SIZE);

      for (const item of pending) {
        await this.processEmailItem(item.id, item.toEmail, item.toName ?? undefined, item.subject, item.htmlBody, item.retryCount);
      }
    } catch (error) {
      console.error("[email-queue] Process error:", error);
    }
  }

  private async processEmailItem(
    id: number,
    toEmail: string,
    toName: string | undefined,
    subject: string,
    htmlBody: string,
    retryCount: number
  ): Promise<void> {
    const result = await emailService.sendEmail({
      to: toEmail,
      toName,
      subject,
      html: htmlBody,
    });

    if (result.success) {
      await db
        .update(emailQueue)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(emailQueue.id, id));
    } else {
      const maxRetries = 3;
      if (retryCount >= maxRetries) {
        await db
          .update(emailQueue)
          .set({ status: "failed", errorMessage: result.error })
          .where(eq(emailQueue.id, id));
      } else {
        // Schedule retry with exponential backoff
        const delayMinutes = this.RETRY_DELAY_MINUTES[retryCount] ?? 60;
        const retryAt = new Date(Date.now() + delayMinutes * 60 * 1000);
        await db
          .update(emailQueue)
          .set({
            retryCount: retryCount + 1,
            scheduledAt: retryAt,
            errorMessage: result.error,
          })
          .where(eq(emailQueue.id, id));
      }
    }
  }

  /**
   * Start the background email processor.
   */
  private startProcessor(): void {
    this.processingInterval = setInterval(() => {
      this.processPendingEmails().catch(console.error);
    }, 30 * 1000); // Every 30 seconds

    console.log("[email-queue] Background processor started (30s interval)");
  }

  /**
   * Stop the processor (for graceful shutdown).
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  /**
   * Get queue statistics.
   */
  async getStats(): Promise<{
    pending: number;
    sent: number;
    failed: number;
  }> {
    const [pending, sent, failed] = await Promise.all([
      db.select().from(emailQueue).where(eq(emailQueue.status, "pending")),
      db.select().from(emailQueue).where(eq(emailQueue.status, "sent")),
      db.select().from(emailQueue).where(eq(emailQueue.status, "failed")),
    ]);
    return {
      pending: pending.length,
      sent: sent.length,
      failed: failed.length,
    };
  }
}

export const emailQueueService = new EmailQueueService();
