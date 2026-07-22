/**
 * @file frontend/src/pages/settings/SystemSettings.tsx
 * @description Admin-only system configuration panel — general, face-match, notification,
 *              and backup/restore settings. Persisted via /api/settings endpoints.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Settings, Shield, Camera, Bell, Database, Save,
  RefreshCw, AlertTriangle, CheckCircle, Sliders,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────

interface SettingGroup {
  label: string;
  key: string;
  value: any;
  type: "boolean" | "number" | "text" | "select";
  options?: string[];
  description: string;
  min?: number;
  max?: number;
}

const defaultSettings: Record<string, any> = {
  institutionName: "AttendReg University",
  allowSelfRegistration: true,
  sessionAutoClose: true,
  sessionTimeoutMinutes: 120,
  faceMatchThreshold: 0.45,
  livenessThreshold: 0.70,
  maxFaceRetries: 3,
  attendanceWindowMinutes: 15,
  lowAttendanceThreshold: 75,
  enableEmailAlerts: true,
  enableSMSAlerts: false,
  enablePushAlerts: true,
  backupEnabled: true,
  backupFrequency: "daily",
  dataRetentionDays: 365,
};

// ── Fetch & Save helpers ───────────────────────────────────────────────────

const fetchSettings = async (): Promise<Record<string, any>> => {
  try {
    const res = await fetch("/api/settings/global");
    if (!res.ok) throw new Error("Not reachable");
    return res.json();
  } catch {
    return defaultSettings;
  }
};

const saveSettings = async (data: Record<string, any>) => {
  const res = await fetch("/api/settings/global", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

// ── Section config ─────────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: "general",
    icon: Settings,
    label: "General",
    color: "from-blue-500 to-cyan-500",
    fields: [
      { label: "Institution Name", key: "institutionName", type: "text", description: "Display name used in reports and UI." },
      { label: "Allow Self-Registration", key: "allowSelfRegistration", type: "boolean", description: "Students can register accounts without admin approval." },
      { label: "Auto-close Sessions", key: "sessionAutoClose", type: "boolean", description: "Automatically end sessions after the timeout window." },
      { label: "Session Timeout (minutes)", key: "sessionTimeoutMinutes", type: "number", min: 10, max: 480, description: "How long before an open session is auto-closed." },
    ] as SettingGroup[],
  },
  {
    id: "face",
    icon: Camera,
    label: "Face Recognition",
    color: "from-violet-500 to-purple-600",
    fields: [
      { label: "Match Threshold", key: "faceMatchThreshold", type: "number", min: 0.30, max: 0.65, description: "Euclidean distance threshold — lower = stricter. Recommended: 0.45." },
      { label: "Liveness Threshold", key: "livenessThreshold", type: "number", min: 0.50, max: 0.95, description: "Minimum score to pass the anti-spoofing liveness check." },
      { label: "Max Face Retries", key: "maxFaceRetries", type: "number", min: 1, max: 10, description: "Number of recognition attempts before flagging as unknown." },
      { label: "Attendance Window (minutes)", key: "attendanceWindowMinutes", type: "number", min: 5, max: 60, description: "Grace period after session start when face attendance is accepted." },
    ] as SettingGroup[],
  },
  {
    id: "alerts",
    icon: Bell,
    label: "Alerts & Notifications",
    color: "from-amber-500 to-orange-500",
    fields: [
      { label: "Low Attendance Threshold (%)", key: "lowAttendanceThreshold", type: "number", min: 50, max: 95, description: "Alert is triggered when a student's rate falls below this value." },
      { label: "Enable Email Alerts", key: "enableEmailAlerts", type: "boolean", description: "Send email notifications for absences and low attendance." },
      { label: "Enable SMS Alerts", key: "enableSMSAlerts", type: "boolean", description: "Send SMS via Twilio for critical attendance events." },
      { label: "Enable Push Alerts", key: "enablePushAlerts", type: "boolean", description: "Browser push notifications for real-time events." },
    ] as SettingGroup[],
  },
  {
    id: "data",
    icon: Database,
    label: "Data & Backup",
    color: "from-emerald-500 to-teal-500",
    fields: [
      { label: "Automatic Backups", key: "backupEnabled", type: "boolean", description: "Periodically export database snapshots." },
      { label: "Backup Frequency", key: "backupFrequency", type: "select", options: ["hourly", "daily", "weekly", "monthly"], description: "How often automated backups are created." },
      { label: "Data Retention (days)", key: "dataRetentionDays", type: "number", min: 30, max: 3650, description: "Records older than this threshold are archived." },
    ] as SettingGroup[],
  },
];

// ── Component ──────────────────────────────────────────────────────────────

export default function SystemSettings() {
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: fetchSettings,
  });

  const [local, setLocal] = useState<Record<string, any>>({});
  const [activeSection, setActiveSection] = useState("general");

  const merged = { ...defaultSettings, ...(settings ?? {}), ...local };

  const mutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: () => {
      toast.success("Settings saved successfully");
      setLocal({});
      qc.invalidateQueries({ queryKey: ["system-settings"] });
    },
    onError: (e: any) => toast.error(`Save failed: ${e.message}`),
  });

  const update = (key: string, value: any) => setLocal((prev) => ({ ...prev, [key]: value }));
  const isDirty = Object.keys(local).length > 0;

  const currentSection = SECTIONS.find((s) => s.id === activeSection)!;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 p-2.5">
            <Sliders className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">System Settings</h1>
            <p className="text-sm text-slate-400">Configure global platform parameters</p>
          </div>
        </div>

        {isDirty && (
          <motion.button
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            onClick={() => mutation.mutate(merged)}
            disabled={mutation.isPending}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2.5 font-semibold text-white shadow-lg shadow-violet-900/30 hover:opacity-90 disabled:opacity-60"
          >
            {mutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </motion.button>
        )}
      </motion.div>

      {isDirty && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mb-6 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-400"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-sm">You have unsaved changes. Click "Save Changes" to apply them.</span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Sidebar navigation */}
        <div className="space-y-2">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const active = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all ${
                  active
                    ? "bg-white/10 text-white shadow-lg"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className={`rounded-lg bg-gradient-to-br p-1.5 ${section.color}`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <span className="font-medium">{section.label}</span>
                {active && <div className="ml-auto h-2 w-2 rounded-full bg-blue-400" />}
              </button>
            );
          })}
        </div>

        {/* Settings panel */}
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-3"
        >
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="mb-6 flex items-center gap-3">
              <div className={`rounded-xl bg-gradient-to-br p-2 ${currentSection.color}`}>
                <currentSection.icon className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-white">{currentSection.label}</h2>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
              </div>
            ) : (
              <div className="space-y-5">
                {currentSection.fields.map((field) => (
                  <div
                    key={field.key}
                    className="flex flex-col gap-1 rounded-xl border border-white/5 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-white">{field.label}</label>
                      <p className="mt-0.5 text-xs text-slate-400">{field.description}</p>
                      {field.key in local && (
                        <span className="mt-1 inline-flex items-center gap-1 text-xs text-amber-400">
                          <AlertTriangle className="h-3 w-3" /> Modified
                        </span>
                      )}
                    </div>

                    <div className="mt-3 sm:mt-0 sm:ml-6">
                      {field.type === "boolean" && (
                        <button
                          onClick={() => update(field.key, !merged[field.key])}
                          className={`relative h-6 w-11 rounded-full transition-colors ${
                            merged[field.key] ? "bg-blue-500" : "bg-slate-600"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                              merged[field.key] ? "translate-x-5" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      )}

                      {field.type === "number" && (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={field.min}
                            max={field.max}
                            step={field.max && field.max <= 1 ? 0.05 : 1}
                            value={merged[field.key] ?? ""}
                            onChange={(e) => update(field.key, parseFloat(e.target.value) || e.target.value)}
                            className="w-28 rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      )}

                      {field.type === "text" && (
                        <input
                          type="text"
                          value={merged[field.key] ?? ""}
                          onChange={(e) => update(field.key, e.target.value)}
                          className="w-48 rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                        />
                      )}

                      {field.type === "select" && (
                        <select
                          value={merged[field.key] ?? ""}
                          onChange={(e) => update(field.key, e.target.value)}
                          className="rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                        >
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {mutation.isSuccess && !isDirty && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-emerald-400">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">All settings saved.</span>
              </div>
            )}
          </div>

          {/* Security notice */}
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-blue-300">
            <Shield className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-xs">
              All configuration changes are recorded in the Audit Log. Only administrators with the
              <strong> admin</strong> or <strong>superadmin</strong> role can modify these settings.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
