/**
 * @file backend/modules/rbac/rbac.seed.ts
 * @description Seeds the database with default roles and permissions.
 * Idempotent — safe to run multiple times.
 */

import { db } from "../../../database/db";
import { roles, permissions, rolePermissions } from "../../../database/schema/auth.schema";
import { eq } from "drizzle-orm";
import { UserRole, Permission } from "@shared/types";

// ─────────────────────────────────────────────
// PERMISSION DEFINITIONS
// ─────────────────────────────────────────────

const ALL_PERMISSIONS: Array<{
  name: Permission;
  resource: string;
  action: string;
  description: string;
}> = [
  // User management
  { name: Permission.MANAGE_USERS, resource: "users", action: "manage", description: "Full user management" },
  { name: Permission.VIEW_USERS, resource: "users", action: "view", description: "View user list" },
  { name: Permission.DELETE_USERS, resource: "users", action: "delete", description: "Delete users" },

  // Attendance
  { name: Permission.MARK_ATTENDANCE, resource: "attendance", action: "mark", description: "Mark attendance" },
  { name: Permission.VIEW_ATTENDANCE, resource: "attendance", action: "view", description: "View attendance records" },
  { name: Permission.EDIT_ATTENDANCE, resource: "attendance", action: "edit", description: "Edit attendance records" },
  { name: Permission.DELETE_ATTENDANCE, resource: "attendance", action: "delete", description: "Delete attendance records" },
  { name: Permission.APPROVE_CORRECTIONS, resource: "attendance", action: "approve_corrections", description: "Approve attendance corrections" },
  { name: Permission.EXPORT_ATTENDANCE, resource: "attendance", action: "export", description: "Export attendance data" },

  // Academic
  { name: Permission.MANAGE_ACADEMIC, resource: "academic", action: "manage", description: "Full academic management" },
  { name: Permission.VIEW_ACADEMIC, resource: "academic", action: "view", description: "View academic data" },
  { name: Permission.MANAGE_TIMETABLE, resource: "timetable", action: "manage", description: "Manage timetables" },
  { name: Permission.MANAGE_SUBJECTS, resource: "subjects", action: "manage", description: "Manage subjects" },
  { name: Permission.MANAGE_DEPARTMENTS, resource: "departments", action: "manage", description: "Manage departments" },
  { name: Permission.MANAGE_COURSES, resource: "courses", action: "manage", description: "Manage courses" },

  // Sessions
  { name: Permission.MANAGE_SESSIONS, resource: "sessions", action: "manage", description: "Start/stop attendance sessions" },
  { name: Permission.VIEW_SESSIONS, resource: "sessions", action: "view", description: "View attendance sessions" },

  // Reports
  { name: Permission.VIEW_REPORTS, resource: "reports", action: "view", description: "View reports" },
  { name: Permission.GENERATE_REPORTS, resource: "reports", action: "generate", description: "Generate reports" },
  { name: Permission.EXPORT_REPORTS, resource: "reports", action: "export", description: "Export reports" },

  // Face recognition
  { name: Permission.MANAGE_FACE, resource: "face", action: "manage", description: "Manage face recognition" },
  { name: Permission.VIEW_FACE_LOGS, resource: "face", action: "view_logs", description: "View face recognition logs" },

  // Notifications
  { name: Permission.SEND_NOTIFICATIONS, resource: "notifications", action: "send", description: "Send notifications" },
  { name: Permission.MANAGE_NOTIFICATIONS, resource: "notifications", action: "manage", description: "Manage notification settings" },

  // Settings
  { name: Permission.MANAGE_SETTINGS, resource: "settings", action: "manage", description: "Manage system settings" },
  { name: Permission.VIEW_SETTINGS, resource: "settings", action: "view", description: "View settings" },

  // Audit
  { name: Permission.VIEW_AUDIT_LOGS, resource: "audit", action: "view", description: "View audit logs" },

  // Leave
  { name: Permission.APPLY_LEAVE, resource: "leave", action: "apply", description: "Apply for leave" },
  { name: Permission.APPROVE_LEAVE, resource: "leave", action: "approve", description: "Approve leave requests" },
  { name: Permission.VIEW_LEAVE, resource: "leave", action: "view", description: "View leave records" },

  // AI
  { name: Permission.VIEW_AI_INSIGHTS, resource: "ai", action: "view", description: "View AI insights" },
];

