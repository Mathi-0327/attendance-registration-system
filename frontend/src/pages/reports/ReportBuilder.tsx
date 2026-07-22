/**
 * @file frontend/src/pages/reports/ReportBuilder.tsx
 * @description Advanced report builder UI supporting PDF & Excel exports.
 */

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet, FileText, Filter, Calendar, Users,
  BookOpen, ChevronRight, Loader2, ArrowUpDown
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

export default function ReportBuilder() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    fromDate: "",
    toDate: "",
    department: "",
    subjectId: "all",
    status: "all",
    studentId: "",
  });
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  // Load subject list on mount
  useEffect(() => {
    async function loadSubjects() {
      try {
        const token = localStorage.getItem("attendreg_access_token") || sessionStorage.getItem("attendreg_access_token");
        const res = await fetch("/api/reports/subjects", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const list = await res.json();
          setSubjects(list);
        }
      } catch (e) {
        console.error("Failed to load subjects:", e);
      }
    }
    loadSubjects();
  }, []);

  const handleRunReport = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("attendreg_access_token") || sessionStorage.getItem("attendreg_access_token");
      
      const payload: any = {};
      if (filters.fromDate) payload.fromDate = filters.fromDate;
      if (filters.toDate) payload.toDate = filters.toDate;
      if (filters.department) payload.department = filters.department;
      if (filters.studentId) payload.studentId = filters.studentId;
      if (filters.subjectId !== "all") payload.subjectId = parseInt(filters.subjectId, 10);
      if (filters.status !== "all") payload.status = filters.status;

      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to compile filtered report");
      const data = await res.json();
      setReportData(data);
      toast.success("Report records successfully generated!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    if (!reportData || reportData.records.length === 0) {
      toast.error("No report data available to export");
      return;
    }

    const rows = reportData.records.map((r: any) => ({
      "Record ID": r.id,
      "Student ID": r.studentId,
      "Student Name": r.name,
      "Subject ID": r.subjectId || "N/A",
      "Department": r.department || "N/A",
      "IP Address": r.ipAddress,
      "Device": r.device,
      "Status": r.status,
      "Marked At": new Date(r.markedAt).toLocaleString(),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance Report");
    XLSX.writeFile(wb, `attendance_report_${Date.now()}.xlsx`);
    toast.success("Excel exported successfully!");
  };

  const exportPDF = () => {
    if (!reportData || reportData.records.length === 0) {
      toast.error("No report data available to export");
      return;
    }

    const doc = new jsPDF() as any;
    doc.text("AttendReg Enterprise Attendance Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    const headers = [["ID", "Name", "Dept", "IP Address", "Status", "Marked At"]];
    const data = reportData.records.map((r: any) => [
      r.studentId,
      r.name,
      r.department || "N/A",
      r.ipAddress,
      r.status.toUpperCase(),
      new Date(r.markedAt).toLocaleString(),
    ]);

    doc.autoTable({
      head: headers,
      body: data,
      startY: 28,
      theme: "striped",
    });

    doc.save(`attendance_report_${Date.now()}.pdf`);
    toast.success("PDF exported successfully!");
  };

  const summary = reportData?.summary;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Report Builder Console
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Build custom filters, review aggregates, and export spreadsheets or PDFs.
          </p>
        </div>

        {/* Filter Cards */}
        <Card className="bg-slate-900/30 border-slate-800 backdrop-blur-xl mb-8">
          <CardHeader className="flex flex-row items-center gap-2">
            <Filter className="w-5 h-5 text-indigo-400" />
            <div>
              <CardTitle className="text-slate-100 text-lg font-bold">Report Filters</CardTitle>
              <CardDescription className="text-slate-500">Configure parameters for custom matching</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Date Filters */}
              <div className="space-y-1.5">
                <Label>From Date</Label>
                <Input
                  type="date"
                  value={filters.fromDate}
                  onChange={(e) => setFilters((p) => ({ ...p, fromDate: e.target.value }))}
                  className="bg-slate-950/80 border-slate-850 text-slate-100"
                />
              </div>
              <div className="space-y-1.5">
                <Label>To Date</Label>
                <Input
                  type="date"
                  value={filters.toDate}
                  onChange={(e) => setFilters((p) => ({ ...p, toDate: e.target.value }))}
                  className="bg-slate-950/80 border-slate-850 text-slate-100"
                />
              </div>

              {/* Department */}
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Input
                  placeholder="e.g. Computer Science"
                  value={filters.department}
                  onChange={(e) => setFilters((p) => ({ ...p, department: e.target.value }))}
                  className="bg-slate-950/80 border-slate-850 text-slate-100"
                />
              </div>

              {/* Student ID */}
              <div className="space-y-1.5">
                <Label>Student ID</Label>
                <Input
                  placeholder="e.g. STU1001"
                  value={filters.studentId}
                  onChange={(e) => setFilters((p) => ({ ...p, studentId: e.target.value }))}
                  className="bg-slate-950/80 border-slate-850 text-slate-100"
                />
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Select value={filters.subjectId} onValueChange={(val) => setFilters((p) => ({ ...p, subjectId: val }))}>
                  <SelectTrigger className="bg-slate-950/80 border-slate-850 text-slate-100">
                    <SelectValue placeholder="All Subjects" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="all">All Subjects</SelectItem>
                    {subjects.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id.toString()}>{sub.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <Label>Attendance Status</Label>
                <Select value={filters.status} onValueChange={(val) => setFilters((p) => ({ ...p, status: val }))}>
                  <SelectTrigger className="bg-slate-950/80 border-slate-850 text-slate-100">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="on_duty">On Duty</SelectItem>
                    <SelectItem value="medical_leave">Medical Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Button onClick={handleRunReport} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 font-semibold shadow-lg shadow-blue-500/20">
              {loading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <ChevronRight className="w-4 h-4 mr-2" />}
              Compile Attendance Report
            </Button>
          </CardContent>
        </Card>

        {reportData && (
          <div className="space-y-8">
            {/* Aggregated Summaries */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-xl">
                  <CardContent className="pt-6">
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Records</p>
                    <h3 className="text-3xl font-bold text-slate-100">{summary.total}</h3>
                  </CardContent>
                </Card>
                <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-xl">
                  <CardContent className="pt-6">
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Attendance Rate</p>
                    <h3 className="text-3xl font-bold text-emerald-400">{summary.rate}%</h3>
                  </CardContent>
                </Card>
                <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-xl">
                  <CardContent className="pt-6">
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Late Arrivals</p>
                    <h3 className="text-3xl font-bold text-amber-500">{summary.late}</h3>
                  </CardContent>
                </Card>
                <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-xl">
                  <CardContent className="pt-6">
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Absences</p>
                    <h3 className="text-3xl font-bold text-rose-500">{summary.absent}</h3>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Preview table & export options */}
            <Card className="bg-slate-900/30 border-slate-800 backdrop-blur-xl">
              <CardHeader className="flex flex-row justify-between items-center border-b border-slate-850 pb-4">
                <div>
                  <CardTitle className="text-slate-100 text-lg font-bold">Report Preview</CardTitle>
                  <CardDescription className="text-slate-500">Matching database records</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={exportExcel} size="sm" variant="outline" className="border-slate-800 bg-slate-900/60 text-emerald-400 hover:bg-slate-850 hover:text-emerald-300">
                    <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Export Excel
                  </Button>
                  <Button onClick={exportPDF} size="sm" variant="outline" className="border-slate-800 bg-slate-900/60 text-blue-400 hover:bg-slate-850 hover:text-blue-300">
                    <FileText className="w-4 h-4 mr-1.5" /> Export PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {reportData.records.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Users className="w-12 h-12 mx-auto stroke-[1.5] mb-2" />
                    <p>No records match your selected filter criteria.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-slate-950/40 border-b border-slate-850">
                      <TableRow>
                        <TableHead className="text-slate-400">Student ID</TableHead>
                        <TableHead className="text-slate-400">Name</TableHead>
                        <TableHead className="text-slate-400">Department</TableHead>
                        <TableHead className="text-slate-400">IP Address</TableHead>
                        <TableHead className="text-slate-400">Status</TableHead>
                        <TableHead className="text-slate-400 text-right">Marked At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.records.map((r: any) => (
                        <TableRow key={r.id} className="border-slate-850 hover:bg-slate-900/30">
                          <TableCell className="font-bold text-slate-300">{r.studentId}</TableCell>
                          <TableCell>{r.name}</TableCell>
                          <TableCell>{r.department || "N/A"}</TableCell>
                          <TableCell className="font-mono text-slate-400 text-xs">{r.ipAddress}</TableCell>
                          <TableCell>
                            <Badge className={
                              r.status === "present" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                              r.status === "late" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                              "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            }>
                              {r.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-slate-400 text-xs">{new Date(r.markedAt).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
