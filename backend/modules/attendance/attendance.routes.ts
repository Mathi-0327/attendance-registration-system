/**
 * @file backend/modules/attendance/attendance.routes.ts
 * @description Phase 4 API routes — /api/v2/attendance, /api/v2/leave, /api/v2/correction
 * All routes are additive (v2 namespace). Legacy /api/attendance routes are untouched.
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { attendanceService } from "./attendance.service";
import { leaveService } from "./leave.service";
import { correctionService } from "./correction.service";
import { attendanceRepository } from "./attendance.repository";
import * as XLSX from "xlsx";
import multer from "multer";

// ─────────────────────────────────────────────
// MULTER — memory storage for Excel imports
// ─────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.mimetype === "text/csv"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel (.xlsx, .xls) or CSV files are allowed"));
    }
  },
});

// ─────────────────────────────────────────────
// VALIDATION SCHEMAS
// ─────────────────────────────────────────────

const createSessionSchema = z.object({
  name: z.string().optional(),
  subjectId: z.number().optional(),
  sectionId: z.number().optional(),
  facultyId: z.number().optional(),
  periodNumber: z.number().optional(),
  authorizedIp: z.string().optional(),
  attendanceMode: z.enum(["wifi", "face", "qr", "manual", "gps"]).default("wifi"),
  geoFenceLatitude: z.number().optional(),
  geoFenceLongitude: z.number().optional(),
  geoFenceRadius: z.number().optional(),
  allowLateEntry: z.boolean().default(true),
  lateEntryAfterMinutes: z.number().default(15),
  autoClose: z.boolean().default(false),
  autoCloseAfterMinutes: z.number().optional(),
});

const submitAttendanceSchema = z.object({
  sessionId: z.number(),
  studentId: z.string().min(1),
  name: z.string().min(1),
  subjectId: z.number().optional(),
  department: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  locationAccuracy: z.number().optional(),
  confidence: z.number().optional(),
  livenessScore: z.number().optional(),
});

const bulkAttendanceSchema = z.object({
  sessionId: z.number(),
  records: z.array(
    z.object({
      studentId: z.string(),
      name: z.string(),
      status: z.enum(["present", "absent", "late", "on_duty", "medical_leave"]).default("present"),
      department: z.string().optional(),
      subjectId: z.number().optional(),
    })
  ),
});

const leaveRequestSchema = z.object({
  studentId: z.string().min(1),
  type: z.enum(["medical", "on_duty", "internship", "industrial_visit", "sports", "other"]),
  fromDate: z.string(),
  toDate: z.string(),
  reason: z.string().min(10, "Please provide a detailed reason (at least 10 characters)"),
  subjectIds: z.array(z.number()).optional(),
  document: z.string().optional(),
});

const correctionRequestSchema = z.object({
  studentId: z.string(),
  sessionId: z.number(),
  attendanceRecordId: z.number().optional(),
  requestedBy: z.number(),
  requestedStatus: z.enum(["present", "absent", "late", "on_duty", "medical_leave"]),
  currentStatus: z.string(),
  reason: z.string().min(10),
  supportingDocument: z.string().optional(),
});

const approveRejectSchema = z.object({
  reviewedBy: z.number(),
  remarks: z.string().optional(),
});

const rejectSchema = z.object({
  reviewedBy: z.number(),
  remarks: z.string().min(5, "Rejection reason required"),
});

// ─────────────────────────────────────────────
// ROUTER
// ─────────────────────────────────────────────

const v2AttendanceRouter = Router();
const v2LeaveRouter = Router();
const v2CorrectionRouter = Router();

// Helper for client IP
const getClientIp = (req: Request): string => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
};

// ─────────────────────────────────────────────
// ATTENDANCE SESSION ROUTES
// ─────────────────────────────────────────────

// POST /api/v2/attendance/session — Create extended session
v2AttendanceRouter.post("/session", async (req: Request, res: Response) => {
  try {
    const parsed = createSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }

    const session = await attendanceService.createSession({
      ...parsed.data,
      startTime: new Date(),
      isActive: true,
      createdAt: new Date(),
      totalStudents: 0,
      presentCount: 0,
      absentCount: 0,
    });

    return res.status(201).json({ session });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to create session" });
  }
});

// GET /api/v2/attendance/session/active — Get current active extended session
v2AttendanceRouter.get("/session/active", async (_req: Request, res: Response) => {
  try {
    const session = await attendanceRepository.getActiveExtendedSession();
    return res.json({ session: session ?? null, active: !!session });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/attendance/sessions — All extended sessions
v2AttendanceRouter.get("/sessions", async (_req: Request, res: Response) => {
  try {
    const sessions = await attendanceRepository.findAllExtendedSessions();
    return res.json({ sessions });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/v2/attendance/session/:id/close — Close extended session
v2AttendanceRouter.put("/session/:id/close", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid session ID" });

    const session = await attendanceRepository.closeExtendedSession(id);
    return res.json({ session });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/attendance/session/:id/records — Records for a session
v2AttendanceRouter.get("/session/:id/records", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid session ID" });

    const records = await attendanceRepository.findExtendedRecordsBySession(id);
    return res.json({ records });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// ATTENDANCE SUBMISSION ROUTES
// ─────────────────────────────────────────────

// POST /api/v2/attendance/submit — Single student attendance
v2AttendanceRouter.post("/submit", async (req: Request, res: Response) => {
  try {
    const parsed = submitAttendanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }

    const clientIp = getClientIp(req);
    const userAgent = req.headers["user-agent"] || "Unknown";
    const device = userAgent.includes("Mobile") ? "Mobile Browser" : "Desktop Browser";

    const result = await attendanceService.submitAttendance({
      ...parsed.data,
      ipAddress: clientIp,
      device,
      markedBy: "self",
    });

    return res.status(201).json({
      record: result.record,
      geoFenceWarning: result.geoFenceWarning,
    });
  } catch (err: any) {
    const status =
      err.message === "Session not found"
        ? 404
        : err.message === "Session is not active"
        ? 403
        : err.message === "Attendance already submitted for this session"
        ? 409
        : 500;
    return res.status(status).json({ error: err.message });
  }
});

// POST /api/v2/attendance/bulk — Faculty bulk mark
v2AttendanceRouter.post("/bulk", async (req: Request, res: Response) => {
  try {
    const parsed = bulkAttendanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }

    const result = await attendanceService.markBulkAttendance({
      ...parsed.data,
      markedBy: "faculty",
    });

    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/attendance/bulk-import — Excel file import
v2AttendanceRouter.post(
  "/bulk-import",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const sessionId = parseInt(req.body.sessionId);
      if (isNaN(sessionId)) {
        return res.status(400).json({ error: "sessionId is required" });
      }

      // Parse Excel/CSV
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet);

      if (rows.length === 0) {
        return res.status(400).json({ error: "Empty file — no data rows found" });
      }

      // Check preview mode
      if (req.body.preview === "true") {
        const parsed = attendanceService.parseBulkImportRows(rows, sessionId);
        return res.json({ preview: parsed.records, total: parsed.records.length });
      }

      // Full import
      const input = attendanceService.parseBulkImportRows(rows, sessionId);
      const result = await attendanceService.markBulkAttendance(input);

      return res.status(201).json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
);

// GET /api/v2/attendance/template — Download blank import template
v2AttendanceRouter.get("/template", (_req: Request, res: Response) => {
  const templateData = [
    {
      StudentID: "STU001",
      Name: "John Doe",
      Status: "present",
      Department: "CS",
      SubjectCode: "CS101",
    },
    {
      StudentID: "STU002",
      Name: "Jane Smith",
      Status: "absent",
      Department: "IT",
      SubjectCode: "CS101",
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader(
    "Content-Disposition",
    "attachment; filename=attendance_import_template.xlsx"
  );
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  return res.send(buffer);
});

// GET /api/v2/attendance/summary/:studentId — Student attendance summary
v2AttendanceRouter.get("/summary/:studentId", async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const summary = await attendanceService.getStudentSummary(studentId);
    return res.json(summary);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/attendance/geo-check — Validate GPS position
v2AttendanceRouter.post("/geo-check", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      studentLat: z.number(),
      studentLng: z.number(),
      targetLat: z.number(),
      targetLng: z.number(),
      radiusMeters: z.number().default(100),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }

    const result = attendanceService.checkGeoFence(parsed.data);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/attendance/grace — Grant grace attendance
v2AttendanceRouter.post("/grace", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      studentId: z.string(),
      subjectId: z.number(),
      grantedClasses: z.number().min(1),
      grantedBy: z.number(),
      reason: z.string().min(5),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }

    const grace = await attendanceService.grantGraceAttendance(
      parsed.data.studentId,
      parsed.data.subjectId,
      parsed.data.grantedClasses,
      parsed.data.grantedBy,
      parsed.data.reason
    );

    return res.status(201).json({ grace });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// LEAVE ROUTES
// ─────────────────────────────────────────────

// POST /api/v2/leave — Submit leave request
v2LeaveRouter.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = leaveRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }

    const leave = await leaveService.submitLeave({
      ...parsed.data,
      fromDate: new Date(parsed.data.fromDate),
      toDate: new Date(parsed.data.toDate),
    });

    return res.status(201).json({ leave });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/leave/my?studentId=XXX — Student's leave history
v2LeaveRouter.get("/my", async (req: Request, res: Response) => {
  try {
    const { studentId } = req.query;
    if (!studentId || typeof studentId !== "string") {
      return res.status(400).json({ error: "studentId query parameter is required" });
    }

    const leaves = await leaveService.getLeavesByStudent(studentId);
    const stats = await leaveService.getLeaveStats(studentId);
    return res.json({ leaves, stats });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/leave/pending — All pending leaves (admin/faculty)
v2LeaveRouter.get("/pending", async (_req: Request, res: Response) => {
  try {
    const leaves = await leaveService.getPendingLeaves();
    return res.json({ leaves });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/v2/leave/:id/approve — Approve leave
v2LeaveRouter.put("/:id/approve", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid leave ID" });

    const parsed = approveRejectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }

    const leave = await leaveService.approveLeave(id, parsed.data.reviewedBy, parsed.data.remarks);
    return res.json({ leave });
  } catch (err: any) {
    const status = err.message.includes("not found") ? 404 : 500;
    return res.status(status).json({ error: err.message });
  }
});

// PUT /api/v2/leave/:id/reject — Reject leave
v2LeaveRouter.put("/:id/reject", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid leave ID" });

    const parsed = rejectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }

    const leave = await leaveService.rejectLeave(id, parsed.data.reviewedBy, parsed.data.remarks);
    return res.json({ leave });
  } catch (err: any) {
    const status = err.message.includes("not found") ? 404 : 500;
    return res.status(status).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// CORRECTION ROUTES
// ─────────────────────────────────────────────

// POST /api/v2/correction — Submit correction request
v2CorrectionRouter.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = correctionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }

    const correction = await correctionService.requestCorrection(parsed.data);
    return res.status(201).json({ correction });
  } catch (err: any) {
    const status = err.message.includes("already exists") ? 409 : 500;
    return res.status(status).json({ error: err.message });
  }
});

// GET /api/v2/correction/pending — All pending corrections
v2CorrectionRouter.get("/pending", async (_req: Request, res: Response) => {
  try {
    const corrections = await correctionService.getPendingCorrections();
    return res.json({ corrections });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/correction/my?studentId=XXX — Student's correction history
v2CorrectionRouter.get("/my", async (req: Request, res: Response) => {
  try {
    const { studentId } = req.query;
    if (!studentId || typeof studentId !== "string") {
      return res.status(400).json({ error: "studentId query parameter is required" });
    }

    const corrections = await correctionService.getStudentCorrections(studentId);
    return res.json({ corrections });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/v2/correction/:id/approve
v2CorrectionRouter.put("/:id/approve", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid correction ID" });

    const parsed = approveRejectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }

    const correction = await correctionService.approveCorrection(
      id,
      parsed.data.reviewedBy,
      parsed.data.remarks
    );
    return res.json({ correction });
  } catch (err: any) {
    const status = err.message.includes("not found") ? 404 : 500;
    return res.status(status).json({ error: err.message });
  }
});

// PUT /api/v2/correction/:id/reject
v2CorrectionRouter.put("/:id/reject", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid correction ID" });

    const parsed = rejectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }

    const correction = await correctionService.rejectCorrection(
      id,
      parsed.data.reviewedBy,
      parsed.data.remarks
    );
    return res.json({ correction });
  } catch (err: any) {
    const status = err.message.includes("not found") ? 404 : 500;
    return res.status(status).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// EXPORT COMBINED ROUTER
// ─────────────────────────────────────────────

export const v2AttendanceRoutes = v2AttendanceRouter;
export const v2LeaveRoutes = v2LeaveRouter;
export const v2CorrectionRoutes = v2CorrectionRouter;