// ─────────────────────────────────────────────
// ROLE PERMISSION MATRIX
// ─────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(Permission), // All permissions

  [UserRole.INSTITUTION_ADMIN]: [
    Permission.MANAGE_USERS,
    Permission.VIEW_USERS,
    Permission.MARK_ATTENDANCE,
    Permission.VIEW_ATTENDANCE,
    Permission.EDIT_ATTENDANCE,
    Permission.APPROVE_CORRECTIONS,
    Permission.EXPORT_ATTENDANCE,
    Permission.MANAGE_ACADEMIC,
    Permission.VIEW_ACADEMIC,
    Permission.MANAGE_TIMETABLE,
    Permission.MANAGE_SUBJECTS,
    Permission.MANAGE_DEPARTMENTS,
    Permission.MANAGE_COURSES,
    Permission.MANAGE_SESSIONS,
    Permission.VIEW_SESSIONS,
    Permission.VIEW_REPORTS,
    Permission.GENERATE_REPORTS,
    Permission.EXPORT_REPORTS,
    Permission.MANAGE_FACE,
    Permission.VIEW_FACE_LOGS,
    Permission.SEND_NOTIFICATIONS,
    Permission.MANAGE_NOTIFICATIONS,
    Permission.MANAGE_SETTINGS,
    Permission.VIEW_AUDIT_LOGS,
    Permission.APPROVE_LEAVE,
    Permission.VIEW_LEAVE,
    Permission.VIEW_AI_INSIGHTS,
  ],

  [UserRole.CAMPUS_ADMIN]: [
    Permission.MANAGE_USERS,
    Permission.VIEW_USERS,
    Permission.VIEW_ATTENDANCE,
    Permission.EDIT_ATTENDANCE,
    Permission.APPROVE_CORRECTIONS,
    Permission.EXPORT_ATTENDANCE,
    Permission.VIEW_ACADEMIC,
    Permission.MANAGE_DEPARTMENTS,
    Permission.MANAGE_SESSIONS,
    Permission.VIEW_SESSIONS,
    Permission.VIEW_REPORTS,
    Permission.GENERATE_REPORTS,
    Permission.EXPORT_REPORTS,
    Permission.VIEW_FACE_LOGS,
    Permission.SEND_NOTIFICATIONS,
    Permission.VIEW_SETTINGS,
    Permission.VIEW_AUDIT_LOGS,
    Permission.APPROVE_LEAVE,
    Permission.VIEW_LEAVE,
    Permission.VIEW_AI_INSIGHTS,
  ],

  [UserRole.DEPARTMENT_ADMIN]: [
    Permission.VIEW_USERS,
    Permission.VIEW_ATTENDANCE,
    Permission.APPROVE_CORRECTIONS,
    Permission.EXPORT_ATTENDANCE,
    Permission.VIEW_ACADEMIC,
    Permission.MANAGE_SUBJECTS,
    Permission.MANAGE_SESSIONS,
    Permission.VIEW_SESSIONS,
    Permission.VIEW_REPORTS,
    Permission.GENERATE_REPORTS,
    Permission.EXPORT_REPORTS,
    Permission.VIEW_FACE_LOGS,
    Permission.SEND_NOTIFICATIONS,
    Permission.APPROVE_LEAVE,
    Permission.VIEW_LEAVE,
    Permission.VIEW_AI_INSIGHTS,
  ],

  [UserRole.HOD]: [
    Permission.VIEW_USERS,
    Permission.VIEW_ATTENDANCE,
    Permission.APPROVE_CORRECTIONS,
    Permission.EXPORT_ATTENDANCE,
    Permission.VIEW_ACADEMIC,
    Permission.MANAGE_TIMETABLE,
    Permission.MANAGE_SUBJECTS,
    Permission.MANAGE_SESSIONS,
    Permission.VIEW_SESSIONS,
    Permission.VIEW_REPORTS,
    Permission.GENERATE_REPORTS,
    Permission.EXPORT_REPORTS,
    Permission.VIEW_FACE_LOGS,
    Permission.SEND_NOTIFICATIONS,
    Permission.APPROVE_LEAVE,
    Permission.VIEW_LEAVE,
    Permission.VIEW_AI_INSIGHTS,
  ],

  [UserRole.FACULTY]: [
    Permission.MARK_ATTENDANCE,
    Permission.VIEW_ATTENDANCE,
    Permission.EDIT_ATTENDANCE,
    Permission.APPROVE_CORRECTIONS,
    Permission.EXPORT_ATTENDANCE,
    Permission.VIEW_ACADEMIC,
    Permission.MANAGE_SESSIONS,
    Permission.VIEW_SESSIONS,
    Permission.VIEW_REPORTS,
    Permission.MANAGE_FACE,
    Permission.VIEW_FACE_LOGS,
    Permission.APPROVE_LEAVE,
    Permission.VIEW_LEAVE,
  ],

  [UserRole.LAB_STAFF]: [
    Permission.MARK_ATTENDANCE,
    Permission.VIEW_ATTENDANCE,
    Permission.VIEW_ACADEMIC,
    Permission.MANAGE_SESSIONS,
    Permission.VIEW_SESSIONS,
    Permission.MANAGE_FACE,
  ],

  [UserRole.STUDENT]: [
    Permission.MARK_ATTENDANCE,
    Permission.VIEW_ATTENDANCE,
    Permission.VIEW_ACADEMIC,
    Permission.APPLY_LEAVE,
    Permission.VIEW_LEAVE,
  ],

  [UserRole.PARENT]: [
    Permission.VIEW_ATTENDANCE,
    Permission.VIEW_LEAVE,
  ],

  [UserRole.GUEST]: [
    Permission.VIEW_ACADEMIC,
  ],
};

