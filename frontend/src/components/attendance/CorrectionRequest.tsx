/**
 * CorrectionRequest.tsx
 * Modal for requesting an attendance correction for a specific session.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Edit3, CheckCircle2, AlertCircle, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// ─────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────

const correctionSchema = z.object({
  requestedStatus: z.enum(
    ["present", "absent", "late", "on_duty", "medical_leave"],
    { required_error: "Select the correct status" }
  ),
  reason: z.string().min(10, "Please provide at least 10 characters"),
});

type CorrectionFormValues = z.infer<typeof correctionSchema>;

// ─────────────────────────────────────────────
// STATUS LABELS
// ─────────────────────────────────────────────

const statusLabels: Record<string, { label: string; color: string }> = {
  present: { label: "Present", color: "bg-emerald-100 text-emerald-700" },
  absent: { label: "Absent", color: "bg-red-100 text-red-700" },
  late: { label: "Late", color: "bg-amber-100 text-amber-700" },
  on_duty: { label: "On Duty (OD)", color: "bg-blue-100 text-blue-700" },
  medical_leave: { label: "Medical Leave", color: "bg-purple-100 text-purple-700" },
};

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

interface CorrectionRequestProps {
  studentId: string;
  sessionId: number;
  attendanceRecordId?: number;
  currentStatus: string;
  sessionName?: string;
  requestedBy: number; // auth user id
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function CorrectionRequest({
  studentId,
  sessionId,
  attendanceRecordId,
  currentStatus,
  sessionName,
  requestedBy,
  onSuccess,
  trigger,
}: CorrectionRequestProps) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CorrectionFormValues>({
    resolver: zodResolver(correctionSchema),
    defaultValues: {
      requestedStatus: undefined,
      reason: "",
    },
  });

  async function onSubmit(values: CorrectionFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v2/correction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          sessionId,
          attendanceRecordId,
          requestedBy,
          requestedStatus: values.requestedStatus,
          currentStatus,
          reason: values.reason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit correction request");
      }

      setSubmitted(true);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (!val) {
      setTimeout(() => {
        setSubmitted(false);
        setError(null);
        form.reset();
      }, 300);
    }
  };

  const currentStatusConfig = statusLabels[currentStatus] || {
    label: currentStatus,
    color: "bg-muted text-muted-foreground",
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground">
            <Edit3 className="h-3.5 w-3.5" />
            Request Correction
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            Request Attendance Correction
          </DialogTitle>
          <DialogDescription>
            {sessionName
              ? `Session: ${sessionName}`
              : `Session #${sessionId}`}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold">Correction Request Submitted</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your faculty will review the request and update your attendance record.
              </p>
            </div>
            <Button variant="outline" className="mt-2" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
              {/* Current status */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                <span className="text-sm text-muted-foreground">Current status:</span>
                <span
                  className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${currentStatusConfig.color}`}
                >
                  {currentStatusConfig.label}
                </span>
              </div>

              {/* Requested status */}
              <FormField
                control={form.control}
                name="requestedStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Request Change To</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select desired status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(statusLabels)
                          .filter(([key]) => key !== currentStatus)
                          .map(([key, cfg]) => (
                            <SelectItem key={key} value={key}>
                              <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium mr-2 ${cfg.color}`}>
                                {cfg.label}
                              </span>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Reason */}
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Correction</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Explain why your attendance status needs correction..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-md">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <DialogFooter className="gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="gap-2">
                  {submitting ? "Submitting..." : "Submit Request"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
