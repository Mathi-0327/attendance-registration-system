import { useSystem } from "@/context/SystemContext";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchAndFilter } from "@/components/admin/SearchAndFilter";
import { StatsCards } from "@/components/admin/StatsCards";
import { QRCodeDisplay } from "@/components/admin/QRCodeDisplay";
import { FaceAttendance } from "@/components/admin/FaceAttendance";
import { FaceRegistration } from "@/components/admin/FaceRegistration";
import { AbsenceAlerts } from "@/components/admin/AbsenceAlerts";
import { TimetableManager } from "@/components/admin/TimetableManager";
import { generateAttendancePDF } from "@/utils/generatePDF";
import {
  Users,
  Clock,
  FileSpreadsheet,
  Trash2,
  RefreshCw,
  UserCheck,
  Lock,
  LogOut,
  Bell,
  BellOff,
  UserCog,
  Mail,
  UserPlus,
  ScanFace,
  AlertTriangle,
  FileText,
  CalendarDays,
  Edit3,
  CheckCircle2,
  XCircle,
  ClipboardList,
  Sparkles,
  ShieldCheck,
  Radio,
  Play,
  Square,
  Upload,
  Check,
  ChevronRight,
  School,
  ExternalLink,
  Laptop,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AttendanceRecord } from "@/context/SystemContext";
import BulkImport from "./attendance/BulkImport";

