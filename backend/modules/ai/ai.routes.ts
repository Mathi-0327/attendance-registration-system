/**
 * @file backend/modules/ai/ai.routes.ts
 * @description API endpoints for AI prediction models, performance insights, and AI chat.
 */

import { Router, type Request, type Response } from "express";
import { predictionService } from "./prediction.service";
import { insightsService } from "./insights.service";
import { requireAuth, requireStudentSelf } from "../../auth/auth.middleware";

const router = Router();

// GET /api/ai/predictions/:studentId - Get attendance forecast and risk level
router.get("/predictions/:studentId", requireAuth, requireStudentSelf, async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const prediction = await predictionService.generatePrediction(studentId);
    return res.json(prediction);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/insights/:studentId - Get natural language summary report (local or Gemini)
router.get("/insights/:studentId", requireAuth, requireStudentSelf, async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const insights = await insightsService.generateInsights(studentId);
    return res.json({ insights });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/chat - Q&A interface for attendance rules
router.post("/chat", requireAuth, async (req: Request, res: Response) => {
  try {
    const { query, studentId } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Query parameter is required" });
    }
    const reply = await insightsService.generateChatResponse(query, studentId);
    return res.json({ reply });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export const aiRouter = router;
export default router;
