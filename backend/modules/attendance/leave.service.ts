/**
 * @file backend/modules/attendance/leave.service.ts
 * @description Business logic for leave request management.
 * Handles student leave submissions, faculty approval/rejection,
 * automatic attendance record updates, and multi-channel (Email + SMS)
 * notifications to both Students and Parents/Guardians.
 */

import { attendanceRepository } from "./attendance.repository";
import type { InsertLeaveRequest } from "./attendance.repository";
import { studentRepository } from "../students/student.repository";
import { emailService } from "../../services/email/email.service";
import { smsService } from "../../services/sms/sms.service";
import { attendanceNotificationService } from "../../services/notifications/attendance-notification.service";

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

    // Asynchronously dispatch Leave Submission notifications to Student & Parent
    this.sendLeaveNotification("submitted", leave).catch((err) => {
      console.error("[leave-notification] Error notifying leave submission:", err.message);
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

    // Asynchronously dispatch Leave Approval notifications to Student & Parent
    this.sendLeaveNotification("approved", { ...leave, ...updated }, remarks).catch((err) => {
      console.error("[leave-notification] Error notifying leave approval:", err.message);
    });

    return updated;
  }

  /**
   * Reject a leave request.
   */
  async rejectLeave(id: number, reviewedBy: number, remarks: string) {
    const leave = await attendanceRepository.findLeaveRequestById(id);
    if (!leave) throw new Error("Leave request not found");
    if (leave.status !== "pending") throw new Error("Leave request is already processed");

    const updated = await attendanceRepository.updateLeaveRequest(id, {
      status: "rejected",
      approvedBy: reviewedBy,
      approvedAt: new Date(),
      remarks,
      updatedAt: new Date(),
    });

    // Asynchronously dispatch Leave Rejection notifications to Student & Parent
    this.sendLeaveNotification("rejected", { ...leave, ...updated }, remarks).catch((err) => {
      console.error("[leave-notification] Error notifying leave rejection:", err.message);
    });

    return updated;
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

  // ─────────────────────────────────────────────
  // NOTIFICATION DISPATCHER (EMAIL + SMS)
  // ─────────────────────────────────────────────

  private async sendLeaveNotification(
    action: "submitted" | "approved" | "rejected",
    leave: any,
    remarks?: string
  ): Promise<void> {
    const student = await studentRepository.findByStudentId(leave.studentId);
    const parent = await studentRepository.getParentDetails(leave.studentId);

    const studentName = student?.name || "Student";
    const parentName = parent?.parentName || parent?.fatherName || parent?.motherName || "Parent/Guardian";
    const parentEmail = parent?.email || parent?.fatherEmail || parent?.motherEmail;
    const parentPhone = parent?.phone || parent?.fatherPhone || parent?.motherPhone;

    const fromStr = new Date(leave.fromDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const toStr = new Date(leave.toDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const typeTitle = (leave.type || "leave").replace("_", " ").toUpperCase();

    let subject = "";
    let badgeColor = "#2563EB";
    let badgeText = "LEAVE REQUEST PENDING";
    let summaryText = "";

    if (action === "submitted") {
      subject = `📋 Leave Request Submitted: ${studentName} (${fromStr} - ${toStr})`;
      badgeColor = "#F59E0B";
      badgeText = "LEAVE REQUEST SUBMITTED";
      summaryText = `A new ${typeTitle} leave request of ${leave.totalDays} day(s) was submitted for faculty review.`;
    } else if (action === "approved") {
      subject = `✅ Leave Request APPROVED: ${studentName} (${fromStr} - ${toStr})`;
      badgeColor = "#10B981";
      badgeText = "LEAVE APPROVED";
      summaryText = `The ${typeTitle} leave request has been APPROVED by faculty. Attendance records have been updated accordingly.`;
    } else if (action === "rejected") {
      subject = `❌ Leave Request Rejected: ${studentName} (${fromStr} - ${toStr})`;
      badgeColor = "#EF4444";
      badgeText = "LEAVE REJECTED";
      summaryText = `The ${typeTitle} leave request was reviewed and REJECTED by faculty.`;
    }

    const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #2563EB 0%, #1d4ed8 100%); color: #ffffff; padding: 24px 32px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 700;">🎓 AttendReg Leave Management</h1>
          <p style="margin: 4px 0 0; font-size: 13px; color: rgba(255,255,255,0.85);">Campus Attendance & Safety Portal</p>
        </div>
        <div style="padding: 32px;">
          <div style="display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: bold; background: ${badgeColor}; color: #ffffff; margin-bottom: 16px;">
            ${badgeText}
          </div>
          <h2 style="color: #0f172a; margin-top: 0; font-size: 18px;">Leave Request Update</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.5;">${summaryText}</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 500; width: 140px;">Student Name</td>
              <td style="padding: 10px 14px; font-size: 14px; color: #0f172a; font-weight: 600;">${studentName} (${leave.studentId})</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 500;">Leave Type</td>
              <td style="padding: 10px 14px; font-size: 14px; color: #0f172a; font-weight: 600;">${typeTitle}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 500;">Date Range</td>
              <td style="padding: 10px 14px; font-size: 14px; color: #0f172a; font-weight: 600;">${fromStr} → ${toStr} (${leave.totalDays} day${leave.totalDays > 1 ? "s" : ""})</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 500;">Reason</td>
              <td style="padding: 10px 14px; font-size: 14px; color: #0f172a;">${leave.reason}</td>
            </tr>
            ${remarks ? `<tr>
              <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 500;">Faculty Remarks</td>
              <td style="padding: 10px 14px; font-size: 14px; color: #dc2626; font-weight: 600;">${remarks}</td>
            </tr>` : ""}
          </table>

          <p style="color: #64748b; font-size: 12px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            This automated email was sent by AttendReg Leave Automation Service.
          </p>
        </div>
      </div>
    `;

    // 1. Send Email to Student
    if (student?.email) {
      await emailService.sendEmail({
        to: student.email,
        toName: studentName,
        subject,
        html: htmlBody,
      });

      await attendanceNotificationService.recordLog({
        studentId: leave.studentId,
        recipientType: "student",
        recipientName: studentName,
        recipientContact: student.email,
        channel: "email",
        notificationType: `leave_${action}`,
        sessionId: null,
        subject,
        status: "sent",
        errorMessage: null,
        sentAt: new Date(),
      });
    }

    // 2. Send Email to Parent
    if (parentEmail) {
      await emailService.sendEmail({
        to: parentEmail,
        toName: parentName,
        subject,
        html: htmlBody,
      });

      await attendanceNotificationService.recordLog({
        studentId: leave.studentId,
        recipientType: "parent",
        recipientName: parentName,
        recipientContact: parentEmail,
        channel: "email",
        notificationType: `leave_${action}`,
        sessionId: null,
        subject,
        status: "sent",
        errorMessage: null,
        sentAt: new Date(),
      });
    }

    // 3. Send SMS to Parent
    if (parentPhone) {
      const smsBody =
        action === "submitted"
          ? `[AttendReg] Dear Parent, a ${typeTitle} leave request for ${studentName} (${fromStr} to ${toStr}) has been submitted for faculty review.`
          : action === "approved"
          ? `[AttendReg] Dear Parent, the leave request for ${studentName} (${fromStr} to ${toStr}) has been APPROVED by faculty.`
          : `[AttendReg] Dear Parent, the leave request for ${studentName} (${fromStr} to ${toStr}) was REJECTED: ${remarks || "Contact department"}.`;

      const smsResult = await smsService.sendSms({
        to: parentPhone,
        body: smsBody,
      });

      await attendanceNotificationService.recordLog({
        studentId: leave.studentId,
        recipientType: "parent",
        recipientName: parentName,
        recipientContact: parentPhone,
        channel: "sms",
        notificationType: `leave_${action}`,
        sessionId: null,
        subject: `SMS Leave Update: ${action.toUpperCase()}`,
        status: smsResult.success ? "sent" : "failed",
        errorMessage: smsResult.error || null,
        sentAt: smsResult.success ? new Date() : null,
      });
    }
  }
}

export const leaveService = new LeaveService();
