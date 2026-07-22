/**
 * @file backend/modules/attendance/attendance.repository.ts
 * @description Repository for all attendance-related database operations.
 * Handles legacy sessions/records AND extended sessions, leave requests,
 * corrections, summaries, and grace attendance from Phase 4.
 */

import { db } from "../../../database/db";
import { eq, desc, and, gte, lte, isNull, sql } from "drizzle-orm";
import {
  sessions as legacySessions,
  attendanceRecords as legacyRecords,
  type Session as LegacySession,
  type InsertSession as InsertLegacySession,
  type AttendanceRecord as LegacyRecord,
  type InsertAttendance as InsertLegacyRecord,
} from "../../../database/schema";
import {
  attendanceSessions,
  attendanceRecordsExtended,
  leaveRequests,
  attendanceCorrections,
  attendanceSummary,
  graceAttendance,
  faceRecognitionLogs,
  type AttendanceSession,
  type AttendanceRecordExtended,
  type LeaveRequest,
  type AttendanceCorrection,
  type AttendanceSummary,
  type GraceAttendance,
} from "../../../database/schema/attendance.schema";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type InsertAttendanceSession = typeof attendanceSessions.$inferInsert;
export type InsertAttendanceRecord = typeof attendanceRecordsExtended.$inferInsert;
export type InsertLeaveRequest = typeof leaveRequests.$inferInsert;
export type InsertCorrection = typeof attendanceCorrections.$inferInsert;
export type InsertSummary = typeof attendanceSummary.$inferInsert;
export type InsertGrace = typeof graceAttendance.$inferInsert;

export class AttendanceRepository {
  // ─────────────────────────────────────────────
  // LEGACY SESSIONS
  // ─────────────────────────────────────────────

  async findSessionById(id: number): Promise<LegacySession | undefined> {
    const [session] = await db.select().from(legacySessions).where(eq(legacySessions.id, id));
    return session;
  }

  async getActiveSession(): Promise<LegacySession | undefined> {
    const [session] = await db
      .select()
      .from(legacySessions)
      .where(eq(legacySessions.isActive, true));
    return session;
  }

  async createSession(data: InsertLegacySession): Promise<LegacySession> {
    const [session] = await db.insert(legacySessions).values(data).returning();
    return session;
  }

  async updateSession(id: number, active: boolean, endTime?: Date): Promise<LegacySession> {
    const [updated] = await db
      .update(legacySessions)
      .set({
        isActive: active,
        endTime: endTime || (active ? null : new Date()),
      })
      .where(eq(legacySessions.id, id))
      .returning();
    return updated;
  }

  async findAllSessions(): Promise<LegacySession[]> {
    return db.select().from(legacySessions).orderBy(desc(legacySessions.startTime));
  }

  // ─────────────────────────────────────────────
  // LEGACY RECORDS
  // ─────────────────────────────────────────────

  async createRecord(data: InsertLegacyRecord): Promise<LegacyRecord> {
    const [record] = await db
      .insert(legacyRecords)
      .values({
        ...data,
        timestamp: data.timestamp || new Date(),
      })
      .returning();
    return record;
  }

  async findAllRecords(): Promise<LegacyRecord[]> {
    return db.select().from(legacyRecords).orderBy(desc(legacyRecords.timestamp));
  }

  async findRecordById(id: number): Promise<LegacyRecord | undefined> {
    const [record] = await db.select().from(legacyRecords).where(eq(legacyRecords.id, id));
    return record;
  }

  async deleteRecord(id: number): Promise<boolean> {
    const result = await db.delete(legacyRecords).where(eq(legacyRecords.id, id)).returning();
    return result.length > 0;
  }

  async clearAllRecords(): Promise<void> {
    await db.delete(legacyRecords);
  }

  // ─────────────────────────────────────────────
  // FACE RECOGNITION LOGS
  // ─────────────────────────────────────────────

  async logFaceRecognitionAttempt(data: typeof faceRecognitionLogs.$inferInsert): Promise<void> {
    await db.insert(faceRecognitionLogs).values({
      ...data,
      timestamp: data.timestamp || new Date(),
    });
  }

