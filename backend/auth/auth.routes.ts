/**
 * @file backend/auth/auth.routes.ts
 * @description Authentication REST API routes.
 * Login, logout, register, email verification, forgot/reset password, 2FA, token refresh.
 */

import { Router, type Request, type Response } from "express";
import { authService, AuthError } from "./auth.service";
import { requireAuth } from "./auth.middleware";
import { getClientIp } from "../security";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from "../../database/schema/auth.schema";
import { validatePasswordStrength } from "./password.service";

export const authRouter = Router();

// ─────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────

function handleAuthError(error: unknown, res: Response): void {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
    });
    return;
  }
  console.error("[auth] Unexpected error:", error);
  res.status(500).json({ error: "Internal server error", code: "SERVER_ERROR" });
}

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: Email or username
 *               password:
 *                 type: string
 *               rememberMe:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       423:
 *         description: Account locked
 */
authRouter.post("/login", async (req: Request, res: Response) => {
  const validated = loginSchema.safeParse(req.body);
  if (!validated.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: validated.error.flatten().fieldErrors,
    });
  }

  try {
    const result = await authService.login(
      validated.data,
      getClientIp(req),
      req.headers["user-agent"]
    );
    res.json({ success: true, ...result });
  } catch (error) {
    handleAuthError(error, res);
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/refresh
// ─────────────────────────────────────────────

authRouter.post("/refresh", async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken || typeof refreshToken !== "string") {
    return res.status(400).json({ error: "Refresh token required" });
  }

  try {
    const tokens = await authService.refreshToken(refreshToken, getClientIp(req));
    res.json({ success: true, tokens });
  } catch (error) {
    handleAuthError(error, res);
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────

authRouter.post("/logout", requireAuth, async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  try {
    if (refreshToken && req.user) {
      await authService.logout(refreshToken, req.user.userId);
    }
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    handleAuthError(error, res);
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/logout-all
// ─────────────────────────────────────────────

authRouter.post("/logout-all", requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user) {
      await authService.logoutAllDevices(req.user.userId, getClientIp(req));
    }
    res.json({ success: true, message: "Logged out from all devices" });
  } catch (error) {
    handleAuthError(error, res);
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────

authRouter.post("/register", async (req: Request, res: Response) => {
  const validated = registerSchema.safeParse(req.body);
  if (!validated.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: validated.error.flatten().fieldErrors,
    });
  }

  try {
    const { user } = await authService.register(validated.data as any);
    res.status(201).json({
      success: true,
      message: "Registration successful. Please verify your email.",
      user,
    });
  } catch (error) {
    handleAuthError(error, res);
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/verify-email
// ─────────────────────────────────────────────

authRouter.post("/verify-email", requireAuth, async (req: Request, res: Response) => {
  const { otp } = req.body;
  if (!otp || typeof otp !== "string") {
    return res.status(400).json({ error: "OTP is required" });
  }

  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    await authService.verifyEmail(req.user.userId, otp);
    res.json({ success: true, message: "Email verified successfully" });
  } catch (error) {
    handleAuthError(error, res);
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────

authRouter.post("/forgot-password", async (req: Request, res: Response) => {
  const validated = forgotPasswordSchema.safeParse(req.body);
  if (!validated.success) {
    return res.status(400).json({ error: "Valid email required" });
  }

  try {
    await authService.forgotPassword(validated.data.email);
    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: "If an account with that email exists, a reset OTP has been sent.",
    });
  } catch (error) {
    handleAuthError(error, res);
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/reset-password
// ─────────────────────────────────────────────

authRouter.post("/reset-password", async (req: Request, res: Response) => {
  const { email, otp, password } = req.body;

  if (!email || !otp || !password) {
    return res.status(400).json({ error: "Email, OTP, and new password are required" });
  }

  try {
    await authService.resetPassword(email, otp, password);
    res.json({
      success: true,
      message: "Password reset successfully. Please log in with your new password.",
    });
  } catch (error) {
    handleAuthError(error, res);
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/2fa/complete
// ─────────────────────────────────────────────

authRouter.post("/2fa/complete", async (req: Request, res: Response) => {
  const { userId, totpCode } = req.body;

  if (!userId || !totpCode) {
    return res.status(400).json({ error: "userId and totpCode are required" });
  }

  try {
    const result = await authService.completeTwoFactor(
      userId,
      totpCode,
      getClientIp(req)
    );
    res.json({ success: true, ...result });
  } catch (error) {
    handleAuthError(error, res);
  }
});

// ─────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────

authRouter.get("/me", requireAuth, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.json({ success: true, user: req.user });
});

// ─────────────────────────────────────────────
// POST /api/auth/password-strength
// ─────────────────────────────────────────────

/**
 * Client-side password strength check endpoint.
 * Returns strength score and suggestions without creating any account.
 */
authRouter.post("/password-strength", (req: Request, res: Response) => {
  const { password } = req.body;
  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Password is required" });
  }
  const result = validatePasswordStrength(password);
  res.json({ success: true, ...result });
});
