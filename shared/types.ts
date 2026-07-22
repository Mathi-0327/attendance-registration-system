/**
 * @file shared/types.ts
 * @description Shared TypeScript types used across frontend and backend.
 * Central source of truth for all domain types, enums, and interfaces.
 */

// ─────────────────────────────────────────────
// ROLE & PERMISSION ENUMS
// ─────────────────────────────────────────────

export enum UserRole {
  SUPER_ADMIN = "super_admin",
  INSTITUTION_ADMIN = "institution_admin",
  CAMPUS_ADMIN = "campus_admin",
  DEPARTMENT_ADMIN = "department_admin",
  HOD = "hod",
  FACULTY = "faculty",
  LAB_STAFF = "lab_staff",
  STUDENT = "student",
  PARENT = "parent",
  GUEST = "guest",
}

export enum Permission {
  // User management
  MANAGE_USERS = "manage_users",
  VIEW_USERS = "view_users",
  DELETE_USERS = "delete_users",

  // Attendance
  MARK_ATTENDANCE = "mark_attendance",
  VIEW_ATTENDANCE = "view_attendance",
  EDIT_ATTENDANCE = "edit_attendance",
  DELETE_ATTENDANCE = "delete_attendance",
  APPROVE_CORRECTIONS = "approve_corrections",
  EXPORT_ATTENDANCE = "export_attendance",

  // Academic
  MANAGE_ACADEMIC = "manage_academic",
  VIEW_ACADEMIC = "view_academic",
  MANAGE_TIMETABLE = "manage_timetable",
  MANAGE_SUBJECTS = "manage_subjects",
  MANAGE_DEPARTMENTS = "manage_departments",
  MANAGE_COURSES = "manage_courses",

  // Sessions
  MANAGE_SESSIONS = "manage_sessions",
  VIEW_SESSIONS = "view_sessions",

  // Reports
  VIEW_REPORTS = "view_reports",
  GENERATE_REPORTS = "generate_reports",
  EXPORT_REPORTS = "export_reports",

  // Face recognition
  MANAGE_FACE = "manage_face",
  VIEW_FACE_LOGS = "view_face_logs",

  // Notifications
  SEND_NOTIFICATIONS = "send_notifications",
  MANAGE_NOTIFICATIONS = "manage_notifications",

  // Settings
  MANAGE_SETTINGS = "manage_settings",
  VIEW_SETTINGS = "view_settings",

  // Audit
  VIEW_AUDIT_LOGS = "view_audit_logs",

  // Leave
  APPLY_LEAVE = "apply_leave",
  APPROVE_LEAVE = "approve_leave",
  VIEW_LEAVE = "view_leave",

  // AI
  VIEW_AI_INSIGHTS = "view_ai_insights",
}

// ─────────────────────────────────────────────
// AUTH TYPES
// ─────────────────────────────────────────────

export interface JWTPayload {
  userId: number;
  username: string;
  email: string;
  name?: string;
  roles: UserRole[];
  permissions: Permission[];
  institutionId?: number;
  campusId?: number;
  departmentId?: number;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  userId: number;
  tokenId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  identifier: string; // email or username or student ID
  password: string;
  rememberMe?: boolean;
  deviceId?: string;
  captchaToken?: string;
}

export interface LoginResponse {
  tokens: AuthTokens;
  user: SafeUser;
  requiresTwoFactor?: boolean;
  twoFactorToken?: string;
}

export interface SafeUser {
  id: number;
  username: string;
  email: string;
  name: string;
  roles: UserRole[];
  permissions: Permission[];
  profilePhoto?: string;
  institutionId?: number;
  isEmailVerified: boolean;
  isTwoFactorEnabled: boolean;
  profileCompletion: number;
}

export interface OTPRequest {
  userId: number;
  type: OTPType;
}

export type OTPType = "email_verification" | "password_reset" | "two_factor" | "login";

// ─────────────────────────────────────────────
// ACADEMIC TYPES
// ─────────────────────────────────────────────

export interface Institution {
  id: number;
  name: string;
  code: string;
  logo?: string;
  domain?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  createdAt: Date;
}

export interface Campus {
  id: number;
  institutionId: number;
  name: string;
  code: string;
  location?: string;
  address?: string;
  phone?: string;
  isActive: boolean;
}

export interface Department {
  id: number;
  campusId: number;
  name: string;
  code: string;
  hodId?: number;
  isActive: boolean;
}

