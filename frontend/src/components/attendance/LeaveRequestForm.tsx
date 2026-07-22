/**
 * LeaveRequestForm.tsx
 * Form for students to submit leave requests.
 * Supports date range, leave type, reason, subject selection, and document upload.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  CalendarDays,
  FileText,
  Send,
  CheckCircle2,
  AlertCircle,
  Upload,
  X,
} from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// ─────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────

const leaveFormSchema = z
  .object({
    type: z.enum(["medical", "on_duty", "internship", "industrial_visit", "sports", "other"], {
      required_error: "Select a leave type",
    }),
    fromDate: z.string().min(1, "Start date is required"),
    toDate: z.string().min(1, "End date is required"),
    reason: z.string().min(10, "Please provide a detailed reason (at least 10 characters)"),
  })
  .refine((data) => new Date(data.toDate) >= new Date(data.fromDate), {
    message: "End date must be on or after start date",
    path: ["toDate"],
  });

type LeaveFormValues = z.infer<typeof leaveFormSchema>;

// ─────────────────────────────────────────────
// LEAVE TYPE CONFIG
// ─────────────────────────────────────────────

const leaveTypeConfig: Record<
  string,
  { label: string; color: string; description: string }
> = {
  medical: {
    label: "Medical Leave",
    color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    description: "Illness, hospital visit, or medical procedure",
  },
  on_duty: {
    label: "On Duty (OD)",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    description: "Official college duty, competitions, events",
  },
  internship: {
    label: "Internship",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    description: "Industry internship or training program",
  },
  industrial_visit: {
    label: "Industrial Visit",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    description: "Scheduled industrial or company visit",
  },
  sports: {
    label: "Sports / Cultural",
    color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    description: "Sports meet, cultural fest, competitions",
  },
  other: {
    label: "Other",
    color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    description: "Personal or miscellaneous reason",
  },
};

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

interface LeaveRequestFormProps {
  studentId: string;
  onSuccess?: () => void;
}

export function LeaveRequestForm({ studentId, onSuccess }: LeaveRequestFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentBase64, setDocumentBase64] = useState<string | null>(null);

  const form = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveFormSchema),
    defaultValues: {
      type: undefined,
      fromDate: "",
      toDate: "",
      reason: "",
    },
  });

  const selectedType = form.watch("type");
  const fromDate = form.watch("fromDate");
  const toDate = form.watch("toDate");

  // Calculate working days
  const workingDays =
    fromDate && toDate
      ? (() => {
          let count = 0;
          const current = new Date(fromDate);
          const end = new Date(toDate);
          while (current <= end) {
            const day = current.getDay();
            if (day !== 0 && day !== 6) count++;
            current.setDate(current.getDate() + 1);
          }
          return Math.max(1, count);
        })()
      : 0;

  // Handle document upload → base64
  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Document must be smaller than 2 MB");
      return;
    }
    setDocumentFile(file);
    const reader = new FileReader();
    reader.onload = () => setDocumentBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  async function onSubmit(values: LeaveFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v2/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          ...values,
          document: documentBase64 ?? undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit leave request");
      }

      setSubmitted(true);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4 py-8 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Leave Request Submitted</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Your leave request has been sent to your faculty for approval.
          </p>
        </div>
        <Badge className={leaveTypeConfig[selectedType]?.color}>
          {leaveTypeConfig[selectedType]?.label}
        </Badge>
        <Button
          variant="outline"
          className="mt-2"
          onClick={() => {
            setSubmitted(false);
            form.reset();
            setDocumentFile(null);
            setDocumentBase64(null);
          }}
        >
          Submit Another Request
        </Button>
      </motion.div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Leave Type */}
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Leave Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(leaveTypeConfig).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <div>
                        <span className="font-medium">{cfg.label}</span>
                        <p className="text-xs text-muted-foreground">{cfg.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="fromDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>From Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    className="h-11"
                    min={new Date().toISOString().split("T")[0]}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="toDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>To Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    className="h-11"
                    min={fromDate || new Date().toISOString().split("T")[0]}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Working days badge */}
        <AnimatePresence>
          {workingDays > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2"
            >
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                <strong className="text-foreground">{workingDays}</strong> working day
                {workingDays !== 1 ? "s" : ""} selected
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reason */}
        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reason</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the reason for your leave request in detail..."
                  className="resize-none min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-xs">
                {field.value?.length || 0}/500 characters (minimum 10)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Document Upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">
            Supporting Document <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          {documentFile ? (
            <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/50">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm flex-1 truncate">{documentFile.name}</span>
              <button
                type="button"
                onClick={() => {
                  setDocumentFile(null);
                  setDocumentBase64(null);
                }}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 px-3 py-2 border border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Upload medical certificate, letter, or proof (max 2MB)
              </span>
              <input
                type="file"
                className="sr-only"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleDocumentChange}
              />
            </label>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-md">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-11 gap-2 font-medium"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <span className="animate-spin">⏳</span> Submitting...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Submit Leave Request
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
