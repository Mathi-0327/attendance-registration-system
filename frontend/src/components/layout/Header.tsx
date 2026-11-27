import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  ClipboardCheck,
  UserCircle,
  Shield,
  GraduationCap,
  Sparkles,
  LogOut,
  Sliders,
  Layers
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSystem } from "@/context/SystemContext";
import { Button } from "@/components/ui/button";

export function Header() {
  const [location] = useLocation();
  const { user, isAuthenticated, logout: authLogout } = useAuth();
  const { sessionActive, logout: systemLogout } = useSystem();

  const handleLogout = async () => {
    try {
      if (authLogout) await authLogout();
    } catch (e) {}
    try {
      if (systemLogout) systemLogout();
    } catch (e) {}
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-8">
        {/* Brand Logo */}
        <Link
          href="/"
          className="flex items-center gap-3 font-heading font-bold text-xl text-primary hover:opacity-95 transition-all group"
        >
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 text-white shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform">
            <ClipboardCheck className="h-5 w-5" />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="leading-none text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-indigo-300">
              Attend<span className="text-foreground">Reg</span>
            </span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
              Smart Academic Hub
            </span>
          </div>
        </Link>

        {/* Central Navigation */}
        <nav className="hidden md:flex items-center gap-1 bg-muted/40 p-1 rounded-full border border-border/50 text-sm font-medium">
          <Link
            href="/attendance"
            className={cn(
              "px-4 py-1.5 rounded-full transition-all duration-200 flex items-center gap-1.5",
              location === "/attendance"
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <GraduationCap className="h-4 w-4" />
            Student Access
          </Link>
          <Link
            href="/admin"
            className={cn(
              "px-4 py-1.5 rounded-full transition-all duration-200 flex items-center gap-1.5",
              location.startsWith("/admin")
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25 font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <Shield className="h-4 w-4" />
            Admin Dashboard
          </Link>
          <Link
            href="/academic"
            className={cn(
              "px-4 py-1.5 rounded-full transition-all duration-200 flex items-center gap-1.5",
              location === "/academic"
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <Layers className="h-4 w-4" />
            Academic
          </Link>
          <Link
            href="/analytics/ai"
            className={cn(
              "px-4 py-1.5 rounded-full transition-all duration-200 flex items-center gap-1.5",
              location.startsWith("/analytics")
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <Sparkles className="h-4 w-4 text-indigo-500" />
            AI Insights
          </Link>
        </nav>

        {/* User Account / Action */}
        <div className="flex items-center gap-3">
          {sessionActive && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Live Session Active
            </div>
          )}

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-foreground leading-tight">
                  {user?.name || "Admin User"}
                </span>
                <span className="text-[10px] text-muted-foreground capitalize">
                  {user?.roles?.[0] ? user.roles[0].replace('_', ' ') : "Super Admin"}
                </span>
              </div>
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-md">
                {(user?.name || "A").charAt(0).toUpperCase()}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2 text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-3.5 py-1.5 rounded-full transition-all duration-200"
            >
              <UserCircle className="h-4 w-4" />
              <span>Admin Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
