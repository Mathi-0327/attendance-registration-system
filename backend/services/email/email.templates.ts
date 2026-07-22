/**
 * @file backend/services/email/email.templates.ts
 * @description Professional HTML email templates for all notification types.
 * Uses a base layout with the AttendReg brand design.
 */

import type { NotificationType } from "@shared/types";

// ─────────────────────────────────────────────
// BASE EMAIL LAYOUT
// ─────────────────────────────────────────────

const BRAND_COLOR = "#2563EB"; // Matches existing --primary blue
const BRAND_NAME = process.env.INSTITUTION_NAME || "AttendReg";
const BRAND_TAGLINE = "Smart Attendance & Academic Management";

function baseLayout(content: string, previewText = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="ie=edge" />
  <title>${BRAND_NAME}</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background-color:#f1f5f9;">
  ${previewText ? `<span style="display:none;max-height:0;overflow:hidden;">${previewText}</span>` : ""}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          
          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND_COLOR} 0%,#1d4ed8 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">
                🎓 ${BRAND_NAME}
              </h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">${BRAND_TAGLINE}</p>
            </td>
          </tr>

          <!-- CONTENT -->
          <tr>
            <td style="padding:40px;color:#1e293b;">
              ${content}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                This is an automated email from ${BRAND_NAME}. Please do not reply.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;">
                © ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────
// REUSABLE COMPONENTS
// ─────────────────────────────────────────────

function button(text: string, url: string, color = BRAND_COLOR): string {
  return `<a href="${url}" style="display:inline-block;background:${color};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:16px 0;">${text}</a>`;
}

