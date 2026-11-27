/**
 * @file backend/modules/attendance/correction.service.ts
 * @description Business logic for attendance correction workflows.
 * Students request corrections; faculty/admin review and approve/reject.
 * Approved corrections directly update the attendance record and trigger
 * automated Email + SMS notifications to students and parents.
 */

import { attendanceRepository } from "./attendance.repository";
import type { InsertCorrection } from "./attendance.repository";
import { studentRepository } from "../students/student.repository";
import { emailService } from "../../services/email/email.service";
import { smsService } from "../../services/sms/sms.service";
import { attendanceNotificationService } from "../../services/notifications/attendance-notification.service";

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

    this.sendCorrectionNotification("submitted", correction).catch((err) => {
      console.error("[correction-notification] Error notifying submission:", err.message);
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
   * Updates the underlying attendance record and dispatches approval emails.
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

    this.sendCorrectionNotification("approved", { ...correction, ...updated }, remarks).catch((err) => {
      console.error("[correction-notification] Error notifying approval:", err.message);
    });

    return updated;
  }

  /**
   * Reject a correction request.
   */
  async rejectCorrection(id: number, reviewedBy: number, remarks: string) {
    const correction = await attendanceRepository.findCorrectionById(id);
    if (!correction) throw new Error("Correction request not found");
    if (correction.status !== "pending") throw new Error("Correction already processed");

    const updated = await attendanceRepository.updateCorrection(id, {
      status: "rejected",
      reviewedBy,
      reviewedAt: new Date(),
      reviewerRemarks: remarks,
    });

    this.sendCorrectionNotification("rejected", { ...correction, ...updated }, remarks).catch((err) => {
      console.error("[correction-notification] Error notifying rejection:", err.message);
    });

    return updated;
  }

  /**
   * Get correction statistics for admin dashboard.
   */
  async getCorrectionStats() {
    const all = await attendanceRepository.findPendingCorrections();
    return {
      pending: all.length,
    };
  }

  // ─────────────────────────────────────────────
  // NOTIFICATION DISPATCHER (EMAIL + SMS)
  // ─────────────────────────────────────────────

  private async sendCorrectionNotification(
    action: "submitted" | "approved" | "rejected",
    correction: any,
    remarks?: string
  ): Promise<void> {
    const student = await studentRepository.findByStudentId(correction.studentId);
    const parent = await studentRepository.getParentDetails(correction.studentId);

    const studentName = student?.name || "Student";
    const parentName = parent?.parentName || parent?.fatherName || parent?.motherName || "Parent/Guardian";
    const parentEmail = parent?.email || parent?.fatherEmail || parent?.motherEmail;
    const parentPhone = parent?.phone || parent?.fatherPhone || parent?.motherPhone;

    const requestedTitle = (correction.requestedStatus || "").replace("_", " ").toUpperCase();
    const currentTitle = (correction.currentStatus || "").replace("_", " ").toUpperCase();

    let subject = "";
    let badgeColor = "#2563EB";
    let badgeText = "CORRECTION PENDING";
    let summaryText = "";

    if (action === "submitted") {
      subject = `📝 Attendance Correction Requested: ${studentName} (${currentTitle} → ${requestedTitle})`;
      badgeColor = "#F59E0B";
      badgeText = "CORRECTION CLAIM SUBMITTED";
      summaryText = `A correction request was submitted to update attendance from ${currentTitle} to ${requestedTitle}.`;
    } else if (action === "approved") {
      subject = `✅ Attendance Correction APPROVED: ${studentName} (Updated to ${requestedTitle})`;
      badgeColor = "#10B981";
      badgeText = "CORRECTION APPROVED";
      summaryText = `The attendance correction claim has been APPROVED by the host/faculty. Record updated to ${requestedTitle}.`;
    } else if (action === "rejected") {
      subject = `❌ Attendance Correction Rejected: ${studentName}`;
      badgeColor = "#EF4444";
      badgeText = "CORRECTION REJECTED";
      summaryText = `The attendance correction claim was reviewed and REJECTED by faculty. Attendance remains ${currentTitle}.`;
    }

    const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #2563EB 0%, #1d4ed8 100%); color: #ffffff; padding: 24px 32px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 700;">🎓 AttendReg Correction Portal</h1>
          <p style="margin: 4px 0 0; font-size: 13px; color: rgba(255,255,255,0.85);">Attendance Dispute & Correction Resolution</p>
        </div>
        <div style="padding: 32px;">
          <div style="display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: bold; background: ${badgeColor}; color: #ffffff; margin-bottom: 16px;">
            ${badgeText}
          </div>
          <h2 style="color: #0f172a; margin-top: 0; font-size: 18px;">Attendance Correction Status</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.5;">${summaryText}</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 500; width: 140px;">Student Name</td>
              <td style="padding: 10px 14px; font-size: 14px; color: #0f172a; font-weight: 600;">${studentName} (${correction.studentId})</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 500;">Original Status</td>
              <td style="padding: 10px 14px; font-size: 14px; color: #dc2626; font-weight: 600;">${currentTitle}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 500;">Requested Status</td>
              <td style="padding: 10px 14px; font-size: 14px; color: #16a34a; font-weight: 600;">${requestedTitle}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 500;">Student Reason</td>
              <td style="padding: 10px 14px; font-size: 14px; color: #0f172a;">${correction.reason}</td>
            </tr>
            ${remarks ? `<tr>
              <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 500;">Reviewer Remarks</td>
              <td style="padding: 10px 14px; font-size: 14px; color: #2563EB; font-weight: 600;">${remarks}</td>
            </tr>` : ""}
          </table>

          <p style="color: #64748b; font-size: 12px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            This automated email was sent by AttendReg Correction Automation Service.
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
        studentId: correction.studentId,
        recipientType: "student",
        recipientName: studentName,
        recipientContact: student.email,
        channel: "email",
        notificationType: `correction_${action}`,
        sessionId: correction.sessionId,
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
        studentId: correction.studentId,
        recipientType: "parent",
        recipientName: parentName,
        recipientContact: parentEmail,
        channel: "email",
        notificationType: `correction_${action}`,
        sessionId: correction.sessionId,
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
          ? `[AttendReg] Dear Parent, an attendance correction request (${currentTitle} -> ${requestedTitle}) for ${studentName} was submitted.`
          : action === "approved"
          ? `[AttendReg] Dear Parent, attendance correction for ${studentName} was APPROVED. Status updated to ${requestedTitle}.`
          : `[AttendReg] Dear Parent, attendance correction for ${studentName} was REJECTED: ${remarks || "Contact office"}.`;

      const smsResult = await smsService.sendSms({
        to: parentPhone,
        body: smsBody,
      });

      await attendanceNotificationService.recordLog({
        studentId: correction.studentId,
        recipientType: "parent",
        recipientName: parentName,
        recipientContact: parentPhone,
        channel: "sms",
        notificationType: `correction_${action}`,
        sessionId: correction.sessionId,
        subject: `SMS Correction: ${action.toUpperCase()}`,
        status: smsResult.success ? "sent" : "failed",
        errorMessage: smsResult.error || null,
        sentAt: smsResult.success ? new Date() : null,
      });
    }
  }
}

export const correctionService = new CorrectionService();
