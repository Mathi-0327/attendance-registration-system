/**
 * @file database/schema/attendance.schema.ts
 * @description Extended attendance schema — subject-wise, leave management,
 * corrections, face embeddings, recognition logs, and student extended profiles.
 */

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─────────────────────────────────────────────
// EXTENDED STUDENT PROFILE
// Extends the existing students table with new fields
// The existing students table in schema.ts is preserved.
// ─────────────────────────────────────────────

export const studentProfiles = sqliteTable("student_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: text("student_id").notNull().unique(), // FK → students.studentId
  userId: integer("user_id"), // FK → auth_users (after migration)

  // Photo & signature
  photo: text("photo"), // base64 or file path
  signature: text("signature"),

  // Personal details
  bloodGroup: text("blood_group"),
  dateOfBirth: integer("date_of_birth", { mode: "timestamp" }),
  gender: text("gender"),
  religion: text("religion"),
  category: text("category"), // 'general' | 'obc' | 'sc' | 'st'
  nationality: text("nationality").default("Indian"),
  aadharNumber: text("aadhar_number"),

  // Address
  permanentAddress: text("permanent_address"),
  currentAddress: text("current_address"),
  city: text("city"),
  state: text("state"),
  pincode: text("pincode"),

  // Emergency contact
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  emergencyContactRelation: text("emergency_contact_relation"),

  // Academic
  batch: text("batch"), // e.g. "2022-2026"
  rollNumber: text("roll_number"),
  sectionId: integer("section_id"),
  semesterId: integer("semester_id"),
  admissionDate: integer("admission_date", { mode: "timestamp" }),
  admissionNumber: text("admission_number"),

  // ID Card
  idCardNumber: text("id_card_number").unique(),
  qrCode: text("qr_code"), // QR data string

  // Profile completion
  profileCompletion: integer("profile_completion").notNull().default(0),

  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// PARENT / GUARDIAN DETAILS
// ─────────────────────────────────────────────

export const parentDetails = sqliteTable("parent_details", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: text("student_id").notNull().unique(), // FK → students.studentId

  // Father
  fatherName: text("father_name"),
  fatherOccupation: text("father_occupation"),
  fatherPhone: text("father_phone"),
  fatherEmail: text("father_email"),
  fatherAadhar: text("father_aadhar"),

  // Mother
  motherName: text("mother_name"),
  motherOccupation: text("mother_occupation"),
  motherPhone: text("mother_phone"),
  motherEmail: text("mother_email"),

  // Guardian (if different from parents)
  guardianName: text("guardian_name"),
  guardianRelation: text("guardian_relation"),
  guardianPhone: text("guardian_phone"),
  guardianEmail: text("guardian_email"),
  guardianOccupation: text("guardian_occupation"),
  guardianAddress: text("guardian_address"),

  // Primary contact preference
  primaryContact: text("primary_contact").default("father"), // 'father' | 'mother' | 'guardian'

  // Annual income
  annualIncome: real("annual_income"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// FACE EMBEDDINGS (extended face storage)
// Replaces the single descriptor in students table
// ─────────────────────────────────────────────

export const faceEmbeddings = sqliteTable("face_embeddings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: text("student_id").notNull(), // FK → students.studentId
  descriptor: text("descriptor", { mode: "json" }).$type<number[]>().notNull(),
  qualityScore: real("quality_score").notNull().default(0),
  blurScore: real("blur_score"),
  brightnessScore: real("brightness_score"),
  poseScore: real("pose_score"),
  sampleIndex: integer("sample_index").notNull().default(0), // Which capture sample (0-4)
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  capturedAt: integer("captured_at", { mode: "timestamp" }).notNull(),
  capturedBy: text("captured_by"), // 'self' | 'admin' | 'faculty'
});

// ─────────────────────────────────────────────
// FACE RECOGNITION LOGS
// ─────────────────────────────────────────────

export const faceRecognitionLogs = sqliteTable("face_recognition_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: text("student_id"), // Null if unknown face
  sessionId: integer("session_id"), // Attendance session
  confidence: real("confidence").notNull(),
  livenessScore: real("liveness_score"),
  qualityScore: real("quality_score"),
  isLive: integer("is_live", { mode: "boolean" }),
  isKnown: integer("is_known", { mode: "boolean" }).notNull(),
  multipleFaces: integer("multiple_faces", { mode: "boolean" }).notNull().default(false),
  antiSpoofPassed: integer("anti_spoof_passed", { mode: "boolean" }),
  result: text("result").notNull(), // 'success' | 'unknown' | 'failed' | 'spoof' | 'multiple'
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
});

// ─────────────────────────────────────────────
// ATTENDANCE SESSIONS (extended)
// ─────────────────────────────────────────────

export const attendanceSessions = sqliteTable("attendance_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name"),

  // Academic context
  subjectId: integer("subject_id"),
  sectionId: integer("section_id"),
  facultyId: integer("faculty_id"),
  timetableSlotId: integer("timetable_slot_id"),
  periodNumber: integer("period_number"),

  // Network security
  authorizedIp: text("authorized_ip"),

  // Timing
  startTime: integer("start_time", { mode: "timestamp" }).notNull(),
  endTime: integer("end_time", { mode: "timestamp" }),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),

  // Attendance method
  attendanceMode: text("attendance_mode").notNull().default("wifi"), // AttendanceMode

  // Geo-fencing
  geoFenceLatitude: real("geo_fence_latitude"),
  geoFenceLongitude: real("geo_fence_longitude"),
  geoFenceRadius: real("geo_fence_radius"), // meters

  // Settings
  allowLateEntry: integer("allow_late_entry", { mode: "boolean" }).notNull().default(true),
  lateEntryAfterMinutes: integer("late_entry_after_minutes").default(15),
  autoClose: integer("auto_close", { mode: "boolean" }).default(false),
  autoCloseAfterMinutes: integer("auto_close_after_minutes"),

  // Counts (cached for performance)
  totalStudents: integer("total_students").default(0),
  presentCount: integer("present_count").default(0),
  absentCount: integer("absent_count").default(0),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  createdBy: integer("created_by"), // auth_users.id
});

