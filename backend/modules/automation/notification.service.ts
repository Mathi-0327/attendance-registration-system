/**
 * @file backend/modules/automation/notification.service.ts
 * @description Email notification service using Nodemailer.
 * Supports SMTP configuration, HTML templates, and queued delivery.
 */

import nodemailer from "nodemailer";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// ─────────────────────────────────────────────
// IN-MEMORY CONFIG STORE (persists in process)
// Replace with DB row in production
// ─────────────────────────────────────────────

let smtpConfig: SmtpConfig | null = null;
let transporter: nodemailer.Transporter | null = null;

function initFromEnv() {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  if (user && pass) {
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = Number(process.env.SMTP_PORT) || 465;
    const secure = process.env.SMTP_SECURE === "false" ? false : port === 465;
    const fromName = process.env.SMTP_FROM_NAME || "AttendReg Notifications";
    const fromEmail = process.env.SMTP_FROM_EMAIL || user;

    smtpConfig = {
      host,
      port,
      secure,
      user,
      pass,
      fromName,
      fromEmail,
    };

    const isGmail = host.includes("gmail") || user.includes("@gmail.com");
    transporter = nodemailer.createTransport(
      isGmail
        ? {
            service: "gmail",
            auth: { user, pass },
          }
        : {
            host,
            port,
            secure,
            auth: { user, pass },
          }
    );
    console.log(`[notification] Auto-configured Gmail/SMTP for ${user}`);
  }
}

initFromEnv();

