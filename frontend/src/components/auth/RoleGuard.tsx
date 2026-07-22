/**
 * @file frontend/src/components/auth/RoleGuard.tsx
 * @description Authorization component to conditionally render UI elements
 * based on user roles and specific permissions.
 */

import { ReactNode } from "react";
import { useAuth } from "../../context/AuthContext";
import { UserRole, Permission } from "@shared/types";
import { ShieldAlert } from "lucide-react";
import { Button } from "../ui/button";

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
  requiredPermission?: Permission;
  fallback?: ReactNode;
}

export function RoleGuard({
  children,
  allowedRoles,
  requiredPermission,
  fallback,
}: RoleGuardProps) {
  const { hasRole, hasPermission, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return fallback !== undefined ? <>{fallback}</> : null;
  }

  // 1. Validate Roles if provided
  if (allowedRoles && allowedRoles.length > 0) {
    if (!hasRole(allowedRoles)) {
      return fallback !== undefined ? <>{fallback}</> : null;
    }
  }

  // 2. Validate Permission if provided
  if (requiredPermission) {
    if (!hasPermission(requiredPermission)) {
      return fallback !== undefined ? <>{fallback}</> : null;
    }
  }

  return <>{children}</>;
}

/**
 * Standard access denied view that can be used as a fallback for page-level guards.
 */
export function AccessDeniedView() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-full mb-4 text-red-500 animate-bounce">
        <ShieldAlert className="w-12 h-12" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-slate-100 mb-2">
        Access Denied
      </h2>
      <p className="text-sm text-slate-400 max-w-md mb-6">
        You do not have the required permissions to access this module. Please contact your system administrator if you believe this is an error.
      </p>
      <Button onClick={() => window.history.back()} variant="outline">
        Go Back
      </Button>
    </div>
  );
}
