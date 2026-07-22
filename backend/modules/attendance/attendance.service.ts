/**
 * @file backend/modules/attendance/attendance.service.ts
 * @description Business logic for Phase 4 Enhanced Attendance Engine.
 * Handles extended attendance submission, bulk marking, summary computation,
 * geo-fence validation, and attendance threshold checks.
 */

import { attendanceRepository } from "./attendance.repository";
import type { InsertAttendanceRecord, InsertAttendanceSession } from "./attendance.repository";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface SubmitAttendanceInput {
  sessionId: number;
  studentId: string;
  name: string;
  subjectId?: number;
  department?: string;
  ipAddress: string;
  device: string;
  markedBy?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  confidence?: number;
  livenessScore?: number;
}

export interface BulkAttendanceInput {
  sessionId: number;
  records: Array<{
    studentId: string;
    name: string;
    status: "present" | "absent" | "late" | "on_duty" | "medical_leave";
    department?: string;
    subjectId?: number;
  }>;
  markedBy?: string;
}

export interface GeoFenceCheckInput {
  studentLat: number;
  studentLng: number;
  targetLat: number;
  targetLng: number;
  radiusMeters: number;
}

export interface AttendanceSummaryResult {
  studentId: string;
  subjects: Array<{
    subjectId: number | null;
    subjectName?: string;
    totalClasses: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    leaveCount: number;
    attendancePercentage: number;
    status: "safe" | "warning" | "critical";
  }>;
  overall: {
    totalClasses: number;
    presentCount: number;
    attendancePercentage: number;
  };
}

// ─────────────────────────────────────────────
// GEO-FENCE UTILITY
// ─────────────────────────────────────────────

