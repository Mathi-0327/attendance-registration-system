import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupWebSocket, getWebSocketServer } from "./websocket";
import { attendanceFormSchema, studentRegistrationSchema, studentLoginSchema } from "@shared/schema";
import { authRouter } from "./auth/auth.routes";
import { rbacRouter } from "./modules/rbac/rbac.routes";
import { academicRouter } from "./modules/academic/academic.routes";
import {
  v2AttendanceRoutes,
  v2LeaveRoutes,
  v2CorrectionRoutes,
} from "./modules/attendance/attendance.routes";
import { v2ProfileRoutes } from "./modules/profile/profile.routes";
import { automationRouter } from "./modules/automation/automation.routes";
import { workflowDispatcher } from "./modules/automation/workflow.dispatcher";
import { settingsRouter } from "./modules/settings/settings.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { aiRouter } from "./modules/ai/ai.routes";
import { reportRouter } from "./modules/reports/report.routes";
import { auditRouter } from "./modules/audit/audit.routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup WebSocket server
  setupWebSocket(httpServer);

  // Register Auth Routes
  app.use("/api/auth", authRouter);
  app.use("/api/rbac", rbacRouter);
  app.use("/api/academic", academicRouter);

  // ── Phase 4: Enhanced Attendance Engine (v2 routes) ──
  // All v2 routes are additive — legacy /api/attendance routes are preserved below
  app.use("/api/v2/attendance", v2AttendanceRoutes);
  app.use("/api/v2/leave", v2LeaveRoutes);
  app.use("/api/v2/correction", v2CorrectionRoutes);
  app.use("/api/v2/profile", v2ProfileRoutes);
  app.use("/api/automation", automationRouter);

  // ── Phase 7–11: New Module Routes ──
  app.use("/api/settings", settingsRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/ai", aiRouter);
  app.use("/api/reports", reportRouter);
  app.use("/api/audit", auditRouter);

  // Helper to get client Public IP (works on Render)
  const getClientIp = (req: Request): string => {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      return forwarded.split(",")[0].trim();
    }
    return req.socket.remoteAddress || "unknown";
  };

  // Device Info Helper
  const getClientDevice = (req: Request): string => {
    const userAgent = req.headers["user-agent"] || "Unknown";
    return userAgent.includes("Mobile") ? "Mobile Browser" : "Desktop Browser";
  };

  // --- API Routes ---

  // Network Check (Updated for Host=Student logic)
  app.get("/api/network/check", async (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    const activeSession = await storage.getActiveSession();

    let allowed = true;
    let message = "You are ready to submit.";

    if (activeSession && activeSession.authorizedIp) {
      if (clientIp !== activeSession.authorizedIp) {
        allowed = false;
        message = "Access Denied: You are not on the same Wi-Fi network as the Moderator.";
      }
    }

    res.json({
      clientIp,
      authorizedIp: activeSession?.authorizedIp,
      allowed,
      message,
    });
  });

  // QR Code URL Helper
  app.get("/api/qr-code", async (req: Request, res: Response) => {
    const currentUrl = `${req.protocol}://${req.get('host')}`;
    const attendanceUrl = `${currentUrl}/attendance`;
    res.json({
      url: attendanceUrl,
      qrData: attendanceUrl
    });
  });

  // Session Status
  app.get("/api/session", async (_req: Request, res: Response) => {
    const session = await storage.getActiveSession();
    res.json({ active: !!session, session });
  });

  // Toggle Session (Now captures Host IP)
  app.post("/api/session/toggle", async (req: Request, res: Response) => {
    try {
      const activeSession = await storage.getActiveSession();
      const hostIp = getClientIp(req);
      let updatedSession;

      if (activeSession) {
        // Stop session
        updatedSession = await storage.updateSession(activeSession.id, false, new Date());
      } else {
        // Start new session and LOCK it to the Host's current Public IP
        updatedSession = await storage.createSession({
          name: req.body.name || `Session ${new Date().toLocaleDateString()}`,
          isActive: true,
          startTime: new Date(),
          authorizedIp: hostIp,
        });
        console.log(`[session] Started and locked to Host IP: ${hostIp}`);
      }

      const wsServer = getWebSocketServer();
      if (wsServer) wsServer.notifySessionToggled(updatedSession);

      res.json({ active: updatedSession.isActive, session: updatedSession });
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle session" });
    }
  });

  // Attendance Records
  app.get("/api/attendance", async (_req: Request, res: Response) => {
    try {
      const records = await storage.getAllAttendanceRecords();
      res.json({ records });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch records" });
    }
  });

  // Submit Attendance (The Core Security Logic)
  app.post("/api/attendance", async (req: Request, res: Response) => {
    try {
      const activeSession = await storage.getActiveSession();
      if (!activeSession) {
        return res.status(403).json({ error: "No active session" });
      }

      const clientIp = getClientIp(req);

      // --- THE MAIN SECURITY GOAL ---
      // Check if Student IP matched the Host IP saved when session started
      if (activeSession.authorizedIp && clientIp !== activeSession.authorizedIp) {
        return res.status(403).json({
          error: "Network Security Violation",
          message: "You must be on the same Wi-Fi network as the Moderator to submit attendance."
        });
      }

      const validated = attendanceFormSchema.safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ error: "Validation failed", details: validated.error.errors });
      }

      const { name, studentId, department, deviceId } = validated.data;

      const deviceFingerprint = deviceId || getClientDevice(req);

      // Duplicate Check: Look for same Student ID OR same Device Fingerprint in this session
      const records = await storage.getAllAttendanceRecords();
      const duplicateRecord = records.find(r =>
        r.sessionId === activeSession.id &&
        (r.studentId === studentId || r.device === deviceFingerprint)
      );

      if (duplicateRecord) {
        if (duplicateRecord.studentId === studentId) {
          return res.status(409).json({ error: "Attendance already submitted for this student ID in this session" });
        } else {
          return res.status(409).json({ error: "One device per attendance allowed", message: "This device has already been used to submit attendance for this session." });
        }
      }

      const record = await storage.createAttendanceRecord({
        sessionId: activeSession.id,
        name,
        studentId,
        department,
        ipAddress: clientIp,
        device: deviceFingerprint,
        status: "present",
      });

      const wsServer = getWebSocketServer();
      if (wsServer) wsServer.notifyAttendanceRecorded(record);

      // Fire-and-forget: workflow automation (late alert, proxy check)
      workflowDispatcher.dispatch({
        type: "ATTENDANCE_MARKED",
        payload: {
          studentId,
          studentName: name,
          department: department || "N/A",
          sessionId: activeSession.id,
          sessionName: activeSession.name || `Session #${activeSession.id}`,
          sessionStartTime: activeSession.startTime,
          submittedAt: new Date(),
          ipAddress: clientIp,
          device: deviceFingerprint,
        },
      }).catch((err) => console.error("[workflow] dispatch error:", err));

      res.status(201).json({ record });
    } catch (error) {
      res.status(500).json({ error: "Failed to submit attendance" });
    }
  });


  // --- Admin Specific Routes (called directly from AdminDashboard.tsx) ---

  // Admin: Get all students
  app.get("/api/admin/students", async (_req: Request, res: Response) => {
    try {
      const students = await storage.getAllStudents();
      res.json({ students });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });

  // Admin: Delete a student
  app.delete("/api/admin/students/:studentId", async (req: Request, res: Response) => {
    try {
      const { studentId } = req.params;
      const student = await storage.getStudentById(studentId);
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }
      // Assuming storage has a deleteStudent method or similar, 
      // but let's check or implement if missing. 
      // For now, let's assume we need to add it to IStorage.
      await storage.deleteStudent(student.id);
      res.json({ message: "Student deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete student" });
    }
  });

  // Admin: Register Student Face
  app.post("/api/students/:studentId/face", async (req: Request, res: Response) => {
    try {
      const { studentId } = req.params;
      const { descriptor } = req.body;

      if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) {
        return res.status(400).json({ error: "Invalid face descriptor format" });
      }

      const student = await storage.getStudentById(studentId);
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }

      await storage.updateStudentFace(student.id, descriptor);
      res.json({ message: "Face registered successfully" });
    } catch (error) {
      console.error("Face registration error:", error);
      res.status(500).json({ error: "Failed to register face" });
    }
  });

  // Admin: Get all sessions (history) with their records
  app.get("/api/admin/sessions", async (_req: Request, res: Response) => {
    try {
      const allSessions = await storage.getAllSessions();
      const allRecords = await storage.getAllAttendanceRecords();

      const sessionsWithRecords = allSessions.map(session => ({
        ...session,
        records: allRecords.filter(r => r.sessionId === session.id)
      }));

      res.json({ sessions: sessionsWithRecords });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  // Admin: Get Stats
  app.get("/api/admin/stats", async (_req: Request, res: Response) => {
    try {
      const records = await storage.getAllAttendanceRecords();
      const total = records.length;
      const present = records.filter(r => r.status === 'present').length;
      const late = records.filter(r => r.status === 'late').length;

      const departmentBreakdown = records.reduce((acc: any, r) => {
        const dept = r.department || 'Other';
        acc[dept] = (acc[dept] || 0) + 1;
        return acc;
      }, {});

      res.json({
        total,
        present,
        late,
        departmentBreakdown
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Clear Records
  app.delete("/api/attendance", async (_req: Request, res: Response) => {
    try {
      await storage.clearAllRecords();
      const wsServer = getWebSocketServer();
      if (wsServer) wsServer.notifyRecordsCleared();
      res.json({ message: "All records cleared" });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear records" });
    }
  });

  // --- Student Registration & Login ---

  app.post("/api/students/register", async (req: Request, res: Response) => {
    try {
      const validated = studentRegistrationSchema.safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ error: "Invalid registration data", details: validated.error.errors });
      }

      const existing = await storage.getStudentById(validated.data.studentId);
      if (existing) {
        return res.status(400).json({ error: "Student ID already registered" });
      }

      const student = await storage.createStudent(validated.data);
      res.status(201).json({ message: "Registration successful", student });
    } catch (error) {
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/students/login", async (req: Request, res: Response) => {
    try {
      const validated = studentLoginSchema.safeParse(req.body);
      if (!validated.success) return res.status(400).json({ error: "Invalid login data" });

      const student = await storage.getStudentById(validated.data.studentId);
      if (!student || student.password !== validated.data.password) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      res.json({ message: "Login successful", student });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.get("/api/students", async (_req: Request, res: Response) => {
    try {
      const students = await storage.getAllStudents();
      res.json({ students });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });

  // --- Face Recognition Routes ---

  // Get all students that have face descriptors registered
  app.get("/api/students/with-faces", async (_req: Request, res: Response) => {
    try {
      const students = await storage.getAllStudents();
      const studentsWithFaces = students.filter(
        (s) => s.faceRegistered && s.faceDescriptor && Array.isArray(s.faceDescriptor) && s.faceDescriptor.length === 128
      );
      res.json({ students: studentsWithFaces });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch students with faces" });
    }
  });

  // Submit attendance via face recognition (no IP restriction — admin-initiated)
  app.post("/api/attendance/face", async (req: Request, res: Response) => {
    try {
      const activeSession = await storage.getActiveSession();
      if (!activeSession) {
        return res.status(403).json({ error: "No active session" });
      }

      const { studentId, name, department, confidence, livenessScore } = req.body;
      if (!studentId || !name) {
        return res.status(400).json({ error: "studentId and name are required" });
      }

      const parsedConfidence = confidence ? Number(confidence) : 0;
      const parsedLiveness = livenessScore ? Number(livenessScore) : 0;

      // Log the face recognition attempt
      await storage.logFaceRecognitionAttempt({
        studentId,
        sessionId: activeSession.id,
        confidence: parsedConfidence,
        livenessScore: parsedLiveness,
        isLive: parsedLiveness > 0.7,
        isKnown: parsedConfidence > 45,
        result: parsedLiveness > 0.7 ? "success" : "spoof",
        ipAddress: getClientIp(req),
      });

      if (parsedLiveness <= 0.7) {
        return res.status(400).json({ error: "Liveness check failed (Spoof attempt suspected)" });
      }

      const records = await storage.getAllAttendanceRecords();
      const duplicate = records.find(
        (r) => r.sessionId === activeSession.id && r.studentId === studentId
      );
      if (duplicate) {
        return res.status(409).json({ error: "Attendance already submitted for this student" });
      }

      const record = await storage.createAttendanceRecord({
        sessionId: activeSession.id,
        name,
        studentId,
        department: department || null,
        ipAddress: "face-recognition",
        device: "face-api",
        status: "present",
        timestamp: new Date(),
      } as any);

      const wsServer = getWebSocketServer();
      if (wsServer) wsServer.notifyAttendanceRecorded(record);

      res.status(201).json({ record });
    } catch (error) {
      console.error("Face attendance error:", error);
      res.status(500).json({ error: "Failed to submit face attendance" });
    }
  });

  // --- Absence Alerts ---

  app.get("/api/admin/absence-alerts", async (req: Request, res: Response) => {
    try {
      const threshold = parseInt(req.query.threshold as string) || 75;

      const allSessions = await storage.getAllSessions();
      const allRecords = await storage.getAllAttendanceRecords();
      const allStudents = await storage.getAllStudents();

      const closedSessions = allSessions.filter((s) => !s.isActive);
      const totalSessions = closedSessions.length;

      if (totalSessions === 0) {
        return res.json({ alerts: [], totalSessions: 0, threshold });
      }

      // Track which sessions each student attended
      const attendanceMap: Record<string, { name: string; department: string; sessions: Set<number> }> = {};

      allRecords.forEach((record) => {
        const sid = record.studentId;
        if (!attendanceMap[sid]) {
          attendanceMap[sid] = { name: record.name, department: record.department || "N/A", sessions: new Set() };
        }
        if (record.sessionId != null && closedSessions.some((s) => s.id === record.sessionId)) {
          attendanceMap[sid].sessions.add(record.sessionId as number);
        }
      });

      // Include registered students who haven't attended at all
      allStudents.forEach((student) => {
        if (!attendanceMap[student.studentId]) {
          attendanceMap[student.studentId] = {
            name: student.name,
            department: student.department || "N/A",
            sessions: new Set(),
          };
        }
      });

      const alerts = Object.entries(attendanceMap)
        .map(([studentId, data]) => {
          const attended = data.sessions.size;
          const rate = Math.round((attended / totalSessions) * 100);
          return {
            studentId,
            name: data.name,
            department: data.department,
            attended,
            totalSessions,
            rate,
            status: rate < 50 ? "critical" : "warning",
          };
        })
        .filter((a) => a.rate < threshold)
        .sort((a, b) => a.rate - b.rate);

      res.json({ alerts, totalSessions, threshold });
    } catch (error) {
      console.error("Absence alerts error:", error);
      res.status(500).json({ error: "Failed to fetch absence alerts" });
    }
  });

  return httpServer;
}

