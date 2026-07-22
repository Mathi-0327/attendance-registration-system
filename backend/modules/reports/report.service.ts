/**
 * @file backend/modules/reports/report.service.ts
 * @description Services for generating custom filtered reports.
 * Supports per-student breakdowns, department aggregations, and
 * NAAC / NBA compliance-formatted report templates.
 */

import { db } from "../../../database/db";
import { attendanceRecordsExtended } from "../../../database/schema/attendance.schema";
import { eq, and, gte, lte, SQL } from "drizzle-orm";
import { emailService } from "../../services/email/email.service";

export interface ReportFilter {
  fromDate?: string;
  toDate?: string;
  department?: string;
  subjectId?: number;
  status?: string;
  studentId?: string;
  /** "standard" | "naac" | "nba" — controls output template */
  format?: string;
}

export interface StudentSummary {
  studentId: string;
  name: string;
  department: string | null;
  total: number;
  present: number;
  late: number;
  absent: number;
  onDuty: number;
  medical: number;
  rate: number;
  status: "safe" | "warning" | "critical";
}

export interface ReportResult {
  records: any[];
  summary: {
    total: number;
    present: number;
    late: number;
    absent: number;
    onDuty: number;
    medical: number;
    rate: number;
  };
  studentBreakdowns: StudentSummary[];
  departmentBreakdowns: Record<string, { total: number; present: number; rate: number }>;
  complianceTemplate?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function classifyStatus(rate: number): StudentSummary["status"] {
  if (rate >= 75) return "safe";
  if (rate >= 60) return "warning";
  return "critical";
}

function buildNAACTemplate(
  filter: ReportFilter,
  summary: ReportResult["summary"],
  studentBreakdowns: StudentSummary[],
): string {
  const now = new Date().toLocaleDateString("en-IN", { dateStyle: "long" });
  const safeCount = studentBreakdowns.filter((s) => s.status === "safe").length;
  const warnCount = studentBreakdowns.filter((s) => s.status === "warning").length;
  const critCount = studentBreakdowns.filter((s) => s.status === "critical").length;

  const atRiskList = studentBreakdowns
    .filter((s) => s.status !== "safe")
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 10)
    .map((s) => `  • ${s.name} (${s.studentId}) — ${s.rate}% [${s.status.toUpperCase()}]`)
    .join("\n");

  return `
========================================================
  ATTENDANCE COMPLIANCE REPORT — ${filter.format?.toUpperCase() ?? "STANDARD"}
  Generated: ${now}
  Period: ${filter.fromDate ?? "All time"} → ${filter.toDate ?? "Present"}
  Department: ${filter.department ?? "All Departments"}
========================================================

1. OVERALL STATISTICS
   Total Records   : ${summary.total}
   Present         : ${summary.present}
   Late            : ${summary.late}
   Absent          : ${summary.absent}
   On-Duty         : ${summary.onDuty}
   Medical Leave   : ${summary.medical}
   Effective Rate  : ${summary.rate}%

2. STUDENT COMPLIANCE BREAKDOWN
   Safe  (≥75%)    : ${safeCount} students
   Warning (60–74%): ${warnCount} students
   Critical (<60%) : ${critCount} students

3. AT-RISK STUDENTS (Bottom 10 by rate)
${atRiskList || "  None — all students meet the threshold."}

4. CRITERIA COMPLIANCE
   NAAC Criterion 2.7 (Student Satisfaction) threshold: 75%
   Compliance Status: ${summary.rate >= 75 ? "✔ COMPLIANT" : "✘ NON-COMPLIANT — Intervention Required"}

========================================================
   AttendReg Enterprise AI — Automated Compliance Report
========================================================
`.trim();
}

// ── Service ────────────────────────────────────────────────────────────────

