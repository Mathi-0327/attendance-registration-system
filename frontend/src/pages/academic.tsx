/**
 * @file frontend/src/pages/academic.tsx
 * @description Enterprise Academic Management page.
 * A full-featured, premium UI for managing departments, courses,
 * semesters, sections, subjects, and timetable — all in one place.
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
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  BookMarked,
  LayoutGrid,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useCourses,
  useCreateCourse,
  useSemesters,
  useSections,
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
  color: string;
}

const TABS: NavTab[] = [
  { id: "departments", label: "Departments",  icon: Building2,     description: "Manage academic departments",      color: "blue"    },
  { id: "courses",    label: "Courses",       icon: GraduationCap, description: "Programs & degree courses",        color: "violet"  },
  { id: "semesters",  label: "Semesters",     icon: CalendarDays,  description: "Semester terms & academic years",  color: "emerald" },
  { id: "sections",   label: "Sections",      icon: LayoutGrid,    description: "Class divisions & batches",        color: "orange"  },
  { id: "subjects",   label: "Subjects",      icon: BookOpen,      description: "Subjects & faculty assignments",   color: "cyan"    },
  { id: "timetable",  label: "Timetable",     icon: Clock,         description: "Weekly schedule builder",          color: "pink"    },
];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  blue:    { bg: "bg-blue-500/10",    border: "border-blue-500/30",    text: "text-blue-400",    badge: "bg-blue-500/20 text-blue-300"    },
  violet:  { bg: "bg-violet-500/10",  border: "border-violet-500/30",  text: "text-violet-400",  badge: "bg-violet-500/20 text-violet-300"  },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", badge: "bg-emerald-500/20 text-emerald-300" },
  orange:  { bg: "bg-orange-500/10",  border: "border-orange-500/30",  text: "text-orange-400",  badge: "bg-orange-500/20 text-orange-300"  },
  cyan:    { bg: "bg-cyan-500/10",    border: "border-cyan-500/30",    text: "text-cyan-400",    badge: "bg-cyan-500/20 text-cyan-300"    },
  pink:    { bg: "bg-pink-500/10",    border: "border-pink-500/30",    text: "text-pink-400",    badge: "bg-pink-500/20 text-pink-300"    },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  const c = COLOR_MAP[color];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border ${c.border} ${c.bg} p-4 flex items-center gap-4`}
    >
      <div className={`w-10 h-10 rounded-lg ${c.bg} border ${c.border} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${c.text}`} />
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-slate-100">{value}</p>
      </div>
    </motion.div>
  );
}

function EmptyState({ icon: Icon, title, subtitle, color }: { icon: React.ElementType; title: string; subtitle: string; color: string }) {
  const c = COLOR_MAP[color];
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className={`w-16 h-16 rounded-2xl ${c.bg} border ${c.border} flex items-center justify-center mb-4`}>
        <Icon className={`w-8 h-8 ${c.text}`} />
      </div>
      <h3 className="text-slate-300 font-semibold text-lg">{title}</h3>
      <p className="text-slate-600 text-sm mt-1 max-w-xs">{subtitle}</p>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 rounded-xl bg-slate-800/40 animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
      ))}
    </div>
  );
}

// ─── Departments Panel ────────────────────────────────────────────────────────

function DepartmentsPanel() {
  const { data: departments = [], isLoading, refetch } = useDepartments();
  const createMut = useCreateDepartment();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", campusId: 1, email: "", phone: "" });

  const filtered = departments.filter(
    (d: any) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMut.mutateAsync({ ...form, campusId: Number(form.campusId) });
      toast.success(`Department "${form.name}" created`);
      setForm({ name: "", code: "", campusId: 1, email: "", phone: "" });
      setShowForm(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search departments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-900/60 border-slate-700 text-slate-200 placeholder:text-slate-600"
          />
        </div>
        <Button
          size="sm"
          onClick={() => refetch()}
          variant="outline"
          className="border-slate-700 text-slate-400 hover:text-slate-200"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          onClick={() => setShowForm((v) => !v)}
          className="bg-blue-600 hover:bg-blue-500 text-white"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Department
        </Button>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-blue-300">New Department</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Department Name *</Label>
                  <Input
                    placeholder="e.g. Computer Science"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    className="bg-slate-900 border-slate-700 text-slate-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Code *</Label>
                  <Input
                    placeholder="e.g. CSE"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    required
                    className="bg-slate-900 border-slate-700 text-slate-100 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Email</Label>
                  <Input
                    type="email"
                    placeholder="dept@college.edu"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="bg-slate-900 border-slate-700 text-slate-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Phone</Label>
                  <Input
                    placeholder="+91 98765 43210"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="bg-slate-900 border-slate-700 text-slate-100"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)} className="text-slate-500">
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={createMut.isPending} className="bg-blue-600 hover:bg-blue-500 text-white">
                  {createMut.isPending ? "Creating..." : "Create Department"}
                </Button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* List */}
      {isLoading ? (
        <LoadingRows />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Building2} title="No departments found" subtitle="Add your first department to get started with academic structure." color="blue" />
      ) : (
        <div className="space-y-2">
          {filtered.map((dept: any, i: number) => (
            <motion.div
              key={dept.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4 hover:border-slate-700 hover:bg-slate-800/40 transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-200">{dept.name}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono">{dept.code}</span>
                  {dept.isActive ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">Active</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">Inactive</span>
                  )}
                </div>
                {dept.email && <p className="text-xs text-slate-500 mt-0.5">{dept.email}</p>}
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Courses Panel ────────────────────────────────────────────────────────────

function CoursesPanel() {
  const { data: departments = [], isLoading: deptLoading } = useDepartments();
  const [selectedDept, setSelectedDept] = useState<number | null>(null);
  const { data: courses = [], isLoading: coursesLoading } = useCourses(selectedDept);
  const createMut = useCreateCourse();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", type: "ug", durationYears: 4, totalCredits: 160 });

  const COURSE_TYPES = [
    { value: "ug", label: "Undergraduate (UG)" },
    { value: "pg", label: "Postgraduate (PG)" },
    { value: "diploma", label: "Diploma" },
    { value: "phd", label: "PhD / Doctoral" },
    { value: "certificate", label: "Certificate" },
  ];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept) return toast.error("Select a department first");
    try {
      await createMut.mutateAsync({ ...form, departmentId: selectedDept });
      toast.success(`Course "${form.name}" created`);
      setForm({ name: "", code: "", type: "ug", durationYears: 4, totalCredits: 160 });
      setShowForm(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Department selector */}
      <div className="space-y-2">
        <Label className="text-slate-400 text-xs font-medium">Filter by Department</Label>
        {deptLoading ? (
          <div className="h-10 rounded-lg bg-slate-800 animate-pulse" />
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedDept(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                !selectedDept
                  ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                  : "bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300"
              }`}
            >
              All
            </button>
            {departments.map((d: any) => (
              <button
                key={d.id}
                onClick={() => setSelectedDept(d.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  selectedDept === d.id
                    ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                    : "bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300"
                }`}
              >
                {d.code}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {selectedDept
            ? `${courses.length} course${courses.length !== 1 ? "s" : ""} in selected department`
            : "Select a department to view courses"}
        </p>
        {selectedDept && (
          <Button size="sm" onClick={() => setShowForm((v) => !v)} className="bg-violet-600 hover:bg-violet-500 text-white">
            <Plus className="w-4 h-4 mr-1.5" />
            Add Course
          </Button>
        )}
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && selectedDept && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-violet-300">New Course</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Course Name *</Label>
                  <Input placeholder="e.g. B.Tech Computer Science" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-slate-900 border-slate-700 text-slate-100" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Code *</Label>
                  <Input placeholder="e.g. BTCS" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required className="bg-slate-900 border-slate-700 text-slate-100 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Type</Label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full h-10 rounded-md bg-slate-900 border border-slate-700 text-slate-100 px-3 text-sm"
                  >
                    {COURSE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Duration (years)</Label>
                  <Input type="number" min={1} max={6} value={form.durationYears} onChange={(e) => setForm({ ...form, durationYears: parseInt(e.target.value) })} className="bg-slate-900 border-slate-700 text-slate-100" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)} className="text-slate-500">Cancel</Button>
                <Button type="submit" size="sm" disabled={createMut.isPending} className="bg-violet-600 hover:bg-violet-500 text-white">
                  {createMut.isPending ? "Creating..." : "Create Course"}
                </Button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Course list */}
      {!selectedDept ? (
        <EmptyState icon={GraduationCap} title="Select a department" subtitle="Choose a department above to view and manage its courses." color="violet" />
      ) : coursesLoading ? (
        <LoadingRows />
      ) : courses.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No courses yet" subtitle="Add your first course to this department." color="violet" />
      ) : (
        <div className="space-y-2">
          {courses.map((c: any, i: number) => (
            <motion.div key={c.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4 hover:border-slate-700 transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-5 h-5 text-violet-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-200">{c.name}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-mono">{c.code}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 uppercase">{c.type}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{c.durationYears} year program · {c.totalCredits || "—"} credits</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Subjects Panel ───────────────────────────────────────────────────────────

function SubjectsPanel() {
  const { data: departments = [] } = useDepartments();
  const [selectedDept, setSelectedDept] = useState<number | null>(null);
  const { data: courses = [] } = useCourses(selectedDept);
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const { data: semesters = [] } = useSemesters(selectedCourse);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const { data: subjects = [], isLoading } = useSubjects(selectedSemester);
  const createMut = useCreateSubject();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", credits: 3, type: "theory", lecturesPerWeek: 3, attendanceThreshold: 75 });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSemester) return toast.error("Select a semester first");
    try {
      await createMut.mutateAsync({ ...form, semesterId: selectedSemester });
      toast.success(`Subject "${form.name}" created`);
      setForm({ name: "", code: "", credits: 3, type: "theory", lecturesPerWeek: 3, attendanceThreshold: 75 });
      setShowForm(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-5">
      {/* Breadcrumb selectors */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-slate-500 text-xs">Department</Label>
          <select
            value={selectedDept ?? ""}
            onChange={(e) => { setSelectedDept(e.target.value ? parseInt(e.target.value) : null); setSelectedCourse(null); setSelectedSemester(null); }}
            className="w-full h-10 rounded-md bg-slate-900 border border-slate-700 text-slate-300 px-3 text-sm"
          >
            <option value="">Select...</option>
            {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-500 text-xs">Course</Label>
          <select
            value={selectedCourse ?? ""}
            onChange={(e) => { setSelectedCourse(e.target.value ? parseInt(e.target.value) : null); setSelectedSemester(null); }}
            disabled={!selectedDept}
            className="w-full h-10 rounded-md bg-slate-900 border border-slate-700 text-slate-300 px-3 text-sm disabled:opacity-40"
          >
            <option value="">Select...</option>
            {courses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-500 text-xs">Semester</Label>
          <select
            value={selectedSemester ?? ""}
            onChange={(e) => setSelectedSemester(e.target.value ? parseInt(e.target.value) : null)}
            disabled={!selectedCourse}
            className="w-full h-10 rounded-md bg-slate-900 border border-slate-700 text-slate-300 px-3 text-sm disabled:opacity-40"
          >
            <option value="">Select...</option>
            {semesters.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* Toolbar */}
      {selectedSemester && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowForm((v) => !v)} className="bg-cyan-600 hover:bg-cyan-500 text-white">
            <Plus className="w-4 h-4 mr-1.5" />
            Add Subject
          </Button>
        </div>
      )}

      {/* Create form */}
      <AnimatePresence>
        {showForm && selectedSemester && (
          <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} onSubmit={handleCreate} className="overflow-hidden">
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-cyan-300">New Subject</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-slate-400 text-xs">Subject Name *</Label>
                  <Input placeholder="e.g. Data Structures" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-slate-900 border-slate-700 text-slate-100" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Code *</Label>
                  <Input placeholder="CS301" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required className="bg-slate-900 border-slate-700 text-slate-100 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Type</Label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full h-10 rounded-md bg-slate-900 border border-slate-700 text-slate-300 px-3 text-sm">
                    {["theory","lab","project","elective"].map((t) => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Credits</Label>
                  <Input type="number" min={1} max={6} value={form.credits} onChange={(e) => setForm({ ...form, credits: parseInt(e.target.value) })} className="bg-slate-900 border-slate-700 text-slate-100" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Min Attendance %</Label>
                  <Input type="number" min={50} max={100} value={form.attendanceThreshold} onChange={(e) => setForm({ ...form, attendanceThreshold: parseInt(e.target.value) })} className="bg-slate-900 border-slate-700 text-slate-100" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)} className="text-slate-500">Cancel</Button>
                <Button type="submit" size="sm" disabled={createMut.isPending} className="bg-cyan-600 hover:bg-cyan-500 text-white">
                  {createMut.isPending ? "Creating..." : "Create Subject"}
                </Button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Subject list */}
      {!selectedSemester ? (
        <EmptyState icon={BookOpen} title="Select filters above" subtitle="Choose department → course → semester to view subjects." color="cyan" />
      ) : isLoading ? (
        <LoadingRows />
      ) : subjects.length === 0 ? (
        <EmptyState icon={BookOpen} title="No subjects yet" subtitle="Add subjects to this semester to build the curriculum." color="cyan" />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {subjects.map((s: any, i: number) => (
            <motion.div key={s.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 hover:border-slate-700 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-200 text-sm">{s.name}</p>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{s.code}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    s.type === "theory" ? "bg-blue-500/20 text-blue-300" :
                    s.type === "lab"    ? "bg-emerald-500/20 text-emerald-300" :
                    s.type === "elective" ? "bg-orange-500/20 text-orange-300" :
                    "bg-violet-500/20 text-violet-300"
                  }`}>{s.type}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-800">
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <BookMarked className="w-3 h-3" /> {s.credits} credits
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="w-3 h-3" /> {s.lecturesPerWeek}×/week
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <AlertCircle className="w-3 h-3" /> Min {s.attendanceThreshold}%
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Placeholder panels ───────────────────────────────────────────────────────

function ComingSoonPanel({ tab }: { tab: NavTab }) {
  const c = COLOR_MAP[tab.color];
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`w-20 h-20 rounded-2xl ${c.bg} border ${c.border} flex items-center justify-center`}
      >
        <tab.icon className={`w-10 h-10 ${c.text}`} />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <h3 className="text-slate-200 font-semibold text-lg">{tab.label} Management</h3>
        <p className="text-slate-500 text-sm mt-1 max-w-sm">{tab.description} — full management interface coming up in the next build phase.</p>
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className={`px-3 py-1.5 rounded-full text-xs ${c.badge} border ${c.border}`}>
        Phase 3 In Progress
      </motion.div>
    </div>
  );
}

// ─── Page root ────────────────────────────────────────────────────────────────

export default function AcademicManagement() {
  const [activeTab, setActiveTab] = useState<TabId>("departments");
  const { data: departments = [] } = useDepartments();

  const renderPanel = () => {
    switch (activeTab) {
      case "departments": return <DepartmentsPanel />;
      case "courses":     return <CoursesPanel />;
      case "subjects":    return <SubjectsPanel />;
      default:
        const tab = TABS.find((t) => t.id === activeTab)!;
        return <ComingSoonPanel tab={tab} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Page header */}
      <div className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
                  <Layers className="w-4 h-4 text-white" />
                </div>
                Academic Management
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Manage your institution's academic structure</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              {departments.length} department{departments.length !== 1 ? "s" : ""} configured
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stat overview */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard icon={Building2}     label="Departments" value={departments.length} color="blue" />
          <StatCard icon={GraduationCap} label="Active Courses" value="—" color="violet" />
          <StatCard icon={Users}         label="Enrolled Students" value="—" color="emerald" />
        </div>

        {/* Tab navigation + content */}
        <div className="flex gap-6">
          {/* Sidebar nav */}
          <nav className="w-52 flex-shrink-0 space-y-1">
            {TABS.map((tab) => {
              const c = COLOR_MAP[tab.color];
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 ${
                    isActive
                      ? `${c.bg} border ${c.border} ${c.text}`
                      : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                  }`}
                >
                  <tab.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? c.text : "text-slate-600"}`} />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Panel */}
          <div className="flex-1 min-w-0">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 backdrop-blur-sm p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {renderPanel()}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
