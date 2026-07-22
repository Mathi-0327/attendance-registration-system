/**
 * @file backend/auth/auth.middleware.ts
 * @description JWT-based authentication and role-based authorization middleware.
 * Replaces the legacy x-admin-session header approach with proper JWT Bearer tokens.
 * Backward compatible: legacy admin sessions still supported during transition.
 */

import type { Request, Response, NextFunction } from "express";
import {
  verifyAccessToken,
  extractBearerToken,
  TokenExpiredError,
  InvalidTokenError,
} from "./jwt.service";
import { getClientIp, logSecurityEvent } from "../security";
import type { JWTPayload } from "@shared/types";
import { UserRole, Permission } from "@shared/types";

// ─────────────────────────────────────────────
// TYPE AUGMENTATION — Extend Express Request
// ─────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      /** Authenticated user payload from JWT */
      user?: JWTPayload;
      /** Whether this request is from a legacy admin session */
      isLegacyAdmin?: boolean;
    }
  }
}

// ─────────────────────────────────────────────
// CORE AUTH MIDDLEWARE
// ─────────────────────────────────────────────

/**
 * requireAuth — verifies JWT Bearer token.
 * Attaches decoded payload to req.user.
 * Also accepts legacy x-admin-session header for backward compatibility.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);

  // ── Try JWT first ──
  const authHeader = req.headers.authorization;
  const token = extractBearerToken(authHeader);

  if (token) {
    try {
      req.user = verifyAccessToken(token);
      return next();
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        res.status(401).json({
          error: "Token expired",
          code: "TOKEN_EXPIRED",
          message: "Your session has expired. Please log in again.",
        });
        return;
      }
      if (error instanceof InvalidTokenError) {
        logSecurityEvent({
          type: "auth_failure",
          ip,
          path: req.path,
          method: req.method,
          details: { reason: "Invalid JWT token" },
        });
        res.status(401).json({
          error: "Invalid token",
          code: "INVALID_TOKEN",
          message: "Authentication failed. Please log in again.",
        });
        return;
      }
    }
  }

  // ── Backward Compatibility: Legacy x-admin-session ──
  const legacySessionId = req.headers["x-admin-session"] as string | undefined;
  if (legacySessionId) {
    // Import lazily to avoid circular dependency
    const { verifyAdminSession } = require("../security");
    if (verifyAdminSession(legacySessionId, ip)) {
      req.isLegacyAdmin = true;
      // Synthesize a minimal user payload for legacy sessions
      req.user = {
        userId: 0,
        username: "admin",
        email: "admin@system",
        name: "Admin",
        roles: [UserRole.INSTITUTION_ADMIN],
        permissions: Object.values(Permission),
      } as JWTPayload;
      return next();
    }
  }

  // ── No valid auth found ──
  logSecurityEvent({
    type: "auth_failure",
    ip,
    path: req.path,
    method: req.method,
    details: { reason: "No authentication provided" },
  });

  res.status(401).json({
    error: "Unauthorized",
    code: "NO_AUTH",
    message: "Authentication required. Please provide a valid Bearer token.",
  });
}

/**
 * optionalAuth — tries to authenticate but does NOT fail if no token provided.
 * Useful for endpoints that behave differently for authenticated vs anonymous users.
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req.headers.authorization);
  if (token) {
    try {
      req.user = verifyAccessToken(token);
    } catch {
      // Silently ignore — optional auth
    }
  }
  next();
}

// ─────────────────────────────────────────────
// ROLE-BASED AUTHORIZATION
// ─────────────────────────────────────────────

/**
 * requireRole — checks that the authenticated user has at least one of the specified roles.
 * Must be used AFTER requireAuth.
 *
 * @example
 * router.get('/hod-only', requireAuth, requireRole([UserRole.HOD, UserRole.INSTITUTION_ADMIN]), handler)
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized", code: "NO_AUTH" });
      return;
    }

    const userRoles = req.user.roles || [];
    const hasRole = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      logSecurityEvent({
        type: "auth_failure",
        ip: getClientIp(req),
        path: req.path,
        method: req.method,
        details: {
          reason: "Insufficient role",
          requiredRoles: allowedRoles,
          userRoles,
        },
      });

      res.status(403).json({
        error: "Forbidden",
        code: "INSUFFICIENT_ROLE",
        message: `Access denied. Required roles: ${allowedRoles.join(", ")}`,
      });
      return;
    }

    next();
  };
}

/**
 * requirePermission — checks that the authenticated user has the specific permission.
 * Must be used AFTER requireAuth.
 *
 * @example
 * router.delete('/students/:id', requireAuth, requirePermission(Permission.DELETE_USERS), handler)
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized", code: "NO_AUTH" });
      return;
    }

    const userPermissions = req.user.permissions || [];
    if (!userPermissions.includes(permission)) {
      logSecurityEvent({
        type: "auth_failure",
        ip: getClientIp(req),
        path: req.path,
        method: req.method,
        details: {
          reason: "Insufficient permission",
          requiredPermission: permission,
          userId: req.user.userId,
        },
      });

      res.status(403).json({
        error: "Forbidden",
        code: "INSUFFICIENT_PERMISSION",
        message: `You do not have permission to perform this action.`,
      });
      return;
    }

    next();
  };
}

/**
 * requireAnyPermission — user must have at least one of the given permissions.
 */
