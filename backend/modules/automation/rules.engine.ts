/**
 * @file backend/modules/automation/rules.engine.ts
 * @description Attendance Rules Engine — evaluates attendance events and
 * classifies them as: on_time, late, truant, low_attendance, proxy_suspected.
 */

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type AttendanceStatus =
  | "on_time"
  | "late"
  | "truant"
  | "low_attendance"
  | "proxy_suspected";

export interface RulesConfig {
  lateThresholdMinutes: number;     // minutes after session start = "late"
  absenceAlertThreshold: number;    // % below which to alert (e.g. 75)
  criticalThreshold: number;        // % below which = "critical" (e.g. 50)
  minSessionsForAlert: number;      // don't alert unless this many sessions done
  proxyIpWindowSeconds: number;     // seconds for proxy IP dedup window
  enableLateAlerts: boolean;
  enableAbsenceAlerts: boolean;
  enableProxyAlerts: boolean;
  alertRecipientEmail: string;
}

export interface AttendanceEvent {
  studentId: string;
  studentName: string;
  department: string;
  sessionId: number;
  sessionName: string;
  sessionStartTime: Date;
  submittedAt: Date;
  ipAddress: string;
  device: string;
}

export interface RuleResult {
  status: AttendanceStatus;
  minutesLate?: number;
  message: string;
  shouldAlert: boolean;
  alertType?: "late" | "absence" | "proxy";
}

// ─────────────────────────────────────────────
// DEFAULT CONFIG
// ─────────────────────────────────────────────

let rulesConfig: RulesConfig = {
  lateThresholdMinutes: 15,
  absenceAlertThreshold: 75,
  criticalThreshold: 50,
  minSessionsForAlert: 3,
  proxyIpWindowSeconds: 30,
  enableLateAlerts: true,
  enableAbsenceAlerts: true,
  enableProxyAlerts: true,
  alertRecipientEmail: "",
};

// Track recent IPs to detect proxy (same IP, different student, same session)
// Map: sessionId -> Map<ipAddress -> Set<studentId>>
const sessionIpMap = new Map<number, Map<string, Set<string>>>();

export const rulesEngine = {
  // ── Config ────────────────────────────────

  getConfig(): RulesConfig {
    return { ...rulesConfig };
  },

  updateConfig(patch: Partial<RulesConfig>): void {
    rulesConfig = { ...rulesConfig, ...patch };
    console.log("[rules-engine] Config updated:", rulesConfig);
  },

  // ── Core Rule Evaluation ──────────────────

  evaluateAttendance(event: AttendanceEvent): RuleResult {
    const results: RuleResult[] = [];

    // Rule 1: Late Check
    const minutesDiff =
      (event.submittedAt.getTime() - event.sessionStartTime.getTime()) / 60000;
    const minutesLate = Math.max(0, Math.round(minutesDiff));

    if (minutesLate > rulesConfig.lateThresholdMinutes) {
      return {
        status: "late",
        minutesLate,
        message: `Student arrived ${minutesLate} minute(s) late`,
        shouldAlert: rulesConfig.enableLateAlerts,
        alertType: "late",
      };
    }

    // Rule 2: Proxy Detection
    if (rulesConfig.enableProxyAlerts) {
      const proxyCheck = this.checkProxyAttempt(
        event.sessionId,
        event.ipAddress,
        event.studentId
      );
      if (proxyCheck.isSuspected) {
        return {
          status: "proxy_suspected",
          message: `Proxy suspected: IP ${event.ipAddress} used by multiple students in session ${event.sessionId}`,
          shouldAlert: true,
          alertType: "proxy",
        };
      }
    }

    return {
      status: "on_time",
      message: "Attendance marked on time",
      shouldAlert: false,
    };
  },

  // ── Absence Alert Check ───────────────────

  evaluateAbsenceAlert(data: {
    studentId: string;
    studentName: string;
    department: string;
    attended: number;
    totalSessions: number;
  }): { shouldAlert: boolean; riskLevel: "warning" | "critical" | null; rate: number } {
    if (data.totalSessions < rulesConfig.minSessionsForAlert) {
      return { shouldAlert: false, riskLevel: null, rate: 0 };
    }

    const rate = Math.round((data.attended / data.totalSessions) * 100);

    if (rate < rulesConfig.criticalThreshold) {
      return { shouldAlert: rulesConfig.enableAbsenceAlerts, riskLevel: "critical", rate };
    }

    if (rate < rulesConfig.absenceAlertThreshold) {
      return { shouldAlert: rulesConfig.enableAbsenceAlerts, riskLevel: "warning", rate };
    }

    return { shouldAlert: false, riskLevel: null, rate };
  },

  // ── Proxy Detection ───────────────────────

  checkProxyAttempt(
    sessionId: number,
    ipAddress: string,
    studentId: string
  ): { isSuspected: boolean; conflictingStudents?: string[] } {
    if (!sessionIpMap.has(sessionId)) {
      sessionIpMap.set(sessionId, new Map());
    }

    const ipTracker = sessionIpMap.get(sessionId)!;

    if (!ipTracker.has(ipAddress)) {
      ipTracker.set(ipAddress, new Set());
    }

    const studentsOnIp = ipTracker.get(ipAddress)!;
    studentsOnIp.add(studentId);

    if (studentsOnIp.size > 1) {
      const conflicting = [...studentsOnIp].filter((s) => s !== studentId);
      return { isSuspected: true, conflictingStudents: conflicting };
    }

    return { isSuspected: false };
  },

  // ── Cleanup ───────────────────────────────

  clearSessionProxy(sessionId: number): void {
    sessionIpMap.delete(sessionId);
  },
};
