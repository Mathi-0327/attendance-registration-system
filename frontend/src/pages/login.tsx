/**
 * @file frontend/src/pages/login.tsx
 * @description Premium enterprise login page.
 * Features animated mesh gradient background, glassmorphism card,
 * password strength indicator, 2FA support, and forgot-password flow.
 */

import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { ForgotPassword } from "@/components/auth/ForgotPassword";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  User,
  Lock,
  AlertCircle,
  KeyRound,
  GraduationCap,
  Building2,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";

// ─── Password strength helper ──────────────────────────────────────────────────
interface StrengthResult {
  score: number;       // 0–4
  label: string;
  color: string;
  barColor: string;
}

function calcStrength(password: string): StrengthResult {
  let score = 0;
  if (password.length >= 8)  score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  score = Math.min(score, 4);

  const labels = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
  const colors  = ["text-red-400", "text-orange-400", "text-yellow-400", "text-emerald-400", "text-emerald-300"];
  const bars    = ["bg-red-500",   "bg-orange-500",   "bg-yellow-500",   "bg-emerald-500",   "bg-emerald-400"];

  return { score, label: labels[score], color: colors[score], barColor: bars[score] };
}

// ─── Animated orb background ──────────────────────────────────────────────────
function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-slate-950">
      {/* Large primary orb */}
      <motion.div
        className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-blue-600/20 blur-3xl"
        animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Secondary purple orb */}
      <motion.div
        className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-violet-700/15 blur-3xl"
        animate={{ x: [0, -50, 0], y: [0, -30, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Accent teal orb */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-cyan-600/10 blur-3xl"
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
    </div>
  );
}

// ─── 2-FA Step ────────────────────────────────────────────────────────────────
interface TwoFAStepProps {
  onVerify: (code: string) => Promise<void>;
  submitting: boolean;
}

function TwoFAStep({ onVerify, submitting }: TwoFAStepProps) {
  const [code, setCode] = useState("");

  return (
    <motion.div
      key="twofa"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      className="space-y-5"
    >
      <div className="text-center space-y-2 py-2">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
          <KeyRound className="w-7 h-7 text-blue-400" />
        </div>
        <p className="text-slate-300 text-sm leading-relaxed">
          Enter the 6-digit code from your authenticator app or email.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="2fa-code" className="text-slate-300 text-sm font-medium">
          Verification Code
        </Label>
        <Input
          id="2fa-code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="text-center tracking-[0.4em] text-xl font-mono bg-slate-900/80 border-slate-700 text-slate-100 focus-visible:border-blue-500 focus-visible:ring-blue-500/20 h-14"
          autoFocus
        />
      </div>
      <Button
        onClick={() => onVerify(code)}
        disabled={code.length < 6 || submitting}
        className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/25 transition-all duration-200"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
        {submitting ? "Verifying..." : "Confirm Identity"}
      </Button>
    </motion.div>
  );
}

// ─── Main login form ──────────────────────────────────────────────────────────
interface LoginFormProps {
  onForgotPassword: () => void;
}

function LoginForm({ onForgotPassword }: LoginFormProps) {
  const { login } = useAuth();
  const [, navigate] = useLocation();

  const [identifier, setIdentifier]   = useState("");
  const [password,   setPassword]     = useState("");
  const [showPass,   setShowPass]     = useState(false);
  const [rememberMe, setRememberMe]   = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [error,      setError]        = useState<string | null>(null);
  const [requires2FA, setRequires2FA] = useState(false);
  const [strength,   setStrength]     = useState<StrengthResult | null>(null);

  // Compute strength only when password field changes
  useEffect(() => {
    if (password.length > 0) {
      setStrength(calcStrength(password));
    } else {
      setStrength(null);
    }
  }, [password]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!identifier.trim() || !password) return;

      setError(null);
      setSubmitting(true);
      try {
        const data = await login(identifier.trim(), password, rememberMe);
        if (data.requiresTwoFactor) {
          setRequires2FA(true);
        } else {
          toast.success("Welcome back! Redirecting…");
          navigate("/admin");
        }
      } catch (err: any) {
        setError(err.message || "Authentication failed. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [identifier, password, rememberMe, login, navigate]
  );

  const handle2FA = useCallback(
    async (code: string) => {
      setError(null);
      setSubmitting(true);
      try {
        const res = await fetch("/api/auth/verify-2fa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, code }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Invalid 2FA code");
        }
        toast.success("Two-factor verified! Welcome back.");
        navigate("/admin");
      } catch (err: any) {
        setError(err.message || "2FA verification failed");
      } finally {
        setSubmitting(false);
      }
    },
    [identifier, navigate]
  );

  return (
    <AnimatePresence mode="wait">
      {requires2FA ? (
        <TwoFAStep key="2fa" onVerify={handle2FA} submitting={submitting} />
      ) : (
        <motion.form
          key="credentials"
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          {/* Identifier */}
          <div className="space-y-1.5">
            <Label htmlFor="identifier" className="text-slate-300 text-sm font-medium">
              Username or Email
            </Label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
              <Input
                id="identifier"
                type="text"
                placeholder="admin or name@institution.edu"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoComplete="username"
                className="pl-10 bg-slate-900/80 border-slate-700 text-slate-100 placeholder:text-slate-600 focus-visible:border-blue-500 focus-visible:ring-blue-500/20 h-11"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-slate-300 text-sm font-medium">
                Password
              </Label>
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors underline-offset-2 hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
              <Input
                id="password"
                type={showPass ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="pl-10 pr-11 bg-slate-900/80 border-slate-700 text-slate-100 placeholder:text-slate-600 focus-visible:border-blue-500 focus-visible:ring-blue-500/20 h-11"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                tabIndex={-1}
                aria-label={showPass ? "Hide password" : "Show password"}
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Password strength bar */}
            <AnimatePresence>
              {strength && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex gap-1 mt-2">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="h-1 flex-1 rounded-full bg-slate-800 overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${strength.score > i ? strength.barColor : ""}`}
                          initial={{ width: 0 }}
                          animate={{ width: strength.score > i ? "100%" : "0%" }}
                          transition={{ duration: 0.3, delay: i * 0.05 }}
                        />
                      </div>
                    ))}
                  </div>
                  <p className={`text-xs mt-1 ${strength.color}`}>{strength.label}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Remember Me */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              id="remember-me"
              role="checkbox"
              aria-checked={rememberMe}
              onClick={() => setRememberMe((v) => !v)}
              className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition-all duration-150 ${
                rememberMe
                  ? "bg-blue-600 border-blue-600"
                  : "border-slate-600 bg-transparent hover:border-slate-500"
              }`}
            >
              {rememberMe && (
                <motion.svg
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-2.5 h-2.5 text-white"
                  fill="none"
                  viewBox="0 0 12 12"
                >
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </motion.svg>
              )}
            </button>
            <Label htmlFor="remember-me" className="text-slate-400 text-sm cursor-pointer select-none">
              Stay signed in for 30 days
            </Label>
          </div>

          {/* Error banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-start gap-2.5 rounded-lg bg-red-500/10 border border-red-500/30 px-3.5 py-3 text-sm text-red-300"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <Button
            type="submit"
            disabled={submitting || !identifier.trim() || !password}
            className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/25 hover:shadow-blue-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Authenticating…
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 mr-2" />
                Sign In Securely
              </>
            )}
          </Button>
        </motion.form>
      )}
    </AnimatePresence>
  );
}

// ─── Feature badges (shown below the card) ───────────────────────────────────
function FeatureBadges() {
  const features = [
    { icon: ShieldCheck,   label: "AES-256 Encrypted" },
    { icon: Wifi,          label: "Wi-Fi Verified"     },
    { icon: GraduationCap, label: "Smart Attendance"   },
    { icon: Building2,     label: "Multi-Campus"       },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="flex flex-wrap justify-center gap-3 mt-8"
    >
      {features.map(({ icon: Icon, label }) => (
        <div
          key={label}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/60 border border-slate-800 text-slate-500 text-xs"
        >
          <Icon className="w-3 h-3" />
          <span>{label}</span>
        </div>
      ))}
    </motion.div>
  );
}

// ─── Page root ────────────────────────────────────────────────────────────────
export default function Login() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [showForgot, setShowForgot] = useState(false);

  // Redirect already-authenticated users
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/admin");
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <AnimatedBackground />

      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
        {/* Brand header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8 space-y-2"
        >
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
              AttendReg
            </h1>
          </div>
          <p className="text-slate-500 text-sm">
            Enterprise AI Smart Attendance &amp; Academic Management Platform
          </p>
        </motion.div>

        {/* Glass card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-xl shadow-2xl shadow-black/40 p-8">
            {/* Card top glow */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent rounded-t-2xl" />

            <AnimatePresence mode="wait">
              {showForgot ? (
                <motion.div
                  key="forgot"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-slate-100">Reset Password</h2>
                    <p className="text-sm text-slate-500 mt-1">We'll send an OTP to your registered email.</p>
                  </div>
                  <ForgotPassword onBack={() => setShowForgot(false)} />
                </motion.div>
              ) : (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 30 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-slate-100">Sign in to your account</h2>
                    <p className="text-sm text-slate-500 mt-1">Secure access to your campus management workspace.</p>
                  </div>
                  <LoginForm onForgotPassword={() => setShowForgot(true)} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <FeatureBadges />

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-8 text-xs text-slate-700"
        >
          © {new Date().getFullYear()} AttendReg — All rights reserved
        </motion.p>
      </div>
    </>
  );
}
