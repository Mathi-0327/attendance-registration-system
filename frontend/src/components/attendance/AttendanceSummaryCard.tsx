/**
 * AttendanceSummaryCard.tsx
 * Per-subject attendance breakdown with circular gauge and color-coded status.
 * Fetches data from /api/v2/attendance/summary/:studentId
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingDown,
  TrendingUp,
  Minus,
  BookOpen,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface SubjectSummary {
  subjectId: number | null;
  subjectName?: string;
  totalClasses: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  attendancePercentage: number;
  status: "safe" | "warning" | "critical";
}

interface SummaryData {
  studentId: string;
  subjects: SubjectSummary[];
  overall: {
    totalClasses: number;
    presentCount: number;
    attendancePercentage: number;
  };
}

// ─────────────────────────────────────────────
// CIRCULAR PROGRESS GAUGE
// ─────────────────────────────────────────────

interface CircularGaugeProps {
  percentage: number;
  status: "safe" | "warning" | "critical";
  size?: number;
}

function CircularGauge({ percentage, status, size = 72 }: CircularGaugeProps) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (percentage / 100) * circumference;

  const colors = {
    safe: { stroke: "#10b981", text: "text-emerald-600 dark:text-emerald-400" },
    warning: { stroke: "#f59e0b", text: "text-amber-600 dark:text-amber-400" },
    critical: { stroke: "#ef4444", text: "text-red-600 dark:text-red-400" },
  };

  const col = colors[status];

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={6}
          className="text-muted/30"
        />
        {/* Progress ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={col.stroke}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - strokeDash }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className={`absolute text-center ${col.text}`}>
        <span className="text-sm font-bold leading-none">{Math.round(percentage)}%</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// STATUS CONFIG
// ─────────────────────────────────────────────

const statusConfig = {
  safe: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    label: "Safe",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  warning: {
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    label: "Warning",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  critical: {
    icon: <XCircle className="h-3.5 w-3.5" />,
    label: "Critical",
    badge: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
};

// ─────────────────────────────────────────────
// SUBJECT CARD
// ─────────────────────────────────────────────

function SubjectCard({ subject, index }: { subject: SubjectSummary; index: number }) {
  const sc = statusConfig[subject.status];
  const needed =
    subject.attendancePercentage < 75
      ? Math.ceil(
          (0.75 * subject.totalClasses - subject.presentCount) / 0.25
        )
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="rounded-xl border bg-card p-4 flex items-center gap-4 hover:shadow-md transition-shadow"
    >
      {/* Gauge */}
      <CircularGauge
        percentage={subject.attendancePercentage}
        status={subject.status}
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">
              {subject.subjectName || `Subject #${subject.subjectId || "??"}`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {subject.presentCount}/{subject.totalClasses} classes attended
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${sc.badge}`}
          >
            {sc.icon}
            {sc.label}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
          <span>
            <strong className="text-foreground">{subject.absentCount}</strong> absent
          </span>
          {subject.lateCount > 0 && (
            <span>
              <strong className="text-foreground">{subject.lateCount}</strong> late
            </span>
          )}
          {subject.leaveCount > 0 && (
            <span>
              <strong className="text-foreground">{subject.leaveCount}</strong> leave
            </span>
          )}
        </div>

        {/* Warning if below threshold */}
        {needed > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 font-medium">
            ⚠ Attend {needed} more class{needed > 1 ? "es" : ""} to reach 75%
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// OVERALL SUMMARY HEADER
// ─────────────────────────────────────────────

function OverallSummaryHeader({
  overall,
}: {
  overall: SummaryData["overall"];
}) {
  const status =
    overall.attendancePercentage >= 75
      ? "safe"
      : overall.attendancePercentage >= 60
      ? "warning"
      : "critical";

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 mb-4">
      <CircularGauge percentage={overall.attendancePercentage} status={status} size={80} />
      <div>
        <p className="text-sm text-muted-foreground">Overall Attendance</p>
        <p className="text-3xl font-bold">{overall.attendancePercentage.toFixed(1)}%</p>
        <p className="text-xs text-muted-foreground mt-1">
          {overall.presentCount} of {overall.totalClasses} total classes across all subjects
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

interface AttendanceSummaryCardProps {
  studentId: string;
}

export function AttendanceSummaryCard({ studentId }: AttendanceSummaryCardProps) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSummary() {
      try {
        setLoading(true);
        const res = await fetch(`/api/v2/attendance/summary/${studentId}`);
        if (!res.ok) throw new Error("Failed to fetch attendance summary");
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
        // Demo data for display
        setData({
          studentId,
          overall: { totalClasses: 45, presentCount: 38, attendancePercentage: 84.4 },
          subjects: [
            {
              subjectId: 1,
              subjectName: "Data Structures",
              totalClasses: 15,
              presentCount: 14,
              absentCount: 1,
              lateCount: 0,
              leaveCount: 0,
              attendancePercentage: 93.3,
              status: "safe",
            },
            {
              subjectId: 2,
              subjectName: "Operating Systems",
              totalClasses: 12,
              presentCount: 9,
              absentCount: 3,
              lateCount: 1,
              leaveCount: 0,
              attendancePercentage: 75.0,
              status: "safe",
            },
            {
              subjectId: 3,
              subjectName: "Computer Networks",
              totalClasses: 18,
              presentCount: 11,
              absentCount: 5,
              lateCount: 2,
              leaveCount: 0,
              attendancePercentage: 61.1,
              status: "warning",
            },
          ],
        });
      } finally {
        setLoading(false);
      }
    }
    fetchSummary();
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading attendance summary...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No attendance data available yet.</p>
      </div>
    );
  }

  const criticalCount = data.subjects.filter((s) => s.status === "critical").length;
  const warningCount = data.subjects.filter((s) => s.status === "warning").length;

  return (
    <div className="space-y-4">
      <OverallSummaryHeader overall={data.overall} />

      {/* Alerts */}
      {criticalCount > 0 && (
        <motion.div
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg px-3 py-2 text-sm"
        >
          <XCircle className="h-4 w-4 shrink-0" />
          <span>
            <strong>{criticalCount}</strong> subject{criticalCount > 1 ? "s are" : " is"} critically
            low. Immediate action required.
          </span>
        </motion.div>
      )}

      {warningCount > 0 && (
        <motion.div
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 rounded-lg px-3 py-2 text-sm"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>{warningCount}</strong> subject{warningCount > 1 ? "s are" : " is"} below 75%.
            Attend classes to improve.
          </span>
        </motion.div>
      )}

      {/* Subject cards */}
      {data.subjects.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No subject-wise data yet. Submit attendance to see breakdown.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.subjects
            .sort((a, b) => a.attendancePercentage - b.attendancePercentage)
            .map((subject, i) => (
              <SubjectCard key={subject.subjectId || i} subject={subject} index={i} />
            ))}
        </div>
      )}
    </div>
  );
}
