/**
 * BulkImport.tsx
 * Admin/Faculty view to upload an Excel sheet and import attendance records in bulk.
 */

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Info,
} from "lucide-react";
import { toast } from "sonner";

interface PreviewRow {
  studentId: string;
  name: string;
  status: "present" | "absent" | "late" | "on_duty" | "medical_leave";
  department?: string;
}

export default function BulkImport({
  sessionId,
  onBack,
  onImportComplete,
}: {
  sessionId: number;
  onBack?: () => void;
  onImportComplete?: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [successResult, setSuccessResult] = useState<{
    successCount: number;
    total: number;
  } | null>(null);

  // Download template
  const handleDownloadTemplate = () => {
    window.open("/api/v2/attendance/template", "_blank");
  };

  // Handle file select
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setSuccessResult(null);
    setLoadingPreview(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("sessionId", String(sessionId));
      formData.append("preview", "true");

      const res = await fetch("/api/v2/attendance/bulk-import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to parse file preview");

      setPreviewData(data.preview || []);
      toast.success(`Successfully parsed ${data.total} records for preview`);
    } catch (err: any) {
      toast.error(err.message);
      setFile(null);
      setPreviewData([]);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Perform actual import
  const handleConfirmImport = async () => {
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sessionId", String(sessionId));
      formData.append("preview", "false");

      const res = await fetch("/api/v2/attendance/bulk-import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");

      setSuccessResult({
        successCount: data.successCount,
        total: data.total,
      });
      toast.success(`Import complete! Marked ${data.successCount} of ${data.total} records.`);
      onImportComplete?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  };

  const getStatusBadge = (status: PreviewRow["status"]) => {
    const configs = {
      present: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
      absent: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
      late: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
      on_duty: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
      medical_leave: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
    };
    return (
      <Badge variant="outline" className={configs[status] || ""}>
        {status.replace("_", " ")}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h2 className="text-xl font-bold tracking-tight">Bulk Attendance Import</h2>
          <p className="text-muted-foreground text-sm">
            Mark attendance for Session #{sessionId} using an Excel sheet.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="space-y-6 md:col-span-1">
          {/* Action Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">1. Download Template</CardTitle>
              <CardDescription>
                Download our standardized Excel spreadsheet template to map student IDs and status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full gap-2" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4" />
                Template.xlsx
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">2. Upload Filled Sheet</CardTitle>
              <CardDescription>
                Select your completed template. Valid statuses: <code className="text-xs bg-muted p-0.5 rounded">present</code>, <code className="text-xs bg-muted p-0.5 rounded">absent</code>, <code className="text-xs bg-muted p-0.5 rounded">late</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="excel-file" className="cursor-pointer">
                  <div className="flex flex-col items-center justify-center gap-2 border border-dashed rounded-lg p-6 hover:bg-muted/40 transition-colors">
                    <Upload className="h-8 w-8 text-muted-foreground animate-bounce" />
                    <span className="text-sm font-medium text-foreground">
                      {file ? file.name : "Select Excel/CSV File"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {file ? `${(file.size / 1024).toFixed(1)} KB` : "Max size 5MB"}
                    </span>
                  </div>
                </Label>
                <Input
                  id="excel-file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </CardContent>
            {file && previewData.length > 0 && (
              <CardFooter className="flex-col gap-2 pt-0">
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                  disabled={importing || loadingPreview}
                  onClick={handleConfirmImport}
                >
                  {importing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="h-4 w-4" />
                      Confirm Import ({previewData.length} records)
                    </>
                  )}
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>

        {/* Preview / Results Area */}
        <div className="md:col-span-2">
          {successResult ? (
            <Card className="border-emerald-500/20 bg-emerald-50/10 dark:bg-emerald-950/5">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto bg-emerald-100 dark:bg-emerald-900/30 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <CardTitle className="text-emerald-700 dark:text-emerald-400">Import Complete</CardTitle>
                <CardDescription>
                  Attendance has been written to the database.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center space-y-4 py-4">
                <div className="inline-block p-4 bg-card rounded-lg border text-left space-y-2">
                  <div className="flex justify-between gap-12">
                    <span className="text-muted-foreground text-sm">Successfully Marked:</span>
                    <span className="font-bold text-emerald-600">{successResult.successCount}</span>
                  </div>
                  <div className="flex justify-between gap-12">
                    <span className="text-muted-foreground text-sm">Total Processed Rows:</span>
                    <span className="font-bold">{successResult.total}</span>
                  </div>
                </div>
                <div>
                  <Button onClick={onBack || (() => {})}>
                    Back to Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  Import Preview
                </CardTitle>
                <CardDescription>
                  Review columns mapping and status validation before clicking import.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 p-0">
                {loadingPreview ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                    <span>Parsing spreadsheet...</span>
                  </div>
                ) : previewData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center p-6 text-muted-foreground">
                    <FileSpreadsheet className="h-10 w-10 opacity-30 mb-2" />
                    <p className="text-sm">No preview data</p>
                    <p className="text-xs mt-1">Upload a populated spreadsheet to view entries</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-card z-10">
                        <TableRow>
                          <TableHead>Student ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-sm">{row.studentId}</TableCell>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell>{row.department || "N/A"}</TableCell>
                            <TableCell>{getStatusBadge(row.status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
