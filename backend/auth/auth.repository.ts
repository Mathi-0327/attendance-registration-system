/**
 * @file backend/auth/auth.repository.ts
 * @description Repository for auth_users, roles, permissions, tokens, and OTPs.
 * Implements the Repository Pattern for clean data access.
 */

import { db } from "../../database/db";
import { eq, and, gt, desc, or, like } from "drizzle-orm";
import {
  authUsers,
  roles,
  permissions,
  rolePermissions,
  userRoles,
  refreshTokens,
  otpCodes,
  passwordResetTokens,
  auditLogs,
  emailQueue,
  systemSettings,
  type AuthUser,
  type InsertAuthUser,
  type Role,
  type Permission as PermissionRecord,
} from "../../database/schema/auth.schema";

// ─────────────────────────────────────────────
// USER REPOSITORY
// ─────────────────────────────────────────────

export class UserRepository {
  /**
   * Find a user by their primary key.
   */
  async findById(id: number): Promise<AuthUser | undefined> {
    const [user] = await db.select().from(authUsers).where(eq(authUsers.id, id));
    return user;
  }

  /**
   * Find a user by email address.
   */
  async findByEmail(email: string): Promise<AuthUser | undefined> {
    const [user] = await db
      .select()
      .from(authUsers)
      .where(eq(authUsers.email, email.toLowerCase().trim()));
    return user;
  }

  /**
   * Find a user by username.
   */
  async findByUsername(username: string): Promise<AuthUser | undefined> {
    const [user] = await db
      .select()
      .from(authUsers)
      .where(eq(authUsers.username, username.toLowerCase().trim()));
    return user;
  }

  /**
   * Find a user by email OR username (for flexible login).
   */
  async findByIdentifier(identifier: string): Promise<AuthUser | undefined> {
    const normalized = identifier.toLowerCase().trim();
    const [user] = await db
      .select()
      .from(authUsers)
      .where(
        or(
          eq(authUsers.email, normalized),
          eq(authUsers.username, normalized)
        )
      );
    return user;
  }

  /**
   * Create a new auth user.
   */
  async create(data: InsertAuthUser): Promise<AuthUser> {
    const now = new Date();
    const [user] = await db
      .insert(authUsers)
      .values({
        ...data,
        email: data.email.toLowerCase().trim(),
        username: data.username.toLowerCase().trim(),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return user;
  }

  /**
   * Update a user record.
   */
  async update(
    id: number,
    data: Partial<Omit<AuthUser, "id" | "createdAt">>
  ): Promise<AuthUser> {
    const [user] = await db
      .update(authUsers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(authUsers.id, id))
      .returning();
    return user;
  }

  /**
   * Mark email as verified.
   */
  async verifyEmail(id: number): Promise<void> {
    await db
      .update(authUsers)
      .set({ isEmailVerified: true, updatedAt: new Date() })
      .where(eq(authUsers.id, id));
  }

  /**
   * Update password hash.
   */
  async updatePassword(id: number, passwordHash: string): Promise<void> {
    await db
      .update(authUsers)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(authUsers.id, id));
  }

  /**
   * Record a successful login.
   */
  async recordLogin(id: number, ip: string): Promise<void> {
    await db
      .update(authUsers)
      .set({
        lastLoginAt: new Date(),
        lastLoginIp: ip,
        failedLoginAttempts: 0,
        updatedAt: new Date(),
      })
      .where(eq(authUsers.id, id));
  }

  /**
   * Increment failed login attempts and optionally lock account.
   */
  async recordFailedLogin(id: number): Promise<void> {
    const user = await this.findById(id);
    if (!user) return;

    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    const shouldLock = attempts >= 5;

    await db
      .update(authUsers)
      .set({
        failedLoginAttempts: attempts,
        lastFailedLoginAt: new Date(),
        isLocked: shouldLock,
        lockReason: shouldLock ? "Too many failed login attempts" : undefined,
        lockedUntil: shouldLock
          ? new Date(Date.now() + 30 * 60 * 1000) // 30 minute lockout
          : undefined,
        updatedAt: new Date(),
      })
      .where(eq(authUsers.id, id));
  }

  /**
   * Unlock a user account.
   */
  async unlockAccount(id: number): Promise<void> {
    await db
      .update(authUsers)
      .set({
        isLocked: false,
        lockReason: null,
        lockedUntil: null,
        failedLoginAttempts: 0,
        updatedAt: new Date(),
      })
      .where(eq(authUsers.id, id));
  }

  /**
   * Enable 2FA for a user.
   */
  async enableTwoFactor(id: number, secret: string): Promise<void> {
    await db
      .update(authUsers)
      .set({
        isTwoFactorEnabled: true,
        twoFactorSecret: secret,
        updatedAt: new Date(),
      })
      .where(eq(authUsers.id, id));
  }

  /**
   * Get all users with pagination.
   */
  async findAll(limit = 50, offset = 0): Promise<AuthUser[]> {
    return db
      .select()
      .from(authUsers)
      .orderBy(desc(authUsers.createdAt))
      .limit(limit)
      .offset(offset);
  }
}

// ─────────────────────────────────────────────
// ROLE REPOSITORY
// ─────────────────────────────────────────────

export class RoleRepository {
  /**
   * Find role by name.
   */
  async findByName(name: string): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.name, name));
    return role;
  }

  /**
   * Get all permissions for a role.
   */
  async getRolePermissions(roleId: number): Promise<PermissionRecord[]> {
    const result = await db
      .select({ permission: permissions })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));
    return result.map((r: any) => r.permission);
  }

  /**
   * Get all roles for a user.
   */
  async getUserRoles(userId: number): Promise<Role[]> {
    const result = await db
      .select({ role: roles })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));
    return result.map((r: any) => r.role);
  }

  /**
   * Get all permissions for a user (via their roles).
   */
  async getUserPermissions(userId: number): Promise<PermissionRecord[]> {
    const userRolesList = await this.getUserRoles(userId);
    const allPermissions: PermissionRecord[] = [];

    for (const role of userRolesList) {
      const rolePerms = await this.getRolePermissions(role.id);
      allPermissions.push(...rolePerms);
    }

    // Deduplicate
    const unique = new Map<number, PermissionRecord>();
    for (const p of allPermissions) {
      unique.set(p.id, p);
    }
    return Array.from(unique.values());
  }

  /**
   * Assign a role to a user.
   */
  async assignRole(
    userId: number,
    roleId: number,
    grantedBy?: number,
    scopeType?: string,
    scopeId?: number
  ): Promise<void> {
    await db.insert(userRoles).values({
      userId,
      roleId,
      scopeType,
      scopeId,
      grantedBy,
      grantedAt: new Date(),
    });
  }

  /**
   * Get all roles (for admin management).
   */
  async findAll(): Promise<Role[]> {
    return db.select().from(roles).orderBy(roles.name);
  }
}