/**
 * Haversine formula to calculate distance between two GPS coordinates in meters.
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// ─────────────────────────────────────────────
// ATTENDANCE SERVICE
// ─────────────────────────────────────────────

export class AttendanceService {
  /**
   * Check if student GPS coordinates are within the allowed geo-fence.
   */
  checkGeoFence(input: GeoFenceCheckInput): {
    allowed: boolean;
    distanceMeters: number;
    message: string;
  } {
    const distance = calculateDistance(
      input.studentLat,
      input.studentLng,
      input.targetLat,
      input.targetLng
    );

    const allowed = distance <= input.radiusMeters;
    return {
      allowed,
      distanceMeters: Math.round(distance),
      message: allowed
        ? `Within geo-fence (${Math.round(distance)}m from class)`
        : `Outside geo-fence by ${Math.round(distance - input.radiusMeters)}m`,
    };
  }

  /**
   * Create a new extended attendance session.
   */
  async createSession(data: InsertAttendanceSession) {
    return attendanceRepository.createExtendedSession({
      ...data,
      createdAt: data.createdAt || new Date(),
    });
  }

  /**
   * Submit a single attendance record with full validation.
   * - Duplicate check (same student in same session)
   * - Geo-fence validation (if session has geo-fence configured)
   * - Session active check
   */
  async submitAttendance(input: SubmitAttendanceInput) {
    const session = await attendanceRepository.findExtendedSessionById(input.sessionId);

    if (!session) {
      throw new Error("Session not found");
    }

    if (!session.isActive) {
      throw new Error("Session is not active");
    }

    // Duplicate check
    const existing = await attendanceRepository.findExtendedRecordBySessionAndStudent(
      input.sessionId,
      input.studentId
    );
    if (existing) {
      throw new Error("Attendance already submitted for this session");
    }

    // Geo-fence advisory check (if session has geo-fence configured)
    let geoFenceWarning: string | null = null;
    if (
      session.geoFenceLatitude &&
      session.geoFenceLongitude &&
      session.geoFenceRadius &&
      input.latitude !== undefined &&
      input.longitude !== undefined
    ) {
      const geoCheck = this.checkGeoFence({
        studentLat: input.latitude,
        studentLng: input.longitude,
        targetLat: session.geoFenceLatitude,
        targetLng: session.geoFenceLongitude,
        radiusMeters: session.geoFenceRadius,
      });
      if (!geoCheck.allowed) {
        geoFenceWarning = geoCheck.message;
        // Advisory only — we don't block but record the warning
      }
    }

    // Determine if late entry
    const now = new Date();
    const sessionStart = new Date(session.startTime);
    const minutesDiff = Math.floor((now.getTime() - sessionStart.getTime()) / 60000);
    const isLate =
      session.allowLateEntry &&
      session.lateEntryAfterMinutes !== null &&
      minutesDiff > (session.lateEntryAfterMinutes ?? 15);

    const status = isLate ? "late" : "present";

    const record = await attendanceRepository.createExtendedRecord({
      sessionId: input.sessionId,
      studentId: input.studentId,
      name: input.name,
      subjectId: input.subjectId,
      department: input.department,
      status,
      markedAt: now,
      markedBy: input.markedBy || "self",
      ipAddress: input.ipAddress,
      device: input.device,
      latitude: input.latitude,
      longitude: input.longitude,
      locationAccuracy: input.locationAccuracy,
      confidence: input.confidence,
      livenessScore: input.livenessScore,
    });

    // Update session counts
    await attendanceRepository.updateExtendedSessionCounts(input.sessionId, {
      present: 1,
    });

    // Recompute summary if subject is linked
    if (input.subjectId) {
      await this.recomputeSummary(input.studentId, input.subjectId);
    }

    return { record, geoFenceWarning };
  }

  /**
   * Bulk mark attendance for an entire class.
   * Used by faculty for offline reconciliation or Excel import.
   */
  async markBulkAttendance(input: BulkAttendanceInput) {
    const session = await attendanceRepository.findExtendedSessionById(input.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const results: Array<{ studentId: string; status: string; error?: string }> = [];
    let presentDelta = 0;
    let absentDelta = 0;

    for (const item of input.records) {
      try {
        const existing = await attendanceRepository.findExtendedRecordBySessionAndStudent(
          input.sessionId,
          item.studentId
        );
        if (existing) {
          results.push({ studentId: item.studentId, status: "skipped", error: "Already marked" });
          continue;
        }

        await attendanceRepository.createExtendedRecord({
          sessionId: input.sessionId,
          studentId: item.studentId,
          name: item.name,
          status: item.status,
          subjectId: item.subjectId,
          department: item.department,
          markedAt: new Date(),
          markedBy: input.markedBy || "bulk",
          ipAddress: "bulk-import",
          device: "bulk-import",
        });

        if (item.status === "present" || item.status === "late") presentDelta++;
        else absentDelta++;

        results.push({ studentId: item.studentId, status: "success" });

        // Recompute summary per student/subject
        if (item.subjectId) {
          await this.recomputeSummary(item.studentId, item.subjectId);
        }
      } catch (err: any) {
        results.push({ studentId: item.studentId, status: "error", error: err.message });
      }
    }

    await attendanceRepository.updateExtendedSessionCounts(input.sessionId, {
      present: presentDelta,
      absent: absentDelta,
    });

    return { results, total: input.records.length, successCount: results.filter(r => r.status === "success").length };
  }

  /**
   * Recompute and persist the attendance summary for a given student+subject.
   */
  async recomputeSummary(studentId: string, subjectId: number): Promise<void> {
    const records = await attendanceRepository.findExtendedRecordsByStudentAndSubject(
      studentId,
      subjectId
    );

    const totalClasses = records.length;
    const presentCount = records.filter((r) => r.status === "present" || r.status === "late").length;
    const absentCount = records.filter((r) => r.status === "absent").length;
    const lateCount = records.filter((r) => r.status === "late").length;
    const leaveCount = records.filter(
      (r) => r.status === "on_duty" || r.status === "medical_leave"
    ).length;

    const attendancePercentage =
      totalClasses > 0 ? Math.round((presentCount / totalClasses) * 10000) / 100 : 0;

    await attendanceRepository.upsertAttendanceSummary({
      studentId,
      subjectId,
      totalClasses,
      presentCount,
      absentCount,
      lateCount,
      leaveCount,
      attendancePercentage,
      lastUpdated: new Date(),
    });
  }

  /**
   * Get full attendance summary for a student across all subjects.
   */
  async getStudentSummary(studentId: string): Promise<AttendanceSummaryResult> {
    const summaries = await attendanceRepository.findSummaryByStudentAndSubject(studentId);

    const subjects = summaries.map((s) => ({
      subjectId: s.subjectId ?? null,
      totalClasses: s.totalClasses,
      presentCount: s.presentCount,
      absentCount: s.absentCount,
      lateCount: s.lateCount,
      leaveCount: s.leaveCount,
      attendancePercentage: s.attendancePercentage,
      status:
        s.attendancePercentage >= 75
          ? ("safe" as const)
          : s.attendancePercentage >= 60
          ? ("warning" as const)
          : ("critical" as const),
    }));

    const totalClasses = subjects.reduce((sum, s) => sum + s.totalClasses, 0);
    const presentCount = subjects.reduce((sum, s) => sum + s.presentCount, 0);
    const overallPercentage =
      totalClasses > 0 ? Math.round((presentCount / totalClasses) * 10000) / 100 : 0;

    return {
      studentId,
      subjects,
      overall: {
        totalClasses,
        presentCount,
        attendancePercentage: overallPercentage,
      },
    };
  }

  /**
   * Check which students are below the attendance threshold for a session/subject.
   */
  async checkAttendanceThreshold(
    threshold: number = 75
  ): Promise<Array<{ studentId: string; percentage: number; subjectId: number | null }>> {
    // We'd normally query all summaries below threshold here
    // For now we delegate — a future AI phase will use this
    return [];
  }

  /**
   * Grant grace attendance to a student for a subject.
   */
  async grantGraceAttendance(
    studentId: string,
    subjectId: number,
    grantedClasses: number,
    grantedBy: number,
    reason: string
  ) {
    const grace = await attendanceRepository.createGraceAttendance({
      studentId,
      subjectId,
      grantedClasses,
      grantedBy,
      reason,
      grantedAt: new Date(),
    });

    // Adjust the summary to include grace
    const summaries = await attendanceRepository.findSummaryByStudentAndSubject(
      studentId,
      subjectId
    );
    if (summaries.length > 0) {
      const s = summaries[0];
      const adjustedPresent = s.presentCount + grantedClasses;
      const adjustedPercentage =
        s.totalClasses > 0
          ? Math.round((adjustedPresent / s.totalClasses) * 10000) / 100
          : 0;

      await attendanceRepository.upsertAttendanceSummary({
        studentId,
        subjectId,
        totalClasses: s.totalClasses,
        presentCount: adjustedPresent,
        absentCount: s.absentCount,
        lateCount: s.lateCount,
        leaveCount: s.leaveCount,
        attendancePercentage: adjustedPercentage,
        lastUpdated: new Date(),
      });
    }

    return grace;
  }

  /**
   * Parse Excel/CSV bulk import rows into BulkAttendanceInput format.
   * Expected columns: StudentID, Name, Status, Department (optional), SubjectCode (optional)
   */
  parseBulkImportRows(
    rows: Array<Record<string, string>>,
    sessionId: number
  ): BulkAttendanceInput {
    const validStatuses = ["present", "absent", "late", "on_duty", "medical_leave"] as const;

    const records = rows
      .filter((row) => row["StudentID"] && row["Name"])
      .map((row) => {
        const rawStatus = (row["Status"] || "present").toLowerCase().replace(/\s+/g, "_");
        const status = validStatuses.includes(rawStatus as any)
          ? (rawStatus as (typeof validStatuses)[number])
          : ("present" as const);

        return {
          studentId: String(row["StudentID"]).trim(),
          name: String(row["Name"]).trim(),
          status,
          department: row["Department"] ? String(row["Department"]).trim() : undefined,
        };
      });

    return { sessionId, records, markedBy: "bulk" };
  }
}

export const attendanceService = new AttendanceService();
