/**
 * @file backend/modules/academic/academic.routes.ts
 * @description REST API for Academic Management.
 * Covers institutions, departments, courses, academic years,
 * semesters, sections, subjects, timetable, and enrollments.
 */

import { Router, type Request, type Response } from "express";
import { requireAuth, requireRole } from "../../auth/auth.middleware";
import { UserRole } from "@shared/types";
import * as repo from "./academic.repository";
import { z } from "zod";

export const academicRouter = Router();

// ── Middleware shorthand ──────────────────────────────────────────────────────
const adminOnly = [
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.INSTITUTION_ADMIN, UserRole.CAMPUS_ADMIN, UserRole.DEPARTMENT_ADMIN]),
];
const staffOrAbove = [
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.INSTITUTION_ADMIN, UserRole.CAMPUS_ADMIN, UserRole.DEPARTMENT_ADMIN, UserRole.HOD, UserRole.FACULTY]),
];

// ─── Helper ───────────────────────────────────────────────────────────────────
function handleError(res: Response, err: unknown, msg = "Internal server error") {
  console.error(`[academic] ${msg}:`, err);
  res.status(500).json({ error: msg });
}

// ═══════════════════════════════════════════════════════════════════════════════
// INSTITUTIONS
// ═══════════════════════════════════════════════════════════════════════════════

academicRouter.get("/institutions", requireAuth, async (_req, res: Response) => {
  try {
    const data = await repo.getAllInstitutions();
    res.json({ institutions: data });
  } catch (err) {
    handleError(res, err, "Failed to fetch institutions");
  }
});

academicRouter.get("/institutions/:id", requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid institution ID" });

  try {
    const institution = await repo.getInstitutionById(id);
    if (!institution) return res.status(404).json({ error: "Institution not found" });
    res.json({ institution });
  } catch (err) {
    handleError(res, err, "Failed to fetch institution");
  }
});

academicRouter.post("/institutions", ...adminOnly, async (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string().min(2),
    code: z.string().min(2).toUpperCase(),
    type: z.enum(["university", "college", "school", "institute", "corporate"]).optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    website: z.string().url().optional(),
    logo: z.string().optional(),
    domain: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  try {
    const institution = await repo.createInstitution({
      ...parsed.data,
      address: parsed.data.address ?? null,
      city: parsed.data.city ?? null,
      state: parsed.data.state ?? null,
      country: parsed.data.country ?? null,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email ?? null,
      website: parsed.data.website ?? null,
      logo: parsed.data.logo ?? null,
      domain: parsed.data.domain ?? null,
      type: parsed.data.type ?? null,
      isActive: true,
      settings: null,
    });
    res.status(201).json({ institution });
  } catch (err) {
    handleError(res, err, "Failed to create institution");
  }
});

