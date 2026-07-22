/**
 * @file backend/auth/auth.service.ts
 * @description Authentication business logic service.
 * Handles login, registration, token refresh, password reset, OTP, and 2FA.
 */

import {
  userRepository,
  roleRepository,
  tokenRepository,
  otpRepository,
  auditLogRepository,
} from "./auth.repository";
import {
  hashPassword,
  verifyPassword,
  generateOTP,
  hashOTP,
  getOTPExpiry,
  generateSecureToken,
  hashSecureToken,
  verifyTOTP,
  validatePasswordStrength,
} from "./password.service";
import {
  generateAuthTokens,
  verifyRefreshToken,
  hashToken,
  TokenExpiredError,
  InvalidTokenError,
} from "./jwt.service";
import type {
  LoginRequest,
  LoginResponse,
  SafeUser,
  JWTPayload,
  AuthTokens,
} from "@shared/types";
import { UserRole, Permission } from "@shared/types";
import { emailQueueService } from "../services/email/email.queue";
import { db } from "../../database/db";
import {
  passwordResetTokens,
  otpCodes,
} from "../../database/schema/auth.schema";
import { eq, and, gt } from "drizzle-orm";

// ─────────────────────────────────────────────
// CUSTOM ERRORS
// ─────────────────────────────────────────────

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = "AuthError";
  }
}

// ─────────────────────────────────────────────
// AUTH SERVICE
// ─────────────────────────────────────────────

export class AuthService {
  /**
   * Authenticate a user with identifier (email/username) and password.
   * Handles account lockout, 2FA, and token generation.
   */
  async login(
    request: LoginRequest,
    ipAddress: string,
    userAgent?: string
  ): Promise<LoginResponse> {
    const { identifier, password, rememberMe = false } = request;

    // 1. Find user
    const user = await userRepository.findByIdentifier(identifier);
    if (!user) {
      throw new AuthError("Invalid credentials", "INVALID_CREDENTIALS", 401);
    }

    // 2. Check if account is locked
    if (user.isLocked) {
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const minutesLeft = Math.ceil(
          (user.lockedUntil.getTime() - Date.now()) / 60000
        );
        throw new AuthError(
          `Account locked. Try again in ${minutesLeft} minutes.`,
          "ACCOUNT_LOCKED",
          423
        );
      } else {
        // Auto-unlock if lock time has expired
        await userRepository.unlockAccount(user.id);
      }
    }

    // 3. Check if account is active
    if (!user.isActive) {
      throw new AuthError(
        "Account is deactivated. Contact support.",
        "ACCOUNT_DISABLED",
        403
      );
    }

