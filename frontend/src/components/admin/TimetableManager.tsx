/**
 * @file frontend/src/components/admin/TimetableManager.tsx
 * @description Rich visual Timetable Management component for Super Admins and Teachers.
 * Supports weekly schedule viewing, period slot editing, subject assignments,
 * and role-based permissions (Super Admin vs Admin/Teacher).
 */

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  Clock,
  Plus,
  Edit2,
  Trash2,
  Building2,
  BookOpen,
  UserCheck,
  MapPin,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  RefreshCw,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export interface TimetableSlot {
  id: number;
  sectionId: number;
  subjectId: number;
  facultyId?: number | null;
  day: string;
  startTime: string;
  endTime: string;
  room?: string | null;
  periodNumber?: number | null;
  isActive: boolean;
  subjectName?: string | null;
  subjectCode?: string | null;
  subjectType?: string | null;
}

export interface SubjectOption {
  id: number;
  name: string;
  code: string;
  type?: string;
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
  CS3601: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-700 dark:text-blue-400", badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  CS3602: { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-700 dark:text-purple-400", badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  CS3603: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-700 dark:text-emerald-400", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  CS3604: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-700 dark:text-amber-400", badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  CS3605: { bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-700 dark:text-rose-400", badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300" },
  CS3606: { bg: "bg-teal-500/10", border: "border-teal-500/30", text: "text-teal-700 dark:text-teal-400", badge: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300" },
};

export function TimetableManager({ isSuperAdmin = true }: { isSuperAdmin?: boolean }) {
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [currentRole, setCurrentRole] = useState<"super_admin" | "teacher">(isSuperAdmin ? "super_admin" : "teacher");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    day: "monday",
    periodNumber: 1,
    subjectId: 1,
    startTime: "08:30",
    endTime: "09:30",
    room: "Room 304",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [ttRes, subRes] = await Promise.all([
        fetch("/api/academic/timetable"),
        fetch("/api/academic/subjects"),
      ]);

      if (ttRes.ok) {
        const ttData = await ttRes.json();
        setSlots(ttData.timetable || []);
      }

      if (subRes.ok) {
        const subData = await subRes.json();
        setSubjects(subData.subjects || []);
        if (subData.subjects?.length > 0 && !formData.subjectId) {
          setFormData((prev) => ({ ...prev, subjectId: subData.subjects[0].id }));
        }
      }
    } catch (err) {
      console.error("Failed to load timetable:", err);
      toast.error("Failed to load timetable schedule");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = (day?: string, period?: number) => {
    const pInfo = PERIOD_DEFAULTS.find((p) => p.period === (period || 1)) || PERIOD_DEFAULTS[0];
    setEditingSlot(null);
    setFormData({
      day: day || "monday",
      periodNumber: period || 1,
      subjectId: subjects[0]?.id || 1,
      startTime: pInfo.start,
      endTime: pInfo.end,
      room: "Room 304",
    });
    setModalOpen(true);
  };

  const openEditModal = (slot: TimetableSlot) => {
    setEditingSlot(slot);
    setFormData({
      day: slot.day,
      periodNumber: slot.periodNumber || 1,
      subjectId: slot.subjectId,
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: slot.room || "Room 304",
    });
    setModalOpen(true);
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingSlot) {
        // Update existing slot
        const res = await fetch(`/api/academic/timetable/${editingSlot.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (res.ok) {
          toast.success("Timetable slot updated successfully!");
          setModalOpen(false);
          loadData();
        } else {
          const err = await res.json();
          toast.error(err.error || "Failed to update slot");
        }
      } else {
        // Create new slot
        const res = await fetch("/api/academic/timetable", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (res.ok) {
          toast.success("New timetable slot added successfully!");
          setModalOpen(false);
          loadData();
        } else {
          const err = await res.json();
          toast.error(err.error || "Failed to add slot");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save slot");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlot = async (id: number) => {
    if (!confirm("Are you sure you want to remove this timetable slot?")) return;

    try {
      const res = await fetch(`/api/academic/timetable/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Timetable slot removed");
        setSlots((prev) => prev.filter((s) => s.id !== id));
      } else {
        toast.error("Failed to delete slot");
      }
    } catch {
      toast.error("Failed to delete slot");
    }
  };

