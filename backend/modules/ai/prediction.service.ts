/**
 * @file backend/modules/ai/prediction.service.ts
 * @description Local statistical AI models for attendance rate projections and dropout risk assessments.
 */

import { db } from "../../../database/db";
import { attendanceRecordsExtended, attendancePredictions } from "../../../database/schema/attendance.schema";
import { attendanceRecords } from "../../../database/schema";
import { eq, desc } from "drizzle-orm";

export class PredictionService {
  /**
   * Generates or fetches attendance predictions for a specific student.
   */
  async generatePrediction(studentId: string) {
    // 1. Fetch recent attendance records (try extended table, fallback to standard attendance records)
    let records: Array<{ status: string; markedAt?: Date; timestamp?: Date }> = [];
    try {
      const extRecords = await db
        .select()
        .from(attendanceRecordsExtended)
        .where(eq(attendanceRecordsExtended.studentId, studentId))
        .orderBy(desc(attendanceRecordsExtended.markedAt));
      if (extRecords && extRecords.length > 0) {
        records = extRecords;
      }
    } catch {
      // Table might not exist or be empty
    }

    if (records.length === 0) {
      try {
        const legacy = await db
          .select()
          .from(attendanceRecords)
          .where(eq(attendanceRecords.studentId, studentId))
          .orderBy(desc(attendanceRecords.timestamp));

        if (legacy && legacy.length > 0) {
          records = legacy.map((r) => ({
            status: r.status,
            markedAt: r.timestamp,
          }));
        }
      } catch (e: any) {
        console.warn("[prediction] Could not query legacy attendance records:", e?.message);
      }
    }

    const totalCount = records.length;
    if (totalCount === 0) {
      return {
        studentId,
        currentRate: 100,
        predictedRate: 100,
        trendDirection: "stable" as const,
        riskScore: 0,
        riskLevel: "low" as const,
        recommendation: "Excellent! Maintain regular class attendance.",
      };
    }

    const presentRecords = records.filter(
      (r) => r.status === "present" || r.status === "late" || r.status === "on_duty"
    );
    const currentRate = Math.round((presentRecords.length / totalCount) * 100);

    // 2. Perform simple linear regression on the last 30 entries
    // Treat each entry index as 'x' and status as 'y' (1 for present, 0 for absent)
    const dataPoints = records.slice(0, 30).reverse().map((r, index) => ({
      x: index + 1,
      y: (r.status === "present" || r.status === "late" || r.status === "on_duty") ? 1 : 0,
    }));

    let predictedRate = currentRate;
    let trendDirection: "improving" | "declining" | "stable" = "stable";

    if (dataPoints.length >= 3) {
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      const n = dataPoints.length;

      for (const p of dataPoints) {
        sumX += p.x;
        sumY += p.y;
        sumXY += p.x * p.y;
        sumXX += p.x * p.x;
      }

      const denominator = n * sumXX - sumX * sumX;
      if (denominator !== 0) {
        const slope = (n * sumXY - sumX * sumY) / denominator;
        
        // Predict the rate for next 5 classes (representing next week)
        const nextX = n + 3;
        const predictedY = (sumY / n) + slope * (nextX - (sumX / n));
        
        // Convert to percentage
        predictedRate = Math.max(0, Math.min(100, Math.round(predictedY * 100)));

        if (slope > 0.02) trendDirection = "improving";
        else if (slope < -0.02) trendDirection = "declining";
      }
    }

    // 3. Assess risk level
    let riskScore = 0;
    if (predictedRate < 75) {
      riskScore = Math.round((75 - predictedRate) * 4); // Scale risk up to 100
    }
    riskScore = Math.max(0, Math.min(100, riskScore));

    let riskLevel: "low" | "medium" | "high" | "critical" = "low";
    if (riskScore > 80 || predictedRate < 50) riskLevel = "critical";
    else if (riskScore > 50 || predictedRate < 70) riskLevel = "high";
    else if (riskScore > 20 || predictedRate < 75) riskLevel = "medium";

    let recommendation = "Attendance is on track. Keep up the good work.";
    if (riskLevel === "critical" || riskLevel === "high") {
      recommendation = "Warning: Attendance is critically low. Immediate counseling recommended to prevent academic warning.";
    } else if (riskLevel === "medium") {
      recommendation = "Attention: Attendance is borderline. Try to attend all upcoming classes.";
    }

    const predictionData = {
      studentId,
      currentRate,
      predictedRate,
      trendDirection,
      riskScore,
      riskLevel,
      recommendation,
      generatedAt: new Date(),
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // Valid for 1 day
    };

    // Save prediction in DB safely
    try {
      const existing = await db
        .select()
        .from(attendancePredictions)
        .where(eq(attendancePredictions.studentId, studentId))
        .limit(1)
        .then((rows) => rows[0]);

      if (existing) {
        await db
          .update(attendancePredictions)
          .set(predictionData)
          .where(eq(attendancePredictions.id, existing.id));
      } else {
        await db.insert(attendancePredictions).values(predictionData);
      }
    } catch (saveErr: any) {
      console.warn("[prediction] Could not persist prediction to DB:", saveErr?.message);
    }

    return predictionData;
  }
}

export const predictionService = new PredictionService();