  // ─────────────────────────────────────────────
  // EXTENDED SESSIONS
  // ─────────────────────────────────────────────

  async createExtendedSession(data: InsertAttendanceSession): Promise<AttendanceSession> {
    const [session] = await db.insert(attendanceSessions).values(data).returning();
    return session;
  }

  async findExtendedSessionById(id: number): Promise<AttendanceSession | undefined> {
    const [session] = await db.select().from(attendanceSessions).where(eq(attendanceSessions.id, id));
    return session;
  }

  async getActiveExtendedSession(): Promise<AttendanceSession | undefined> {
    const [session] = await db
      .select()
      .from(attendanceSessions)
      .where(eq(attendanceSessions.isActive, true));
    return session;
  }

  async closeExtendedSession(id: number): Promise<AttendanceSession> {
    const [updated] = await db
      .update(attendanceSessions)
      .set({ isActive: false, endTime: new Date() })
      .where(eq(attendanceSessions.id, id))
      .returning();
    return updated;
  }

  async updateExtendedSessionCounts(
    id: number,
    delta: { present?: number; absent?: number }
  ): Promise<void> {
    await db
      .update(attendanceSessions)
      .set({
        presentCount: sql`${attendanceSessions.presentCount} + ${delta.present ?? 0}`,
        absentCount: sql`${attendanceSessions.absentCount} + ${delta.absent ?? 0}`,
      })
      .where(eq(attendanceSessions.id, id));
  }

  async findAllExtendedSessions(): Promise<AttendanceSession[]> {
    return db.select().from(attendanceSessions).orderBy(desc(attendanceSessions.startTime));
  }

  // ─────────────────────────────────────────────
  // EXTENDED RECORDS
  // ─────────────────────────────────────────────

  async createExtendedRecord(data: InsertAttendanceRecord): Promise<AttendanceRecordExtended> {
    const [record] = await db.insert(attendanceRecordsExtended).values(data).returning();
    return record;
  }

  async findExtendedRecordsBySession(sessionId: number): Promise<AttendanceRecordExtended[]> {
    return db
      .select()
      .from(attendanceRecordsExtended)
      .where(eq(attendanceRecordsExtended.sessionId, sessionId))
      .orderBy(desc(attendanceRecordsExtended.markedAt));
  }

  async findExtendedRecordsByStudent(studentId: string): Promise<AttendanceRecordExtended[]> {
    return db
      .select()
      .from(attendanceRecordsExtended)
      .where(eq(attendanceRecordsExtended.studentId, studentId))
      .orderBy(desc(attendanceRecordsExtended.markedAt));
  }

  async findExtendedRecordBySessionAndStudent(
    sessionId: number,
    studentId: string
  ): Promise<AttendanceRecordExtended | undefined> {
    const [record] = await db
      .select()
      .from(attendanceRecordsExtended)
      .where(
        and(
          eq(attendanceRecordsExtended.sessionId, sessionId),
          eq(attendanceRecordsExtended.studentId, studentId)
        )
      );
    return record;
  }

  async updateExtendedRecord(
    id: number,
    data: Partial<InsertAttendanceRecord>
  ): Promise<AttendanceRecordExtended> {
    const [updated] = await db
      .update(attendanceRecordsExtended)
      .set(data)
      .where(eq(attendanceRecordsExtended.id, id))
      .returning();
    return updated;
  }

  async findExtendedRecordsByStudentAndSubject(
    studentId: string,
    subjectId: number
  ): Promise<AttendanceRecordExtended[]> {
    return db
      .select()
      .from(attendanceRecordsExtended)
      .where(
        and(
          eq(attendanceRecordsExtended.studentId, studentId),
          eq(attendanceRecordsExtended.subjectId, subjectId)
        )
      )
      .orderBy(desc(attendanceRecordsExtended.markedAt));
  }

  // ─────────────────────────────────────────────
  // LEAVE REQUESTS
  // ─────────────────────────────────────────────

  async createLeaveRequest(data: InsertLeaveRequest): Promise<LeaveRequest> {
    const [request] = await db.insert(leaveRequests).values(data).returning();
    return request;
  }