export default function AdminDashboard() {
  const {
    isAuthenticated: isSystemAuthenticated,
    login: systemLogin,
    logout: systemLogout,
    sessionActive,
    activeSession,
    toggleSession,
    records,
    resetSession,
    exportData,
    searchRecords,
    bulkDelete,
    enableNotifications,
    setEnableNotifications,
  } = useSystem();

  const {
    user,
    isAuthenticated: isAuthAuthenticated,
    logout: authLogout,
  } = useAuth();

  // User is considered authenticated if either AuthContext (e.g. mathi) or legacy SystemContext is authenticated
  const isUserAuthenticated = isAuthAuthenticated || isSystemAuthenticated;

  // Dashboard records (only current session)
  const dashboardRecords = activeSession
    ? records.filter((r) => r.sessionId === activeSession.id)
    : [];

  const [filteredRecords, setFilteredRecords] = useState<AttendanceRecord[]>(dashboardRecords);
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [showSessionDialog, setShowSessionDialog] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [lateThreshold, setLateThreshold] = useState(15);
  const [registeredStudents, setRegisteredStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [activeView, setActiveView] = useState<
    "attendance" | "students" | "sessions" | "alerts" | "face" | "leaves" | "corrections" | "timetable"
  >("attendance");
  const [faceSubTab, setFaceSubTab] = useState<"scan" | "register">("scan");

  // Parent Details Modal State
  const [parentModalOpen, setParentModalOpen] = useState(false);
  const [selectedStudentForParent, setSelectedStudentForParent] = useState<any>(null);
  const [parentForm, setParentForm] = useState({
    parentName: "",
    relationship: "father",
    phone: "",
    email: "",
    alternatePhone: "",
    alternateEmail: "",
    emergencyContact: "",
    notifyOnPresent: true,
    notifyOnLate: true,
    notifyOnAbsent: true,
  });
  const [savingParent, setSavingParent] = useState(false);

  // New Student Registration state
  const [showAddStudentDialog, setShowAddStudentDialog] = useState(false);
  const [newStudentForm, setNewStudentForm] = useState({
    name: "",
    studentId: "",
    department: "",
    email: "",
    phone: "",
    parentName: "",
    parentPhone: "",
    parentEmail: "",
    relationship: "father",
  });
  const [isSavingNewStudent, setIsSavingNewStudent] = useState(false);

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentForm.name.trim() || !newStudentForm.studentId.trim()) {
      toast.error("Student Name and Student ID are required");
      return;
    }
    setIsSavingNewStudent(true);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStudentForm),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to register student");
      }
      toast.success(`Student ${newStudentForm.name} registered successfully!`);
      setShowAddStudentDialog(false);
      setNewStudentForm({
        name: "",
        studentId: "",
        department: "",
        email: "",
        phone: "",
        parentName: "",
        parentPhone: "",
        parentEmail: "",
        relationship: "father",
      });
      loadRegisteredStudents();
    } catch (err: any) {
      toast.error(err.message || "Failed to register student");
    } finally {
      setIsSavingNewStudent(false);
    }
  };

  // Leave & Correction states
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [pendingCorrections, setPendingCorrections] = useState<any[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [loadingCorrections, setLoadingCorrections] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [selectedSessionForDetails, setSelectedSessionForDetails] = useState<any>(null);
  const [sessionSearch, setSessionSearch] = useState("");

  // Elapsed session timer
  const [sessionElapsed, setSessionElapsed] = useState<string>("00:00:00");

  useEffect(() => {
    if (!sessionActive || !activeSession?.startTime) {
      setSessionElapsed("00:00:00");
      return;
    }
    const start = new Date(activeSession.startTime).getTime();
    const updateElapsed = () => {
      const diff = Math.max(0, Date.now() - start);
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setSessionElapsed(
        `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
      );
    };
    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [sessionActive, activeSession]);

  // Keep filteredRecords in sync when records change
  useEffect(() => {
    setFilteredRecords(dashboardRecords);
  }, [records, activeSession]);

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch("/api/admin/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error("Error loading sessions:", error);
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadRegisteredStudents = async () => {
    setLoadingStudents(true);
    try {
      const res = await fetch("/api/students");
      if (res.ok) {
        const data = await res.json();
        setRegisteredStudents(data.students || []);
      }
    } catch (error) {
      console.error("Error loading students:", error);
    } finally {
      setLoadingStudents(false);
    }
  };

  const loadPendingLeaves = async () => {
    setLoadingLeaves(true);
    try {
      const res = await fetch("/api/v2/leave/pending");
      if (res.ok) {
        const data = await res.json();
        setPendingLeaves(data.leaves || []);
      }
    } catch (err) {
      console.error("Error loading leaves:", err);
    } finally {
      setLoadingLeaves(false);
    }
  };

  const loadPendingCorrections = async () => {
    setLoadingCorrections(true);
    try {
      const res = await fetch("/api/v2/correction/pending");
      if (res.ok) {
        const data = await res.json();
        setPendingCorrections(data.corrections || []);
      }
    } catch (err) {
      console.error("Error loading corrections:", err);
    } finally {
      setLoadingCorrections(false);
    }
  };

  useEffect(() => {
    if (isUserAuthenticated) {
      if (activeView === "sessions") loadSessions();
      if (activeView === "students") loadRegisteredStudents();
      if (activeView === "leaves") loadPendingLeaves();
      if (activeView === "corrections") loadPendingCorrections();
    }
  }, [isUserAuthenticated, activeView]);

  // Initial fetch for count badges
  useEffect(() => {
    if (isUserAuthenticated) {
      loadPendingLeaves();
      loadPendingCorrections();
    }
  }, [isUserAuthenticated]);

  const handleApproveLeave = async (id: number) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/v2/leave/${id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewedBy: 1, remarks: "Approved by Admin" }),
      });
      if (res.ok) {
        toast.success("Leave request approved successfully");
        setPendingLeaves((prev) => prev.filter((l) => l.id !== id));
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to approve leave");
      }
    } catch {
      toast.error("Failed to approve leave");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectLeave = async (id: number) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/v2/leave/${id}/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewedBy: 1, remarks: "Rejected by Admin" }),
      });
      if (res.ok) {
        toast.success("Leave request rejected");
        setPendingLeaves((prev) => prev.filter((l) => l.id !== id));
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to reject leave");
      }
    } catch {
      toast.error("Failed to reject leave");
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveCorrection = async (id: number) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/v2/correction/${id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewedBy: 1 }),
      });
      if (res.ok) {
        toast.success("Correction approved and status updated");
        setPendingCorrections((prev) => prev.filter((c) => c.id !== id));
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to approve correction");
      }
    } catch {
      toast.error("Failed to approve correction");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectCorrection = async (id: number) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/v2/correction/${id}/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewedBy: 1, remarks: "Rejected by Admin" }),
      });
      if (res.ok) {
        toast.success("Correction rejected");
        setPendingCorrections((prev) => prev.filter((c) => c.id !== id));
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to reject correction");
      }
    } catch {
      toast.error("Failed to reject correction");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm(`Are you sure you want to remove student ${studentId}?`)) return;
    try {
      const res = await fetch(`/api/students/${studentId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Student removed successfully");
        loadRegisteredStudents();
      } else {
        toast.error("Failed to delete student");
      }
    } catch {
      toast.error("Failed to delete student");
    }
  };

  const openParentModal = (student: any) => {
    setSelectedStudentForParent(student);
    const p = student.parent || {};
    setParentForm({
      parentName: p.parentName || p.fatherName || p.motherName || p.guardianName || "",
      relationship: p.relationship || p.primaryContact || "father",
      phone: p.phone || p.fatherPhone || p.motherPhone || p.guardianPhone || "",
      email: p.email || p.fatherEmail || p.motherEmail || p.guardianEmail || "",
      alternatePhone: p.alternatePhone || "",
      alternateEmail: p.alternateEmail || "",
      emergencyContact: p.emergencyContact || "",
      notifyOnPresent: p.notifyOnPresent !== undefined ? Boolean(p.notifyOnPresent) : true,
      notifyOnLate: p.notifyOnLate !== undefined ? Boolean(p.notifyOnLate) : true,
      notifyOnAbsent: p.notifyOnAbsent !== undefined ? Boolean(p.notifyOnAbsent) : true,
    });
    setParentModalOpen(true);
  };

  const handleSaveParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForParent) return;

    if (!parentForm.parentName || parentForm.parentName.trim().length < 2) {
      toast.error("Parent/Guardian name is required");
      return;
    }

    setSavingParent(true);
    try {
      const res = await fetch(`/api/students/${selectedStudentForParent.studentId}/parent`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parentForm),
      });

      if (res.ok) {
        toast.success("Parent contact & notification details updated");
        setParentModalOpen(false);
        loadRegisteredStudents();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update parent details");
      }
    } catch {
      toast.error("An error occurred saving parent details");
    } finally {
      setSavingParent(false);
    }
  };

  // Direct login fallback
  const [directPassword, setDirectPassword] = useState("");
  const [directError, setDirectError] = useState("");
  const [isDirectLoggingIn, setIsDirectLoggingIn] = useState(false);

  const handleDirectLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setDirectError("");
    setIsDirectLoggingIn(true);
    try {
      const result = systemLogin(directPassword);
      if (result.success) {
        toast.success("Access granted to Admin Panel!");
        setDirectPassword("");
      } else {
        setDirectError(result.error || "Invalid password. Default: password123 or admin123");
        toast.error("Login failed");
      }
    } catch {
      setDirectError("Login error. Please try again.");
    } finally {
      setIsDirectLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (authLogout) await authLogout();
    } catch {}
    try {
      if (systemLogout) systemLogout();
    } catch {}
    toast.success("Signed out of Admin Panel");
  };

  const [isToggling, setIsToggling] = useState(false);

  const handleToggleSession = async () => {
    if (isToggling) return;
    if (!sessionActive) {
      setShowSessionDialog(true);
      return;
    }

    setIsToggling(true);
    try {
      await toggleSession();
      toast.success("Session concluded successfully");
    } catch (error: any) {
      toast.error(error?.message || "Failed to toggle session.");
    } finally {
      setTimeout(() => setIsToggling(false), 400);
    }
  };

  const handleStartSession = async () => {
    await toggleSession(sessionName || undefined, lateThreshold);
    setShowSessionDialog(false);
    setSessionName("");
    toast.success("New live attendance session activated!");
  };

  const handleExport = async (type: "excel") => {
    const promise = exportData(type);
    toast.promise(promise, {
      loading: "Compiling Excel report...",
      success: "Excel spreadsheet exported successfully",
      error: "Export failed",
    });
  };

  const handleExportPDF = async () => {
    try {
      const currentRecords = filteredRecords.length > 0 ? filteredRecords : dashboardRecords;
      if (currentRecords.length === 0) {
        toast.error("No records to export in active session");
        return;
      }
      toast.loading("Rendering high-res PDF report...", { id: "pdf-export" });
      await generateAttendancePDF({
        records: currentRecords as any,
        session: activeSession as any,
        sessionName: activeSession?.name || undefined,
      });
      toast.success("PDF report generated successfully", { id: "pdf-export" });
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Failed to generate PDF", { id: "pdf-export" });
    }
  };

  const handleSearch = async (search: string) => {
    const results = await searchRecords(search);
    setFilteredRecords(results);
  };

  const handleFilter = async (filters: { department?: string; status?: string; dateRange?: string }) => {
    const results = await searchRecords("", filters);
    setFilteredRecords(results);
  };

  const handleSort = async (by: string, order: string) => {
    const results = await searchRecords("", undefined, { by, order });
    setFilteredRecords(results);
  };

  const handleBulkDelete = async () => {
    if (selectedRecords.size === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedRecords.size} record(s)?`)) return;

    try {
      await bulkDelete(Array.from(selectedRecords));
      setSelectedRecords(new Set());
      toast.success(`Deleted ${selectedRecords.size} record(s)`);
    } catch {
      toast.error("Failed to delete records");
    }
  };

  const chartData = useMemo(() => {
    const counts: Record<string, number> = { CS: 0, IT: 0, ECE: 0, MECH: 0, OTHER: 0 };
    dashboardRecords.forEach((r) => {
      const d = (r.department || "OTHER").toUpperCase();
      if (counts[d] !== undefined) counts[d]++;
      else counts.OTHER++;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [dashboardRecords]);

  const filteredSessions = sessions.filter((session) => {
    const searchLower = sessionSearch.toLowerCase();
    const nameMatch = (session.name || "Untitled Session").toLowerCase().includes(searchLower);
    const dateMatch = format(new Date(session.startTime), "MMM dd, yyyy").toLowerCase().includes(searchLower);
    return nameMatch || dateMatch;
  });

  const exportSessionHistory = async (type: "excel") => {
    try {
      const dataToExport = filteredSessions.length > 0 ? filteredSessions : sessions;
      if (type === "excel") {
        const XLSX = await import("xlsx");
        const worksheet = XLSX.utils.json_to_sheet(
          dataToExport.map((s) => ({
            "Session Name": s.name || "Untitled Session",
            Date: format(new Date(s.startTime), "MMM dd, yyyy"),
            "Start Time": format(new Date(s.startTime), "HH:mm:ss"),
            "End Time": s.endTime ? format(new Date(s.endTime), "HH:mm:ss") : "Active",
            Status: s.isActive ? "Active" : "Closed",
            "Attendees Count": s.records?.length || 0,
          }))
        );

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Session History");
        XLSX.writeFile(workbook, `Session_History_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
        toast.success("Session history exported to Excel");
      }
    } catch (error) {
      toast.error("Failed to export session history");
    }
  };

  const exportSpecificSession = async (session: any, type: "excel") => {
    if (!session || !session.records || session.records.length === 0) {
      toast.error("No records to export for this session");
      return;
    }
    try {
      if (type === "excel") {
        const XLSX = await import("xlsx");
        const worksheet = XLSX.utils.json_to_sheet(
          session.records.map((r: any) => ({
            Name: r.name,
            "Student ID": r.studentId,
            Department: r.department || "N/A",
            Time: format(new Date(r.timestamp), "HH:mm:ss"),
            Date: format(new Date(r.timestamp), "yyyy-MM-dd"),
            Status: r.status,
          }))
        );
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
        XLSX.writeFile(
          workbook,
          `Attendance_${session.name || "Session"}_${format(new Date(session.startTime), "yyyy-MM-dd")}.xlsx`
        );
        toast.success("Session attendance exported to Excel");
      }
    } catch (error) {
      toast.error("Failed to export session data");
    }
  };

  // If not authenticated via either system, render modern Cyber-Glass Password Wall
  if (!isUserAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden">
        {/* Glowing backdrop elements */}
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <Header />

        <main className="flex-1 flex items-center justify-center p-4 z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-md"
          >
            <Card className="border border-blue-500/20 bg-slate-900/80 backdrop-blur-2xl shadow-2xl shadow-blue-950/50">
              <CardHeader className="text-center space-y-3 pb-4">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <ShieldCheck className="w-8 h-8 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold text-white tracking-tight">
                    Super Admin Console
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-sm">
                    Enter master passcode or sign in via Enterprise Portal
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <form onSubmit={handleDirectLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-pass" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                      Master Passcode
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <Input
                        id="admin-pass"
                        type="password"
                        placeholder="Enter password (default: password123)"
                        value={directPassword}
                        onChange={(e) => setDirectPassword(e.target.value)}
                        className="pl-10 h-12 bg-slate-950/70 border-slate-700/80 text-slate-100 placeholder:text-slate-500 focus-visible:ring-blue-500/30"
                        autoFocus
                      />
                    </div>
                    {directError && (
                      <p className="text-xs text-red-400 font-medium">{directError}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-blue-600/30"
                    disabled={isDirectLoggingIn}
                  >
                    {isDirectLoggingIn ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Lock className="mr-2 h-4 w-4" />
                    )}
                    {isDirectLoggingIn ? "Authenticating..." : "Unlock Host Console"}
                  </Button>
                </form>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-800" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-slate-900 px-2 text-slate-400 font-medium">Or</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full h-11 border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-200"
                  onClick={() => (window.location.href = "/login")}
                >
                  <UserCheck className="mr-2 h-4 w-4 text-blue-400" />
                  Sign In with Enterprise Account
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </div>
    );
  }

  // ────────────────── MAIN ADMIN DASHBOARD ──────────────────
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />

      {/* Institutional Banner Bar */}
      <div className="border-b border-border/40 bg-card/40 backdrop-blur-md px-4 md:px-8 py-3">
        <div className="container mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 font-semibold text-primary">
              <School className="h-4 w-4" />
              Engineering & Technology Institute
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">Department: Computer Science & Engineering</span>
            <span className="text-muted-foreground">•</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
              <Radio className="h-3 w-3 animate-pulse" /> Wi-Fi Hotspot Online
            </span>
          </div>

          <div className="flex items-center gap-3 text-muted-foreground">
            <span>Admin: <strong className="text-foreground">{user?.name || "Mathi"}</strong></span>
            <span>•</span>
            <span className="font-mono">{format(new Date(), "EEEE, MMM dd, yyyy")}</span>
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto py-6 px-4 md:px-8 space-y-6">
        {/* Command Deck Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-card via-card/90 to-primary/5 border border-border/60 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Admin Command Center
              </h1>
              <Badge className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[11px] font-bold">
                PRO
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Real-time attendance registry, facial AI scanner, and academic automation deck.
            </p>
          </div>

          {/* Session Controller & Quick Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Live Session Toggle Card */}
            <div
              className={`flex items-center gap-3 px-4 py-2 rounded-xl border transition-all ${
                sessionActive
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                  : "bg-muted/50 border-border/60 text-muted-foreground"
              }`}
            >
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold tracking-wider">
                  {sessionActive ? "Live Session" : "Session Mode"}
                </span>
                <span className="text-xs font-semibold font-mono">
                  {sessionActive ? sessionElapsed : "STANDBY"}
                </span>
              </div>
              <Switch
                checked={!!sessionActive}
                disabled={isToggling}
                onCheckedChange={handleToggleSession}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>

            {/* Sound Notifications */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEnableNotifications(!enableNotifications)}
              className="h-10 gap-2 border-border/60 bg-background/50"
              title="Toggle Audio Notifications"
            >
              {enableNotifications ? (
                <Bell className="h-4 w-4 text-primary" />
              ) : (
                <BellOff className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="hidden sm:inline text-xs">
                {enableNotifications ? "Audio On" : "Muted"}
              </span>
            </Button>

            {/* PDF Report */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              className="h-10 gap-1.5 border-border/60 bg-background/50 text-xs font-medium"
            >
              <FileText className="h-4 w-4 text-red-500" />
              <span className="hidden sm:inline">Export</span> PDF
            </Button>

            {/* Excel Report */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("excel")}
              className="h-10 gap-1.5 border-border/60 bg-background/50 text-xs font-medium"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
              <span className="hidden sm:inline">Export</span> Excel
            </Button>

            {/* Bulk Delete (if items selected) */}
            {selectedRecords.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                className="h-10 gap-1.5 text-xs font-medium shadow-md shadow-red-500/20"
              >
                <Trash2 className="h-4 w-4" />
                Delete ({selectedRecords.size})
              </Button>
            )}

            {/* Sign Out */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="h-10 text-xs text-muted-foreground hover:text-destructive gap-1.5"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Exit</span>
            </Button>
          </div>
        </div>

        {/* View Switcher Segmented Pills */}
        <div className="flex items-center gap-1.5 p-1.5 bg-muted/60 backdrop-blur-md rounded-2xl border border-border/60 overflow-x-auto">
          <Button
            variant={activeView === "attendance" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveView("attendance")}
            className="rounded-xl h-9 text-xs font-semibold gap-2"
          >
            <UserCheck className="h-4 w-4" />
            Live Registry
          </Button>

          <Button
            variant={activeView === "face" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveView("face")}
            className="rounded-xl h-9 text-xs font-semibold gap-2"
          >
            <ScanFace className="h-4 w-4" />
            Face Scan HUD
          </Button>

          <Button
            variant={activeView === "leaves" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveView("leaves")}
            className="relative rounded-xl h-9 text-xs font-semibold gap-2"
          >
            <CalendarDays className="h-4 w-4" />
            Leaves
            {pendingLeaves.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm shadow-red-500/50">
                {pendingLeaves.length}
              </span>
            )}
          </Button>

          <Button
            variant={activeView === "corrections" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveView("corrections")}
            className="relative rounded-xl h-9 text-xs font-semibold gap-2"
          >
            <Edit3 className="h-4 w-4" />
            Corrections
            {pendingCorrections.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-sm shadow-amber-500/50">
                {pendingCorrections.length}
              </span>
            )}
          </Button>

          <Button
            variant={activeView === "alerts" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveView("alerts")}
            className="rounded-xl h-9 text-xs font-semibold gap-2"
          >
            <AlertTriangle className="h-4 w-4" />
            Absence Alerts
          </Button>

          <Button
            variant={activeView === "students" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveView("students")}
            className="rounded-xl h-9 text-xs font-semibold gap-2"
          >
            <UserCog className="h-4 w-4" />
            Students & Parents
          </Button>

          <Button
            variant={activeView === "sessions" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveView("sessions")}
            className="rounded-xl h-9 text-xs font-semibold gap-2"
          >
            <Clock className="h-4 w-4" />
            Past Sessions
          </Button>

          <Button
            variant={activeView === "timetable" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveView("timetable")}
            className="rounded-xl h-9 text-xs font-semibold gap-2"
          >
            <CalendarDays className="h-4 w-4" />
            Timetable
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => (window.location.href = "/admin/face-register")}
            className="rounded-xl h-9 text-xs font-semibold text-primary hover:text-primary gap-1.5 ml-auto shrink-0"
          >
            <UserPlus className="h-4 w-4" />
            Register Student
          </Button>
        </div>

        {/* Global Key Metric Cards */}
        {(activeView === "attendance" || activeView === "face") && (
          <StatsCards records={dashboardRecords} sessionActive={sessionActive} />
        )}

        {/* ─── TAB 1: ATTENDANCE REGISTRY ─── */}
        {activeView === "attendance" && (
          showBulkImport && activeSession ? (
            <BulkImport
              sessionId={activeSession.id}
              onBack={() => setShowBulkImport(false)}
              onImportComplete={() => setShowBulkImport(false)}
            />
          ) : (
            <div className="space-y-4">
              {/* Search & Filter Bar */}
              <SearchAndFilter
                onSearch={handleSearch}
                onFilter={handleFilter}
                onSort={handleSort}
              />

              <div className="grid lg:grid-cols-3 gap-6">
                {/* Main Live Attendance Table */}
                <div className="lg:col-span-2 space-y-4">
                  <Card className="border border-border/60 shadow-sm bg-card/80 backdrop-blur-md overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                      <div>
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                          <Radio className="h-4 w-4 text-emerald-500 animate-pulse" />
                          Live Attendance Feed
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Real-time biometric & Wi-Fi verified check-ins
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {sessionActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowBulkImport(true)}
                            className="h-8 text-xs gap-1.5 font-medium border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            Bulk Import
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.location.reload()}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="Refresh Feed"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="p-0">
                      <ScrollArea className="h-[520px]">
                        <Table>
                          <TableHeader className="sticky top-0 bg-card/95 backdrop-blur-md z-10 border-b border-border/60">
                            <TableRow>
                              <TableHead className="w-12 text-center">
                                <Checkbox
                                  checked={
                                    selectedRecords.size === filteredRecords.length &&
                                    filteredRecords.length > 0
                                  }
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedRecords(new Set(filteredRecords.map((r) => r.id)));
                                    } else {
                                      setSelectedRecords(new Set());
                                    }
                                  }}
                                />
                              </TableHead>
                              <TableHead className="text-xs font-semibold">Student</TableHead>
                              <TableHead className="text-xs font-semibold">Department</TableHead>
                              <TableHead className="text-xs font-semibold">Time</TableHead>
                              <TableHead className="hidden md:table-cell text-xs font-semibold">
                                Device / Verified IP
                              </TableHead>
                              <TableHead className="text-xs font-semibold text-right">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredRecords.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                                  <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-30 text-primary" />
                                  <p className="text-sm font-semibold">No attendance entries recorded yet.</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {sessionActive
                                      ? "Students can check in via QR code or facial scanner."
                                      : "Start a session to accept attendance check-ins."}
                                  </p>
                                </TableCell>
                              </TableRow>
                            ) : (
                              filteredRecords.map((record) => (
                                <TableRow
                                  key={record.id}
                                  className="group hover:bg-muted/40 transition-colors"
                                >
                                  <TableCell className="text-center">
                                    <Checkbox
                                      checked={selectedRecords.has(record.id)}
                                      onCheckedChange={(checked) => {
                                        const newSelected = new Set(selectedRecords);
                                        if (checked) newSelected.add(record.id);
                                        else newSelected.delete(record.id);
                                        setSelectedRecords(newSelected);
                                      }}
                                    />
                                  </TableCell>

                                  <TableCell>
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                                        {(record.name || "S").charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                        <div className="font-semibold text-sm text-foreground">
                                          {record.name}
                                        </div>
                                        <div className="font-mono text-xs text-muted-foreground">
                                          {record.studentId}
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>

                                  <TableCell>
                                    <Badge variant="secondary" className="font-medium text-xs">
                                      {record.department || "General"}
                                    </Badge>
                                  </TableCell>

                                  <TableCell className="font-mono text-xs text-muted-foreground">
                                    {format(new Date(record.timestamp), "HH:mm:ss")}
                                  </TableCell>

                                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                                    <div className="truncate max-w-[180px] font-medium">{record.device}</div>
                                    <div className="font-mono text-[10px] opacity-60">{record.ipAddress}</div>
                                  </TableCell>

                                  <TableCell className="text-right">
                                    <Badge
                                      className={
                                        record.status === "late"
                                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold"
                                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-semibold"
                                      }
                                    >
                                      {record.status === "late" ? "Late (+Threshold)" : "Present"}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>

                {/* Right Side QR & Department Breakdown */}
                <div className="space-y-6">
                  <QRCodeDisplay />

                  {/* Department Distribution Chart */}
                  <Card className="border border-border/60 bg-card/80 backdrop-blur-md shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-bold flex items-center justify-between">
                        <span>Department Distribution</span>
                        <span className="text-xs text-muted-foreground font-normal">Active Session</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                          <Tooltip
                            cursor={{ fill: "transparent" }}
                            contentStyle={{
                              borderRadius: "10px",
                              backgroundColor: "hsl(var(--card))",
                              borderColor: "hsl(var(--border))",
                              boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                            }}
                          />
                          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                            {chartData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Reset/Clear Action */}
                  <Card className="border border-destructive/20 bg-destructive/5">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-destructive">Emergency Session Reset</p>
                        <p className="text-[11px] text-muted-foreground">Clear current live records cache</p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          if (confirm("Are you sure you want to clear all active session records?")) {
                            await resetSession();
                            toast.success("Live attendance records cleared");
                          }
                        }}
                        className="h-8 text-xs gap-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Clear
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )
        )}

        {/* ─── TAB 2: FACE SCAN HUD & BIOMETRIC ONBOARDING ─── */}
        {activeView === "face" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={faceSubTab === "scan" ? "default" : "outline"}
                  onClick={() => setFaceSubTab("scan")}
                  className="gap-2 text-xs font-semibold h-9 rounded-xl shadow-sm"
                >
                  <ScanFace className="w-4 h-4" />
                  Live Attendance Scanner
                </Button>
                <Button
                  size="sm"
                  variant={faceSubTab === "register" ? "default" : "outline"}
                  onClick={() => setFaceSubTab("register")}
                  className="gap-2 text-xs font-semibold h-9 rounded-xl shadow-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  Biometric Face Enrollment
                </Button>
              </div>
            </div>

            {faceSubTab === "scan" ? (
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <FaceAttendance
                    sessionActive={!!sessionActive}
                    onNavigateToEnrollment={() => setFaceSubTab("register")}
                  />
                </div>
                <div className="space-y-6">
                  <QRCodeDisplay />
                  <Card className="border border-border/60 bg-card/80 backdrop-blur-md">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-blue-500" />
                        Facial Recognition Guide
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground space-y-2.5 leading-relaxed">
                      <p>1. Start an active session using the toggle in the command header.</p>
                      <p>2. Activate the camera scanner and center the student in front of camera.</p>
                      <p>3. AI calculates 128-dimensional facial vectors with Euclidean distance matching.</p>
                      <p>4. Upon match, attendance is automatically registered with SMS alerts.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFaceSubTab("register")}
                        className="w-full mt-2 text-xs font-medium gap-1.5"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Enroll New Student Faces
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <FaceRegistration />
            )}
          </div>
        )}

        {/* ─── TAB 3: LEAVE APPROVAL QUEUE ─── */}
        {activeView === "leaves" && (
          <Card className="border border-border/60 bg-card/80 backdrop-blur-md shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-lg font-bold">Leave Approval Queue</CardTitle>
                <CardDescription className="text-xs">
                  Review student medical certificates, OD requests, and leave petitions
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadPendingLeaves}
                disabled={loadingLeaves}
                className="h-8 text-xs gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingLeaves ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {loadingLeaves ? (
                <div className="text-center py-12 text-muted-foreground">
                  <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
                  <p className="text-xs">Loading leave requests...</p>
                </div>
              ) : pendingLeaves.length === 0 ? (
                <div className="text-center py-16 border border-dashed rounded-2xl bg-muted/20">
                  <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30 text-primary" />
                  <p className="font-semibold text-sm">No Pending Leave Requests</p>
                  <p className="text-xs text-muted-foreground mt-1">All leave applications are up to date.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingLeaves.map((leave) => (
                    <motion.div
                      key={leave.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-xl border border-border/60 bg-card flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition-all"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm font-mono">{leave.studentId}</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-xs font-semibold">
                            {format(new Date(leave.fromDate), "MMM dd, yyyy")} to {format(new Date(leave.toDate), "MMM dd, yyyy")}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {leave.totalDays} Day{leave.totalDays !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <p className="text-xs text-foreground">
                          Reason: <span className="text-muted-foreground">{leave.reason}</span>
                        </p>
                        {leave.document && (
                          <div className="pt-0.5">
                            <a
                              href={leave.document}
                              download={`leave_proof_${leave.studentId}.png`}
                              className="text-xs text-primary underline flex items-center gap-1 hover:text-primary/80"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              View/Download Attachment
                            </a>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={processingId === leave.id}
                          onClick={() => handleRejectLeave(leave.id)}
                          className="h-8 text-xs text-destructive hover:bg-destructive/10 gap-1.5"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          disabled={processingId === leave.id}
                          onClick={() => handleApproveLeave(leave.id)}
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ─── TAB 4: CORRECTION CLAIMS ─── */}
        {activeView === "corrections" && (
          <Card className="border border-border/60 bg-card/80 backdrop-blur-md shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-lg font-bold">Attendance Correction Claims</CardTitle>
                <CardDescription className="text-xs">
                  Review and settle student attendance dispute submissions
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadPendingCorrections}
                disabled={loadingCorrections}
                className="h-8 text-xs gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingCorrections ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {loadingCorrections ? (
                <div className="text-center py-12 text-muted-foreground">
                  <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
                  <p className="text-xs">Loading correction claims...</p>
                </div>
              ) : pendingCorrections.length === 0 ? (
                <div className="text-center py-16 border border-dashed rounded-2xl bg-muted/20">
                  <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30 text-primary" />
                  <p className="font-semibold text-sm">No Pending Corrections</p>
                  <p className="text-xs text-muted-foreground mt-1">All attendance correction claims are resolved.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingCorrections.map((corr) => (
                    <motion.div
                      key={corr.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-xl border border-border/60 bg-card flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition-all"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm font-mono">{corr.studentId}</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-xs">Session #{corr.sessionId}</span>
                          <span className="text-muted-foreground">•</span>
                          <Badge variant="secondary" className="bg-red-500/10 text-red-600 dark:text-red-400 text-xs">
                            Was: {corr.currentStatus}
                          </Badge>
                          <Badge className="bg-emerald-600 text-white text-xs">
                            Change to: {corr.requestedStatus}
                          </Badge>
                        </div>
                        <p className="text-xs text-foreground">
                          Reason: <span className="text-muted-foreground">{corr.reason}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={processingId === corr.id}
                          onClick={() => handleRejectCorrection(corr.id)}
                          className="h-8 text-xs text-destructive hover:bg-destructive/10 gap-1.5"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          disabled={processingId === corr.id}
                          onClick={() => handleApproveCorrection(corr.id)}
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ─── TAB 5: ABSENCE ALERTS ─── */}
        {activeView === "alerts" && <AbsenceAlerts />}

        {/* ─── TAB 6: STUDENTS & PARENTS DIRECTORY ─── */}
        {activeView === "students" && (
          <Card className="border border-border/60 bg-card/80 backdrop-blur-md shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-lg font-bold">Registered Students & Guardians</CardTitle>
                <CardDescription className="text-xs">
                  Manage student profiles, linked parent contacts, and automatic SMS/Email dispatch preferences
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setShowAddStudentDialog(true)}
                  className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold shadow-sm"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Add New Student
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadRegisteredStudents}
                  disabled={loadingStudents}
                  className="h-8 text-xs gap-1.5"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingStudents ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Metric Summary Strip */}
              {registeredStudents.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-blue-500/10 rounded-xl border border-blue-500/20 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">Total Registered</p>
                      <p className="text-xl font-bold text-foreground">{registeredStudents.length}</p>
                    </div>
                    <Users className="h-5 w-5 text-blue-600 opacity-80" />
                  </div>
                  <div className="p-3.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Parent Linked</p>
                      <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                        {registeredStudents.filter((s) => s.parentLinked).length}
                        <span className="text-xs font-normal ml-1">
                          ({Math.round((registeredStudents.filter((s) => s.parentLinked).length / registeredStudents.length) * 100)}%)
                        </span>
                      </p>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 opacity-80" />
                  </div>
                  <div className="p-3.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-indigo-700 dark:text-indigo-400 font-medium">Face Enrolled</p>
                      <p className="text-xl font-bold text-indigo-700 dark:text-indigo-400">
                        {registeredStudents.filter((s) => s.faceRegistered).length}
                        <span className="text-xs font-normal ml-1">
                          ({Math.round((registeredStudents.filter((s) => s.faceRegistered).length / registeredStudents.length) * 100)}%)
                        </span>
                      </p>
                    </div>
                    <ScanFace className="h-5 w-5 text-indigo-600 opacity-80" />
                  </div>
                </div>
              )}

              {loadingStudents ? (
                <div className="text-center py-12 text-muted-foreground">
                  <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
                  <p className="text-xs">Loading students...</p>
                </div>
              ) : registeredStudents.length === 0 ? (
                <div className="text-center py-16 border border-dashed rounded-2xl bg-muted/20">
                  <UserCog className="h-12 w-12 mx-auto mb-3 opacity-30 text-primary" />
                  <p className="font-semibold text-sm">No registered students yet</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">Register your students here to enable automated attendance tracking.</p>
                  <Button
                    size="sm"
                    onClick={() => setShowAddStudentDialog(true)}
                    className="gap-1.5 text-xs font-semibold bg-primary text-primary-foreground"
                  >
                    <UserPlus className="h-4 w-4" />
                    Register First Student
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="text-xs font-semibold">Student ID</TableHead>
                        <TableHead className="text-xs font-semibold">Name</TableHead>
                        <TableHead className="text-xs font-semibold">Department</TableHead>
                        <TableHead className="text-xs font-semibold">Parent / Guardian Link</TableHead>
                        <TableHead className="hidden md:table-cell text-xs font-semibold">Email</TableHead>
                        <TableHead className="text-xs font-semibold">Registered</TableHead>
                        <TableHead className="text-right text-xs font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {registeredStudents.map((student) => (
                        <TableRow key={student.id} className="hover:bg-muted/30">
                          <TableCell className="font-mono font-semibold text-xs">{student.studentId}</TableCell>
                          <TableCell className="font-medium text-sm">{student.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">{student.department || "N/A"}</Badge>
                          </TableCell>
                          <TableCell>
                            {student.parentLinked ? (
                              <div className="space-y-0.5">
                                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[11px]">
                                  ✓ Linked
                                </Badge>
                                <div className="text-[11px] text-muted-foreground">
                                  <span className="font-semibold text-foreground">{student.parent?.parentName || "Guardian"}</span>
                                  {student.parent?.relationship && <span className="capitalize ml-1">({student.parent.relationship})</span>}
                                </div>
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 border-amber-300 text-[11px]">
                                ✗ Not Linked
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                            {student.email || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {student.createdAt ? format(new Date(student.createdAt), "MMM dd, yyyy") : "N/A"}
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openParentModal(student)}
                              className="h-8 text-xs gap-1"
                              title="Edit Parent Contacts"
                            >
                              <Users className="h-3.5 w-3.5" />
                              Parent
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteStudent(student.studentId)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              title="Delete Student"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>

            {/* Parent Modal */}
            <Dialog open={parentModalOpen} onOpenChange={setParentModalOpen}>
              <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-base font-bold">
                    <Users className="h-5 w-5 text-primary" />
                    Parent / Guardian Contact Linkage
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Configure real-time automated SMS & Email dispatch for <strong>{selectedStudentForParent?.name}</strong> ({selectedStudentForParent?.studentId}).
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSaveParent} className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="p-name" className="text-xs font-semibold">Parent / Guardian Name *</Label>
                      <Input
                        id="p-name"
                        value={parentForm.parentName}
                        onChange={(e) => setParentForm({ ...parentForm, parentName: e.target.value })}
                        placeholder="e.g. Ramesh Kumar"
                        required
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="p-rel" className="text-xs font-semibold">Relationship</Label>
                      <select
                        id="p-rel"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm"
                        value={parentForm.relationship}
                        onChange={(e) => setParentForm({ ...parentForm, relationship: e.target.value })}
                      >
                        <option value="father">Father</option>
                        <option value="mother">Mother</option>
                        <option value="guardian">Legal Guardian</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="p-phone" className="text-xs font-semibold">Parent Mobile Number *</Label>
                      <Input
                        id="p-phone"
                        value={parentForm.phone}
                        onChange={(e) => setParentForm({ ...parentForm, phone: e.target.value })}
                        placeholder="e.g. +91 9876543210"
                        required
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="p-email" className="text-xs font-semibold">Parent Email Address *</Label>
                      <Input
                        id="p-email"
                        type="email"
                        value={parentForm.email}
                        onChange={(e) => setParentForm({ ...parentForm, email: e.target.value })}
                        placeholder="parent@example.com"
                        required
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t space-y-2">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Real-time Alert Triggers
                    </Label>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40">
                        <span>Notify on <strong>Present</strong> Check-in</span>
                        <Switch
                          checked={parentForm.notifyOnPresent}
                          onCheckedChange={(checked) => setParentForm({ ...parentForm, notifyOnPresent: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40">
                        <span>Notify on <strong>Late Arrival</strong></span>
                        <Switch
                          checked={parentForm.notifyOnLate}
                          onCheckedChange={(checked) => setParentForm({ ...parentForm, notifyOnLate: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40">
                        <span>Notify on <strong>Absence</strong></span>
                        <Switch
                          checked={parentForm.notifyOnAbsent}
                          onCheckedChange={(checked) => setParentForm({ ...parentForm, notifyOnAbsent: checked })}
                        />
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="pt-3 border-t gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setParentModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" disabled={savingParent}>
                      {savingParent ? "Saving..." : "Save Parent Details"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            {/* Add Student Modal */}
            <Dialog open={showAddStudentDialog} onOpenChange={setShowAddStudentDialog}>
              <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-base font-bold">
                    <UserPlus className="h-5 w-5 text-primary" />
                    Register New Student
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Add student academic information and guardian contact details into the database.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleCreateStudent} className="space-y-4 pt-2">
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Student Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="s-name" className="text-xs font-semibold">Full Name *</Label>
                        <Input
                          id="s-name"
                          placeholder="e.g. Alex Johnson"
                          value={newStudentForm.name}
                          onChange={(e) => setNewStudentForm(prev => ({ ...prev, name: e.target.value }))}
                          required
                          className="h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="s-id" className="text-xs font-semibold">Student / Roll ID *</Label>
                        <Input
                          id="s-id"
                          placeholder="e.g. 2024CS01"
                          value={newStudentForm.studentId}
                          onChange={(e) => setNewStudentForm(prev => ({ ...prev, studentId: e.target.value }))}
                          required
                          className="h-9 text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="s-dept" className="text-xs font-semibold">Class / Department</Label>
                        <Input
                          id="s-dept"
                          placeholder="e.g. Computer Science / Class 10A"
                          value={newStudentForm.department}
                          onChange={(e) => setNewStudentForm(prev => ({ ...prev, department: e.target.value }))}
                          className="h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="s-email" className="text-xs font-semibold">Student Email</Label>
                        <Input
                          id="s-email"
                          type="email"
                          placeholder="alex@institution.edu"
                          value={newStudentForm.email}
                          onChange={(e) => setNewStudentForm(prev => ({ ...prev, email: e.target.value }))}
                          className="h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label htmlFor="s-phone" className="text-xs font-semibold">Student Phone</Label>
                        <Input
                          id="s-phone"
                          placeholder="+91 9876543210"
                          value={newStudentForm.phone}
                          onChange={(e) => setNewStudentForm(prev => ({ ...prev, phone: e.target.value }))}
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-border/40">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Parent / Guardian Information (Optional)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="p-name-new" className="text-xs font-semibold">Parent Name</Label>
                        <Input
                          id="p-name-new"
                          placeholder="e.g. Robert Johnson"
                          value={newStudentForm.parentName}
                          onChange={(e) => setNewStudentForm(prev => ({ ...prev, parentName: e.target.value }))}
                          className="h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="p-rel-new" className="text-xs font-semibold">Relationship</Label>
                        <select
                          id="p-rel-new"
                          value={newStudentForm.relationship}
                          onChange={(e) => setNewStudentForm(prev => ({ ...prev, relationship: e.target.value }))}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm"
                        >
                          <option value="father">Father</option>
                          <option value="mother">Mother</option>
                          <option value="guardian">Guardian</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="p-phone-new" className="text-xs font-semibold">Parent Phone (for SMS)</Label>
                        <Input
                          id="p-phone-new"
                          placeholder="+91 9876543210"
                          value={newStudentForm.parentPhone}
                          onChange={(e) => setNewStudentForm(prev => ({ ...prev, parentPhone: e.target.value }))}
                          className="h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="p-email-new" className="text-xs font-semibold">Parent Email (for Alerts)</Label>
                        <Input
                          id="p-email-new"
                          type="email"
                          placeholder="parent@example.com"
                          value={newStudentForm.parentEmail}
                          onChange={(e) => setNewStudentForm(prev => ({ ...prev, parentEmail: e.target.value }))}
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="pt-3 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddStudentDialog(false)}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSavingNewStudent}
                      className="text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
                    >
                      {isSavingNewStudent ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Saving Student...
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-3.5 w-3.5" />
                          Save & Register
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </Card>
        )}

        {/* ─── TAB 7: PAST SESSIONS HISTORY ─── */}
        {activeView === "sessions" && (
          <Card className="border border-border/60 bg-card/80 backdrop-blur-md shadow-sm">
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4">
              <div>
                <CardTitle className="text-lg font-bold">Session History & Archival</CardTitle>
                <CardDescription className="text-xs">Browse past attendance sessions and download historical registries</CardDescription>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Input
                  placeholder="Search past sessions..."
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  className="h-9 w-full md:w-56 text-xs"
                />
                <Button variant="outline" size="sm" onClick={() => exportSessionHistory("excel")} className="h-9 text-xs gap-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  Excel
                </Button>
                <Button variant="outline" size="sm" onClick={loadSessions} disabled={loadingSessions} className="h-9 text-xs">
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingSessions ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {loadingSessions ? (
                <div className="text-center py-12 text-muted-foreground">
                  <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
                  <p className="text-xs">Loading sessions...</p>
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="text-center py-16 border border-dashed rounded-2xl bg-muted/20">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-30 text-primary" />
                  <p className="font-semibold text-sm">No recorded sessions found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="text-xs font-semibold">Session Name</TableHead>
                        <TableHead className="text-xs font-semibold">Date</TableHead>
                        <TableHead className="text-xs font-semibold">Start Time</TableHead>
                        <TableHead className="text-xs font-semibold">End Time</TableHead>
                        <TableHead className="text-xs font-semibold">Status</TableHead>
                        <TableHead className="text-xs font-semibold">Attendees</TableHead>
                        <TableHead className="text-right text-xs font-semibold">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSessions.map((session) => (
                        <TableRow key={session.id} className="hover:bg-muted/30">
                          <TableCell className="font-semibold text-sm">{session.name || "Untitled Session"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(session.startTime), "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {format(new Date(session.startTime), "HH:mm:ss")}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {session.endTime ? format(new Date(session.endTime), "HH:mm:ss") : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                session.isActive
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs"
                                  : "bg-muted text-muted-foreground border-border/50 text-xs"
                              }
                            >
                              {session.isActive ? "Active" : "Closed"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              {session.records?.length || 0} Recorded
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedSessionForDetails(session)}
                              className="h-8 text-xs font-medium text-primary hover:text-primary"
                            >
                              View Records
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Session Details Dialog */}
              <Dialog open={!!selectedSessionForDetails} onOpenChange={(open) => !open && setSelectedSessionForDetails(null)}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
                  <DialogHeader className="flex flex-row items-center justify-between">
                    <div>
                      <DialogTitle className="text-base font-bold">
                        {selectedSessionForDetails?.name || "Session Details"}
                      </DialogTitle>
                      <DialogDescription className="text-xs">
                        Date: {selectedSessionForDetails && format(new Date(selectedSessionForDetails.startTime), "MMM dd, yyyy")} • Total: {selectedSessionForDetails?.records?.length || 0} Students
                      </DialogDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportSpecificSession(selectedSessionForDetails, "excel")}
                      disabled={!selectedSessionForDetails?.records?.length}
                      className="h-8 text-xs gap-1.5"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                      Excel Export
                    </Button>
                  </DialogHeader>

                  <ScrollArea className="flex-1 max-h-[50vh]">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="text-xs">Name</TableHead>
                          <TableHead className="text-xs">Student ID</TableHead>
                          <TableHead className="text-xs">Department</TableHead>
                          <TableHead className="text-xs text-right">Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedSessionForDetails?.records?.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-xs text-muted-foreground">
                              No attendance recorded in this session.
                            </TableCell>
                          </TableRow>
                        ) : (
                          selectedSessionForDetails?.records?.map((record: any) => (
                            <TableRow key={record.id} className="text-xs">
                              <TableCell className="font-semibold">{record.name}</TableCell>
                              <TableCell className="font-mono">{record.studentId}</TableCell>
                              <TableCell>{record.department || "N/A"}</TableCell>
                              <TableCell className="font-mono text-right text-muted-foreground">
                                {format(new Date(record.timestamp), "HH:mm:ss")}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        )}

        {/* ─── TAB 8: TIMETABLE MANAGER ─── */}
        {activeView === "timetable" && <TimetableManager isSuperAdmin={true} />}
      </main>

      {/* Start Session Configuration Dialog */}
      <Dialog open={showSessionDialog} onOpenChange={setShowSessionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Play className="h-4 w-4 text-emerald-500" />
              Start New Attendance Session
            </DialogTitle>
            <DialogDescription className="text-xs">
              Activate real-time student Wi-Fi check-in and face scanning
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="sess-name" className="text-xs font-semibold">Session Name (Optional)</Label>
              <Input
                id="sess-name"
                placeholder="e.g., CSE-A Period 1 (CS3601)"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                className="h-10 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="late-min" className="text-xs font-semibold">Late Arrival Threshold (minutes)</Label>
              <Input
                id="late-min"
                type="number"
                min="1"
                max="60"
                value={lateThreshold}
                onChange={(e) => setLateThreshold(parseInt(e.target.value) || 15)}
                className="h-10 text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Students checking in after {lateThreshold} minutes will be marked as Late.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSessionDialog(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleStartSession} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
              Activate Live Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
