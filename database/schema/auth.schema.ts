/**
 * @file database/schema/auth.schema.ts
 * @description Authentication, RBAC, and session management schema.
 * Covers users, roles, permissions, refresh tokens, OTP, password reset, and audit logs.
 */

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─────────────────────────────────────────────
// USERS (extended unified user table)
// ─────────────────────────────────────────────

export const authUsers = sqliteTable("auth_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  profilePhoto: text("profile_photo"),

  // Institution context
  institutionId: integer("institution_id"),
  campusId: integer("campus_id"),
  departmentId: integer("department_id"),

  // Account state
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  isEmailVerified: integer("is_email_verified", { mode: "boolean" }).notNull().default(false),
  isTwoFactorEnabled: integer("is_two_factor_enabled", { mode: "boolean" }).notNull().default(false),
  twoFactorSecret: text("two_factor_secret"),
  isLocked: integer("is_locked", { mode: "boolean" }).notNull().default(false),
  lockReason: text("lock_reason"),
  lockedUntil: integer("locked_until", { mode: "timestamp" }),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lastFailedLoginAt: integer("last_failed_login_at", { mode: "timestamp" }),

  // Profile completion
  profileCompletion: integer("profile_completion").notNull().default(0),

  // Timestamps
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
  lastLoginIp: text("last_login_ip"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// ROLES
// ─────────────────────────────────────────────

export const roles = sqliteTable("roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// PERMISSIONS
// ─────────────────────────────────────────────

export const permissions = sqliteTable("permissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  resource: text("resource").notNull(),
  action: text("action").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// ROLE PERMISSIONS (many-to-many)
// ─────────────────────────────────────────────

export const rolePermissions = sqliteTable("role_permissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: integer("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
});

// ─────────────────────────────────────────────
// USER ROLES (many-to-many, scoped)
// ─────────────────────────────────────────────

export const userRoles = sqliteTable("user_roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  // Scope: what institution/campus/dept this role applies to
  scopeType: text("scope_type"), // 'institution' | 'campus' | 'department' | 'global'
  scopeId: integer("scope_id"),
  grantedBy: integer("granted_by"),
  grantedAt: integer("granted_at", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// REFRESH TOKENS
// ─────────────────────────────────────────────

export const refreshTokens = sqliteTable("refresh_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  deviceInfo: text("device_info"),
  ipAddress: text("ip_address"),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  isRevoked: integer("is_revoked", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
});

// ─────────────────────────────────────────────
// OTP CODES
// ─────────────────────────────────────────────

export const otpCodes = sqliteTable("otp_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => authUsers.id, { onDelete: "cascade" }),
  email: text("email"), // For pre-registration OTP
  codeHash: text("code_hash").notNull(),
  type: text("type").notNull(), // 'email_verification' | 'password_reset' | 'two_factor' | 'login'
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  isUsed: integer("is_used", { mode: "boolean" }).notNull().default(false),
  attempts: integer("attempts").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// PASSWORD RESET TOKENS
// ─────────────────────────────────────────────

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  isUsed: integer("is_used", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// AUDIT LOGS (persistent)
// ─────────────────────────────────────────────

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id"),
  userEmail: text("user_email"),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: text("resource_id"),
  oldValue: text("old_value", { mode: "json" }),
  newValue: text("new_value", { mode: "json" }),
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent"),
  severity: text("severity").notNull().default("info"), // 'info' | 'warning' | 'critical'
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// EMAIL QUEUE
// ─────────────────────────────────────────────

export const emailQueue = sqliteTable("email_queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  toEmail: text("to_email").notNull(),
  toName: text("to_name"),
  ccEmail: text("cc_email"),
  subject: text("subject").notNull(),
  htmlBody: text("html_body").notNull(),
  textBody: text("text_body"),
  type: text("type").notNull(), // NotificationType
  status: text("status").notNull().default("pending"), // 'pending' | 'sent' | 'failed'
  retryCount: integer("retry_count").notNull().default(0),
  maxRetries: integer("max_retries").notNull().default(3),
  scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
  sentAt: integer("sent_at", { mode: "timestamp" }),
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// NOTIFICATION SETTINGS (per user)
// ─────────────────────────────────────────────

export const notificationSettings = sqliteTable("notification_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  emailEnabled: integer("email_enabled", { mode: "boolean" }).notNull().default(true),
  smsEnabled: integer("sms_enabled", { mode: "boolean" }).notNull().default(false),
  pushEnabled: integer("push_enabled", { mode: "boolean" }).notNull().default(true),
  absentAlertEnabled: integer("absent_alert_enabled", { mode: "boolean" }).notNull().default(true),
  attendanceConfirmEnabled: integer("attendance_confirm_enabled", { mode: "boolean" }).notNull().default(true),
  lowAttendanceEnabled: integer("low_attendance_enabled", { mode: "boolean" }).notNull().default(true),
  reportEmailEnabled: integer("report_email_enabled", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// SYSTEM SETTINGS
// ─────────────────────────────────────────────

export const systemSettings = sqliteTable("system_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value", { mode: "json" }),
  description: text("description"),
  category: text("category").notNull().default("general"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  updatedBy: integer("updated_by"),
});

// ─────────────────────────────────────────────
// RELATIONS
// ─────────────────────────────────────────────

export const authUsersRelations = relations(authUsers, ({ many }) => ({
  userRoles: many(userRoles),
  refreshTokens: many(refreshTokens),
  auditLogs: many(auditLogs),
  notificationSettings: many(notificationSettings),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  userRoles: many(userRoles),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

// ─────────────────────────────────────────────
// ZOD SCHEMAS
// ─────────────────────────────────────────────

export const insertAuthUserSchema = createInsertSchema(authUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  profileCompletion: true,
  failedLoginAttempts: true,
});

export const loginSchema = z.object({
  identifier: z.string().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
  deviceId: z.string().optional(),
  captchaToken: z.string().optional(),
});

export const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[a-z]/, "Must contain lowercase")
    .regex(/[0-9]/, "Must contain number")
    .regex(/[^A-Za-z0-9]/, "Must contain special character"),
  name: z.string().min(2).max(100),
  phone: z.string().optional(),
  role: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Valid email required"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[a-z]/, "Must contain lowercase")
    .regex(/[0-9]/, "Must contain number"),
});

export const verifyOtpSchema = z.object({
  userId: z.number().optional(),
  email: z.string().email().optional(),
  code: z.string().length(6, "OTP must be 6 digits"),
  type: z.enum(["email_verification", "password_reset", "two_factor", "login"]),
});

// ─────────────────────────────────────────────
// TYPE EXPORTS
// ─────────────────────────────────────────────

export type AuthUser = typeof authUsers.$inferSelect;
export type InsertAuthUser = typeof authUsers.$inferInsert;
export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type UserRole = typeof userRoles.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type OtpCode = typeof otpCodes.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type EmailQueueItem = typeof emailQueue.$inferSelect;
export type SystemSetting = typeof systemSettings.$inferSelect;
