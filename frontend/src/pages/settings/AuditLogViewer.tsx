/**
 * @file frontend/src/pages/settings/AuditLogViewer.tsx
 * @description Admin panel for viewing persistent audit logs from the database.
 * Supports filtering by severity, resource type, and text search.
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList, RefreshCw, Search, AlertTriangle,
  AlertCircle, Info, Shield, Filter, Download,
  ChevronDown, ChevronUp, Clock, User, Globe,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface AuditLog {
  id: number;
  userId: number | null;
  userEmail: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  oldValue: any;
  newValue: any;
  ipAddress: string;
  userAgent: string | null;
  severity: "info" | "warning" | "critical";
  timestamp: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const fetchLogs = async (limit: number): Promise<AuditLog[]> => {
  const res = await fetch(`/api/audit/logs?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch audit logs");
  const data = await res.json();
  return data.logs;
};

const SEVERITY_CONFIG = {
  info: {
    icon: Info,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/30",
    badge: "bg-blue-500/20 text-blue-300",
    dot: "bg-blue-400",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/30",
    badge: "bg-amber-500/20 text-amber-300",
    dot: "bg-amber-400",
  },
  critical: {
    icon: AlertCircle,
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/30",
    badge: "bg-red-500/20 text-red-300",
    dot: "bg-red-400",
  },
};

const ACTION_COLORS: Record<string, string> = {
  LOGIN: "text-emerald-400",
  LOGOUT: "text-slate-400",
  CREATE: "text-blue-400",
  UPDATE: "text-amber-400",
  DELETE: "text-red-400",
  VIEW: "text-purple-400",
  EXPORT: "text-cyan-400",
};

function formatDate(ts: string) {
  return new Date(ts).toLocaleString("en-IN", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function timeSince(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Log Row ─────────────────────────────────────────────────────────────────

function LogRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEVERITY_CONFIG[log.severity];
  const Icon = cfg.icon;
  const actionColor = ACTION_COLORS[log.action.split("_")[0]] ?? "text-slate-300";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 transition-all ${cfg.bg}`}
    >
      <div
        className="flex cursor-pointer items-start justify-between gap-3"
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Left: icon + content */}
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 rounded-lg p-1.5 ${cfg.badge}`}>
            <Icon className={`h-4 w-4 ${cfg.color}`} />
          </div>
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`font-mono text-sm font-semibold ${actionColor}`}>{log.action}</span>
              <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-slate-300">{log.resource}</span>
              {log.resourceId && (
                <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-slate-500">#{log.resourceId}</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {log.userEmail ?? `User #${log.userId ?? "anon"}`}
              </span>
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {log.ipAddress}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {timeSince(log.timestamp)}
              </span>
            </div>
          </div>
        </div>

        {/* Right: severity badge + expand */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cfg.badge}`}>
            {log.severity}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-3 overflow-hidden border-t border-white/10 pt-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Full Timestamp</p>
            <p className="rounded bg-black/30 px-3 py-1.5 font-mono text-xs text-slate-300">{formatDate(log.timestamp)}</p>

            {log.userAgent && (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">User Agent</p>
                <p className="rounded bg-black/30 px-3 py-1.5 font-mono text-xs text-slate-300 break-all">{log.userAgent}</p>
              </>
            )}

            {(log.oldValue || log.newValue) && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {log.oldValue && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Old Value</p>
                    <pre className="rounded bg-black/30 px-3 py-2 text-xs text-red-300 overflow-x-auto">
                      {typeof log.oldValue === "string" ? log.oldValue : JSON.stringify(log.oldValue, null, 2)}
                    </pre>
                  </div>
                )}
                {log.newValue && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">New Value</p>
                    <pre className="rounded bg-black/30 px-3 py-2 text-xs text-emerald-300 overflow-x-auto">
                      {typeof log.newValue === "string" ? log.newValue : JSON.stringify(log.newValue, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function AuditLogViewer() {
  const [limit, setLimit] = useState(100);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<"all" | "info" | "warning" | "critical">("all");
  const [resourceFilter, setResourceFilter] = useState("all");

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["audit-logs", limit],
    queryFn: () => fetchLogs(limit),
    refetchInterval: 30_000,
  });

  const resources = useMemo(() => {
    const set = new Set(logs.map((l) => l.resource));
    return ["all", ...Array.from(set).sort()];
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (severityFilter !== "all" && log.severity !== severityFilter) return false;
      if (resourceFilter !== "all" && log.resource !== resourceFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          log.action.toLowerCase().includes(q) ||
          log.resource.toLowerCase().includes(q) ||
          (log.userEmail ?? "").toLowerCase().includes(q) ||
          log.ipAddress.includes(q)
        );
      }
      return true;
    });
  }, [logs, severityFilter, resourceFilter, search]);

  const exportCSV = () => {
    const header = "ID,Timestamp,Severity,Action,Resource,ResourceID,User,IP\n";
    const rows = filtered.map((l) =>
      [l.id, l.timestamp, l.severity, l.action, l.resource, l.resourceId ?? "", l.userEmail ?? "", l.ipAddress].join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const severityCounts = useMemo(() => ({
    info: logs.filter((l) => l.severity === "info").length,
    warning: logs.filter((l) => l.severity === "warning").length,
    critical: logs.filter((l) => l.severity === "critical").length,
  }), [logs]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-red-500 to-rose-600 p-2.5">
            <ClipboardList className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Audit Log Viewer</h1>
            <p className="text-sm text-slate-400">
              Persistent record of all administrative and security events
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Severity summary cards */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {(["info", "warning", "critical"] as const).map((sev) => {
          const cfg = SEVERITY_CONFIG[sev];
          const Icon = cfg.icon;
          return (
            <motion.button
              key={sev}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setSeverityFilter(severityFilter === sev ? "all" : sev)}
              className={`rounded-xl border p-4 text-left transition-all hover:scale-105 ${
                severityFilter === sev ? cfg.bg : "border-white/10 bg-white/5"
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon className={`h-5 w-5 ${cfg.color}`} />
                <span className={`text-xs font-medium capitalize ${cfg.color}`}>{sev}</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-white">{severityCounts[sev]}</p>
              <p className="text-xs text-slate-400">{sev} events</p>
            </motion.button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by action, resource, user, or IP…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={resourceFilter}
            onChange={(e) => setResourceFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            {resources.map((r) => (
              <option key={r} value={r}>{r === "all" ? "All Resources" : r}</option>
            ))}
          </select>
        </div>

        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
        >
          <option value={50}>Last 50</option>
          <option value={100}>Last 100</option>
          <option value={250}>Last 250</option>
          <option value={500}>Last 500</option>
        </select>

        <span className="text-sm text-slate-400">
          {filtered.length} / {logs.length} entries
        </span>
      </div>

      {/* Log list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="h-10 w-10 animate-spin text-blue-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-500">
          <Shield className="mb-3 h-12 w-12 opacity-30" />
          <p className="text-lg font-medium">No audit logs found</p>
          <p className="text-sm">Adjust filters or check back later</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