    // 4. Verify password
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      await userRepository.recordFailedLogin(user.id);
      await auditLogRepository.log({
        userId: user.id,
        userEmail: user.email,
        action: "login",
        resource: "auth",
        ipAddress,
        userAgent,
        severity: "warning",
        newValue: { success: false, reason: "wrong_password" },
      });
      throw new AuthError("Invalid credentials", "INVALID_CREDENTIALS", 401);
    }

    // 5. Check 2FA if enabled
    if (user.isTwoFactorEnabled) {
      // Return a short-lived 2FA required token
      const twoFactorToken = generateSecureToken(16);
      await otpRepository.storeOTP(
        hashOTP(twoFactorToken),
        "two_factor",
        getOTPExpiry(5),
        user.id
      );
      return {
        tokens: { accessToken: "", refreshToken: "", expiresIn: 0 },
        user: this.toSafeUser(user, [], []),
        requiresTwoFactor: true,
        twoFactorToken,
      };
    }

    // 6. Get roles and permissions
    const userRoles = await roleRepository.getUserRoles(user.id);
    const userPermissions = await roleRepository.getUserPermissions(user.id);

    const roleNames = userRoles.map((r) => r.name as UserRole);
    const permissionNames = userPermissions.map((p) => p.name as Permission);

    // 7. Generate tokens
    const payload: JWTPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      roles: roleNames,
      permissions: permissionNames,
      institutionId: user.institutionId ?? undefined,
      campusId: user.campusId ?? undefined,
      departmentId: user.departmentId ?? undefined,
    };

    const tokens = generateAuthTokens(payload, rememberMe);

    // 8. Store refresh token
    const refreshTokenExpiry = new Date(
      Date.now() + (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000
    );
    await tokenRepository.storeRefreshToken(
      user.id,
      hashToken(tokens.refreshToken),
      refreshTokenExpiry,
      userAgent,
      ipAddress
    );

    // 9. Record successful login
    await userRepository.recordLogin(user.id, ipAddress);
    await auditLogRepository.log({
      userId: user.id,
      userEmail: user.email,
      action: "login",
      resource: "auth",
      ipAddress,
      userAgent,
      severity: "info",
      newValue: { success: true, rememberMe },
    });

    return {
      tokens,
      user: this.toSafeUser(user, roleNames, permissionNames),
    };
  }

  /**
   * Refresh an access token using a valid refresh token.
   */
  async refreshToken(
    refreshToken: string,
    ipAddress: string
  ): Promise<AuthTokens> {
    // 1. Verify JWT signature
    let payload: { userId: number; tokenId: string };
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new AuthError("Refresh token expired", "REFRESH_EXPIRED", 401);
      }
      throw new AuthError("Invalid refresh token", "INVALID_TOKEN", 401);
    }

    // 2. Check token in DB (rotation & revocation)
    const tokenHash = hashToken(refreshToken);
    const storedToken = await tokenRepository.findRefreshToken(tokenHash);
    if (!storedToken) {
      throw new AuthError(
        "Refresh token not found or revoked",
        "TOKEN_REVOKED",
        401
      );
    }

    // 3. Revoke old token (rotation)
    await tokenRepository.revokeRefreshToken(tokenHash);

    // 4. Get user and generate new tokens
    const user = await userRepository.findById(payload.userId);
    if (!user || !user.isActive) {
      throw new AuthError("User not found or inactive", "USER_INACTIVE", 401);
    }

    const userRoles = await roleRepository.getUserRoles(user.id);
    const userPermissions = await roleRepository.getUserPermissions(user.id);

    const jwtPayload: JWTPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      roles: userRoles.map((r) => r.name as UserRole),
      permissions: userPermissions.map((p) => p.name as Permission),
      institutionId: user.institutionId ?? undefined,
    };

    const tokens = generateAuthTokens(jwtPayload);

    // 5. Store new refresh token
    await tokenRepository.storeRefreshToken(
      user.id,
      hashToken(tokens.refreshToken),
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      undefined,
      ipAddress
    );

    return tokens;
  }

  /**
   * Logout — revoke the refresh token.
   */
  async logout(refreshToken: string, userId: number): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    await tokenRepository.revokeRefreshToken(tokenHash);
    await auditLogRepository.log({
      userId,
      action: "logout",
      resource: "auth",
      ipAddress: "server",
      severity: "info",
    });
  }

  /**
   * Logout from all devices — revoke all refresh tokens.
   */
  async logoutAllDevices(userId: number, ipAddress: string): Promise<void> {
    await tokenRepository.revokeAllUserTokens(userId);
    await auditLogRepository.log({
      userId,
      action: "logout",
      resource: "auth",
      ipAddress,
      severity: "info",
      newValue: { allDevices: true },
    });
  }

  /**
   * Register a new user (admin-created or self-registration).
   */
  async register(data: {
    username: string;
    email: string;
    password: string;
    name: string;
    phone?: string;
    role?: UserRole;
    institutionId?: number;
  }): Promise<{ user: SafeUser; verificationOTP: string }> {
    // 1. Check password strength
    const strength = validatePasswordStrength(data.password);
    if (strength.errors.length > 0) {
      throw new AuthError(
        strength.errors.join(". "),
        "WEAK_PASSWORD",
        400
      );
    }

    // 2. Check if user already exists
    const existing = await userRepository.findByEmail(data.email);
    if (existing) {
      throw new AuthError("Email already registered", "EMAIL_EXISTS", 409);
    }

    const existingUsername = await userRepository.findByUsername(data.username);
    if (existingUsername) {
      throw new AuthError("Username already taken", "USERNAME_EXISTS", 409);
    }

    // 3. Hash password
    const passwordHash = await hashPassword(data.password);

    // 4. Create user
    const user = await userRepository.create({
      username: data.username,
      email: data.email,
      passwordHash,
      name: data.name,
      phone: data.phone,
      institutionId: data.institutionId,
      isActive: true,
      isEmailVerified: false,
      isTwoFactorEnabled: false,
      isLocked: false,
      failedLoginAttempts: 0,
    } as any);

    // 5. Assign default role
    if (data.role) {
      const role = await roleRepository.findByName(data.role);
      if (role) {
        await roleRepository.assignRole(user.id, role.id);
      }
    }

    // 6. Generate email verification OTP
    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    await otpRepository.storeOTP(otpHash, "email_verification", getOTPExpiry(30), user.id);

    // 7. Queue verification email
    await emailQueueService.queueEmail({
      toEmail: user.email,
      toName: user.name,
      type: "email_verification",
      data: { name: user.name, otp, expiryMinutes: 30 },
    });

    await auditLogRepository.log({
      userId: user.id,
      action: "register",
      resource: "auth",
      ipAddress: "server",
      severity: "info",
      newValue: { email: user.email, role: data.role },
    });

    return {
      user: this.toSafeUser(user, [], []),
      verificationOTP: otp,
    };
  }

  /**
   * Verify email with OTP.
   */
  async verifyEmail(userId: number, otp: string): Promise<void> {
    const otpHash = hashOTP(otp);
    const record = await otpRepository.findValidOTP(otpHash, "email_verification", userId);
    if (!record) {
      throw new AuthError("Invalid or expired OTP", "INVALID_OTP", 400);
    }

    await otpRepository.markUsed(record.id);
    await userRepository.verifyEmail(userId);
  }

  /**
   * Initiate forgot password flow — send reset OTP.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await userRepository.findByEmail(email);
    // Always succeed silently (prevent email enumeration)
    if (!user) return;

    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    await otpRepository.storeOTP(otpHash, "password_reset", getOTPExpiry(15), user.id);

    await emailQueueService.queueEmail({
      toEmail: user.email,
      toName: user.name,
      type: "forgot_password",
      data: { name: user.name, otp, expiryMinutes: 15 },
    });
  }

  /**
   * Reset password using OTP.
   */
  async resetPassword(
    email: string,
    otp: string,
    newPassword: string
  ): Promise<void> {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new AuthError("Invalid request", "INVALID_REQUEST", 400);
    }

    const strength = validatePasswordStrength(newPassword);
    if (strength.errors.length > 0) {
      throw new AuthError(strength.errors.join(". "), "WEAK_PASSWORD", 400);
    }

    const otpHash = hashOTP(otp);
    const record = await otpRepository.findValidOTP(otpHash, "password_reset", user.id);
    if (!record) {
      throw new AuthError("Invalid or expired OTP", "INVALID_OTP", 400);
    }

    await otpRepository.markUsed(record.id);
    const passwordHash = await hashPassword(newPassword);
    await userRepository.updatePassword(user.id, passwordHash);

    // Revoke all existing refresh tokens (security: force re-login everywhere)
    await tokenRepository.revokeAllUserTokens(user.id);

    await auditLogRepository.log({
      userId: user.id,
      action: "password_change",
      resource: "auth",
      ipAddress: "server",
      severity: "info",
      newValue: { method: "otp_reset" },
    });
  }

  /**
   * Complete 2FA login.
   */
  async completeTwoFactor(
    userId: number,
    totpCode: string,
    ipAddress: string
  ): Promise<LoginResponse> {
    const user = await userRepository.findById(userId);
    if (!user || !user.isTwoFactorEnabled || !user.twoFactorSecret) {
      throw new AuthError("Invalid 2FA request", "INVALID_2FA", 400);
    }

    const isValid = verifyTOTP(totpCode, user.twoFactorSecret);
    if (!isValid) {
      throw new AuthError("Invalid 2FA code", "INVALID_2FA_CODE", 401);
    }

    const userRoles = await roleRepository.getUserRoles(user.id);
    const userPermissions = await roleRepository.getUserPermissions(user.id);
    const roleNames = userRoles.map((r) => r.name as UserRole);
    const permissionNames = userPermissions.map((p) => p.name as Permission);

    const payload: JWTPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      roles: roleNames,
      permissions: permissionNames,
    };

    const tokens = generateAuthTokens(payload);
    await tokenRepository.storeRefreshToken(
      user.id,
      hashToken(tokens.refreshToken),
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      undefined,
      ipAddress
    );

    await userRepository.recordLogin(user.id, ipAddress);

    return {
      tokens,
      user: this.toSafeUser(user, roleNames, permissionNames),
    };
  }

  // ─────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────

  private toSafeUser(
    user: any,
    roles: UserRole[],
    permissions: Permission[]
  ): SafeUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      roles,
      permissions,
      profilePhoto: user.profilePhoto ?? undefined,
      institutionId: user.institutionId ?? undefined,
      isEmailVerified: user.isEmailVerified,
      isTwoFactorEnabled: user.isTwoFactorEnabled,
      profileCompletion: user.profileCompletion ?? 0,
    };
  }
}

export const authService = new AuthService();
