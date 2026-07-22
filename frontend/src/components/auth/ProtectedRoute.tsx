/**
 * @file frontend/src/components/auth/ProtectedRoute.tsx
 * @description Route guard component to secure private pages.
 * Displays a sleek, animated loading state while checking credentials and
 * redirects unauthenticated users to /login.
 */

import { useAuth } from "../../context/AuthContext";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface ProtectedRouteProps {
  component: React.ComponentType<any>;
  [key: string]: any;
}

export function ProtectedRoute({ component: Component, ...rest }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center space-y-4"
        >
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          <p className="text-sm font-medium text-slate-400">Verifying security credentials...</p>
        </motion.div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <Component {...rest} />;
}
