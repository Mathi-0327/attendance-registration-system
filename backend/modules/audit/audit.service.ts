/**
 * @file backend/modules/audit/audit.service.ts
 * @description Persistent audit logging service.
 * Records security alerts, administrative actions, and data changes to the database.
 */

import { db } from "../../../database/db";
import { auditLogs } from "../../../database/schema/auth.schema";
import { desc } from "drizzle-orm";

export class AuditService {
  /**
   * Write an audit log entry to the database.
   */
  async logEvent(options: {
    userId?: number | null;
    userEmail?: string | null;
    action: string;
    resource: string;
    resourceId?: string | null;
    oldValue?: any;
    newValue?: any;
    ipAddress: string;
    userAgent?: string | null;
    severity?: "info" | "warning" | "critical";
  }): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        userId: options.userId ?? null,
        userEmail: options.userEmail ?? null,
        action: options.action,
        resource: options.resource,
        resourceId: options.resourceId ?? null,
        oldValue: options.oldValue ? JSON.stringify(options.oldValue) : null,
        newValue: options.newValue ? JSON.stringify(options.newValue) : null,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent ?? null,
        severity: options.severity ?? "info",
        timestamp: new Date(),
      });
    } catch (err: any) {
      console.error("[audit-log] Failed to write audit log to database:", err.message);
    }
  }

  /**
   * Retrieve recent logs (for administration view).
   */
  async getRecentLogs(limit = 100) {
    return db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);
  }
}

export const auditService = new AuditService();