// ─────────────────────────────────────────────
// ATTENDANCE RECORDS (extended)
// ─────────────────────────────────────────────

export const attendanceRecordsExtended = sqliteTable("attendance_records_extended", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull(), // → attendanceSessions or original sessions
  studentId: text("student_id").notNull(),
  name: text("name").notNull(),

  // Academic context
  subjectId: integer("subject_id"),
  department: text("department"),

  // Status
  status: text("status").notNull().default("present"), // AttendanceStatus
  markedAt: integer("marked_at", { mode: "timestamp" }).notNull(),
  markedBy: text("marked_by").default("self"), // 'self' | 'faculty' | 'face-recognition' | 'bulk'

  // Network info
  ipAddress: text("ip_address").notNull(),
  device: text("device").notNull(),

  // Face recognition
  confidence: real("confidence"), // If via face recognition
  livenessScore: real("liveness_score"),

  // GPS
  latitude: real("latitude"),
  longitude: real("longitude"),
  locationAccuracy: real("location_accuracy"),

  // Leave reference (if status is leave type)
  leaveRequestId: integer("leave_request_id"),

  // Correction
  isCorrected: integer("is_corrected", { mode: "boolean" }).notNull().default(false),
  originalStatus: text("original_status"),
  correctedBy: integer("corrected_by"),
  correctedAt: integer("corrected_at", { mode: "timestamp" }),
  correctionReason: text("correction_reason"),

  isLegacy: integer("is_legacy", { mode: "boolean" }).notNull().default(false), // From old system
});

// ─────────────────────────────────────────────
// LEAVE REQUESTS
// ─────────────────────────────────────────────

