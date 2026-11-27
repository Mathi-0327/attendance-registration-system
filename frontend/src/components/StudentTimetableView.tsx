/**
 * @file frontend/src/components/StudentTimetableView.tsx
 * @description Student weekly class schedule view with live day highlight and period cards.
 */

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, Clock, MapPin, RefreshCw, BookOpen, User } from "lucide-react";
import { toast } from "sonner";

interface TimetableSlot {
  id: number;
  sectionId: number;
  subjectId: number;
  day: string;
  startTime: string;
  endTime: string;
  room?: string | null;
  periodNumber?: number | null;
  subjectName?: string | null;
  subjectCode?: string | null;
  subjectType?: string | null;
}

const DAYS = [
  { id: "monday", label: "Monday", short: "Mon" },
  { id: "tuesday", label: "Tuesday", short: "Tue" },
  { id: "wednesday", label: "Wednesday", short: "Wed" },
  { id: "thursday", label: "Thursday", short: "Thu" },
  { id: "friday", label: "Friday", short: "Fri" },
  { id: "saturday", label: "Saturday", short: "Sat" },
];

const PERIOD_DEFAULTS = [
  { period: 1, start: "08:30", end: "09:20", label: "Period 1" },
  { period: 2, start: "09:20", end: "10:10", label: "Period 2" },
  { period: 3, start: "10:30", end: "11:20", label: "Period 3" },
  { period: 4, start: "11:20", end: "12:10", label: "Period 4" },
  { period: 5, start: "01:00", end: "01:50", label: "Period 5" },
  { period: 6, start: "01:50", end: "02:40", label: "Period 6" },
  { period: 7, start: "02:40", end: "03:30", label: "Period 7" },
  { period: 8, start: "03:30", end: "04:15", label: "Period 8" },
];

const SUBJECT_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  CS3601: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-600 dark:text-blue-400", badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  CS3602: { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-600 dark:text-purple-400", badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  CS3603: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-600 dark:text-emerald-400", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  CS3604: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-600 dark:text-amber-400", badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  CS3605: { bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-600 dark:text-rose-400", badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300" },
  CS3606: { bg: "bg-teal-500/10", border: "border-teal-500/30", text: "text-teal-600 dark:text-teal-400", badge: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300" },
};

export function StudentTimetableView() {
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>("all");

  const todayName = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date()).toLowerCase();

  const loadTimetable = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/academic/timetable");
      if (res.ok) {
        const data = await res.json();
        setSlots(data.timetable || []);
      }
    } catch (err) {
      console.error("Error loading timetable:", err);
      toast.error("Failed to load timetable");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimetable();
  }, []);

  const getSlot = (day: string, periodNumber: number) => {
    return slots.find((s) => s.day === day && s.periodNumber === periodNumber);
  };

  const filteredSlots = selectedDay === "all" ? slots : slots.filter((s) => s.day === selectedDay);

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-card/60 backdrop-blur-md shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-6 w-6 text-primary" />
                <CardTitle className="text-xl font-bold">Weekly Class Schedule</CardTitle>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                  CSE • Semester 6
                </Badge>
              </div>
              <CardDescription className="mt-1">
                View your scheduled classes, room locations, timings, and faculty assignments.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadTimetable} className="gap-1.5">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Day selection filters */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t mt-4">
            <Button
              variant={selectedDay === "all" ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setSelectedDay("all")}
            >
              Full Week
            </Button>
            {DAYS.map((d) => (
              <Button
                key={d.id}
                variant={selectedDay === d.id ? "default" : "outline"}
                size="sm"
                className={`h-8 text-xs ${todayName === d.id ? "border-primary font-bold" : ""}`}
                onClick={() => setSelectedDay(d.id)}
              >
                {d.label} {todayName === d.id && "• Today"}
              </Button>
            ))}
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <Card className="p-12 text-center text-muted-foreground">
          <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
          <p>Loading schedule...</p>
        </Card>
      ) : selectedDay === "all" ? (
        /* Full Weekly Grid */
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-muted/50 border-b text-xs font-semibold text-muted-foreground">
                <th className="p-3 w-28 border-r text-center">Day</th>
                {PERIOD_DEFAULTS.map((p) => (
                  <th key={p.period} className="p-3 border-r text-center font-medium">
                    <div className="font-bold text-foreground">{p.label}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{p.start} - {p.end}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day) => {
                const isToday = todayName === day.id;
                return (
                  <tr
                    key={day.id}
                    className={`border-b transition-colors ${
                      isToday ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/20"
                    }`}
                  >
                    <td className="p-3 border-r font-semibold text-center text-sm bg-muted/30">
                      <div className="text-foreground">{day.label}</div>
                      {isToday && (
                        <Badge variant="default" className="text-[9px] px-1.5 py-0 mt-1">
                          Today
                        </Badge>
                      )}
                    </td>
                    {PERIOD_DEFAULTS.map((p) => {
                      const slot = getSlot(day.id, p.period);
                      const color = slot?.subjectCode
                        ? SUBJECT_COLORS[slot.subjectCode] || SUBJECT_COLORS.CS3601
                        : null;

                      return (
                        <td key={p.period} className="p-2 border-r align-top min-w-[140px] max-w-[180px]">
                          {slot ? (
                            <div
                              className={`p-2.5 rounded-lg border transition-all ${
                                color ? `${color.bg} ${color.border}` : "bg-muted/40 border-border"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-background/90 border text-foreground">
                                  {slot.subjectCode || "SUB"}
                                </span>
                                {slot.subjectType === "lab" && (
                                  <Badge variant="secondary" className="text-[9px] uppercase px-1 py-0">
                                    Lab
                                  </Badge>
                                )}
                              </div>
                              <div className="font-semibold text-xs text-foreground line-clamp-2 leading-snug">
                                {slot.subjectName || "Subject"}
                              </div>
                              <div className="mt-2 pt-1.5 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {slot.room || "Room 304"}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="h-20 rounded-lg border border-dashed border-border/40 flex items-center justify-center text-xs text-muted-foreground/50">
                              Free
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Single Day View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSlots.length === 0 ? (
            <Card className="col-span-full p-12 text-center text-muted-foreground">
              <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No classes scheduled for {selectedDay.toUpperCase()}. Enjoy your day off!</p>
            </Card>
          ) : (
            filteredSlots.map((slot) => {
              const color = slot.subjectCode
                ? SUBJECT_COLORS[slot.subjectCode] || SUBJECT_COLORS.CS3601
                : null;
              return (
                <Card
                  key={slot.id}
                  className={`border transition-all hover:shadow-md ${
                    color ? `${color.border} ${color.bg}` : ""
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="font-mono text-xs">
                        Period {slot.periodNumber || "1"} • {slot.day.toUpperCase()}
                      </Badge>
                      {slot.subjectType === "lab" && (
                        <Badge variant="secondary" className="text-xs uppercase">
                          Laboratory
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-base font-bold mt-2">
                      {slot.subjectName || "Subject"}
                    </CardTitle>
                    <CardDescription className="font-mono text-xs">
                      Course Code: {slot.subjectCode || "N/A"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs text-muted-foreground pt-0">
                    <div className="flex items-center justify-between p-2 rounded-md bg-background/60 border">
                      <span className="flex items-center gap-1.5 font-medium text-foreground">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        Class Timing
                      </span>
                      <span className="font-mono font-semibold text-foreground">
                        {slot.startTime} - {slot.endTime}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-md bg-background/60 border">
                      <span className="flex items-center gap-1.5 font-medium text-foreground">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        Location
                      </span>
                      <span className="font-semibold text-foreground">
                        {slot.room || "Room 304"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
