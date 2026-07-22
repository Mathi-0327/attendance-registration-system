/**
 * @file backend/modules/attendance/leave.service.ts
 * @description Business logic for leave request management.
 * Handles student leave submissions, faculty approval/rejection,
 * and automatic attendance record updates when leave is approved.
 */

import { attendanceRepository } from "./attendance.repository";
import type { InsertLeaveRequest } from "./attendance.repository";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type LeaveType =
  | "medical"
  | "on_duty"
  | "internship"
  | "industrial_visit"
  | "sports"
  | "other";

export interface SubmitLeaveInput {
  studentId: string;
  type: LeaveType;
  fromDate: Date;
  toDate: Date;
  reason: string;
  subjectIds?: number[];
  document?: string; // base64 or file path
}

// ─────────────────────────────────────────────
// HELPER: Calculate working days between two dates
// ─────────────────────────────────────────────
function countWorkingDays(from: Date, to: Date): number {
  let count = 0;
  const current = new Date(from);
  while (current <= to) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++; // skip Sundays (0) and Saturdays (6)
    current.setDate(current.getDate() + 1);
  }
  return Math.max(1, count);
}

// ─────────────────────────────────────────────
// LEAVE SERVICE
// ─────────────────────────────────────────────

export class LeaveService {
  /**
   * Student submits a leave request.
   */
  async submitLeave(input: SubmitLeaveInput) {
    const totalDays = countWorkingDays(input.fromDate, input.toDate);

    const leave = await attendanceRepository.createLeaveRequest({
      studentId: input.studentId,
      type: input.type,
      fromDate: input.fromDate,
      toDate: input.toDate,
      totalDays,
      reason: input.reason,
      subjectIds: input.subjectIds,
      document: input.document,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return leave;
  }

  /**
   * Get all leave requests for a specific student.
   */
  async getLeavesByStudent(studentId: string) {
    return attendanceRepository.findLeaveRequestsByStudent(studentId);
  }

  /**
   * Get all pending leave requests (for faculty / admin view).
   */
  async getPendingLeaves() {
    return attendanceRepository.findPendingLeaveRequests();
  }

  /**
   * Approve a leave request. Also updates attendance records within the leave date range
   * to "on_duty" or "medical_leave" status for affected sessions.
   */
  async approveLeave(id: number, approvedBy: number, remarks?: string) {
    const leave = await attendanceRepository.findLeaveRequestById(id);
    if (!leave) throw new Error("Leave request not found");
    if (leave.status !== "pending") throw new Error("Leave request is already processed");

    const updated = await attendanceRepository.updateLeaveRequest(id, {
      status: "approved",
      approvedBy,
      approvedAt: new Date(),
      remarks: remarks ?? null,
      updatedAt: new Date(),
    });

    // Mark any existing "absent" records in the leave date range as approved leave type
    const studentRecords = await attendanceRepository.findExtendedRecordsByStudent(
      leave.studentId
    );
    const leaveType =
      leave.type === "medical" ? "medical_leave" : "on_duty";

    for (const record of studentRecords) {
      const recordDate = new Date(record.markedAt);
      if (
        recordDate >= new Date(leave.fromDate) &&
        recordDate <= new Date(leave.toDate) &&
        record.status === "absent"
      ) {
        await attendanceRepository.updateExtendedRecord(record.id, {
          status: leaveType,
          leaveRequestId: id,
          isCorrected: true,
          originalStatus: "absent",
          correctedAt: new Date(),
          correctionReason: `Leave approved: ${leave.reason}`,
        });
      }
    }

    return updated;
  }

  /**
   * Reject a leave request.
   */
  async rejectLeave(id: number, reviewedBy: number, remarks: string) {
    const leave = await attendanceRepository.findLeaveRequestById(id);
    if (!leave) throw new Error("Leave request not found");
    if (leave.status !== "pending") throw new Error("Leave request is already processed");

    return attendanceRepository.updateLeaveRequest(id, {
      status: "rejected",
      approvedBy: reviewedBy,
      approvedAt: new Date(),
      remarks,
      updatedAt: new Date(),
    });
  }

  /**
   * Get leave statistics for a student.
   */
  async getLeaveStats(studentId: string) {
    const leaves = await attendanceRepository.findLeaveRequestsByStudent(studentId);

    return {
      totalRequests: leaves.length,
      pending: leaves.filter((l) => l.status === "pending").length,
      approved: leaves.filter((l) => l.status === "approved").length,
      rejected: leaves.filter((l) => l.status === "rejected").length,
      totalDaysApproved: leaves
        .filter((l) => l.status === "approved")
        .reduce((sum, l) => sum + l.totalDays, 0),
    };
  }
}

export const leaveService = new LeaveService();
