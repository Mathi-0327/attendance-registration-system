import { Card, CardContent } from "@/components/ui/card";
import { Users, Clock, AlertCircle, Activity, ArrowUpRight } from "lucide-react";
import { AttendanceRecord } from "@/context/SystemContext";
import { motion } from "framer-motion";

interface StatsCardsProps {
  records: AttendanceRecord[];
  sessionActive: boolean;
}

export function StatsCards({ records, sessionActive }: StatsCardsProps) {
  const total = records.length;
  const present = records.filter((r) => r.status === "present").length;
  const late = records.filter((r) => r.status === "late").length;
  const onTimeRate = total > 0 ? ((present / total) * 100).toFixed(1) : "0";
  const lateRate = total > 0 ? ((late / total) * 100).toFixed(1) : "0";

  const cards = [
    {
      title: "Total Present",
      value: total,
      subtitle: "Verified attendees in session",
      icon: Users,
      gradient: "from-blue-600/15 via-blue-500/5 to-transparent",
      border: "border-blue-500/30",
      textColor: "text-blue-600 dark:text-blue-400",
      iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      badge: "+Live",
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
      progress: 100,
    },
    {
      title: "On-Time Ratio",
      value: `${present}`,
      subtitle: `${onTimeRate}% arrived before cutoff`,
      icon: Clock,
      gradient: "from-emerald-600/15 via-emerald-500/5 to-transparent",
      border: "border-emerald-500/30",
      textColor: "text-emerald-600 dark:text-emerald-400",
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      badge: `${onTimeRate}%`,
      badgeColor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
      progress: parseFloat(onTimeRate),
    },
    {
      title: "Late Arrivals",
      value: `${late}`,
      subtitle: `${lateRate}% exceeded threshold`,
      icon: AlertCircle,
      gradient: "from-amber-600/15 via-amber-500/5 to-transparent",
      border: "border-amber-500/30",
      textColor: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      badge: `${lateRate}%`,
      badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
      progress: parseFloat(lateRate),
    },
    {
      title: "Session Status",
      value: sessionActive ? "ONLINE" : "STANDBY",
      subtitle: sessionActive ? "Accepting student submissions" : "Portal closed for entry",
      icon: Activity,
      gradient: sessionActive
        ? "from-emerald-600/20 via-emerald-500/5 to-transparent"
        : "from-slate-600/15 via-slate-500/5 to-transparent",
      border: sessionActive ? "border-emerald-500/40" : "border-border/50",
      textColor: sessionActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
      iconBg: sessionActive ? "bg-emerald-500/20 text-emerald-500" : "bg-muted text-muted-foreground",
      badge: sessionActive ? "Active" : "Closed",
      badgeColor: sessionActive
        ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
        : "bg-muted text-muted-foreground",
      progress: sessionActive ? 100 : 0,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
          >
            <Card
              className={`relative overflow-hidden border ${card.border} bg-card/70 backdrop-blur-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 group`}
            >
              {/* Soft Gradient Overlay */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-80 pointer-events-none`}
              />

              <CardContent className="p-5 relative z-10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {card.title}
                  </span>
                  <div className={`p-2 rounded-xl ${card.iconBg} group-hover:scale-110 transition-transform`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>

                <div className="flex items-baseline justify-between gap-2">
                  <div className={`text-3xl font-extrabold tracking-tight ${card.textColor}`}>
                    {card.value}
                  </div>
                  <span
                    className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full ${card.badgeColor}`}
                  >
                    {card.badge}
                  </span>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
                    <span>{card.subtitle}</span>
                  </div>
                  {/* Visual Progress Bar */}
                  <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        card.title === "Total Present"
                          ? "bg-blue-500"
                          : card.title === "On-Time Ratio"
                          ? "bg-emerald-500"
                          : card.title === "Late Arrivals"
                          ? "bg-amber-500"
                          : sessionActive
                          ? "bg-emerald-500"
                          : "bg-muted"
                      }`}
                      style={{ width: `${Math.min(card.progress, 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
