/**
 * @file backend/modules/automation/workflow.dispatcher.ts
 * @description Event-driven workflow dispatcher.
 * Listens for attendance events and triggers the appropriate automations.
 */

import { notificationService } from "./notification.service";
import { rulesEngine, type AttendanceEvent } from "./rules.engine";
import { attendanceRepository } from "../attendance/attendance.repository";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type WorkflowEvent =
  | { type: "ATTENDANCE_MARKED"; payload: AttendanceEvent }
  | {
      type: "ABSENCE_THRESHOLD_REACHED";
      payload: {
        studentId: string;
        studentName: string;
        department: string;
        attended: number;
        totalSessions: number;
        rate: number;
      };
    }
  | {
      type: "PROXY_SUSPECTED";
      payload: {
        studentId: string;
        sessionId: number;
        ipAddress: string;
        conflictingStudents: string[];
      };
    };

// ─────────────────────────────────────────────
// WORKFLOW LOG (in-memory ring buffer — last 200 events)
// ─────────────────────────────────────────────

interface WorkflowLog {
  id: string;
  type: WorkflowEvent["type"];
  triggeredAt: Date;
  result: "success" | "skipped" | "error";
  summary: string;
}

const workflowLogs: WorkflowLog[] = [];
const MAX_LOG_SIZE = 200;

function addLog(log: WorkflowLog) {
  workflowLogs.unshift(log);
  if (workflowLogs.length > MAX_LOG_SIZE) workflowLogs.pop();
}

// ─────────────────────────────────────────────
// DISPATCHER
// ─────────────────────────────────────────────

