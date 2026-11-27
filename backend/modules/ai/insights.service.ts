/**
 * @file backend/modules/ai/insights.service.ts
 * @description Google Gemini API integration for generating intelligent textual summaries and answering chat questions.
 */

import { db } from "../../../database/db";
import { attendanceRecordsExtended } from "../../../database/schema/attendance.schema";
import { attendanceRecords } from "../../../database/schema";
import { eq } from "drizzle-orm";
import { predictionService } from "./prediction.service";

export class InsightsService {
  private getApiKey(): string {
    return process.env.GEMINI_API_KEY || "";
  }

  /**
   * Generates natural language insights for a student.
   * If Gemini API is available, calls the Google Gemini API.
   * Otherwise, generates a structured local statistical summary.
   */
  async generateInsights(studentId: string): Promise<string> {
    const prediction = await predictionService.generatePrediction(studentId);
    let records: Array<{ status: string }> = [];

    try {
      const extRecords = await db
        .select()
        .from(attendanceRecordsExtended)
        .where(eq(attendanceRecordsExtended.studentId, studentId));
      if (extRecords && extRecords.length > 0) {
        records = extRecords;
      }
    } catch {}

    if (records.length === 0) {
      try {
        const legacy = await db
          .select()
          .from(attendanceRecords)
          .where(eq(attendanceRecords.studentId, studentId));
        if (legacy && legacy.length > 0) {
          records = legacy as any;
        }
      } catch {}
    }

    const total = records.length;
    const present = records.filter(r => r.status === "present").length;
    const late = records.filter(r => r.status === "late").length;
    const absent = records.filter(r => r.status === "absent").length;

    const summaryContext = `
      Student ID: ${studentId}
      Current Attendance Rate: ${prediction.currentRate}%
      Predicted Attendance Rate: ${prediction.predictedRate}%
      Trend Direction: ${prediction.trendDirection}
      Risk Level: ${prediction.riskLevel}
      Risk Score: ${prediction.riskScore}/100
      Total Classes Scheduled: ${total}
      Present: ${present}
      Late: ${late}
      Absent: ${absent}
    `;

    const apiKey = this.getApiKey();
    if (!apiKey) {
      // Local fallback
      return `
### Attendance Analysis Report
- **Overview**: The student has participated in **${present + late}** out of **${total}** sessions, resulting in an overall attendance rate of **${prediction.currentRate}%**.
- **Trend Forecast**: The current attendance trend is classified as **${prediction.trendDirection}**. Next week's projected attendance rate is expected to be **${prediction.predictedRate}%**.
- **Risk Assessment**: The student's dropout risk is **${prediction.riskLevel.toUpperCase()}** (Score: ${prediction.riskScore}/100).
- **Recommendation**: ${prediction.recommendation}
      `.trim();
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const prompt = `
        You are an academic advisor analyzing student attendance.
        Based on the following data, write a brief, supportive, and professional analysis of the student's attendance. Include performance warnings if the rate is below 75%.
        Keep the response clear, in Markdown, and under 150 words.
        
        Data:
        ${summaryContext}
      `;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      if (!response.ok) {
        throw new Error("Gemini API call failed");
      }

      const resJson = await response.json() as any;
      const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        throw new Error("Empty candidate response from Gemini");
      }

      return text.trim();
    } catch (err: any) {
      console.warn("[ai-insights] Gemini request failed, using fallback. Error:", err.message);
      return `
### Attendance Analysis Report (Fallback)
- **Overview**: The student has attended **${present + late}** out of **${total}** classes, giving a rate of **${prediction.currentRate}%**.
- **Trend**: Projections indicate a **${prediction.trendDirection}** attendance curve with a risk level of **${prediction.riskLevel.toUpperCase()}**.
- **Recommendation**: ${prediction.recommendation}
      `.trim();
    }
  }

  /**
   * Simple chat helper to answer questions about attendance rules or a student.
   */
  async generateChatResponse(query: string, studentId?: string): Promise<string> {
    const apiKey = this.getApiKey();
    let context = "AttendReg System rules: Standard attendance threshold is 75%. Below 75% triggers warning alerts. Below 60% is high risk.";

    // Hoist prediction so it is accessible in the fallback block below
    let prediction: Awaited<ReturnType<typeof predictionService.generatePrediction>> | null = null;

    if (studentId) {
      prediction = await predictionService.generatePrediction(studentId);
      context += ` \nStudent context: Student ID ${studentId} has ${prediction.currentRate}% attendance and risk level is ${prediction.riskLevel}.`;
    }

    if (!apiKey) {
      // Basic rule-based helper
      const lower = query.toLowerCase();
      if (lower.includes("threshold") || lower.includes("minimum")) {
        return "The minimum required attendance to sit for exams is 75%. If your attendance falls below this threshold, you will receive automated warning alerts.";
      }
      if (lower.includes("risk") || lower.includes("dropout")) {
        return studentId
          ? `The current risk assessment for Student ID ${studentId} is ${prediction?.riskLevel || "Low"} with a predicted rate of ${prediction?.predictedRate || "100"}%.`
          : "Risk levels are calculated based on attendance records: Low, Medium, High, and Critical. Rates below 75% trigger warnings.";
      }
      return "Hello! I am the AttendReg AI Assistant. Ask me about attendance rules, required thresholds, or risk levels.";
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const prompt = `
        You are AttendReg's AI assistant. Answer the user's question about attendance or academic rules.
        Context: ${context}
        Question: ${query}
        Keep the response brief, polite, and under 100 words.
      `;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      const resJson = await response.json() as any;
      return resJson.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I could not formulate an answer right now.";
    } catch (err: any) {
      return "Hello! I'm your AI assistant. Currently, I cannot connect to the primary LLM server. Standard rules: 75% attendance is required to pass.";
    }
  }
}

export const insightsService = new InsightsService();
