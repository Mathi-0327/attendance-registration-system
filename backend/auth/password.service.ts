/**
 * @file backend/auth/password.service.ts
 * @description Secure password hashing using bcrypt.
 * Replaces the insecure SHA256 hashing in the original security.ts.
 * Also provides OTP generation, password strength validation, and 2FA support.
 */

import bcrypt from "bcrypt";
import { createHash, randomBytes } from "crypto";
import { generateSecret, generateURI, verifySync } from "otplib";

// ─────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || "12", 10);
const OTP_EXPIRY_MINUTES = 10;
const OTP_LENGTH = 6;

// ─────────────────────────────────────────────
// PASSWORD HASHING
// ─────────────────────────────────────────────

/**
 * Hash a password using bcrypt with a configurable cost factor.
 * Cost factor 12 provides a good balance of security and performance.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a plaintext password against a bcrypt hash.
 * Time-constant comparison prevents timing attacks.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Check if a hash was generated with bcrypt (vs old SHA256).
 * Used for migrating legacy users.
 */
export function isBcryptHash(hash: string): boolean {
  return hash.startsWith("$2b$") || hash.startsWith("$2a$");
}

// ─────────────────────────────────────────────
// PASSWORD STRENGTH VALIDATION
// ─────────────────────────────────────────────

export interface PasswordStrengthResult {
  score: number; // 0-100
  strength: "weak" | "fair" | "good" | "strong" | "very_strong";
  errors: string[];
  suggestions: string[];
}

/**
 * Validate password strength and return detailed feedback.
 * Used on both backend (registration) and frontend (real-time UI).
 */
export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const errors: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Length checks
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  } else if (password.length >= 8) {
    score += 20;
  }
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;

  // Character type checks
  if (/[A-Z]/.test(password)) {
    score += 15;
  } else {
    errors.push("Add at least one uppercase letter");
  }

  if (/[a-z]/.test(password)) {
    score += 15;
  } else {
    errors.push("Add at least one lowercase letter");
  }

  if (/[0-9]/.test(password)) {
    score += 15;
  } else {
    errors.push("Add at least one number");
  }

  if (/[^A-Za-z0-9]/.test(password)) {
    score += 15;
  } else {
    suggestions.push("Add special characters (!@#$%^&*) to make it stronger");
  }

  // Common password check
  const commonPasswords = [
    "password", "admin", "12345678", "qwerty123", "letmein",
    "welcome", "monkey", "dragon", "master", "iloveyou",
    "admin123", "password1", "123456789", "test1234",
  ];
  if (commonPasswords.some((common) => password.toLowerCase().includes(common))) {
    score = Math.min(score, 20);
    errors.push("This password is too common");
  }

  // Repeated character check
  if (/(.)\1{3,}/.test(password)) {
    score -= 10;
    suggestions.push("Avoid repeating the same character");
  }

  score = Math.max(0, Math.min(100, score));

  const strength =
    score >= 90 ? "very_strong"
    : score >= 70 ? "strong"
    : score >= 50 ? "good"
    : score >= 30 ? "fair"
    : "weak";

  return { score, strength, errors, suggestions };
}

// ─────────────────────────────────────────────
// OTP GENERATION & VERIFICATION
// ─────────────────────────────────────────────

/**
 * Generate a numeric OTP code.
 */
export function generateOTP(): string {
  const digits = "0123456789";
  let otp = "";
  const bytes = randomBytes(OTP_LENGTH);
  for (let i = 0; i < OTP_LENGTH; i++) {
    otp += digits[bytes[i] % 10];
  }
  return otp;
}

/**
 * Hash an OTP for secure DB storage.
 * SHA256 is fine here (fast, OTPs are single-use and short-lived).
 */
export function hashOTP(otp: string): string {
  return createHash("sha256").update(otp).digest("hex");
}

/**
 * Get OTP expiry time.
 */
export function getOTPExpiry(minutesFromNow = OTP_EXPIRY_MINUTES): Date {
  return new Date(Date.now() + minutesFromNow * 60 * 1000);
}

/**
 * Verify if a raw OTP matches its stored hash.
 */
export function verifyOTP(rawOTP: string, storedHash: string): boolean {
  const hash = hashOTP(rawOTP);
  // Constant-time comparison
  return createHash("sha256").update(hash).digest("hex") ===
    createHash("sha256").update(storedHash).digest("hex");
}

// ─────────────────────────────────────────────
// TOTP / 2FA (Authenticator App)
// ─────────────────────────────────────────────

/**
 * Generate a TOTP secret for a user.
 */
export function generateTOTPSecret(): string {
  return generateSecret();
}

/**
 * Generate a TOTP URI for QR code display.
 */
export function generateTOTPUri(secret: string, userEmail: string): string {
  return generateURI({ label: userEmail, issuer: "AttendReg", secret });
}

/**
 * Verify a TOTP code entered by the user.
 */
export function verifyTOTP(token: string, secret: string): boolean {
  try {
    const result = verifySync({ token, secret });
    return result.valid;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// SECURE TOKEN GENERATION
// ─────────────────────────────────────────────

/**
 * Generate a cryptographically secure random token (for password reset links, etc.)
 */
export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

/**
 * Hash a secure token for DB storage.
 */
export function hashSecureToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
