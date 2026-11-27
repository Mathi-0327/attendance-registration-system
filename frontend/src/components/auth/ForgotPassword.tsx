/**
 * @file frontend/src/components/auth/ForgotPassword.tsx
 * @description Forgot password request and password reset flow.
 * Guides users through receiving an OTP and configuring a new password.
 */

import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../ui/card";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Mail, KeyRound, ArrowLeft, Send, CheckCircle2, Lock } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface ForgotPasswordProps {
  onBack: () => void;
}

export function ForgotPassword({ onBack }: ForgotPasswordProps) {
  const { forgotPassword, resetPassword } = useAuth();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setSubmitting(true);
    try {
      await forgotPassword(email);
      toast.success("Reset code sent! Check your email inbox.");
      setStep("reset");
    } catch (err: any) {
      toast.error(err.message || "Failed to request password reset code");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || !newPassword) return;

    setSubmitting(true);
    try {
      await resetPassword(email, otp, newPassword);
      toast.success("Password updated successfully! Please log in.");
      onBack();
    } catch (err: any) {
      toast.error(err.message || "Reset failed. Verify the code and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      <div className="space-y-1 mb-6">
        <h2 className="text-xl font-bold font-heading tracking-tight text-foreground flex items-center gap-2">
          <Lock className="w-5 h-5 text-primary" />
          Reset Password
        </h2>
        <p className="text-sm text-muted-foreground">
          {step === "request"
            ? "Enter your email to receive an authorization code"
            : "Verify OTP and configure your new password"}
        </p>
      </div>

      {step === "request" ? (
        <form onSubmit={handleRequest} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-foreground">
              Email Address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="email"
                type="email"
                placeholder="name@institution.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-10 h-11 rounded-xl bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2"
            >
              {submitting ? "Sending..." : "Send Verification Code"}
              {!submitting && <Send className="w-4 h-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onBack}
              className="w-full h-10 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sign In
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleReset} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp" className="text-sm font-medium text-foreground">
              6-Digit Code
            </Label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="otp"
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                className="pl-10 tracking-widest font-mono h-11 rounded-xl bg-background border-input text-foreground"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-sm font-medium text-foreground">
              New Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="newPassword"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="pl-10 h-11 rounded-xl bg-background border-input text-foreground"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2"
            >
              {submitting ? "Resetting..." : "Complete Password Reset"}
              {!submitting && <CheckCircle2 className="w-4 h-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep("request")}
              className="w-full h-10 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Resend Code
            </Button>
          </div>
        </form>
      )}
    </motion.div>
  );
}