export interface Course {
  id: number;
  departmentId: number;
  name: string;
  code: string;
  credits: number;
  durationYears: number;
  isActive: boolean;
}

export interface Semester {
  id: number;
  courseId: number;
  number: number;
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
}

export interface Section {
  id: number;
  semesterId: number;
  name: string;
  maxStudents: number;
  isActive: boolean;
}

export interface Subject {
  id: number;
  semesterId: number;
  name: string;
  code: string;
  credits: number;
  facultyId?: number;
  isLab: boolean;
  isActive: boolean;
}

export interface TimetableSlot {
  id: number;
  sectionId: number;
  subjectId: number;
  day: DayOfWeek;
  startTime: string; // "HH:MM"
  endTime: string;
  room?: string;
}

export type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

// ─────────────────────────────────────────────
// ATTENDANCE TYPES
// ─────────────────────────────────────────────

export type AttendanceStatus = "present" | "absent" | "late" | "on_duty" | "medical_leave" | "internship" | "sports_leave";

export interface AttendanceSession {
  id: number;
  name?: string;
  subjectId?: number;
  sectionId?: number;
  facultyId?: number;
  timetableSlotId?: number;
  authorizedIp?: string;
  startTime: Date;
  endTime?: Date;
  isActive: boolean;
  attendanceMode: AttendanceMode;
  geoFenceLatitude?: number;
  geoFenceLongitude?: number;
  geoFenceRadius?: number;
}

export type AttendanceMode = "wifi" | "face" | "qr" | "manual" | "nfc" | "rfid" | "gps";

export interface AttendanceRecord {
  id: number;
  sessionId: number;
  studentId: string;
  name: string;
  department?: string;
  subjectId?: number;
  status: AttendanceStatus;
  markedAt: Date;
  markedBy?: string; // "self" | "faculty" | "face-recognition"
  ipAddress: string;
  device: string;
  confidence?: number; // face recognition confidence
  latitude?: number;
  longitude?: number;
}

export interface LeaveRequest {
  id: number;
  studentId: string;
  type: LeaveType;
  fromDate: Date;
  toDate: Date;
  reason: string;
  document?: string; // file path
  status: LeaveStatus;
  approvedBy?: number;
  approvedAt?: Date;
  remarks?: string;
}

export type LeaveType = "medical" | "on_duty" | "internship" | "industrial_visit" | "sports" | "other";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

// ─────────────────────────────────────────────
// PROFILE TYPES
// ─────────────────────────────────────────────

export interface StudentProfile {
  id: number;
  studentId: string;
  name: string;
  email?: string;
  phone?: string;
  department?: string;
  year?: string;
  batch?: string;
  sectionId?: number;
  photo?: string;
  signature?: string;
  bloodGroup?: string;
  address?: string;
  emergencyContact?: string;
  faceRegistered: boolean;
  profileCompletion: number;
  parentDetails?: ParentDetails;
  idCardNumber?: string;
  qrCode?: string;
}

export interface ParentDetails {
  fatherName?: string;
  motherName?: string;
  guardianName?: string;
  parentEmail?: string;
  parentMobile?: string;
  occupation?: string;
  relationship?: string;
  address?: string;
  emergencyContact?: string;
}

// ─────────────────────────────────────────────
// NOTIFICATION TYPES
// ─────────────────────────────────────────────

export type NotificationChannel = "email" | "sms" | "whatsapp" | "push" | "browser";
export type NotificationType =
  | "registration"
  | "email_verification"
  | "forgot_password"
  | "attendance_confirmation"
  | "absent_alert"
  | "late_entry"
  | "low_attendance"
  | "daily_report"
  | "weekly_report"
  | "monthly_report"
  | "holiday_notice"
  | "class_cancellation"
  | "exam_notice"
  | "faculty_notice"
  | "leave_approval"
  | "leave_rejection"
  | "graduation";

export interface NotificationPayload {
  userId?: number;
  email?: string;
  phone?: string;
  type: NotificationType;
  channel: NotificationChannel[];
  data: Record<string, any>;
}

// ─────────────────────────────────────────────
// FACE RECOGNITION TYPES
// ─────────────────────────────────────────────

export interface FaceEmbedding {
  id: number;
  studentId: string;
  descriptor: number[];
  qualityScore: number;
  isActive: boolean;
  createdAt: Date;
}

