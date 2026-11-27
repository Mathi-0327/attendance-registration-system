/**
 * @file frontend/src/pages/academic.tsx
 * @description Enterprise Academic Management page matching the AttendReg design aesthetic.
 * Full-featured UI for managing departments, courses, semesters, sections, subjects, and timetables.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Building2,
  BookOpen,
  GraduationCap,
  CalendarDays,
  Users,
  Layers,
  Clock,
  Plus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  BookMarked,
  LayoutGrid,
  Search,
  Sparkles,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TimetableManager } from "@/components/admin/TimetableManager";
import {
  useDepartments,
  useCreateDepartment,
  useCourses,
  useCreateCourse,
  useSemesters,
  useCreateSemester,
  useSections,
  useCreateSection,
  useSubjects,
  useCreateSubject,
} from "@/hooks/useAcademic";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = "departments" | "courses" | "semesters" | "sections" | "subjects" | "timetable";

interface NavTab {
  id: TabId;
  label: string;
  icon: React.ElementType;
  description: string;
}

const TABS: NavTab[] = [
  { id: "departments", label: "Departments",  icon: Building2,     description: "Manage academic departments" },
  { id: "courses",    label: "Courses",       icon: GraduationCap, description: "Programs & degree courses" },
  { id: "semesters",  label: "Semesters",     icon: CalendarDays,  description: "Semester terms & academic tracks" },
  { id: "sections",   label: "Sections",      icon: LayoutGrid,    description: "Class divisions & batches" },
  { id: "subjects",   label: "Subjects",      icon: BookOpen,      description: "Subjects & credit allocations" },
  { id: "timetable",  label: "Timetable",     icon: Clock,         description: "Weekly interactive schedule builder" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border/70 bg-card p-4 flex items-center gap-4 shadow-sm"
    >
      <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-bold font-heading text-foreground">{value}</p>
      </div>
    </motion.div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border/80 rounded-2xl bg-muted/20">
      <div className="w-12 h-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-foreground font-semibold text-base">{title}</h3>
      <p className="text-muted-foreground text-xs mt-1 max-w-sm">{subtitle}</p>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 rounded-xl bg-muted/60 animate-pulse" />
      ))}
    </div>
  );
}

// ─── 1. Departments Panel ─────────────────────────────────────────────────────

function DepartmentsPanel() {
  const { data: departments = [], isLoading, refetch } = useDepartments();
  const createMut = useCreateDepartment();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", description: "" });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.code) return;
    try {
      await createMut.mutateAsync({
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || undefined,
        institutionId: 1,
      });
      toast.success("Department created successfully!");
      setForm({ name: "", code: "", description: "" });
      setShowForm(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to create department");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Academic Departments</h2>
          <p className="text-xs text-muted-foreground">Manage college schools, divisions, and faculties.</p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowForm((v) => !v)}
          className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
        >
          <Plus className="w-3.5 h-3.5" />
          {showForm ? "Cancel" : "Add Department"}
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate}
            className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm overflow-hidden"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary">New Department</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Department Name *</Label>
                <Input
                  placeholder="e.g. Computer Science & Engineering"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Code *</Label>
                <Input
                  placeholder="e.g. CSE"
                  value={form.code}
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                  required
                  className="h-9 text-xs font-mono uppercase"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Description</Label>
              <Input
                placeholder="Optional description"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="h-9 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={createMut.isPending} className="text-xs bg-primary text-primary-foreground">
                {createMut.isPending ? "Creating..." : "Save Department"}
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {isLoading ? (
        <LoadingRows />
      ) : departments.length === 0 ? (
        <EmptyState icon={Building2} title="No departments found" subtitle="Create your first academic department above to get started." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {departments.map((dept: any) => (
            <div
              key={dept.id}
              className="rounded-xl border border-border/80 bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-foreground text-sm">{dept.name}</h4>
                  <p className="text-xs font-mono text-primary font-semibold mt-0.5">{dept.code}</p>
                </div>
                <Badge variant="secondary" className="text-xs">Active</Badge>
              </div>
              {dept.description && <p className="text-xs text-muted-foreground mt-2">{dept.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 2. Courses Panel ─────────────────────────────────────────────────────────

function CoursesPanel() {
  const { data: departments = [] } = useDepartments();
  const [selectedDept, setSelectedDept] = useState<number | null>(null);
  const { data: courses = [], isLoading, refetch } = useCourses(selectedDept);
  const createMut = useCreateCourse();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", durationSemesters: 8, totalCredits: 160 });

  const activeDeptId = selectedDept || (departments[0]?.id ?? null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.code || !activeDeptId) return;
    try {
      await createMut.mutateAsync({
        departmentId: activeDeptId,
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        durationSemesters: Number(form.durationSemesters),
        totalCredits: Number(form.totalCredits),
        degreeType: "bachelors",
      });
      toast.success("Course added successfully!");
      setForm({ name: "", code: "", durationSemesters: 8, totalCredits: 160 });
      setShowForm(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to add course");
    }
  };

  return (
    <div className="space-y-4">
      {/* Department Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs font-semibold whitespace-nowrap">Filter Dept:</Label>
          <select
            value={activeDeptId || ""}
            onChange={(e) => setSelectedDept(Number(e.target.value))}
            className="flex h-9 rounded-xl border border-input bg-background px-3 py-1 text-xs shadow-sm"
          >
            {departments.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
            ))}
          </select>
        </div>
        <Button
          size="sm"
          onClick={() => setShowForm((v) => !v)}
          className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
        >
          <Plus className="w-3.5 h-3.5" />
          {showForm ? "Cancel" : "Add Course / Degree"}
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate}
            className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm overflow-hidden"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary">New Course / Degree Program</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Course Title *</Label>
                <Input
                  placeholder="e.g. B.Tech Computer Science"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Course Code *</Label>
                <Input
                  placeholder="e.g. BT-CSE"
                  value={form.code}
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                  required
                  className="h-9 text-xs font-mono uppercase"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Duration (Semesters)</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={form.durationSemesters}
                  onChange={(e) => setForm((p) => ({ ...p, durationSemesters: Number(e.target.value) }))}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Total Credits</Label>
                <Input
                  type="number"
                  value={form.totalCredits}
                  onChange={(e) => setForm((p) => ({ ...p, totalCredits: Number(e.target.value) }))}
                  className="h-9 text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={createMut.isPending} className="text-xs bg-primary text-primary-foreground">
                {createMut.isPending ? "Adding..." : "Save Course"}
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {isLoading ? (
        <LoadingRows />
      ) : courses.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No courses yet" subtitle="Create courses under this department to configure syllabus and semesters." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {courses.map((course: any) => (
            <div
              key={course.id}
              className="rounded-xl border border-border/80 bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-foreground text-sm">{course.name}</h4>
                  <p className="text-xs font-mono text-primary font-semibold mt-0.5">{course.code}</p>
                </div>
                <Badge variant="outline" className="text-xs">{course.durationSemesters} Semesters</Badge>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                <span>Credits: {course.totalCredits}</span>
                <span>Type: {course.degreeType || "Full-time"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 3. Semesters Panel ───────────────────────────────────────────────────────

function SemestersPanel() {
  const { data: departments = [] } = useDepartments();
  const [selectedDept, setSelectedDept] = useState<number | null>(null);
  const activeDeptId = selectedDept || (departments[0]?.id ?? null);
  const { data: courses = [] } = useCourses(activeDeptId);
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const activeCourseId = selectedCourse || (courses[0]?.id ?? null);

  const { data: semesters = [], isLoading, refetch } = useSemesters(activeCourseId);
  const createMut = useCreateSemester();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ number: 1, name: "Semester 1", isActive: true });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCourseId) return;
    try {
      await createMut.mutateAsync({
        courseId: activeCourseId,
        number: Number(form.number),
        name: form.name.trim(),
        isActive: form.isActive,
      });
      toast.success("Semester added successfully!");
      setShowForm(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to add semester");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-semibold">Dept:</Label>
            <select
              value={activeDeptId || ""}
              onChange={(e) => {
                setSelectedDept(Number(e.target.value));
                setSelectedCourse(null);
              }}
              className="h-9 rounded-xl border border-input bg-background px-3 py-1 text-xs shadow-sm"
            >
              {departments.map((d: any) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-semibold">Course:</Label>
            <select
              value={activeCourseId || ""}
              onChange={(e) => setSelectedCourse(Number(e.target.value))}
              className="h-9 rounded-xl border border-input bg-background px-3 py-1 text-xs shadow-sm"
            >
              {courses.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => setShowForm((v) => !v)}
          className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
        >
          <Plus className="w-3.5 h-3.5" />
          {showForm ? "Cancel" : "Add Semester"}
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate}
            className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm overflow-hidden"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary">New Semester Term</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Semester Number (1-12) *</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={form.number}
                  onChange={(e) => setForm((p) => ({ ...p, number: Number(e.target.value), name: `Semester ${e.target.value}` }))}
                  required
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Term Name *</Label>
                <Input
                  placeholder="e.g. Semester 1 (Fall)"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                  className="h-9 text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={createMut.isPending} className="text-xs bg-primary text-primary-foreground">
                {createMut.isPending ? "Adding..." : "Save Semester"}
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {isLoading ? (
        <LoadingRows />
      ) : semesters.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No semesters configured" subtitle="Add semester terms for this degree course." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {semesters.map((sem: any) => (
            <div
              key={sem.id}
              className="rounded-xl border border-border/80 bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-primary">TERM {sem.number}</span>
                <Badge variant={sem.isActive ? "default" : "secondary"} className="text-xs">
                  {sem.isActive ? "Active Term" : "Archived"}
                </Badge>
              </div>
              <h4 className="font-bold text-foreground text-sm mt-2">{sem.name}</h4>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 4. Sections Panel ────────────────────────────────────────────────────────

function SectionsPanel() {
  const { data: departments = [] } = useDepartments();
  const [selectedDept, setSelectedDept] = useState<number | null>(null);
  const activeDeptId = selectedDept || (departments[0]?.id ?? null);
  const { data: courses = [] } = useCourses(activeDeptId);
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const activeCourseId = selectedCourse || (courses[0]?.id ?? null);
  const { data: semesters = [] } = useSemesters(activeCourseId);
  const [selectedSem, setSelectedSem] = useState<number | null>(null);
  const activeSemId = selectedSem || (semesters[0]?.id ?? null);

  const { data: sections = [], isLoading, refetch } = useSections(activeSemId);
  const createMut = useCreateSection();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "Section A", room: "Room 101", maxStudents: 60 });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSemId || !form.name) return;
    try {
      await createMut.mutateAsync({
        semesterId: activeSemId,
        name: form.name.trim(),
        room: form.room.trim() || undefined,
        maxStudents: Number(form.maxStudents),
      });
      toast.success("Section created successfully!");
      setShowForm(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to create section");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-semibold">Course:</Label>
            <select
              value={activeCourseId || ""}
              onChange={(e) => {
                setSelectedCourse(Number(e.target.value));
                setSelectedSem(null);
              }}
              className="h-9 rounded-xl border border-input bg-background px-3 py-1 text-xs shadow-sm"
            >
              {courses.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-semibold">Semester:</Label>
            <select
              value={activeSemId || ""}
              onChange={(e) => setSelectedSem(Number(e.target.value))}
              className="h-9 rounded-xl border border-input bg-background px-3 py-1 text-xs shadow-sm"
            >
              {semesters.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => setShowForm((v) => !v)}
          className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
        >
          <Plus className="w-3.5 h-3.5" />
          {showForm ? "Cancel" : "Add Section / Division"}
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate}
            className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm overflow-hidden"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary">New Section Division</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Section Name *</Label>
                <Input
                  placeholder="e.g. Section A or CSE-A"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Room / Lecture Hall</Label>
                <Input
                  placeholder="e.g. Hall 301"
                  value={form.room}
                  onChange={(e) => setForm((p) => ({ ...p, room: e.target.value }))}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Capacity (Max Students)</Label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={form.maxStudents}
                  onChange={(e) => setForm((p) => ({ ...p, maxStudents: Number(e.target.value) }))}
                  className="h-9 text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={createMut.isPending} className="text-xs bg-primary text-primary-foreground">
                {createMut.isPending ? "Creating..." : "Save Section"}
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {isLoading ? (
        <LoadingRows />
      ) : sections.length === 0 ? (
        <EmptyState icon={LayoutGrid} title="No sections configured" subtitle="Create class sections (A, B, C) for this semester." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {sections.map((sec: any) => (
            <div
              key={sec.id}
              className="rounded-xl border border-border/80 bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-foreground text-sm">{sec.name}</h4>
                <Badge variant="secondary" className="text-xs">{sec.room || "No Room"}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Max Capacity: {sec.maxStudents} students</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 5. Subjects Panel ────────────────────────────────────────────────────────

function SubjectsPanel() {
  const { data: departments = [] } = useDepartments();
  const [selectedDept, setSelectedDept] = useState<number | null>(null);
  const activeDeptId = selectedDept || (departments[0]?.id ?? null);
  const { data: courses = [] } = useCourses(activeDeptId);
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const activeCourseId = selectedCourse || (courses[0]?.id ?? null);
  const { data: semesters = [] } = useSemesters(activeCourseId);
  const [selectedSem, setSelectedSem] = useState<number | null>(null);
  const activeSemId = selectedSem || (semesters[0]?.id ?? null);

  const { data: subjects = [], isLoading, refetch } = useSubjects(activeSemId);
  const createMut = useCreateSubject();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    credits: 3,
    type: "theory",
    lecturesPerWeek: 4,
    attendanceThreshold: 75,
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSemId || !form.name || !form.code) return;
    try {
      await createMut.mutateAsync({
        semesterId: activeSemId,
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        credits: Number(form.credits),
        type: form.type,
        lecturesPerWeek: Number(form.lecturesPerWeek),
        attendanceThreshold: Number(form.attendanceThreshold),
      });
      toast.success("Subject registered successfully!");
      setShowForm(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to create subject");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-semibold">Course:</Label>
            <select
              value={activeCourseId || ""}
              onChange={(e) => {
                setSelectedCourse(Number(e.target.value));
                setSelectedSem(null);
              }}
              className="h-9 rounded-xl border border-input bg-background px-3 py-1 text-xs shadow-sm"
            >
              {courses.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-semibold">Semester:</Label>
            <select
              value={activeSemId || ""}
              onChange={(e) => setSelectedSem(Number(e.target.value))}
              className="h-9 rounded-xl border border-input bg-background px-3 py-1 text-xs shadow-sm"
            >
              {semesters.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => setShowForm((v) => !v)}
          className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
        >
          <Plus className="w-3.5 h-3.5" />
          {showForm ? "Cancel" : "Add Subject"}
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate}
            className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm overflow-hidden"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary">New Subject Course</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Subject Title *</Label>
                <Input
                  placeholder="e.g. Data Structures & Algorithms"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Subject Code *</Label>
                <Input
                  placeholder="e.g. CS201"
                  value={form.code}
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                  required
                  className="h-9 text-xs font-mono uppercase"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Type</Label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                  className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1 text-xs shadow-sm"
                >
                  <option value="theory">Theory</option>
                  <option value="lab">Lab / Practical</option>
                  <option value="elective">Elective</option>
                  <option value="seminar">Seminar / Project</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Credits</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={form.credits}
                  onChange={(e) => setForm((p) => ({ ...p, credits: Number(e.target.value) }))}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Classes / Week</Label>
                <Input
                  type="number"
                  min={1}
                  max={15}
                  value={form.lecturesPerWeek}
                  onChange={(e) => setForm((p) => ({ ...p, lecturesPerWeek: Number(e.target.value) }))}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Min Attendance (%)</Label>
                <Input
                  type="number"
                  min={50}
                  max={100}
                  value={form.attendanceThreshold}
                  onChange={(e) => setForm((p) => ({ ...p, attendanceThreshold: Number(e.target.value) }))}
                  className="h-9 text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={createMut.isPending} className="text-xs bg-primary text-primary-foreground">
                {createMut.isPending ? "Creating..." : "Save Subject"}
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {isLoading ? (
        <LoadingRows />
      ) : subjects.length === 0 ? (
        <EmptyState icon={BookOpen} title="No subjects registered" subtitle="Add curriculum subjects to this semester." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {subjects.map((s: any) => (
            <div
              key={s.id}
              className="rounded-xl border border-border/80 bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-foreground text-sm">{s.name}</h4>
                  <p className="text-xs font-mono text-primary font-semibold mt-0.5">{s.code}</p>
                </div>
                <Badge variant="secondary" className="capitalize text-xs">{s.type}</Badge>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                <span>{s.credits} Credits</span>
                <span>{s.lecturesPerWeek}× / week</span>
                <span>Threshold: {s.attendanceThreshold}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 6. Timetable Panel ───────────────────────────────────────────────────────

function TimetablePanel() {
  return (
    <div className="space-y-4">
      <TimetableManager />
    </div>
  );
}

// ─── Academic Management Page Root ─────────────────────────────────────────────

export default function AcademicManagement() {
  const [activeTab, setActiveTab] = useState<TabId>("departments");
  const { data: departments = [] } = useDepartments();

  const renderPanel = () => {
    switch (activeTab) {
      case "departments": return <DepartmentsPanel />;
      case "courses":     return <CoursesPanel />;
      case "semesters":   return <SemestersPanel />;
      case "sections":    return <SectionsPanel />;
      case "subjects":    return <SubjectsPanel />;
      case "timetable":   return <TimetablePanel />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground">
      {/* Universal Header (Matches Home Theme) */}
      <Header />

      <main className="flex-1 container mx-auto px-4 md:px-8 py-6 max-w-7xl space-y-6">
        {/* Top Header Banner */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-2 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-heading tracking-tight text-foreground">
                Academic Operations Hub
              </h1>
              <p className="text-xs text-muted-foreground">
                Complete management for departments, degrees, semesters, sections, syllabus, and schedules.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Academic Database Connected</span>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard icon={Building2} label="Departments Configured" value={departments.length} />
          <StatCard icon={GraduationCap} label="Academic Structure" value="Active" />
          <StatCard icon={Clock} label="Weekly Timetables" value="Live" />
        </div>

        {/* Tabs Navigation (Matches Home Pill Style) */}
        <div className="flex flex-wrap gap-1.5 p-1.5 bg-muted/50 rounded-2xl border border-border/60">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Card */}
        <Card className="border border-border/80 bg-card/95 backdrop-blur-xl shadow-sm rounded-2xl p-6">
          {renderPanel()}
        </Card>
      </main>
    </div>
  );
}
