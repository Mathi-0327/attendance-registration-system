/**
 * @file backend/modules/automation/automation.routes.ts
 * @description REST API for automation settings, SMTP config, rules config,
 * workflow logs, and manual trigger endpoints.
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { notificationService } from "./notification.service";
import { rulesEngine } from "./rules.engine";
import { workflowDispatcher } from "./workflow.dispatcher";
import { cronScheduler } from "./cron.scheduler";

const router = Router();

// ─────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────

const smtpConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  user: z.string().min(1),
  pass: z.string().min(1),
  fromName: z.string().min(1),
  fromEmail: z.string().email(),
});

const rulesConfigSchema = z.object({
  lateThresholdMinutes: z.number().int().min(1).max(60),
  absenceAlertThreshold: z.number().int().min(1).max(100),
  criticalThreshold: z.number().int().min(1).max(100),
  minSessionsForAlert: z.number().int().min(1).max(50),
  enableLateAlerts: z.boolean(),
  enableAbsenceAlerts: z.boolean(),
  enableProxyAlerts: z.boolean(),
  alertRecipientEmail: z.string().email().or(z.literal("")),
});

// ─────────────────────────────────────────────
// SMTP CONFIG
// ─────────────────────────────────────────────

// GET /api/automation/smtp — Get current SMTP config (password masked)
router.get("/smtp", (_req: Request, res: Response) => {
  const config = notificationService.getSmtpConfig();
  return res.json({
    configured: notificationService.isConfigured(),
    config: config ?? null,
  });
});

// POST /api/automation/smtp — Save SMTP config
router.post("/smtp", (req: Request, res: Response) => {
  const parsed = smtpConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid config", details: parsed.error.errors });
  }
  notificationService.setSmtpConfig(parsed.data);
  return res.json({ message: "SMTP configuration saved successfully" });
});

// POST /api/automation/smtp/test — Test SMTP connection
router.post("/smtp/test", async (_req: Request, res: Response) => {
  const result = await notificationService.testConnection();
  return res.json(result);
});

// POST /api/automation/smtp/send-test — Send a test email
router.post("/smtp/send-test", async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "email is required" });

  const result = await notificationService.sendEmail({
    to: email,
    subject: "✅ Test Email — AI Smart Attendance System",
    html: `<div style="font-family:sans-serif;padding:24px;"><h2>Test Email</h2><p>Your SMTP configuration is working correctly. 🎉</p><p style="color:#64748b;font-size:12px;">Sent from AI Smart Attendance System</p></div>`,
    text: "Your SMTP configuration is working correctly.",
  });
  return res.json(result);
});

// ─────────────────────────────────────────────
// RULES CONFIG
// ─────────────────────────────────────────────

// GET /api/automation/rules — Get current rules config
router.get("/rules", (_req: Request, res: Response) => {
  return res.json({ config: rulesEngine.getConfig() });
});

// PUT /api/automation/rules — Update rules config
router.put("/rules", (req: Request, res: Response) => {
  const parsed = rulesConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid config", details: parsed.error.errors });
  }
  rulesEngine.updateConfig(parsed.data);
  return res.json({ message: "Rules configuration updated", config: rulesEngine.getConfig() });
});

// ─────────────────────────────────────────────
// WORKFLOW LOGS
// ─────────────────────────────────────────────

// GET /api/automation/logs — Get recent workflow event logs
router.get("/logs", (_req: Request, res: Response) => {
  const logs = workflowDispatcher.getLogs();
  return res.json({ logs, total: logs.length });
});

// ─────────────────────────────────────────────
// MANUAL TRIGGERS
// ─────────────────────────────────────────────

// POST /api/automation/trigger/absence-check — Manually run absence check
router.post("/trigger/absence-check", async (_req: Request, res: Response) => {
  const result = await cronScheduler.runNow();
  return res.json({
    message: "Absence check complete",
    ...result,
  });
});

// POST /api/automation/trigger/late-alert — Manually fire a late alert (testing)
router.post("/trigger/late-alert", async (req: Request, res: Response) => {
  const schema = z.object({
    studentName: z.string(),
    studentId: z.string(),
    department: z.string().optional(),
    sessionName: z.string(),
    sessionStartTime: z.string(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
  }

  await workflowDispatcher.dispatch({
    type: "ATTENDANCE_MARKED",
    payload: {
      ...parsed.data,
      department: parsed.data.department || "N/A",
      sessionId: 0,
      sessionStartTime: new Date(parsed.data.sessionStartTime),
      submittedAt: new Date(),
      ipAddress: "127.0.0.1",
      device: "test",
    },
  });

  return res.json({ message: "Late alert dispatched" });
});

export const automationRouter = router;