// ─────────────────────────────────────────────
// ROLE DEFINITIONS
// ─────────────────────────────────────────────

const ROLE_DEFINITIONS = [
  { name: UserRole.SUPER_ADMIN, displayName: "Super Admin", description: "Full system access across all institutions" },
  { name: UserRole.INSTITUTION_ADMIN, displayName: "Institution Admin", description: "Full access within an institution" },
  { name: UserRole.CAMPUS_ADMIN, displayName: "Campus Admin", description: "Manages a specific campus" },
  { name: UserRole.DEPARTMENT_ADMIN, displayName: "Department Admin", description: "Manages a specific department" },
  { name: UserRole.HOD, displayName: "Head of Department", description: "Head of department with academic management access" },
  { name: UserRole.FACULTY, displayName: "Faculty", description: "Teaching staff with attendance management" },
  { name: UserRole.LAB_STAFF, displayName: "Lab Staff", description: "Laboratory staff with limited access" },
  { name: UserRole.STUDENT, displayName: "Student", description: "Student with self-service access" },
  { name: UserRole.PARENT, displayName: "Parent / Guardian", description: "Parent or guardian with read-only access" },
  { name: UserRole.GUEST, displayName: "Guest", description: "Limited read-only access" },
];

// ─────────────────────────────────────────────
// SEEDER
// ─────────────────────────────────────────────

export async function seedRBAC(): Promise<void> {
  console.log("[rbac] Starting RBAC seed...");
  const now = new Date();

  // 1. Seed permissions
  const permissionIdMap = new Map<Permission, number>();

  for (const perm of ALL_PERMISSIONS) {
    const existing = await db.select().from(permissions).where(eq(permissions.name, perm.name));
    if (existing.length === 0) {
      const [inserted] = await db.insert(permissions).values({
        name: perm.name,
        resource: perm.resource,
        action: perm.action,
        description: perm.description,
        createdAt: now,
      }).returning();
      permissionIdMap.set(perm.name, inserted.id);
    } else {
      permissionIdMap.set(perm.name, existing[0].id);
    }
  }

  console.log(`[rbac] Seeded ${permissionIdMap.size} permissions`);

  // 2. Seed roles and assign permissions
  for (const roleDef of ROLE_DEFINITIONS) {
    let roleId: number;

    const existing = await db.select().from(roles).where(eq(roles.name, roleDef.name));
    if (existing.length === 0) {
      const [inserted] = await db.insert(roles).values({
        name: roleDef.name,
        displayName: roleDef.displayName,
        description: roleDef.description,
        isSystem: true,
        createdAt: now,
      }).returning();
      roleId = inserted.id;
    } else {
      roleId = existing[0].id;
    }

    // 3. Assign permissions to role
    const rolePerms = ROLE_PERMISSIONS[roleDef.name] || [];
    for (const permName of rolePerms) {
      const permId = permissionIdMap.get(permName);
      if (!permId) continue;

      const existingRolePerm = await db
        .select()
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, roleId));

      const alreadyAssigned = existingRolePerm.some((rp: any) => rp.permissionId === permId);
      if (!alreadyAssigned) {
        await db.insert(rolePermissions).values({ roleId, permissionId: permId });
      }
    }
  }

  console.log(`[rbac] Seeded ${ROLE_DEFINITIONS.length} roles with permissions`);

  // 4. Ensure initial Super Admin user exists if database has 0 users
  const { authUsers, userRoles } = await import("../../../database/schema/auth.schema");
  const existingUsers = await db.select().from(authUsers);
  if (existingUsers.length === 0) {
    const bcrypt = (await import("bcrypt")).default;
    const passwordHash = await bcrypt.hash("Admin@2026!", 12);
    const [adminUser] = await db.insert(authUsers).values({
      username: "admin",
      email: "admin@attendreg.edu",
      passwordHash,
      name: "System Administrator",
      isActive: true,
      isEmailVerified: true,
      createdAt: now,
      updatedAt: now,
    }).returning();

    const [superAdminRole] = await db.select().from(roles).where(eq(roles.name, UserRole.SUPER_ADMIN));
    if (superAdminRole) {
      await db.insert(userRoles).values({
        userId: adminUser.id,
        roleId: superAdminRole.id,
        scopeType: "global",
        grantedAt: now,
      });
    }
    console.log("[rbac] Initial Super Admin auto-created: admin (admin@attendreg.edu)");
  }

  console.log("[rbac] RBAC seed complete ✓");
}
