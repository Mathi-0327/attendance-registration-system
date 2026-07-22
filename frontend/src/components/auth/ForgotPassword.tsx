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
      className="w-full max-w-md mx-auto"
    >
      <Card className="border-slate-800 bg-slate-900/65 backdrop-blur-md shadow-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-500" />
            Reset Password
          </CardTitle>
          <CardDescription className="text-slate-400">
            {step === "request"
              ? "Enter your email to receive an authorization code"
              : "Verify OTP and configure your new password"}
          </CardDescription>
        </CardHeader>

        {step === "request" ? (
          <form onSubmit={handleRequest}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@institution.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 border-slate-700 bg-slate-950 text-slate-100 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg hover:shadow-blue-500/20"
              >
                {submitting ? "Sending..." : "Send Verification Code"}
                {!submitting && <Send className="w-4 h-4 ml-2" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={onBack}
                className="w-full text-slate-400 hover:text-slate-200"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
              </Button>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={handleReset}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp" className="text-slate-300">6-Digit Code</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-500" />
                  <Input
                    id="otp"
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                    className="pl-10 tracking-widest font-mono border-slate-700 bg-slate-950 text-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-slate-300">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-500" />
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="pl-10 border-slate-700 bg-slate-950 text-slate-100"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-lg"
              >
                {submitting ? "Resetting..." : "Complete Password Reset"}
                {!submitting && <CheckCircle2 className="w-4 h-4 ml-2" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("request")}
                className="w-full text-slate-400 hover:text-slate-200"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Resend Code
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </motion.div>
  );
}