academicRouter.patch("/institutions/:id", ...adminOnly, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid institution ID" });

  try {
    const institution = await repo.updateInstitution(id, req.body);
    res.json({ institution });
  } catch (err) {
    handleError(res, err, "Failed to update institution");
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CAMPUSES
// ═══════════════════════════════════════════════════════════════════════════════

academicRouter.get(
  "/institutions/:institutionId/campuses",
  requireAuth,
  async (req: Request, res: Response) => {
    const institutionId = parseInt(req.params.institutionId);
    if (isNaN(institutionId)) return res.status(400).json({ error: "Invalid ID" });

    try {
      const data = await repo.getCampusesByInstitution(institutionId);
      res.json({ campuses: data });
    } catch (err) {
      handleError(res, err, "Failed to fetch campuses");
    }
  }
);

academicRouter.post(
  "/institutions/:institutionId/campuses",
  ...adminOnly,
  async (req: Request, res: Response) => {
    const institutionId = parseInt(req.params.institutionId);
    if (isNaN(institutionId)) return res.status(400).json({ error: "Invalid ID" });

    const schema = z.object({
      name: z.string().min(2),
      code: z.string().min(2),
      location: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

    try {
      const campus = await repo.createCampus({
        ...parsed.data,
        institutionId,
        address: parsed.data.address ?? null,
        phone: parsed.data.phone ?? null,
        email: parsed.data.email ?? null,
        location: parsed.data.location ?? null,
        isActive: true,
      });
      res.status(201).json({ campus });
    } catch (err) {
      handleError(res, err, "Failed to create campus");
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// DEPARTMENTS
// ═══════════════════════════════════════════════════════════════════════════════

academicRouter.get("/departments", requireAuth, async (_req, res: Response) => {
  try {
    const data = await repo.getAllDepartments();
    res.json({ departments: data });
  } catch (err) {
    handleError(res, err, "Failed to fetch departments");
  }
});

academicRouter.get(
  "/institutions/:institutionId/departments",
  requireAuth,
  async (req: Request, res: Response) => {
    const institutionId = parseInt(req.params.institutionId);
    if (isNaN(institutionId)) return res.status(400).json({ error: "Invalid ID" });

    try {
      const data = await repo.getDepartmentsByInstitution(institutionId);
      res.json({ departments: data });
    } catch (err) {
      handleError(res, err, "Failed to fetch departments");
    }
  }
);

academicRouter.post("/departments", ...adminOnly, async (req: Request, res: Response) => {
  const schema = z.object({
    campusId: z.number().int().positive(),
    name: z.string().min(2),
    code: z.string().min(2),
    phone: z.string().optional(),
    email: z.string().email().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  try {
    const department = await repo.createDepartment({
      ...parsed.data,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      hodId: null,
      isActive: true,
    });
    res.status(201).json({ department });
  } catch (err) {
    handleError(res, err, "Failed to create department");
  }
});

academicRouter.patch("/departments/:id", ...adminOnly, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid department ID" });

  try {
    const department = await repo.updateDepartment(id, req.body);
    res.json({ department });
  } catch (err) {
    handleError(res, err, "Failed to update department");
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// COURSES
// ═══════════════════════════════════════════════════════════════════════════════

academicRouter.get(
  "/departments/:departmentId/courses",
  requireAuth,
  async (req: Request, res: Response) => {
    const departmentId = parseInt(req.params.departmentId);
    if (isNaN(departmentId)) return res.status(400).json({ error: "Invalid department ID" });

    try {
      const data = await repo.getCoursesByDepartment(departmentId);
      res.json({ courses: data });
    } catch (err) {
      handleError(res, err, "Failed to fetch courses");
    }
  }
);

academicRouter.post("/courses", ...adminOnly, async (req: Request, res: Response) => {
  const schema = z.object({
    departmentId: z.number().int().positive(),
    name: z.string().min(2),
    code: z.string().min(2),
    type: z.enum(["ug", "pg", "diploma", "phd", "certificate"]).optional(),
    durationYears: z.number().int().min(1).max(6).optional(),
    totalCredits: z.number().int().positive().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  try {
    const course = await repo.createCourse({
      ...parsed.data,
      type: parsed.data.type ?? null,
      durationYears: parsed.data.durationYears ?? 4,
      totalCredits: parsed.data.totalCredits ?? null,
      isActive: true,
    });
    res.status(201).json({ course });
  } catch (err) {
    handleError(res, err, "Failed to create course");
  }
});

academicRouter.patch("/courses/:id", ...adminOnly, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid course ID" });

  try {
    const course = await repo.updateCourse(id, req.body);
    res.json({ course });
  } catch (err) {
    handleError(res, err, "Failed to update course");
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ACADEMIC YEARS
// ═══════════════════════════════════════════════════════════════════════════════

academicRouter.get(
  "/institutions/:institutionId/academic-years",
  requireAuth,
  async (req: Request, res: Response) => {
    const institutionId = parseInt(req.params.institutionId);
    if (isNaN(institutionId)) return res.status(400).json({ error: "Invalid ID" });

    try {
      const data = await repo.getAcademicYears(institutionId);
      res.json({ academicYears: data });
    } catch (err) {
      handleError(res, err, "Failed to fetch academic years");
    }
  }
);

academicRouter.post(
  "/institutions/:institutionId/academic-years",
  ...adminOnly,
  async (req: Request, res: Response) => {
    const institutionId = parseInt(req.params.institutionId);
    if (isNaN(institutionId)) return res.status(400).json({ error: "Invalid ID" });

    const schema = z.object({
      name: z.string().min(4),
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      isCurrent: z.boolean().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

    try {
      const year = await repo.createAcademicYear({
        institutionId,
        name: parsed.data.name,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        isCurrent: parsed.data.isCurrent ?? false,
      });
      res.status(201).json({ academicYear: year });
    } catch (err) {
      handleError(res, err, "Failed to create academic year");
    }
  }
);

academicRouter.post(
  "/institutions/:institutionId/academic-years/:yearId/set-current",
  ...adminOnly,
  async (req: Request, res: Response) => {
    const institutionId = parseInt(req.params.institutionId);
    const yearId = parseInt(req.params.yearId);

    try {
      await repo.setCurrentAcademicYear(institutionId, yearId);
      res.json({ success: true });
    } catch (err) {
      handleError(res, err, "Failed to set current academic year");
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// SEMESTERS
// ═══════════════════════════════════════════════════════════════════════════════

academicRouter.get(
  "/courses/:courseId/semesters",
  requireAuth,
  async (req: Request, res: Response) => {
    const courseId = parseInt(req.params.courseId);
    if (isNaN(courseId)) return res.status(400).json({ error: "Invalid course ID" });

    try {
      const data = await repo.getSemestersByCourse(courseId);
      res.json({ semesters: data });
    } catch (err) {
      handleError(res, err, "Failed to fetch semesters");
    }
  }
);

academicRouter.post("/semesters", ...adminOnly, async (req: Request, res: Response) => {
  const schema = z.object({
    courseId: z.number().int().positive(),
    academicYearId: z.number().int().positive().optional(),
    number: z.number().int().min(1).max(12),
    name: z.string().min(2),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    isActive: z.boolean().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  try {
    const semester = await repo.createSemester({
      ...parsed.data,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      academicYearId: parsed.data.academicYearId ?? null,
      isActive: parsed.data.isActive ?? false,
    });
    res.status(201).json({ semester });
  } catch (err) {
    handleError(res, err, "Failed to create semester");
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTIONS
// ═══════════════════════════════════════════════════════════════════════════════

academicRouter.get(
  "/semesters/:semesterId/sections",
  requireAuth,
  async (req: Request, res: Response) => {
    const semesterId = parseInt(req.params.semesterId);
    if (isNaN(semesterId)) return res.status(400).json({ error: "Invalid semester ID" });

    try {
      const data = await repo.getSectionsBySemester(semesterId);
      res.json({ sections: data });
    } catch (err) {
      handleError(res, err, "Failed to fetch sections");
    }
  }
);

academicRouter.post("/sections", ...adminOnly, async (req: Request, res: Response) => {
  const schema = z.object({
    semesterId: z.number().int().positive(),
    name: z.string().min(1),
    maxStudents: z.number().int().min(1).max(200).optional(),
    classTeacherId: z.number().int().positive().optional(),
    room: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  try {
    const section = await repo.createSection({
      ...parsed.data,
      maxStudents: parsed.data.maxStudents ?? 60,
      classTeacherId: parsed.data.classTeacherId ?? null,
      room: parsed.data.room ?? null,
      isActive: true,
    });
    res.status(201).json({ section });
  } catch (err) {
    handleError(res, err, "Failed to create section");
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUBJECTS
// ═══════════════════════════════════════════════════════════════════════════════

academicRouter.get(
  "/semesters/:semesterId/subjects",
  requireAuth,
  async (req: Request, res: Response) => {
    const semesterId = parseInt(req.params.semesterId);
    if (isNaN(semesterId)) return res.status(400).json({ error: "Invalid semester ID" });

    try {
      const data = await repo.getSubjectsBySemester(semesterId);
      res.json({ subjects: data });
    } catch (err) {
      handleError(res, err, "Failed to fetch subjects");
    }
  }
);

academicRouter.post("/subjects", ...staffOrAbove, async (req: Request, res: Response) => {
  const schema = z.object({
    semesterId: z.number().int().positive(),
    name: z.string().min(2),
    code: z.string().min(2),
    credits: z.number().int().min(1).max(6).optional(),
    type: z.enum(["theory", "lab", "project", "elective"]).optional(),
    lecturesPerWeek: z.number().int().min(1).max(10).optional(),
    facultyId: z.number().int().positive().optional(),
    attendanceThreshold: z.number().int().min(50).max(100).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  try {
    const subject = await repo.createSubject({
      ...parsed.data,
      credits: parsed.data.credits ?? 3,
      type: parsed.data.type ?? "theory",
      lecturesPerWeek: parsed.data.lecturesPerWeek ?? 3,
      facultyId: parsed.data.facultyId ?? null,
      attendanceThreshold: parsed.data.attendanceThreshold ?? 75,
      isActive: true,
    });
    res.status(201).json({ subject });
  } catch (err) {
    handleError(res, err, "Failed to create subject");
  }
});

academicRouter.patch("/subjects/:id", ...staffOrAbove, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid subject ID" });

  try {
    const subject = await repo.updateSubject(id, req.body);
    res.json({ subject });
  } catch (err) {
    handleError(res, err, "Failed to update subject");
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TIMETABLE
// ═══════════════════════════════════════════════════════════════════════════════

academicRouter.get("/timetable", async (_req: Request, res: Response) => {
  try {
    const data = await repo.getAllTimetableSlots();
    res.json({ timetable: data });
  } catch (err) {
    handleError(res, err, "Failed to fetch timetable");
  }
});

academicRouter.get(
  "/sections/:sectionId/timetable",
  async (req: Request, res: Response) => {
    const sectionId = parseInt(req.params.sectionId);
    if (isNaN(sectionId)) return res.status(400).json({ error: "Invalid section ID" });

    try {
      const data = await repo.getTimetableBySection(sectionId);
      res.json({ timetable: data });
    } catch (err) {
      handleError(res, err, "Failed to fetch timetable");
    }
  }
);

academicRouter.post("/timetable", async (req: Request, res: Response) => {
  const schema = z.object({
    sectionId: z.number().int().positive().optional().default(1),
    subjectId: z.number().int().positive(),
    facultyId: z.number().int().positive().optional(),
    day: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Format HH:MM"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Format HH:MM"),
    room: z.string().optional(),
    periodNumber: z.number().int().min(1).max(12).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  try {
    const slot = await repo.createTimetableSlot({
      ...parsed.data,
      sectionId: parsed.data.sectionId ?? 1,
      facultyId: parsed.data.facultyId ?? null,
      room: parsed.data.room ?? null,
      periodNumber: parsed.data.periodNumber ?? null,
      isActive: true,
    });
    res.status(201).json({ slot });
  } catch (err) {
    handleError(res, err, "Failed to create timetable slot");
  }
});

academicRouter.put("/timetable/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid slot ID" });

  try {
    const slot = await repo.updateTimetableSlot(id, req.body);
    if (!slot) return res.status(404).json({ error: "Slot not found" });
    res.json({ slot });
  } catch (err) {
    handleError(res, err, "Failed to update timetable slot");
  }
});

academicRouter.delete(
  "/timetable/:id",
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid slot ID" });

    try {
      const deleted = await repo.deleteTimetableSlot(id);
      if (!deleted) return res.status(404).json({ error: "Slot not found" });
      res.json({ success: true });
    } catch (err) {
      handleError(res, err, "Failed to delete timetable slot");
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ENROLLMENTS
// ═══════════════════════════════════════════════════════════════════════════════

academicRouter.get(
  "/sections/:sectionId/enrollments",
  ...staffOrAbove,
  async (req: Request, res: Response) => {
    const sectionId = parseInt(req.params.sectionId);
    if (isNaN(sectionId)) return res.status(400).json({ error: "Invalid section ID" });

    try {
      const data = await repo.getEnrollmentsBySection(sectionId);
      res.json({ enrollments: data });
    } catch (err) {
      handleError(res, err, "Failed to fetch enrollments");
    }
  }
);

academicRouter.get(
  "/students/:studentId/enrollments",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const data = await repo.getEnrollmentsByStudent(req.params.studentId);
      res.json({ enrollments: data });
    } catch (err) {
      handleError(res, err, "Failed to fetch student enrollments");
    }
  }
);

academicRouter.post("/enrollments", ...adminOnly, async (req: Request, res: Response) => {
  const schema = z.object({
    studentId: z.string().min(1),
    sectionId: z.number().int().positive(),
    semesterId: z.number().int().positive(),
    rollNumber: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  try {
    const enrollment = await repo.enrollStudent({
      ...parsed.data,
      rollNumber: parsed.data.rollNumber ?? null,
      enrolledAt: new Date(),
      isActive: true,
    });
    res.status(201).json({ enrollment });
  } catch (err) {
    handleError(res, err, "Failed to enroll student");
  }
});

academicRouter.delete(
  "/enrollments",
  ...adminOnly,
  async (req: Request, res: Response) => {
    const schema = z.object({
      studentId: z.string().min(1),
      sectionId: z.number().int().positive(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

    try {
      const success = await repo.unenrollStudent(parsed.data.studentId, parsed.data.sectionId);
      if (!success) return res.status(404).json({ error: "Enrollment not found" });
      res.json({ success: true });
    } catch (err) {
      handleError(res, err, "Failed to unenroll student");
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ACADEMIC CALENDAR
// ═══════════════════════════════════════════════════════════════════════════════

academicRouter.get(
  "/institutions/:institutionId/calendar",
  requireAuth,
  async (req: Request, res: Response) => {
    const institutionId = parseInt(req.params.institutionId);
    if (isNaN(institutionId)) return res.status(400).json({ error: "Invalid ID" });

    try {
      const events = await repo.getCalendarEvents(institutionId);
      res.json({ events });
    } catch (err) {
      handleError(res, err, "Failed to fetch calendar events");
    }
  }
);