export interface FaceRecognitionResult {
  studentId: string;
  name: string;
  confidence: number;
  livenessScore: number;
  qualityScore: number;
  isLive: boolean;
  isKnown: boolean;
  multipleFacesDetected: boolean;
  antiSpoofPassed: boolean;
}

export interface FaceQualityMetrics {
  blurScore: number;
  brightnessScore: number;
  occlusionScore: number;
  poseScore: number;
  overallScore: number;
  isPassing: boolean;
}

export interface LivenessResult {
  isLive: boolean;
  blinkDetected: boolean;
  eyeMovementDetected: boolean;
  headMovementDetected: boolean;
  score: number;
}

// ─────────────────────────────────────────────
// AI / ANALYTICS TYPES
// ─────────────────────────────────────────────

export interface AttendancePrediction {
  studentId: string;
  subjectId?: number;
  currentRate: number;
  predictedRate: number;
  trendDirection: "improving" | "declining" | "stable";
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  recommendation: string;
}

export interface AttendanceInsight {
  type: "department" | "faculty" | "student" | "subject" | "institution";
  scopeId: string;
  insights: {
    averageAttendance: number;
    bestDay: DayOfWeek;
    worstDay: DayOfWeek;
    trend: "up" | "down" | "stable";
    anomalies: string[];
    recommendations: string[];
  };
  generatedAt: Date;
}

// ─────────────────────────────────────────────
// AUDIT TYPES
// ─────────────────────────────────────────────

export interface AuditLog {
  id: number;
  userId?: number;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  ipAddress: string;
  userAgent?: string;
  timestamp: Date;
}

export type AuditAction =
  | "login"
  | "logout"
  | "register"
  | "password_change"
  | "profile_update"
  | "attendance_mark"
  | "attendance_edit"
  | "attendance_delete"
  | "session_start"
  | "session_stop"
  | "leave_apply"
  | "leave_approve"
  | "leave_reject"
  | "admin_action"
  | "settings_change"
  | "user_delete"
  | "face_register"
  | "face_recognition"
  | "report_generate"
  | "data_export";

// ─────────────────────────────────────────────
// API RESPONSE TYPES
// ─────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ─────────────────────────────────────────────
// REPORT TYPES
// ─────────────────────────────────────────────

export type ReportType =
  | "daily"
  | "weekly"
  | "monthly"
  | "semester"
  | "yearly"
  | "department"
  | "faculty"
  | "student"
  | "subject"
  | "class"
  | "institution"
  | "naac"
  | "nba"
  | "aicte"
  | "custom";

export type ReportFormat = "pdf" | "excel" | "csv";

export interface ReportRequest {
  type: ReportType;
  format: ReportFormat;
  filters: {
    dateFrom?: Date;
    dateTo?: Date;
    departmentId?: number;
    courseId?: number;
    semesterId?: number;
    sectionId?: number;
    subjectId?: number;
    studentId?: string;
    facultyId?: number;
  };
}

// ─────────────────────────────────────────────
// SETTINGS TYPES
// ─────────────────────────────────────────────

export interface InstitutionSettings {
  name: string;
  logo?: string;
  timezone: string;
  dateFormat: string;
  attendanceThreshold: number;
  workingDays: DayOfWeek[];
  periodsPerDay: number;
  gracePeriodMinutes: number;
  allowSelfAttendance: boolean;
  requireFaceVerification: boolean;
  requireGpsValidation: boolean;
  autoCloseSessionAfterMinutes: number;
  emailSettings: EmailSettings;
  notificationSettings: NotificationSettings;
  faceSettings: FaceRecognitionSettings;
}

export interface EmailSettings {
  provider: "smtp" | "sendgrid" | "resend";
  fromEmail: string;
  fromName: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpSecure?: boolean;
  apiKey?: string;
}

export interface NotificationSettings {
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  pushEnabled: boolean;
  absentAlertEnabled: boolean;
  lowAttendanceThreshold: number;
  dailyReportEnabled: boolean;
  weeklyReportEnabled: boolean;
  monthlyReportEnabled: boolean;
  dailyReportTime: string;
  weeklyReportDay: DayOfWeek;
  monthlyReportDate: number;
}

export interface FaceRecognitionSettings {
  confidenceThreshold: number;
  livenessEnabled: boolean;
  antiSpoofEnabled: boolean;
  multiSampleCount: number;
  qualityThreshold: number;
  maskDetectionEnabled: boolean;
  maxFaceDistance: number;
}