export const notificationService = {
  // ── Config Management ──────────────────────

  setSmtpConfig(config: SmtpConfig) {
    smtpConfig = config;
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
    });
  },

  getSmtpConfig(): Omit<SmtpConfig, "pass"> | null {
    if (!smtpConfig) {
      initFromEnv();
    }
    if (!smtpConfig) return null;
    const { pass: _, ...safe } = smtpConfig;
    return safe;
  },

  isConfigured(): boolean {
    if (!smtpConfig) {
      initFromEnv();
    }
    return !!smtpConfig && !!transporter;
  },

  // ── Core Send ─────────────────────────────

  async sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
    if (!transporter || !smtpConfig) {
      console.warn("[notification] Email not sent — SMTP not configured.");
      return { success: false, error: "SMTP not configured" };
    }
    try {
      await transporter.sendMail({
        from: `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });
      console.log(`[notification] Email sent to ${payload.to}: ${payload.subject}`);
      return { success: true };
    } catch (err: any) {
      console.error("[notification] Email send failed:", err.message);
      return { success: false, error: err.message };
    }
  },

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!transporter) return { success: false, error: "SMTP not configured" };
    try {
      await transporter.verify();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // ── HTML Templates ────────────────────────

  buildAbsenceAlertEmail(data: {
    studentName: string;
    studentId: string;
    department: string;
    attendanceRate: number;
    attended: number;
    totalSessions: number;
    threshold: number;
  }): string {
    const riskColor = data.attendanceRate < 50 ? "#ef4444" : "#f59e0b";
    const riskLabel = data.attendanceRate < 50 ? "CRITICAL" : "WARNING";

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Segoe UI', sans-serif; background: #f3f4f6; margin: 0; padding: 20px; }
    .card { background: white; border-radius: 12px; max-width: 560px; margin: 0 auto; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 28px 32px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
    .header p { margin: 6px 0 0; opacity: 0.7; font-size: 13px; }
    .body { padding: 28px 32px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; background: ${riskColor}22; color: ${riskColor}; margin-bottom: 16px; }
    .stat-row { display: flex; gap: 12px; margin: 20px 0; }
    .stat { flex: 1; background: #f8fafc; border-radius: 8px; padding: 14px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: 800; color: ${riskColor}; }
    .stat-label { font-size: 11px; color: #64748b; margin-top: 4px; }
    .info-grid { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .info-row { display: flex; border-bottom: 1px solid #e2e8f0; }
    .info-row:last-child { border-bottom: none; }
    .info-key { width: 140px; background: #f8fafc; padding: 10px 14px; font-size: 12px; color: #64748b; font-weight: 600; }
    .info-val { padding: 10px 14px; font-size: 13px; color: #1e293b; }
    .footer { padding: 16px 32px; background: #f8fafc; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>📊 Attendance Alert</h1>
      <p>AI Smart Attendance System — Automated Report</p>
    </div>
    <div class="body">
      <span class="badge">⚠️ ${riskLabel}</span>
      <p style="color:#374151; margin: 0 0 20px; line-height: 1.6;">
        Student <strong>${data.studentName}</strong> has fallen below the minimum attendance threshold of <strong>${data.threshold}%</strong> and requires immediate attention.
      </p>
      <div class="stat-row">
        <div class="stat">
          <div class="stat-value">${data.attendanceRate}%</div>
          <div class="stat-label">Current Rate</div>
        </div>
        <div class="stat">
          <div class="stat-value">${data.attended}/${data.totalSessions}</div>
          <div class="stat-label">Sessions Attended</div>
        </div>
        <div class="stat">
          <div class="stat-value">${data.threshold}%</div>
          <div class="stat-label">Threshold</div>
        </div>
      </div>
      <div class="info-grid">
        <div class="info-row"><div class="info-key">Student ID</div><div class="info-val">${data.studentId}</div></div>
        <div class="info-row"><div class="info-key">Name</div><div class="info-val">${data.studentName}</div></div>
        <div class="info-row"><div class="info-key">Department</div><div class="info-val">${data.department}</div></div>
        <div class="info-row"><div class="info-key">Risk Level</div><div class="info-val" style="color:${riskColor}; font-weight:600;">${riskLabel}</div></div>
      </div>
    </div>
    <div class="footer">
      This is an automated alert from the AI Smart Attendance System. Please take appropriate action.
    </div>
  </div>
</body>
</html>`;
  },

  buildLateArrivalEmail(data: {
    studentName: string;
    studentId: string;
    sessionName: string;
    minutesLate: number;
    timestamp: string;
  }): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Segoe UI', sans-serif; background: #f3f4f6; margin: 0; padding: 20px; }
    .card { background: white; border-radius: 12px; max-width: 520px; margin: 0 auto; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #92400e 0%, #b45309 100%); color: white; padding: 24px 28px; }
    .header h1 { margin: 0; font-size: 18px; font-weight: 700; }
    .body { padding: 24px 28px; }
    .info-grid { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-top: 16px; }
    .info-row { display: flex; border-bottom: 1px solid #e2e8f0; }
    .info-row:last-child { border-bottom: none; }
    .info-key { width: 140px; background: #fffbeb; padding: 10px 14px; font-size: 12px; color: #92400e; font-weight: 600; }
    .info-val { padding: 10px 14px; font-size: 13px; color: #1e293b; }
    .footer { padding: 14px 28px; background: #fffbeb; text-align: center; font-size: 11px; color: #92400e; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header"><h1>⏰ Late Arrival Notification</h1></div>
    <div class="body">
      <p style="margin:0 0 8px; color:#374151;">A student arrived <strong>${data.minutesLate} minute(s) late</strong> to a session.</p>
      <div class="info-grid">
        <div class="info-row"><div class="info-key">Student</div><div class="info-val">${data.studentName} (${data.studentId})</div></div>
        <div class="info-row"><div class="info-key">Session</div><div class="info-val">${data.sessionName}</div></div>
        <div class="info-row"><div class="info-key">Minutes Late</div><div class="info-val" style="color:#b45309; font-weight:600;">${data.minutesLate} min</div></div>
        <div class="info-row"><div class="info-key">Time</div><div class="info-val">${data.timestamp}</div></div>
      </div>
    </div>
    <div class="footer">Automated Late Arrival Alert — AI Smart Attendance System</div>
  </div>
</body>
</html>`;
  },
};
