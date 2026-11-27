/**
 * @file frontend/src/pages/login.tsx
 * @description Professional, enterprise login page matching the AttendReg design system.
 * Features unified Header navigation, theme adaptation, 2FA support,
 * clean inputs with no autofill glitches, and no unnecessary password strength bar on login.
 */

import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/layout/Header";
import { ForgotPassword } from "@/components/auth/ForgotPassword";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  Users,
  Search,
  Shield,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

// ─── 2FA Step ─────────────────────────────────────────────────────────────────
interface TwoFAStepProps {
  onVerify: (code: string) => Promise<void>;
  submitting: boolean;
}

function TwoFAStep({ onVerify, submitting }: TwoFAStepProps) {
  const [code, setCode] = useState("");

  return (
    <motion.div
      key="twofa"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-5"
    >
      <div className="text-center space-y-2 py-2">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <KeyRound className="w-6 h-6" />
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Enter the 6-digit code from your authenticator app or email.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="2fa-code" className="text-sm font-medium text-foreground">
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
          className="text-center tracking-[0.4em] text-xl font-mono h-12 bg-background border-input text-foreground focus-visible:ring-2 focus-visible:ring-primary/20"
          autoFocus
        />
      </div>
      <Button
        onClick={() => onVerify(code)}
        disabled={code.length < 6 || submitting}
        className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
        {submitting ? "Verifying..." : "Confirm Identity"}
      </Button>
    </motion.div>
  );
}

// ─── Main Login Form ──────────────────────────────────────────────────────────
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
          toast.success("Welcome back! Redirecting to dashboard…");
          navigate("/admin");
        }
      } catch (err: any) {
        setError(err.message || "Invalid credentials. Please verify your username and password.");
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
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          onSubmit={handleSubmit}
          autoComplete="off"
          className="space-y-4"
        >
          {/* Identifier Field */}
          <div className="space-y-1.5">
            <Label htmlFor="identifier" className="text-sm font-medium text-foreground">
              Username or Email
            </Label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="identifier"
                type="text"
                placeholder="Enter username or email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoComplete="off"
                className="pl-10 h-11 rounded-xl bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20 transition-all"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </Label>
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-xs text-primary hover:underline underline-offset-2 transition-colors font-medium"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="password"
                type={showPass ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="pl-10 pr-11 h-11 rounded-xl bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                tabIndex={-1}
                aria-label={showPass ? "Hide password" : "Show password"}
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me */}
          <div className="flex items-center space-x-2 pt-0.5">
            <Checkbox
              id="remember-me"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
            />
            <Label
              htmlFor="remember-me"
              className="text-xs text-muted-foreground cursor-pointer select-none font-normal"
            >
              Remember me on this device
            </Label>
          </div>

          {/* Error Banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-start gap-2.5 rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span className="leading-tight">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={submitting || !identifier.trim() || !password}
            className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-md shadow-primary/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 mt-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing In…
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Sign In
              </>
            )}
          </Button>
        </motion.form>
      )}
    </AnimatePresence>
  );
}

// ─── Feature Badges (Matches Home Theme) ───────────────────────────────────────
function FeatureBadges() {
  const features = [
    { icon: ShieldCheck,   label: "AES-256 Encrypted" },
    { icon: Wifi,          label: "Wi-Fi Verified"     },
    { icon: GraduationCap, label: "Smart Attendance"   },
    { icon: Building2,     label: "Multi-Campus"       },
  ];

  return (
    <div className="flex flex-wrap justify-center gap-2 mt-6">
      {features.map(({ icon: Icon, label }) => (
        <div
          key={label}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/60 border border-border/50 text-muted-foreground text-xs font-medium"
        >
          <Icon className="w-3.5 h-3.5 text-primary/70" />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Quick Navigation Cards (Matches Home Page Cards) ─────────────────────────
function HomeStyleQuickLinks() {
  return (
    <div className="mt-8 pt-6 border-t border-border/40 w-full max-w-xl">
      <div className="text-center mb-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Quick Access Portals
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Student Form */}
        <Link href="/attendance" className="block group">
          <div className="p-3 rounded-xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-md transition-all text-center">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
            <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
              Student Form
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Mark attendance
            </div>
          </div>
        </Link>

        {/* Student Portal */}
        <Link href="/student" className="block group">
          <div className="p-3 rounded-xl border border-border/60 bg-card hover:border-blue-500/30 hover:shadow-md transition-all text-center">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform">
              <Search className="w-4 h-4" />
            </div>
            <div className="text-xs font-semibold text-foreground group-hover:text-blue-600 transition-colors">
              Student Portal
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Check records
            </div>
          </div>
        </Link>

        {/* Admin Direct PIN */}
        <Link href="/admin" className="block group">
          <div className="p-3 rounded-xl border border-border/60 bg-card hover:border-indigo-500/30 hover:shadow-md transition-all text-center">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform">
              <Shield className="w-4 h-4" />
            </div>
            <div className="text-xs font-semibold text-foreground group-hover:text-indigo-600 transition-colors">
              Host PIN Access
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Direct session PIN
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

// ─── Page Root ────────────────────────────────────────────────────────────────
export default function Login() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [showForgot, setShowForgot] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/admin");
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Universal Header */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative">
        {/* Subtle decorative background gradient */}
        <div className="absolute inset-0 pointer-events-none -z-10 flex items-center justify-center overflow-hidden">
          <div className="w-[600px] h-[600px] bg-gradient-to-tr from-primary/10 via-indigo-500/5 to-cyan-400/5 rounded-full blur-3xl opacity-70" />
        </div>

        {/* Page Title & Subtitle */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-6 space-y-2 max-w-md"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Campus Authentication</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold font-heading tracking-tight text-foreground">
            Sign In to{" "}
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-indigo-300">
              AttendReg
            </span>
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Access your administrative dashboard, session controls, and academic analytics.
          </p>
        </motion.div>

        {/* Main Card (Clean, Professional Enterprise Login) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <Card className="border border-border/80 bg-card/95 backdrop-blur-xl shadow-xl shadow-primary/5 rounded-2xl overflow-hidden hover:border-primary/20 transition-all">
            {/* Top decorative accent stripe */}
            <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-400" />

            <div className="p-6 md:p-8">
              <AnimatePresence mode="wait">
                {showForgot ? (
                  <ForgotPassword onBack={() => setShowForgot(false)} />
                ) : (
                  <div>
                    {/* Card Header Info */}
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold font-heading text-foreground leading-tight">
                          Enterprise Login
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          Enter your credentials to continue
                        </p>
                      </div>
                    </div>

                    <LoginForm onForgotPassword={() => setShowForgot(true)} />
                  </div>
                )}
              </AnimatePresence>
            </div>
          </Card>
        </motion.div>

        {/* Feature Badges */}
        <FeatureBadges />

        {/* Home-Style Quick Navigation Links */}
        <HomeStyleQuickLinks />

        {/* Footer */}
        <p className="mt-8 text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} AttendReg — Smart Academic Hub. All rights reserved.
        </p>
      </main>
    </div>
  );
}