function otp(code: string): string {
  return `<div style="background:#f0f7ff;border:2px dashed ${BRAND_COLOR};border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
    <p style="margin:0 0 8px;font-size:13px;color:#64748b;font-weight:500;">YOUR OTP CODE</p>
    <div style="font-size:36px;font-weight:800;letter-spacing:8px;color:${BRAND_COLOR};font-family:monospace;">${code}</div>
    <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;">Do not share this code with anyone</p>
  </div>`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;font-size:14px;color:#64748b;width:140px;">${label}</td>
    <td style="padding:8px 0;font-size:14px;color:#1e293b;font-weight:500;">${value}</td>
  </tr>`;
}

function alertBadge(text: string, type: "success" | "warning" | "danger" | "info" = "info"): string {
  const colors = {
    success: { bg: "#f0fdf4", border: "#22c55e", text: "#15803d" },
    warning: { bg: "#fffbeb", border: "#f59e0b", text: "#b45309" },
    danger: { bg: "#fff1f2", border: "#f43f5e", text: "#be123c" },
    info: { bg: "#f0f7ff", border: BRAND_COLOR, text: "#1d4ed8" },
  };
  const c = colors[type];
  return `<div style="background:${c.bg};border-left:4px solid ${c.border};padding:12px 16px;border-radius:6px;margin:16px 0;">
    <p style="margin:0;color:${c.text};font-size:14px;font-weight:500;">${text}</p>
  </div>`;
}

// ─────────────────────────────────────────────
// TEMPLATES
// ─────────────────────────────────────────────

const templates: Record<NotificationType, (data: Record<string, any>) => { subject: string; html: string }> = {

  registration: (data) => ({
    subject: `Welcome to ${BRAND_NAME} — Registration Successful`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;">Welcome, ${data.name}! 🎉</h2>
      <p style="margin:0 0 24px;color:#64748b;">Your account has been created successfully.</p>
      ${alertBadge("Your account is ready. Please verify your email to get started.", "success")}
      <table cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;">
        ${infoRow("Name", data.name)}
        ${infoRow("Student ID", data.studentId || "—")}
        ${infoRow("Email", data.email)}
        ${infoRow("Department", data.department || "—")}
      </table>
      <p style="color:#64748b;font-size:14px;">Please check your email for a verification code to activate your account.</p>
    `, `Welcome to ${BRAND_NAME}! Your registration is complete.`),
  }),

  email_verification: (data) => ({
    subject: `${BRAND_NAME} — Email Verification Code`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;">Verify Your Email ✉️</h2>
      <p style="margin:0 0 24px;color:#64748b;">Hi ${data.name}, use the code below to verify your email address.</p>
      ${otp(data.otp)}
      <p style="font-size:14px;color:#94a3b8;">This code expires in <strong>${data.expiryMinutes || 10} minutes</strong>.</p>
    `, "Your email verification code"),
  }),

  forgot_password: (data) => ({
    subject: `${BRAND_NAME} — Password Reset OTP`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;">Reset Your Password 🔐</h2>
      <p style="margin:0 0 24px;color:#64748b;">Hi ${data.name}, use the code below to reset your password.</p>
      ${otp(data.otp)}
      ${alertBadge("If you did not request this, please ignore this email and your password will remain unchanged.", "warning")}
      <p style="font-size:14px;color:#94a3b8;">This code expires in <strong>${data.expiryMinutes || 15} minutes</strong>.</p>
    `, "Your password reset OTP"),
  }),

  attendance_confirmation: (data) => ({
    subject: `✅ Attendance Marked — ${data.subject || "Class"} on ${data.date}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;">Attendance Confirmed ✅</h2>
      <p style="margin:0 0 24px;color:#64748b;">Your attendance has been successfully recorded.</p>
      ${alertBadge("You are marked PRESENT for today's class.", "success")}
      <table cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;">
        ${infoRow("Student", data.name)}
        ${infoRow("Student ID", data.studentId)}
        ${infoRow("Subject", data.subject || "—")}
        ${infoRow("Faculty", data.faculty || "—")}
        ${infoRow("Date & Time", data.timestamp || data.date)}
        ${infoRow("Room", data.room || "—")}
        ${infoRow("Method", data.method || "Online")}
      </table>
    `, "Your attendance has been marked"),
  }),

  absent_alert: (data) => ({
    subject: `⚠️ Absent Alert — ${data.subject || "Class"} on ${data.date}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;">Absent Alert ⚠️</h2>
      <p style="margin:0 0 16px;color:#64748b;">Dear ${data.name},</p>
      ${alertBadge(`You were marked ABSENT for ${data.subject || "a class"} on ${data.date}.`, "danger")}
      <table cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;">
        ${infoRow("Student", data.name)}
        ${infoRow("Student ID", data.studentId)}
        ${infoRow("Subject", data.subject || "—")}
        ${infoRow("Date", data.date)}
        ${infoRow("Attendance %", `${data.attendancePercentage || "—"}%`)}
      </table>
      <p style="font-size:14px;color:#64748b;">If this is incorrect, please apply for an attendance correction through the student portal.</p>
    `, "You were marked absent today"),
  }),

  late_entry: (data) => ({
    subject: `🕐 Late Entry Recorded — ${data.subject || "Class"}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;">Late Entry Recorded 🕐</h2>
      ${alertBadge(`Your attendance was recorded as LATE by ${data.lateByMinutes || "—"} minutes.`, "warning")}
      <table cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;">
        ${infoRow("Subject", data.subject || "—")}
        ${infoRow("Entry Time", data.entryTime || data.date)}
        ${infoRow("Class Started", data.classStartTime || "—")}
      </table>
    `, "Late entry recorded"),
  }),

  low_attendance: (data) => ({
    subject: `🚨 Low Attendance Warning — ${data.attendancePercentage}%`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;">Low Attendance Warning 🚨</h2>
      <p style="color:#64748b;">Dear ${data.name},</p>
      ${alertBadge(`Your attendance has fallen to ${data.attendancePercentage}%, which is below the required ${data.threshold || 75}%.`, "danger")}
      <table cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;">
        ${infoRow("Current Attendance", `${data.attendancePercentage}%`)}
        ${infoRow("Required Minimum", `${data.threshold || 75}%`)}
        ${infoRow("Classes Attended", data.attended || "—")}
        ${infoRow("Total Classes", data.total || "—")}
        ${infoRow("Subject", data.subject || "All Subjects")}
      </table>
      <p style="font-size:14px;color:#64748b;">Please ensure you attend all remaining classes to meet the attendance requirement.</p>
    `, `Your attendance is at ${data.attendancePercentage}% — action required`),
  }),

  daily_report: (data) => ({
    subject: `📊 Daily Attendance Report — ${data.date}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;">Daily Report — ${data.date} 📊</h2>
      <table cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;">
        ${infoRow("Total Students", data.total || "—")}
        ${infoRow("Present", data.present || "—")}
        ${infoRow("Absent", data.absent || "—")}
        ${infoRow("Late", data.late || "—")}
        ${infoRow("Attendance Rate", `${data.rate || "—"}%`)}
      </table>
      ${data.departmentBreakdown ? `<p style="font-size:13px;color:#64748b;">Login to the admin dashboard for detailed department-wise breakdown.</p>` : ""}
    `, `Daily attendance report for ${data.date}`),
  }),

  weekly_report: (data) => ({
    subject: `📈 Weekly Attendance Report — Week ${data.week}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;">Weekly Report 📈</h2>
      <p style="color:#64748b;">Week: ${data.week} | ${data.fromDate} to ${data.toDate}</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;">
        ${infoRow("Average Attendance", `${data.avgRate || "—"}%`)}
        ${infoRow("Best Day", data.bestDay || "—")}
        ${infoRow("Worst Day", data.worstDay || "—")}
        ${infoRow("Students at Risk", data.atRisk || "0")}
      </table>
    `, "Weekly attendance summary"),
  }),

  monthly_report: (data) => ({
    subject: `📋 Monthly Attendance Report — ${data.month} ${data.year}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;">Monthly Report — ${data.month} ${data.year} 📋</h2>
      <table cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;">
        ${infoRow("Total Working Days", data.workingDays || "—")}
        ${infoRow("Average Attendance", `${data.avgRate || "—"}%`)}
        ${infoRow("Students Below 75%", data.belowThreshold || "0")}
        ${infoRow("Perfect Attendance", data.perfectAttendance || "0")}
      </table>
    `, `Monthly report for ${data.month}`),
  }),

  holiday_notice: (data) => ({
    subject: `🎉 Holiday Notice — ${data.holidayName} on ${data.date}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;">Holiday Notice 🎉</h2>
      ${alertBadge(`${data.holidayName} — ${data.date}. No classes scheduled.`, "info")}
      ${data.message ? `<p style="color:#64748b;font-size:14px;">${data.message}</p>` : ""}
    `, `${data.holidayName} holiday announced`),
  }),

  class_cancellation: (data) => ({
    subject: `📢 Class Cancelled — ${data.subject} on ${data.date}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;">Class Cancellation Notice 📢</h2>
      ${alertBadge(`${data.subject} class on ${data.date} at ${data.time} has been cancelled.`, "warning")}
      ${data.reason ? `<p style="color:#64748b;font-size:14px;"><strong>Reason:</strong> ${data.reason}</p>` : ""}
      ${data.rescheduleInfo ? `<p style="color:#64748b;font-size:14px;"><strong>Rescheduled to:</strong> ${data.rescheduleInfo}</p>` : ""}
    `, "Class cancellation notice"),
  }),

  exam_notice: (data) => ({
    subject: `📝 Exam Notice — ${data.examName} on ${data.date}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;">Exam Notice 📝</h2>
      ${alertBadge(`${data.examName} is scheduled on ${data.date}.`, "info")}
      <table cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;">
        ${infoRow("Exam", data.examName)}
        ${infoRow("Date", data.date)}
        ${infoRow("Time", data.time || "—")}
        ${infoRow("Venue", data.venue || "—")}
        ${infoRow("Subjects", data.subjects || "—")}
      </table>
    `, `Exam scheduled: ${data.examName}`),
  }),

  faculty_notice: (data) => ({
    subject: `📌 Faculty Notice — ${data.subject}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;">Faculty Notice 📌</h2>
      <p style="color:#64748b;">${data.message}</p>
    `, data.subject),
  }),

  leave_approval: (data) => ({
    subject: `✅ Leave Approved — ${data.leaveType} from ${data.fromDate} to ${data.toDate}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;">Leave Approved ✅</h2>
      ${alertBadge(`Your ${data.leaveType} leave request has been APPROVED.`, "success")}
      <table cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;">
        ${infoRow("Leave Type", data.leaveType)}
        ${infoRow("From Date", data.fromDate)}
        ${infoRow("To Date", data.toDate)}
        ${infoRow("Total Days", data.totalDays)}
        ${infoRow("Approved By", data.approvedBy || "—")}
      </table>
      ${data.remarks ? `<p style="color:#64748b;font-size:14px;"><strong>Remarks:</strong> ${data.remarks}</p>` : ""}
    `, "Your leave request has been approved"),
  }),

  leave_rejection: (data) => ({
    subject: `❌ Leave Rejected — ${data.leaveType}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;">Leave Request Rejected ❌</h2>
      ${alertBadge(`Your ${data.leaveType} leave request has been REJECTED.`, "danger")}
      ${data.remarks ? `<p style="color:#64748b;font-size:14px;"><strong>Reason:</strong> ${data.remarks}</p>` : ""}
      <p style="font-size:14px;color:#64748b;">You may submit a new request with additional documentation if needed.</p>
    `, "Your leave request was rejected"),
  }),

  graduation: (data) => ({
    subject: `🎓 Graduation Notification — Congratulations, ${data.name}!`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;">Congratulations, ${data.name}! 🎓</h2>
      <p style="color:#64748b;font-size:16px;">You have successfully completed your academic program.</p>
      ${alertBadge(`Graduation ceremony details will be shared soon.`, "success")}
      <table cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;">
        ${infoRow("Program", data.program || "—")}
        ${infoRow("Department", data.department || "—")}
        ${infoRow("Final CGPA", data.cgpa || "—")}
      </table>
    `, `Congratulations on your graduation!`),
  }),
};

// ─────────────────────────────────────────────
// TEMPLATE RENDERER
// ─────────────────────────────────────────────

export function renderEmailTemplate(
  type: NotificationType,
  data: Record<string, any>
): { subject: string; html: string } {
  const templateFn = templates[type];
  if (!templateFn) {
    return {
      subject: `${BRAND_NAME} Notification`,
      html: baseLayout(`<p>${JSON.stringify(data)}</p>`),
    };
  }
  return templateFn(data);
}