export function requireAnyPermission(permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized", code: "NO_AUTH" });
      return;
    }

    const userPermissions = req.user.permissions || [];
    const hasAny = permissions.some((p) => userPermissions.includes(p));

    if (!hasAny) {
      res.status(403).json({
        error: "Forbidden",
        code: "INSUFFICIENT_PERMISSION",
        message: "You do not have sufficient permissions.",
      });
      return;
    }

    next();
  };
}

/**
 * requireSuperAdmin — shorthand for super admin only routes.
 */
export const requireSuperAdmin = [
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN]),
];

/**
 * requireAdminLevel — shorthand for admin-level routes (super admin, institution admin, campus admin).
 */
export const requireAdminLevel = [
  requireAuth,
  requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.INSTITUTION_ADMIN,
    UserRole.CAMPUS_ADMIN,
    UserRole.DEPARTMENT_ADMIN,
  ]),
];

/**
 * requireFacultyOrAbove — shorthand for faculty+ routes.
 */
export const requireFacultyOrAbove = [
  requireAuth,
  requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.INSTITUTION_ADMIN,
    UserRole.CAMPUS_ADMIN,
    UserRole.DEPARTMENT_ADMIN,
    UserRole.HOD,
    UserRole.FACULTY,
    UserRole.LAB_STAFF,
  ]),
];

// ─────────────────────────────────────────────
// OWNERSHIP CHECK
// ─────────────────────────────────────────────

/**
 * Check if the authenticated user owns a resource (or is an admin).
 * Useful for profile update endpoints.
 */
export function isOwnerOrAdmin(
  req: Request,
  resourceUserId: number
): boolean {
  if (!req.user) return false;
  if (req.user.userId === resourceUserId) return true;
  const adminRoles = [
    UserRole.SUPER_ADMIN,
    UserRole.INSTITUTION_ADMIN,
    UserRole.CAMPUS_ADMIN,
  ];
  return req.user.roles?.some((r) => adminRoles.includes(r)) ?? false;
}

// ─────────────────────────────────────────────
// STUDENT SELF-ACCESS MIDDLEWARE
// ─────────────────────────────────────────────

/**
 * requireStudentSelf — ensures a student can only access their OWN records.
 * Admins and faculty can access any student's records.
 * Param: studentId must be in req.params.studentId
 */
export function requireStudentSelf(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const paramStudentId = req.params.studentId;

  // Admins and faculty can access any student
  const elevatedRoles = [
    UserRole.SUPER_ADMIN,
    UserRole.INSTITUTION_ADMIN,
    UserRole.CAMPUS_ADMIN,
    UserRole.DEPARTMENT_ADMIN,
    UserRole.HOD,
    UserRole.FACULTY,
    UserRole.LAB_STAFF,
  ];

  if (req.user.roles?.some((r) => elevatedRoles.includes(r))) {
    return next();
  }

  // Students can only access their own data
  if (req.user.roles?.includes(UserRole.STUDENT)) {
    // The student's identifier is stored in their JWT
    // We check username match (studentId is stored as username for students)
    if (req.user.username !== paramStudentId && req.user.userId.toString() !== paramStudentId) {
      res.status(403).json({
        error: "Forbidden",
        message: "You can only access your own records.",
      });
      return;
    }
    return next();
  }

  // Parents can only access their child's data
  if (req.user.roles?.includes(UserRole.PARENT)) {
    // TODO: Check parent-child linkage in Phase 5
    return next();
  }

  res.status(403).json({ error: "Forbidden" });
}
