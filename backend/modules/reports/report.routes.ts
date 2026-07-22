/**
 * @file backend/modules/reports/report.routes.ts
 * @description API endpoints for custom attendance report generation and scheduled email delivery.
 */

import { Router, type Request, type Response } from "express";
import { reportService } from "./report.service";
import { requireAuth, requireFacultyOrAbove } from "../../auth/auth.middleware";
import { db } from "../../../database/db";
import { subjects } from "../../../database/schema/academic.schema";

const router = Router();

/**
 * POST /api/reports/generate
 * Generate a filtered attendance report.
 *
 * Body: ReportFilter (fromDate, toDate, department, subjectId, status, studentId, format)
 *
 * Returns: records[], summary{}, studentBreakdowns[], departmentBreakdowns{}, complianceTemplate?
 */
router.post("/generate", requireAuth, requireFacultyOrAbove, async (req: Request, res: Response) => {
  try {
    const report = await reportService.generateFilteredReport(req.body);
    return res.json(report);
  } catch (err: any) {
    console.error("[reports] generate error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/reports/schedule
 * Generate a report and dispatch it to the specified email address.
 *
 * Body: { filter: ReportFilter, recipientEmail: string, recipientName?: string }
 */
router.post("/schedule", requireAuth, requireFacultyOrAbove, async (req: Request, res: Response) => {
  try {
    const { filter, recipientEmail, recipientName } = req.body as {
      filter: Record<string, any>;
      recipientEmail: string;
      recipientName?: string;
    };

    if (!recipientEmail || !/\S+@\S+\.\S+/.test(recipientEmail)) {
      return res.status(400).json({ error: "A valid recipientEmail is required." });
    }

    await reportService.scheduleReport(filter ?? {}, recipientEmail, recipientName);

    return res.json({
      success: true,
      message: `Report dispatched to ${recipientEmail}.`,
    });
  } catch (err: any) {
    console.error("[reports] schedule error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/reports/subjects
 * Helper — return list of subjects for the filter dropdown in ReportBuilder.
 */
router.get("/subjects", requireAuth, async (_req: Request, res: Response) => {
  try {
    const list = await db.select().from(subjects);
    return res.json(list);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export const reportRouter = router;
export default router;
