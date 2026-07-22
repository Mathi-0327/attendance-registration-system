/**
 * @file backend/modules/audit/audit.routes.ts
 * @description REST endpoints for reading and writing persistent audit logs.
 */

import { Router, type Request, type Response } from "express";
import { auditService } from "./audit.service";
import { requireAuth, requireRole } from "../../auth/auth.middleware";
import { UserRole } from "../../../shared/types";

export const auditRouter = Router();

/**
 * @route  GET /api/audit/logs
 * @access Admin / HOD only
 * @desc   Retrieve the most recent audit log entries.
 */
auditRouter.get(
  "/logs",
  requireAuth,
  requireRole([UserRole.INSTITUTION_ADMIN, UserRole.HOD, UserRole.SUPER_ADMIN]),
  async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      const logs = await auditService.getRecentLogs(limit);
      res.json({ logs, total: logs.length });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch audit logs", message: err.message });
    }
  }
);

/**
 * @route  POST /api/audit/log
 * @access Internal / Admin
 * @desc   Manually emit an audit log entry (for client-side notable events).
 */
auditRouter.post(
  "/log",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { action, resource, resourceId, oldValue, newValue, severity } = req.body;
      if (!action || !resource) {
        return res.status(400).json({ error: "action and resource are required" });
      }

      const user = (req as any).user;
      await auditService.logEvent({
        userId: user?.id ?? null,
        userEmail: user?.email ?? null,
        action,
        resource,
        resourceId: resourceId ?? null,
        oldValue,
        newValue,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"],
        severity: severity ?? "info",
      });

      res.json({ message: "Audit log recorded" });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to log event", message: err.message });
    }
  }
);