export const leaveRequests = sqliteTable("leave_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: text("student_id").notNull(),
  type: text("type").notNull(), // LeaveType
  fromDate: integer("from_date", { mode: "timestamp" }).notNull(),
  toDate: integer("to_date", { mode: "timestamp" }).notNull(),
  totalDays: integer("total_days").notNull().default(1),
  reason: text("reason").notNull(),
  document: text("document"), // file path or URL
  status: text("status").notNull().default("pending"), // LeaveStatus
  approvedBy: integer("approved_by"),
  approvedAt: integer("approved_at", { mode: "timestamp" }),
  remarks: text("remarks"),
  subjectIds: text("subject_ids", { mode: "json" }).$type<number[]>(), // Which subjects affected
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// ATTENDANCE CORRECTIONS
// ─────────────────────────────────────────────

export const attendanceCorrections = sqliteTable("attendance_corrections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  attendanceRecordId: integer("attendance_record_id"),
  studentId: text("student_id").notNull(),
  sessionId: integer("session_id").notNull(),
  requestedBy: integer("requested_by").notNull(), // student or faculty user_id
  requestedStatus: text("requested_status").notNull(), // desired new status
  currentStatus: text("current_status").notNull(),
  reason: text("reason").notNull(),
  supportingDocument: text("supporting_document"),
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  reviewedBy: integer("reviewed_by"),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
  reviewerRemarks: text("reviewer_remarks"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// ATTENDANCE SUMMARY (aggregated, cached)
// ─────────────────────────────────────────────

export const attendanceSummary = sqliteTable("attendance_summary", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: text("student_id").notNull(),
  subjectId: integer("subject_id"),
  semesterId: integer("semester_id"),
  month: integer("month"),
  year: integer("year"),
  totalClasses: integer("total_classes").notNull().default(0),
  presentCount: integer("present_count").notNull().default(0),
  absentCount: integer("absent_count").notNull().default(0),
  lateCount: integer("late_count").notNull().default(0),
  leaveCount: integer("leave_count").notNull().default(0),
  attendancePercentage: real("attendance_percentage").notNull().default(0),
  lastUpdated: integer("last_updated", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// AI PREDICTIONS
// ─────────────────────────────────────────────

export const attendancePredictions = sqliteTable("attendance_predictions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: text("student_id").notNull(),
  subjectId: integer("subject_id"),
  currentRate: real("current_rate").notNull(),
  predictedRate: real("predicted_rate").notNull(),
  trendDirection: text("trend_direction").notNull(), // 'improving' | 'declining' | 'stable'
  riskScore: real("risk_score").notNull().default(0), // 0-100
  riskLevel: text("risk_level").notNull(), // 'low' | 'medium' | 'high' | 'critical'
  recommendation: text("recommendation"),
  generatedAt: integer("generated_at", { mode: "timestamp" }).notNull(),
  validUntil: integer("valid_until", { mode: "timestamp" }),
});

// ─────────────────────────────────────────────
// GRACE ATTENDANCE
// ─────────────────────────────────────────────

export const graceAttendance = sqliteTable("grace_attendance", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: text("student_id").notNull(),
  subjectId: integer("subject_id"),
  semesterId: integer("semester_id"),
  grantedClasses: integer("granted_classes").notNull().default(0),
  grantedBy: integer("granted_by").notNull(),
  reason: text("reason").notNull(),
  grantedAt: integer("granted_at", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// ZOD SCHEMAS
// ─────────────────────────────────────────────

export const leaveRequestSchema = z.object({
  type: z.enum(["medical", "on_duty", "internship", "industrial_visit", "sports", "other"]),
  fromDate: z.string(),
  toDate: z.string(),
  reason: z.string().min(10, "Please provide a detailed reason"),
  subjectIds: z.array(z.number()).optional(),
});

export const correctionRequestSchema = z.object({
  sessionId: z.number(),
  requestedStatus: z.enum(["present", "absent", "late", "on_duty", "medical_leave"]),
  reason: z.string().min(10, "Please provide a detailed reason"),
});

// ─────────────────────────────────────────────
// TYPE EXPORTS
// ─────────────────────────────────────────────

export type StudentProfile = typeof studentProfiles.$inferSelect;
export type ParentDetail = typeof parentDetails.$inferSelect;
export type FaceEmbedding = typeof faceEmbeddings.$inferSelect;
export type FaceRecognitionLog = typeof faceRecognitionLogs.$inferSelect;
export type AttendanceSession = typeof attendanceSessions.$inferSelect;
export type AttendanceRecordExtended = typeof attendanceRecordsExtended.$inferSelect;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type AttendanceCorrection = typeof attendanceCorrections.$inferSelect;
export type AttendanceSummary = typeof attendanceSummary.$inferSelect;
export type AttendancePrediction = typeof attendancePredictions.$inferSelect;
export type GraceAttendance = typeof graceAttendance.$inferSelect;
