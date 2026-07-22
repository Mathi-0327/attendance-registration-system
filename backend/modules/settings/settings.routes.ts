/**
 * @file backend/modules/settings/settings.routes.ts
 * @description API endpoints for notification and system settings.
 */

import { Router, type Request, type Response } from "express";
import { settingsService } from "./settings.service";
import { requireAuth, requireAdminLevel } from "../../auth/auth.middleware";
import { pushService } from "../../services/notifications/push.service";
import { z } from "zod";

const router = Router();

const updateNotificationSchema = z.object({
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  absentAlertEnabled: z.boolean().optional(),
  attendanceConfirmEnabled: z.boolean().optional(),
  lowAttendanceEnabled: z.boolean().optional(),
  reportEmailEnabled: z.boolean().optional(),
});

const systemSettingSchema = z.object({
  key: z.string().min(1),
  value: z.any(),
  category: z.string().optional().default("general"),
  description: z.string().optional().default(""),
});

// GET /api/settings/notifications - Get current user notification settings
router.get("/notifications", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const settings = await settingsService.getNotificationSettings(userId);
    return res.json(settings);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings/notifications - Update current user notification settings
router.put("/notifications", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const parsed = updateNotificationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }
    const settings = await settingsService.updateNotificationSettings(userId, parsed.data);
    return res.json({ message: "Notification settings updated", settings });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/settings/notifications/subscribe - Store a web push subscription
router.post("/notifications/subscribe", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const subscription = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: "Invalid push subscription object" });
    }
    
    await pushService.subscribeUser(userId, subscription);
    return res.json({ message: "Browser push subscription registered successfully" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/system - Get all system settings (Admin only)
router.get("/system", requireAuth, requireAdminLevel, async (req: Request, res: Response) => {
  try {
    const settings = await settingsService.getSystemSettings();
    return res.json(settings);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/settings/system - Create/Update system setting (Admin only)
router.post("/system", requireAuth, requireAdminLevel, async (req: Request, res: Response) => {
  try {
    const parsed = systemSettingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }
    
    const userId = req.user!.userId;
    const { key, value, category, description } = parsed.data;
    
    const setting = await settingsService.setSystemSetting(key, value, category, description, userId);
    return res.json({ message: "System setting saved successfully", setting });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export const settingsRouter = router;
export default router;