// ─────────────────────────────────────────────
// TOKEN REPOSITORY
// ─────────────────────────────────────────────

export class TokenRepository {
  /**
   * Store a refresh token hash.
   */
  async storeRefreshToken(
    userId: number,
    tokenHash: string,
    expiresAt: Date,
    deviceInfo?: string,
    ipAddress?: string
  ): Promise<void> {
    await db.insert(refreshTokens).values({
      userId,
      tokenHash,
      expiresAt,
      deviceInfo,
      ipAddress,
      createdAt: new Date(),
    });
  }

  /**
   * Find a refresh token by hash.
   */
  async findRefreshToken(tokenHash: string) {
    const [token] = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          eq(refreshTokens.isRevoked, false),
          gt(refreshTokens.expiresAt, new Date())
        )
      );
    return token;
  }

  /**
   * Revoke a specific refresh token.
   */
  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.tokenHash, tokenHash));
  }

  /**
   * Revoke ALL refresh tokens for a user (logout all devices).
   */
  async revokeAllUserTokens(userId: number): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.userId, userId));
  }

  /**
   * Clean up expired tokens.
   */
  async cleanupExpired(): Promise<void> {
    const { lt } = await import("drizzle-orm");
    await db
      .delete(refreshTokens)
      .where(lt(refreshTokens.expiresAt, new Date()));
  }
}

// ─────────────────────────────────────────────
// OTP REPOSITORY
// ─────────────────────────────────────────────

export class OTPRepository {
  /**
   * Store an OTP code hash.
   */
  async storeOTP(
    codeHash: string,
    type: string,
    expiresAt: Date,
    userId?: number,
    email?: string
  ): Promise<void> {
    // Invalidate existing OTPs of same type for this user/email
    if (userId) {
      await db
        .update(otpCodes)
        .set({ isUsed: true })
        .where(and(eq(otpCodes.userId, userId), eq(otpCodes.type, type)));
    }

    await db.insert(otpCodes).values({
      userId,
      email,
      codeHash,
      type,
      expiresAt,
      createdAt: new Date(),
    });
  }

  /**
   * Find a valid OTP by hash and type.
   */
  async findValidOTP(
    codeHash: string,
    type: string,
    userId?: number,
    email?: string
  ) {
    const conditions = [
      eq(otpCodes.codeHash, codeHash),
      eq(otpCodes.type, type),
      eq(otpCodes.isUsed, false),
      gt(otpCodes.expiresAt, new Date()),
    ];

    if (userId) conditions.push(eq(otpCodes.userId, userId) as any);
    if (email) conditions.push(eq(otpCodes.email, email) as any);

    const [otp] = await db
      .select()
      .from(otpCodes)
      .where(and(...(conditions as any[])));
    return otp;
  }

  /**
   * Mark an OTP as used.
   */
  async markUsed(id: number): Promise<void> {
    await db
      .update(otpCodes)
      .set({ isUsed: true })
      .where(eq(otpCodes.id, id));
  }
}

// ─────────────────────────────────────────────
// AUDIT LOG REPOSITORY
// ─────────────────────────────────────────────

export class AuditLogRepository {
  /**
   * Create an audit log entry.
   */
  async log(data: {
    userId?: number;
    userEmail?: string;
    action: string;
    resource: string;
    resourceId?: string;
    oldValue?: Record<string, any>;
    newValue?: Record<string, any>;
    ipAddress: string;
    userAgent?: string;
    severity?: "info" | "warning" | "critical";
  }): Promise<void> {
    await db.insert(auditLogs).values({
      ...data,
      severity: data.severity ?? "info",
      timestamp: new Date(),
    });
  }

  /**
   * Get recent audit logs with pagination.
   */
  async findRecent(limit = 100, offset = 0) {
    return db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Get audit logs for a specific user.
   */
  async findByUser(userId: number, limit = 50) {
    return db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);
  }
}

// ─────────────────────────────────────────────
// SINGLETON EXPORTS
// ─────────────────────────────────────────────

export const userRepository = new UserRepository();
export const roleRepository = new RoleRepository();
export const tokenRepository = new TokenRepository();
export const otpRepository = new OTPRepository();
export const auditLogRepository = new AuditLogRepository();