  const filteredSlots = selectedDay === "all" ? slots : slots.filter((s) => s.day === selectedDay);

  const getSlot = (day: string, periodNumber: number) => {
    return slots.find((s) => s.day === day && s.periodNumber === periodNumber);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <Card className="border-border/60 shadow-sm bg-card/60 backdrop-blur-md">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-6 w-6 text-primary" />
                <CardTitle className="text-xl font-bold">Academic Timetable Manager</CardTitle>
                <Badge
                  variant={currentRole === "super_admin" ? "default" : "secondary"}
                  className="ml-2 font-mono text-xs"
                >
                  {currentRole === "super_admin" ? "🛡️ Super Admin (Full Control)" : "👨‍🏫 Teacher / Admin (Editor)"}
                </Badge>
              </div>
              <CardDescription className="mt-1">
                Manage weekly lecture slots, period timings, classrooms, and assigned subjects. Both <strong>Super Admins</strong> and <strong>Teachers</strong> can modify and update schedules.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Role Toggle for Testing */}
              <div className="flex items-center rounded-lg border bg-muted/30 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setCurrentRole("super_admin")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    currentRole === "super_admin" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Super Admin
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentRole("teacher")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    currentRole === "teacher" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Teacher / Admin
                </button>
              </div>

              <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button variant="outline" size="sm" onClick={loadData} className="gap-1.5">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button size="sm" onClick={() => openAddModal()} className="gap-1.5 shadow-sm">
                <Plus className="h-4 w-4" />
                Add Slot
              </Button>
            </div>
          </div>

          {/* Department & Day Filters */}
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t mt-4 text-sm">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-foreground">Computer Science (CSE)</span>
              <Badge variant="outline" className="text-xs">Semester 6 • Section A</Badge>
            </div>

