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
import { studentRepository } from "./modules/students/student.repository";
import { attendanceNotificationService } from "./services/notifications/attendance-notification.service";

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

  // Helper to get client Public IP (works on Render & local Wi-Fi)
  const getClientIp = (req: Request): string => {
    const forwarded = req.headers["x-forwarded-for"];
    let ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : (req.socket.remoteAddress || "unknown");
    return ip.replace(/^::ffff:/, '');
  };

  // Helper to verify if client and moderator are on the same Wi-Fi / local network
  const isSameNetwork = (clientIp: string, authIp?: string | null): boolean => {
    if (!authIp) return true;
    const cIp = clientIp.replace(/^::ffff:/, '').trim();
    const aIp = authIp.replace(/^::ffff:/, '').trim();

    if (cIp === aIp) return true;
    if (aIp === "127.0.0.1" || aIp === "::1" || aIp === "unknown") return true;
    if (cIp === "127.0.0.1" || cIp === "::1" || cIp === "unknown") return true;

    // Check same subnet (/24 or private network class)
    const cParts = cIp.split(".");
    const aParts = aIp.split(".");
    if (cParts.length === 4 && aParts.length === 4) {
      if (cParts[0] === aParts[0] && cParts[1] === aParts[1] && cParts[2] === aParts[2]) {
        return true;
      }
      if (cParts[0] === aParts[0] && (cParts[0] === "10" || cParts[0] === "192" || cParts[0] === "172")) {
        return true;
      }
    }
    return false;
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
      if (!isSameNetwork(clientIp, activeSession.authorizedIp)) {
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
      // Check if Student IP matched the Host IP/Subnet saved when session started
      if (activeSession.authorizedIp && !isSameNetwork(clientIp, activeSession.authorizedIp)) {
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

      // Asynchronously notify Student + Parent/Guardian (decoupled, non-blocking)
      attendanceNotificationService.notifyAttendance({
        studentId,
        studentName: name,
        department: department || undefined,
        sessionId: activeSession.id,
        sessionName: activeSession.name || `Session #${activeSession.id}`,
        status: "present",
        timestamp: record.timestamp,
      }).catch((err) => console.error("[attendance-notification] Error:", err));

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

  // Admin: Get all students with Parent Linkage Status
  app.get("/api/admin/students", async (_req: Request, res: Response) => {
    try {
      const students = await studentRepository.findAllWithParentStatus();
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

  app.delete("/api/students/:studentId", async (req: Request, res: Response) => {
    try {
      const { studentId } = req.params;
      const student = await studentRepository.findByStudentId(studentId) || await storage.getStudentById(studentId);
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }
      await studentRepository.delete(student.id);
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

      const existing = await studentRepository.findByStudentId(validated.data.studentId);
      if (existing) {
        return res.status(400).json({ error: "Student ID already registered" });
      }

      const {
        studentId,
        name,
        email,
        phone,
        department,
        year,
        password,
        parentName,
        parentRelationship,
        parentPhone,
        parentEmail,
        parentAlternatePhone,
        parentAlternateEmail,
        emergencyContact,
      } = validated.data;

      const student = await studentRepository.create(
        {
          studentId,
          name,
          email: email || null,
          phone: phone || null,
          department,
          year: year || null,
          password,
        },
        {
          parentName,
          relationship: parentRelationship,
          phone: parentPhone,
          email: parentEmail,
          alternatePhone: parentAlternatePhone || undefined,
          alternateEmail: parentAlternateEmail || undefined,
          emergencyContact: emergencyContact || undefined,
        }
      );

      const parent = await studentRepository.getParentDetails(studentId);
      res.status(201).json({ message: "Registration successful", student, parent });
    } catch (error) {
      console.error("[registration] Error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // --- Face Recognition Student Face Profiles (Placed before :studentId wildcard) ---
  app.get("/api/students/with-faces", async (_req: Request, res: Response) => {
    try {
      const students = await storage.getAllStudents();
      const studentsWithFaces = students
        .map((s) => {
          let desc = s.faceDescriptor;
          if (typeof desc === "string") {
            try {
              desc = JSON.parse(desc);
            } catch (e) {
              desc = null;
            }
          }
          return {
            ...s,
            faceDescriptor: desc,
          };
        })
        .filter(
          (s) =>
            (Boolean(s.faceRegistered) || (Array.isArray(s.faceDescriptor) && s.faceDescriptor.length === 128)) &&
            Array.isArray(s.faceDescriptor) &&
            s.faceDescriptor.length === 128
        );
      res.json({ students: studentsWithFaces });
    } catch (error) {
      console.error("Error fetching students with faces:", error);
      res.status(500).json({ error: "Failed to fetch students with faces" });
    }
  });

  // Get single student by student ID
  app.get("/api/students/:studentId", async (req: Request, res: Response) => {
    try {
      const { studentId } = req.params;
      const student = await studentRepository.findByStudentId(studentId);
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }
      res.json({ student });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch student" });
    }
  });

  // Update single student by student ID
  app.put("/api/students/:studentId", async (req: Request, res: Response) => {
    try {
      const { studentId } = req.params;
      const student = await studentRepository.findByStudentId(studentId);
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }

      const { name, email, phone, department, year } = req.body;
      const updated = await studentRepository.update(student.id, {
        name: name || student.name,
        email: email !== undefined ? email : student.email,
        phone: phone !== undefined ? phone : student.phone,
        department: department || student.department,
        year: year !== undefined ? year : student.year,
      });

      res.json({ message: "Student updated successfully", student: updated });
    } catch (error) {
      res.status(500).json({ error: "Failed to update student" });
    }
  });

  // Get student attendance records
  app.get("/api/students/:studentId/attendance", async (req: Request, res: Response) => {
    try {
      const { studentId } = req.params;
      const allRecords = await storage.getAllAttendanceRecords();
      const studentRecords = allRecords
        .filter((r) => r.studentId === studentId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.json({ records: studentRecords });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch attendance records" });
    }
  });

  // Get student attendance streak
  app.get("/api/students/:studentId/streak", async (req: Request, res: Response) => {
    try {
      const { studentId } = req.params;
      const allRecords = await storage.getAllAttendanceRecords();
      const studentRecords = allRecords.filter(
        (r) => r.studentId === studentId && (r.status === "present" || r.status === "late")
      );

      if (studentRecords.length === 0) {
        return res.json({ streak: 0 });
      }

      const uniqueDates = Array.from(
        new Set(studentRecords.map((r) => new Date(r.timestamp).toISOString().split("T")[0]))
      ).sort().reverse();

      let streak = 0;
      const today = new Date().toISOString().split("T")[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

      if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
        streak = 1;
        let currentDate = new Date(uniqueDates[0]);
        for (let i = 1; i < uniqueDates.length; i++) {
          const prevDate = new Date(uniqueDates[i]);
          const diffDays = Math.round((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            streak++;
            currentDate = prevDate;
          } else {
            break;
          }
        }
      }

      res.json({ streak });
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate streak" });
    }
  });

  // Get parent details for a student
  app.get("/api/students/:studentId/parent", async (req: Request, res: Response) => {
    try {
      const { studentId } = req.params;
      const parent = await studentRepository.getParentDetails(studentId);
      res.json({ parent: parent || null });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch parent details" });
    }
  });

  // Update parent details for a student (Admin or Student)
  app.put("/api/students/:studentId/parent", async (req: Request, res: Response) => {
    try {
      const { studentId } = req.params;
      const student = await studentRepository.findByStudentId(studentId);
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }

      const parent = await studentRepository.updateParentDetails(studentId, req.body);
      res.json({ message: "Parent details updated successfully", parent });
    } catch (error) {
      console.error("[parent-update] Error:", error);
      res.status(500).json({ error: "Failed to update parent details" });
    }
  });

  // Send direct SMS notification
  app.post("/api/notifications/sms/send", async (req: Request, res: Response) => {
    try {
      const { to, message, studentId, recipientName } = req.body;
      if (!to || !message) {
        return res.status(400).json({ error: "Missing 'to' phone number or 'message' text." });
      }

      const result = await attendanceNotificationService.sendDirectSms({
        to,
        message,
        studentId,
        recipientName,
      });

      res.json({
        success: result.success,
        message: result.success ? `SMS successfully dispatched to ${to}` : "SMS dispatch failed",
        details: result,
      });
    } catch (error: any) {
      console.error("[sms-endpoint] Error:", error.message);
      res.status(500).json({ error: "Internal error sending SMS" });
    }
  });

  // Notification logs audit endpoint for admin
  app.get("/api/notifications/logs", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await attendanceNotificationService.getLogs(limit);
      res.json({ logs });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notification logs" });
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
      const students = await studentRepository.findAllWithParentStatus();
      res.json({ students });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });

  // Admin & Staff: Register / Create New Student
  app.post("/api/students", async (req: Request, res: Response) => {
    try {
      const {
        name,
        studentId,
        department,
        email,
        phone,
        batch,
        rollNumber,
        sectionId,
        parentName,
        parentPhone,
        parentEmail,
        relationship,
        faceDescriptor
      } = req.body;

      if (!name || !studentId) {
        return res.status(400).json({ error: "Student Name and Student ID are required" });
      }

      const existing = await studentRepository.findByStudentId(studentId.trim());
      if (existing) {
        return res.status(409).json({ error: `Student with ID "${studentId}" already exists.` });
      }

      const hasFace = Array.isArray(faceDescriptor) && faceDescriptor.length === 128;

      const created = await studentRepository.create(
        {
          name: name.trim(),
          studentId: studentId.trim(),
          department: department ? department.trim() : "General",
          email: email ? email.trim() : null,
          phone: phone ? phone.trim() : null,
          password: req.body.password || "student123",
          faceRegistered: hasFace,
          faceDescriptor: hasFace ? faceDescriptor : null,
        } as any,
        {
          parentName: parentName ? parentName.trim() : "",
          phone: parentPhone ? parentPhone.trim() : "",
          email: parentEmail ? parentEmail.trim() : "",
          relationship: relationship || "father",
        }
      );

      if (hasFace) {
        try {
          await storage.updateStudentFace(created.id, faceDescriptor);
        } catch (e) {}
      }

      res.status(201).json({ success: true, message: "Student registered successfully", student: created });
    } catch (error: any) {
      console.error("Student registration error:", error);
      res.status(500).json({ error: error.message || "Failed to register student" });
    }
  });

  // --- Face Recognition Attendance Submission Route ---

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
      const parsedLiveness = livenessScore !== undefined ? Number(livenessScore) : 1.0;

      // Log the face recognition attempt
      await storage.logFaceRecognitionAttempt({
        studentId,
        sessionId: activeSession.id,
        confidence: parsedConfidence,
        livenessScore: parsedLiveness,
        isLive: parsedLiveness >= 0.5,
        isKnown: parsedConfidence > 40,
        result: parsedLiveness >= 0.5 ? "success" : "spoof",
        ipAddress: getClientIp(req),
      });

      if (parsedLiveness < 0.5) {
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

      // Asynchronously notify Student + Parent/Guardian (decoupled, non-blocking)
      attendanceNotificationService.notifyAttendance({
        studentId,
        studentName: name,
        department: department || undefined,
        sessionId: activeSession.id,
        sessionName: activeSession.name || `Session #${activeSession.id}`,
        status: "present",
        timestamp: record.timestamp,
      }).catch((err) => console.error("[attendance-notification] Face attendance notification error:", err));

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

  // Admin: Dispatch absence alerts to students and their parents
  app.post("/api/admin/absence-alerts/notify", async (req: Request, res: Response) => {
    try {
      const { studentIds, sessionName } = req.body;
      if (!Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({ error: "studentIds array is required" });
      }

      let notifiedCount = 0;
      for (const studentId of studentIds) {
        const student = await studentRepository.findByStudentId(studentId);
        if (student) {
          await attendanceNotificationService.notifyAttendance({
            studentId,
            studentName: student.name,
            department: student.department || undefined,
            sessionName: sessionName || "Scheduled Class / Session",
            status: "absent",
            timestamp: new Date(),
          });
          notifiedCount++;
        }
      }

      res.json({ message: `Absence notifications dispatched to ${notifiedCount} student(s) and parent(s).`, notifiedCount });
    } catch (error) {
      console.error("Dispatch absence alert error:", error);
      res.status(500).json({ error: "Failed to dispatch absence alerts" });
    }
  });

  return httpServer;
}