export class ReportService {
  /**
   * Generates a report matching the given filters.
   * Returns raw records, aggregated summary, per-student breakdowns,
   * department breakdowns, and (optionally) a compliance template string.
   */
  async generateFilteredReport(filter: ReportFilter): Promise<ReportResult> {
    const conditions: SQL<unknown>[] = [];

    if (filter.studentId) {
      conditions.push(eq(attendanceRecordsExtended.studentId, filter.studentId));
    }
    if (filter.department) {
      conditions.push(eq(attendanceRecordsExtended.department, filter.department));
    }
    if (filter.subjectId) {
      conditions.push(eq(attendanceRecordsExtended.subjectId, filter.subjectId));
    }
    if (filter.status) {
      conditions.push(eq(attendanceRecordsExtended.status, filter.status));
    }
    if (filter.fromDate) {
      conditions.push(gte(attendanceRecordsExtended.markedAt, new Date(filter.fromDate)));
    }
    if (filter.toDate) {
      conditions.push(lte(attendanceRecordsExtended.markedAt, new Date(filter.toDate)));
    }

    const records =
      conditions.length > 0
        ? await db
            .select()
            .from(attendanceRecordsExtended)
            .where(and(...conditions))
            .orderBy(attendanceRecordsExtended.markedAt)
        : await db
            .select()
            .from(attendanceRecordsExtended)
            .orderBy(attendanceRecordsExtended.markedAt);

    // ── Global summary ──
    const total = records.length;
    const present = records.filter((r) => r.status === "present").length;
    const late = records.filter((r) => r.status === "late").length;
    const absent = records.filter((r) => r.status === "absent").length;
    const onDuty = records.filter((r) => r.status === "on_duty").length;
    const medical = records.filter((r) => r.status === "medical_leave").length;
    const rate = total > 0 ? Math.round(((present + late + onDuty) / total) * 100) : 100;

    const summary = { total, present, late, absent, onDuty, medical, rate };

    // ── Per-student breakdown ──
    const studentMap = new Map<string, StudentSummary>();
    for (const r of records) {
      if (!r.studentId) continue;
      if (!studentMap.has(r.studentId)) {
        studentMap.set(r.studentId, {
          studentId: r.studentId,
          name: r.studentName ?? r.studentId,
          department: r.department,
          total: 0,
          present: 0,
          late: 0,
          absent: 0,
          onDuty: 0,
          medical: 0,
          rate: 0,
          status: "safe",
        });
      }
      const s = studentMap.get(r.studentId)!;
      s.total++;
      if (r.status === "present") s.present++;
      else if (r.status === "late") s.late++;
      else if (r.status === "absent") s.absent++;
      else if (r.status === "on_duty") s.onDuty++;
      else if (r.status === "medical_leave") s.medical++;
    }

    const studentBreakdowns = Array.from(studentMap.values()).map((s) => {
      s.rate = s.total > 0 ? Math.round(((s.present + s.late + s.onDuty) / s.total) * 100) : 100;
      s.status = classifyStatus(s.rate);
      return s;
    });

    // ── Department breakdown ──
    const deptMap: Record<string, { total: number; present: number; rate: number }> = {};
    for (const r of records) {
      const dept = r.department ?? "Unknown";
      if (!deptMap[dept]) deptMap[dept] = { total: 0, present: 0, rate: 0 };
      deptMap[dept].total++;
      if (r.status === "present" || r.status === "late" || r.status === "on_duty") {
        deptMap[dept].present++;
      }
    }
    for (const d of Object.values(deptMap)) {
      d.rate = d.total > 0 ? Math.round((d.present / d.total) * 100) : 100;
    }

    // ── Compliance template ──
    const complianceTemplate =
      filter.format === "naac" || filter.format === "nba"
        ? buildNAACTemplate(filter, summary, studentBreakdowns)
        : undefined;

    return {
      records,
      summary,
      studentBreakdowns,
      departmentBreakdowns: deptMap,
      complianceTemplate,
    };
  }

  /**
   * Schedule a report to be emailed to the given address.
   * Generates the report immediately and dispatches it via the email service.
   */
  async scheduleReport(
    filter: ReportFilter,
    recipientEmail: string,
    recipientName: string = "Administrator",
  ): Promise<void> {
    const report = await this.generateFilteredReport(filter);
    const dateRange = filter.fromDate
      ? `${filter.fromDate} to ${filter.toDate ?? "today"}`
      : "All records";

    const htmlBody = `
      <h2 style="color:#1e40af;">AttendReg — Scheduled Attendance Report</h2>
      <p>Hello ${recipientName},</p>
      <p>Your scheduled report is ready.</p>
      <table style="border-collapse:collapse;width:100%;max-width:480px;">
        <tr style="background:#eff6ff;">
          <td style="padding:8px 12px;font-weight:600;">Period</td>
          <td style="padding:8px 12px;">${dateRange}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;font-weight:600;">Department</td>
          <td style="padding:8px 12px;">${filter.department ?? "All"}</td>
        </tr>
        <tr style="background:#eff6ff;">
          <td style="padding:8px 12px;font-weight:600;">Total Records</td>
          <td style="padding:8px 12px;">${report.summary.total}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;font-weight:600;">Overall Rate</td>
          <td style="padding:8px 12px;color:${report.summary.rate >= 75 ? "#16a34a" : "#dc2626"};">
            ${report.summary.rate}%
          </td>
        </tr>
        <tr style="background:#eff6ff;">
          <td style="padding:8px 12px;font-weight:600;">At-Risk Students</td>
          <td style="padding:8px 12px;">${report.studentBreakdowns.filter((s) => s.status !== "safe").length}</td>
        </tr>
      </table>
      ${
        report.complianceTemplate
          ? `<pre style="background:#f8fafc;padding:16px;border-radius:6px;font-size:12px;overflow:auto;">${report.complianceTemplate}</pre>`
          : ""
      }
      <p style="color:#6b7280;font-size:12px;margin-top:24px;">
        This report was automatically generated by AttendReg Enterprise AI.<br/>
        Do not reply to this email.
      </p>
    `;

    await emailService.sendEmail({
      to: recipientEmail,
      subject: `AttendReg Report — ${dateRange}`,
      html: htmlBody,
    });
  }
}

export const reportService = new ReportService();