            <div className="ml-auto flex items-center gap-1.5 overflow-x-auto">
              <Button
                variant={selectedDay === "all" ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setSelectedDay("all")}
              >
                Weekly Grid
              </Button>
              {DAYS.map((d) => (
                <Button
                  key={d.id}
                  variant={selectedDay === d.id ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setSelectedDay(d.id)}
                >
                  {d.short}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Timetable Grid View */}
      {loading ? (
        <Card className="p-12 text-center text-muted-foreground">
          <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
          <p>Loading timetable schedule...</p>
        </Card>
      ) : selectedDay === "all" ? (
        /* Full Weekly Grid (Monday to Saturday) */
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-muted/50 border-b text-xs font-semibold text-muted-foreground">
                <th className="p-3 w-28 border-r text-center">Day / Time</th>
                {PERIOD_DEFAULTS.map((p) => (
                  <th key={p.period} className="p-3 border-r text-center font-medium">
                    <div className="font-bold text-foreground">{p.label}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{p.start} - {p.end}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day) => (
                <tr key={day.id} className="border-b hover:bg-muted/20 transition-colors">
                  <td className="p-3 border-r bg-muted/30 font-semibold text-center text-sm">
                    <div className="text-foreground">{day.label}</div>
                  </td>
                  {PERIOD_DEFAULTS.map((p) => {
                    const slot = getSlot(day.id, p.period);
                    const color = slot?.subjectCode ? SUBJECT_COLORS[slot.subjectCode] || SUBJECT_COLORS.CS3601 : null;

                    return (
                      <td key={p.period} className="p-2 border-r align-top min-w-[140px] max-w-[180px]">
                        {slot ? (
                          <div
                            className={`group relative p-2.5 rounded-lg border transition-all hover:shadow-md ${
                              color ? `${color.bg} ${color.border}` : "bg-muted/40 border-border"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-background/80 border text-foreground">
                                {slot.subjectCode || "SUB"}
                              </span>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditModal(slot)}
                                  className="p-1 rounded bg-background/90 hover:bg-primary hover:text-white text-muted-foreground transition-colors shadow-xs"
                                  title="Edit Slot"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSlot(slot.id)}
                                  className="p-1 rounded bg-background/90 hover:bg-destructive hover:text-white text-muted-foreground transition-colors shadow-xs"
                                  title="Delete Slot"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                            <div className="font-semibold text-xs text-foreground line-clamp-2 leading-snug">
                              {slot.subjectName || "Subject"}
                            </div>
                            <div className="mt-2 pt-1.5 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {slot.room || "Room 304"}
                              </span>
                              <span className="font-mono text-[10px]">
                                {slot.startTime}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openAddModal(day.id, p.period)}
                            className="w-full h-24 border border-dashed border-border/60 hover:border-primary hover:bg-primary/5 rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-all text-xs"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Add Slot</span>
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Single Day List View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSlots.length === 0 ? (
            <Card className="col-span-full p-12 text-center text-muted-foreground">
              <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No classes scheduled for {selectedDay.toUpperCase()}.</p>
              <Button size="sm" onClick={() => openAddModal(selectedDay)} className="mt-4 gap-1.5">
                <Plus className="h-4 w-4" />
                Add First Class Slot
              </Button>
            </Card>
          ) : (
            filteredSlots.map((slot) => {
              const color = slot.subjectCode ? SUBJECT_COLORS[slot.subjectCode] || SUBJECT_COLORS.CS3601 : null;
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
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEditModal(slot)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDeleteSlot(slot.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <CardTitle className="text-base font-bold mt-2">
                      {slot.subjectName || "Subject"}
                    </CardTitle>
                    <CardDescription className="font-mono text-xs">
                      Code: {slot.subjectCode || "N/A"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs text-muted-foreground pt-0">
                    <div className="flex items-center justify-between p-2 rounded-md bg-background/60 border">
                      <span className="flex items-center gap-1.5 font-medium text-foreground">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        Timing
                      </span>
                      <span className="font-mono font-semibold">
                        {slot.startTime} - {slot.endTime}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-md bg-background/60 border">
                      <span className="flex items-center gap-1.5 font-medium text-foreground">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        Classroom / Lab
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

      {/* Add / Edit Timetable Slot Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-primary" />
              {editingSlot ? "Edit Timetable Slot" : "Add Timetable Lecture Slot"}
            </DialogTitle>
            <DialogDescription>
              {editingSlot
                ? "Update lecture timing, assigned subject, or room number."
                : "Schedule a new lecture slot for Computer Science Section A."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSlot} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tt-day">Day of Week *</Label>
                <select
                  id="tt-day"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.day}
                  onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                  required
                >
                  {DAYS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tt-period">Period Number *</Label>
                <select
                  id="tt-period"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.periodNumber}
                  onChange={(e) => {
                    const pNum = parseInt(e.target.value);
                    const def = PERIOD_DEFAULTS.find((p) => p.period === pNum);
                    setFormData({
                      ...formData,
                      periodNumber: pNum,
                      startTime: def ? def.start : formData.startTime,
                      endTime: def ? def.end : formData.endTime,
                    });
                  }}
                  required
                >
                  {PERIOD_DEFAULTS.map((p) => (
                    <option key={p.period} value={p.period}>
                      {p.label} ({p.start} - {p.end})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tt-subject">Subject *</Label>
              <select
                id="tt-subject"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formData.subjectId}
                onChange={(e) => setFormData({ ...formData, subjectId: parseInt(e.target.value) })}
                required
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name} ({s.type || "theory"})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tt-start">Start Time (HH:MM) *</Label>
                <Input
                  id="tt-start"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  placeholder="08:30"
                  pattern="^\d{2}:\d{2}$"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tt-end">End Time (HH:MM) *</Label>
                <Input
                  id="tt-end"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  placeholder="09:30"
                  pattern="^\d{2}:\d{2}$"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tt-room">Room / Laboratory</Label>
              <Input
                id="tt-room"
                value={formData.room}
                onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                placeholder="e.g. Room 304 (Block-A) or Lab 3"
              />
            </div>

            <DialogFooter className="pt-4 border-t gap-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editingSlot ? "Save Changes" : "Create Slot"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
