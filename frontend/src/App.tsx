import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Attendance from "@/pages/attendance";
import AdminDashboard from "@/pages/admin";
import FaceRegisterPage from "@/pages/face-register";
import StudentPortal from "@/pages/student";
import Login from "@/pages/login";
import AcademicManagement from "@/pages/academic";
import StudentProfile from "@/pages/profile/StudentProfile";
import IDCard from "@/pages/profile/IDCard";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { SystemProvider } from "@/context/SystemContext";
import { Component, ReactNode, lazy, Suspense } from "react";

// ── Lazy-loaded Phase 7–12 pages ──────────────────────────────────────────
const StudentDashboard   = lazy(() => import("@/pages/dashboard/StudentDashboard"));
const FacultyDashboard   = lazy(() => import("@/pages/dashboard/FacultyDashboard"));
const HODDashboard       = lazy(() => import("@/pages/dashboard/HODDashboard"));
const ParentDashboard    = lazy(() => import("@/pages/dashboard/ParentDashboard"));
const AnalyticsDashboard = lazy(() => import("@/pages/dashboard/AnalyticsDashboard"));
const AIDashboard        = lazy(() => import("@/pages/analytics/AIDashboard"));
const ReportBuilder      = lazy(() => import("@/pages/reports/ReportBuilder"));
const NotificationSettings = lazy(() => import("@/pages/settings/NotificationSettings"));
const SystemSettings     = lazy(() => import("@/pages/settings/SystemSettings"));
const AuditLogViewer     = lazy(() => import("@/pages/settings/AuditLogViewer"));

const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  </div>
);

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
          <h1>Something went wrong</h1>
          <p>{this.state.error?.message || "Unknown error"}</p>
          <button onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      );
    }

    return this.props.children;
  }
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* Public routes */}
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/attendance" component={Attendance} />
        <Route path="/student" component={StudentPortal} />
        <Route path="/profile/student" component={StudentProfile} />
        <Route path="/profile/id-card" component={IDCard} />

        {/* Protected routes — require authentication */}
        <Route path="/admin">
          {(params) => <ProtectedRoute component={AdminDashboard} {...params} />}
        </Route>
        <Route path="/admin/face-register">
          {(params) => <ProtectedRoute component={FaceRegisterPage} {...params} />}
        </Route>
        <Route path="/academic">
          {(params) => <ProtectedRoute component={AcademicManagement} {...params} />}
        </Route>

        {/* Phase 8 — Multi-Role Dashboards */}
        <Route path="/dashboard/student">
          {(params) => <ProtectedRoute component={StudentDashboard} {...params} />}
        </Route>
        <Route path="/dashboard/faculty">
          {(params) => <ProtectedRoute component={FacultyDashboard} {...params} />}
        </Route>
        <Route path="/dashboard/hod">
          {(params) => <ProtectedRoute component={HODDashboard} {...params} />}
        </Route>
        <Route path="/dashboard/parent">
          {(params) => <ProtectedRoute component={ParentDashboard} {...params} />}
        </Route>
        <Route path="/dashboard/analytics">
          {(params) => <ProtectedRoute component={AnalyticsDashboard} {...params} />}
        </Route>

        {/* Phase 9 — AI & Insights */}
        <Route path="/analytics/ai">
          {(params) => <ProtectedRoute component={AIDashboard} {...params} />}
        </Route>

        {/* Phase 10 — Report Builder */}
        <Route path="/reports">
          {(params) => <ProtectedRoute component={ReportBuilder} {...params} />}
        </Route>

        {/* Phase 11 — Settings & Audit */}
        <Route path="/settings/notifications">
          {(params) => <ProtectedRoute component={NotificationSettings} {...params} />}
        </Route>
        <Route path="/settings/system">
          {(params) => <ProtectedRoute component={SystemSettings} {...params} />}
        </Route>
        <Route path="/settings/audit">
          {(params) => <ProtectedRoute component={AuditLogViewer} {...params} />}
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SystemProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </SystemProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
