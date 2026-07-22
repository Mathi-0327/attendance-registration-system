/**
 * @file backend/auth/jwt.service.ts
 * @description JWT token generation, verification, and refresh token management.
 * Handles access tokens (short-lived) and refresh tokens (long-lived).
 */

import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "crypto";
import type { JWTPayload, RefreshTokenPayload, AuthTokens } from "@shared/types";

// ─────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || "attendreg-enterprise-jwt-secret-change-in-production";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "attendreg-refresh-secret-change-in-production";
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || "15m";
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || "7d";
const REMEMBER_ME_REFRESH_EXPIRY = "30d";

// ─────────────────────────────────────────────
// TOKEN GENERATION
// ─────────────────────────────────────────────

/**
 * Generate a JWT access token for the authenticated user.
 * Short-lived (15 minutes by default).
 */
export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY as any,
    issuer: "attendreg",
    audience: "attendreg-api",
  });
}

/**
 * Generate a JWT refresh token.
 * Long-lived (7 days by default, 30 days with rememberMe).
 */
export function generateRefreshToken(
  payload: RefreshTokenPayload,
  rememberMe = false
): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: (rememberMe ? REMEMBER_ME_REFRESH_EXPIRY : REFRESH_TOKEN_EXPIRY) as any,
    issuer: "attendreg",
    audience: "attendreg-refresh",
  });
}

/**
 * Generate both access and refresh tokens for a user.
 */
export function generateAuthTokens(
  payload: JWTPayload,
  rememberMe = false
): AuthTokens {
  const accessToken = generateAccessToken(payload);
  const refreshTokenId = randomBytes(16).toString("hex");
  const refreshToken = generateRefreshToken(
    { userId: payload.userId, tokenId: refreshTokenId },
    rememberMe
  );

  // Decode to get actual expiry
  const decoded = jwt.decode(accessToken) as { exp: number };

  return {
    accessToken,
    refreshToken,
    expiresIn: decoded.exp - Math.floor(Date.now() / 1000),
  };
}

// ─────────────────────────────────────────────
// TOKEN VERIFICATION
// ─────────────────────────────────────────────

/**
 * Verify and decode an access token.
 * Returns the payload or throws if invalid/expired.
 */
export function verifyAccessToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: "attendreg",
      audience: "attendreg-api",
    }) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new TokenExpiredError("Access token has expired");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new InvalidTokenError("Invalid access token");
    }
    throw error;
  }
}

/**
 * Verify and decode a refresh token.
 * Returns the payload or throws if invalid/expired.
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: "attendreg",
      audience: "attendreg-refresh",
    }) as RefreshTokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new TokenExpiredError("Refresh token has expired");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new InvalidTokenError("Invalid refresh token");
    }
    throw error;
  }
}

/**
 * Decode a token without verifying (for reading expired tokens).
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// TOKEN HASHING (for DB storage)
// ─────────────────────────────────────────────

/**
 * Hash a token for secure DB storage.
 * Only the hash is stored — the raw token is never persisted.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Extract token from Authorization header.
 * Supports "Bearer <token>" format.
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7).trim();
}

// ─────────────────────────────────────────────
// CUSTOM ERRORS
// ─────────────────────────────────────────────

export class TokenExpiredError extends Error {
  readonly isTokenExpired = true;
  constructor(message: string) {
    super(message);
    this.name = "TokenExpiredError";
  }
}

export class InvalidTokenError extends Error {
  readonly isInvalidToken = true;
  constructor(message: string) {
    super(message);
    this.name = "InvalidTokenError";
  }
}
