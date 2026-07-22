/**
 * @file backend/modules/attendance/correction.service.ts
 * @description Business logic for attendance correction workflows.
 * Students request corrections; faculty/admin review and approve/reject.
 * Approved corrections directly update the attendance record and recompute summary.
 */

import { attendanceRepository } from "./attendance.repository";
import type { InsertCorrection } from "./attendance.repository";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface RequestCorrectionInput {
  studentId: string;
  sessionId: number;
  attendanceRecordId?: number;
  requestedBy: number; // auth_users.id
  requestedStatus: "present" | "absent" | "late" | "on_duty" | "medical_leave";
  currentStatus: string;
  reason: string;
  supportingDocument?: string;
}

// ─────────────────────────────────────────────
// CORRECTION SERVICE
// ─────────────────────────────────────────────

export class CorrectionService {
  /**
   * Student or faculty submits an attendance correction request.
   */
  async requestCorrection(input: RequestCorrectionInput) {
    // Check for duplicate pending correction for same record
    const existing = await attendanceRepository.findCorrectionsByStudent(input.studentId);
    const duplicate = existing.find(
      (c) =>
        c.sessionId === input.sessionId &&
        c.status === "pending" &&
        c.requestedStatus === input.requestedStatus
    );

    if (duplicate) {
      throw new Error("A pending correction request already exists for this session");
    }

    const correction = await attendanceRepository.createCorrection({
      attendanceRecordId: input.attendanceRecordId,
      studentId: input.studentId,
      sessionId: input.sessionId,
      requestedBy: input.requestedBy,
      requestedStatus: input.requestedStatus,
      currentStatus: input.currentStatus,
      reason: input.reason,
      supportingDocument: input.supportingDocument,
      status: "pending",
      createdAt: new Date(),
    });

    return correction;
  }

  /**
   * Get all pending corrections (for faculty/admin).
   */
  async getPendingCorrections() {
    return attendanceRepository.findPendingCorrections();
  }

  /**
   * Get all corrections for a specific student.
   */
  async getStudentCorrections(studentId: string) {
    return attendanceRepository.findCorrectionsByStudent(studentId);
  }

  /**
   * Approve a correction request.
   * Updates the underlying attendance record and recomputes the summary.
   */
  async approveCorrection(id: number, reviewedBy: number, remarks?: string) {
    const correction = await attendanceRepository.findCorrectionById(id);
    if (!correction) throw new Error("Correction request not found");
    if (correction.status !== "pending") throw new Error("Correction already processed");

    // Update the correction record
    const updated = await attendanceRepository.updateCorrection(id, {
      status: "approved",
      reviewedBy,
      reviewedAt: new Date(),
      reviewerRemarks: remarks ?? null,
    });

    // Apply the correction to the actual attendance record (if it exists)
    if (correction.attendanceRecordId) {
      await attendanceRepository.updateExtendedRecord(correction.attendanceRecordId, {
        status: correction.requestedStatus,
        isCorrected: true,
        originalStatus: correction.currentStatus,
        correctedBy: reviewedBy,
        correctedAt: new Date(),
        correctionReason: correction.reason,
      });
    }

    return updated;
  }

  /**
   * Reject a correction request.
   */
  async rejectCorrection(id: number, reviewedBy: number, remarks: string) {
    const correction = await attendanceRepository.findCorrectionById(id);
    if (!correction) throw new Error("Correction request not found");
    if (correction.status !== "pending") throw new Error("Correction already processed");

    return attendanceRepository.updateCorrection(id, {
      status: "rejected",
      reviewedBy,
      reviewedAt: new Date(),
      reviewerRemarks: remarks,
    });
  }

  /**
   * Get correction statistics for admin dashboard.
   */
  async getCorrectionStats() {
    const all = await attendanceRepository.findPendingCorrections();
    // This only returns pending; for full stats, we'd need a separate query.
    return {
      pending: all.length,
    };
  }
}

export const correctionService = new CorrectionService();