export const workflowDispatcher = {
  getLogs(): WorkflowLog[] {
    return workflowLogs;
  },

  async dispatch(event: WorkflowEvent): Promise<void> {
    console.log(`[workflow] Dispatching: ${event.type}`);

    try {
      switch (event.type) {
        case "ATTENDANCE_MARKED":
          await this.handleAttendanceMarked(event.payload);
          break;

        case "ABSENCE_THRESHOLD_REACHED":
          await this.handleAbsenceThreshold(event.payload);
          break;

        case "PROXY_SUSPECTED":
          await this.handleProxySuspected(event.payload);
          break;
      }
    } catch (err: any) {
      console.error(`[workflow] Error dispatching ${event.type}:`, err.message);
      addLog({
        id: Date.now().toString(),
        type: event.type,
        triggeredAt: new Date(),
        result: "error",
        summary: err.message,
      });
    }
  },

  async handleAttendanceMarked(event: AttendanceEvent): Promise<void> {
    const rule = rulesEngine.evaluateAttendance(event);
    const config = rulesEngine.getConfig();

    if (rule.status === "late" && rule.shouldAlert && config.alertRecipientEmail) {
      const html = notificationService.buildLateArrivalEmail({
        studentName: event.studentName,
        studentId: event.studentId,
        sessionName: event.sessionName,
        minutesLate: rule.minutesLate!,
        timestamp: event.submittedAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      });

      const result = await notificationService.sendEmail({
        to: config.alertRecipientEmail,
        subject: `⏰ Late Arrival: ${event.studentName} — ${rule.minutesLate} min late`,
        html,
        text: `${event.studentName} (${event.studentId}) was ${rule.minutesLate} minute(s) late to session "${event.sessionName}".`,
      });

      addLog({
        id: Date.now().toString(),
        type: "ATTENDANCE_MARKED",
        triggeredAt: new Date(),
        result: result.success ? "success" : "error",
        summary: `Late alert for ${event.studentName}: ${rule.minutesLate} min late — Email ${result.success ? "sent" : "failed: " + result.error}`,
      });
    } else if (rule.status === "proxy_suspected") {
      console.warn(`[workflow] PROXY SUSPECTED: ${event.studentId} @ IP ${event.ipAddress}`);
      addLog({
        id: Date.now().toString(),
        type: "ATTENDANCE_MARKED",
        triggeredAt: new Date(),
        result: "success",
        summary: `Proxy suspected: ${event.studentId} at IP ${event.ipAddress}`,
      });
    } else {
      addLog({
        id: Date.now().toString(),
        type: "ATTENDANCE_MARKED",
        triggeredAt: new Date(),
        result: "skipped",
        summary: `${event.studentName} marked ${rule.status}`,
      });
    }
  },

  async handleAbsenceThreshold(payload: WorkflowEvent & { type: "ABSENCE_THRESHOLD_REACHED" } extends infer T ? T extends { payload: infer P } ? P : never : never): Promise<void> {
    const config = rulesEngine.getConfig();
    if (!config.alertRecipientEmail) {
      addLog({
        id: Date.now().toString(),
        type: "ABSENCE_THRESHOLD_REACHED",
        triggeredAt: new Date(),
        result: "skipped",
        summary: "No alert email configured",
      });
      return;
    }

    const html = notificationService.buildAbsenceAlertEmail({
      studentName: payload.studentName,
      studentId: payload.studentId,
      department: payload.department,
      attendanceRate: payload.rate,
      attended: payload.attended,
      totalSessions: payload.totalSessions,
      threshold: config.absenceAlertThreshold,
    });

    const result = await notificationService.sendEmail({
      to: config.alertRecipientEmail,
      subject: `⚠️ Low Attendance Alert: ${payload.studentName} (${payload.rate}%)`,
      html,
      text: `${payload.studentName} (${payload.studentId}) has ${payload.rate}% attendance — below threshold of ${config.absenceAlertThreshold}%.`,
    });

    addLog({
      id: Date.now().toString(),
      type: "ABSENCE_THRESHOLD_REACHED",
      triggeredAt: new Date(),
      result: result.success ? "success" : "error",
      summary: `Absence alert for ${payload.studentName} (${payload.rate}%) — Email ${result.success ? "sent" : "failed: " + result.error}`,
    });
  },

  async handleProxySuspected(payload: { studentId: string; sessionId: number; ipAddress: string; conflictingStudents: string[] }): Promise<void> {
    console.warn(`[workflow] PROXY: ${payload.studentId} conflicts with [${payload.conflictingStudents.join(", ")}] on IP ${payload.ipAddress}`);
    addLog({
      id: Date.now().toString(),
      type: "PROXY_SUSPECTED",
      triggeredAt: new Date(),
      result: "success",
      summary: `Proxy: ${payload.studentId} vs [${payload.conflictingStudents.join(", ")}] @ ${payload.ipAddress}`,
    });
  },

  // ── Batch absence check (called by cron) ────

  async runAbsenceCheck(): Promise<{ checked: number; alerted: number }> {
    let alerted = 0;

    try {
      const sessions = await attendanceRepository.findAllSessions();
      const records = await attendanceRepository.findAllRecords();
      const closedSessions = sessions.filter((s) => !s.isActive);
      const totalSessions = closedSessions.length;

      if (totalSessions < rulesEngine.getConfig().minSessionsForAlert) {
        return { checked: 0, alerted: 0 };
      }

      // Build per-student attendance map
      const map: Record<string, { name: string; department: string; attended: number }> = {};
      for (const r of records) {
        if (!r.studentId) continue;
        if (!map[r.studentId]) {
          map[r.studentId] = { name: r.name, department: r.department || "N/A", attended: 0 };
        }
        if (closedSessions.some((s) => s.id === r.sessionId)) {
          map[r.studentId].attended++;
        }
      }

      const studentIds = Object.keys(map);
      for (const sid of studentIds) {
        const d = map[sid];
        const check = rulesEngine.evaluateAbsenceAlert({
          studentId: sid,
          studentName: d.name,
          department: d.department,
          attended: d.attended,
          totalSessions,
        });

        if (check.shouldAlert) {
          await this.dispatch({
            type: "ABSENCE_THRESHOLD_REACHED",
            payload: {
              studentId: sid,
              studentName: d.name,
              department: d.department,
              attended: d.attended,
              totalSessions,
              rate: check.rate,
            },
          });
          alerted++;
        }
      }

      console.log(`[workflow] Absence check complete. Checked: ${studentIds.length}, Alerted: ${alerted}`);
      return { checked: studentIds.length, alerted };
    } catch (err: any) {
      console.error("[workflow] Absence check failed:", err.message);
      return { checked: 0, alerted };
    }
  },
};