  async findLeaveRequestById(id: number): Promise<LeaveRequest | undefined> {
    const [request] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
    return request;
  }

  async findLeaveRequestsByStudent(studentId: string): Promise<LeaveRequest[]> {
    return db
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.studentId, studentId))
      .orderBy(desc(leaveRequests.createdAt));
  }

  async findPendingLeaveRequests(): Promise<LeaveRequest[]> {
    return db
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.status, "pending"))
      .orderBy(leaveRequests.createdAt);
  }

  async updateLeaveRequest(
    id: number,
    data: Partial<InsertLeaveRequest>
  ): Promise<LeaveRequest> {
    const [updated] = await db
      .update(leaveRequests)
      .set(data)
      .where(eq(leaveRequests.id, id))
      .returning();
    return updated;
  }

  // ─────────────────────────────────────────────
  // ATTENDANCE CORRECTIONS
  // ─────────────────────────────────────────────

  async createCorrection(data: InsertCorrection): Promise<AttendanceCorrection> {
    const [correction] = await db.insert(attendanceCorrections).values(data).returning();
    return correction;
  }

  async findCorrectionById(id: number): Promise<AttendanceCorrection | undefined> {
    const [correction] = await db
      .select()
      .from(attendanceCorrections)
      .where(eq(attendanceCorrections.id, id));
    return correction;
  }

  async findPendingCorrections(): Promise<AttendanceCorrection[]> {
    return db
      .select()
      .from(attendanceCorrections)
      .where(eq(attendanceCorrections.status, "pending"))
      .orderBy(attendanceCorrections.createdAt);
  }

  async findCorrectionsByStudent(studentId: string): Promise<AttendanceCorrection[]> {
    return db
      .select()
      .from(attendanceCorrections)
      .where(eq(attendanceCorrections.studentId, studentId))
      .orderBy(desc(attendanceCorrections.createdAt));
  }

  async updateCorrection(
    id: number,
    data: Partial<InsertCorrection>
  ): Promise<AttendanceCorrection> {
    const [updated] = await db
      .update(attendanceCorrections)
      .set(data)
      .where(eq(attendanceCorrections.id, id))
      .returning();
    return updated;
  }

  // ─────────────────────────────────────────────
  // ATTENDANCE SUMMARY
  // ─────────────────────────────────────────────

  async findSummaryByStudentAndSubject(
    studentId: string,
    subjectId?: number
  ): Promise<AttendanceSummary[]> {
    if (subjectId) {
      return db
        .select()
        .from(attendanceSummary)
        .where(
          and(
            eq(attendanceSummary.studentId, studentId),
            eq(attendanceSummary.subjectId, subjectId)
          )
        );
    }
    return db
      .select()
      .from(attendanceSummary)
      .where(eq(attendanceSummary.studentId, studentId));
  }

  async upsertAttendanceSummary(data: InsertSummary): Promise<AttendanceSummary> {
    const existing = await this.findSummaryByStudentAndSubject(
      data.studentId,
      data.subjectId ?? undefined
    );

    if (existing.length > 0) {
      const [updated] = await db
        .update(attendanceSummary)
        .set(data)
        .where(eq(attendanceSummary.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(attendanceSummary).values(data).returning();
      return created;
    }
  }

  // ─────────────────────────────────────────────
  // GRACE ATTENDANCE
  // ─────────────────────────────────────────────

  async createGraceAttendance(data: InsertGrace): Promise<GraceAttendance> {
    const [grace] = await db.insert(graceAttendance).values(data).returning();
    return grace;
  }

  async findGraceByStudent(studentId: string): Promise<GraceAttendance[]> {
    return db
      .select()
      .from(graceAttendance)
      .where(eq(graceAttendance.studentId, studentId))
      .orderBy(desc(graceAttendance.grantedAt));
  }

  async findGraceByStudentAndSubject(
    studentId: string,
    subjectId: number
  ): Promise<GraceAttendance[]> {
    return db
      .select()
      .from(graceAttendance)
      .where(
        and(
          eq(graceAttendance.studentId, studentId),
          eq(graceAttendance.subjectId, subjectId)
        )
      );
  }
}

export const attendanceRepository = new AttendanceRepository();
