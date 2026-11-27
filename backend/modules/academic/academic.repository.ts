/**
 * @file backend/modules/academic/academic.repository.ts
 * @description Repository for all academic entities.
 * Covers institutions, campuses, departments, courses, academic years,
 * semesters, sections, subjects, timetable, and student enrollments.
 */

import { db } from "../../../database/db";
import { eq, and, desc, asc } from "drizzle-orm";
import {
  institutions,
  campuses,
  departments,
  courses,
  academicYears,
  semesters,
  sections,
  subjects,
  timetable,
  studentEnrollments,
  faculty,
  academicCalendar,
  type Institution,
  type Campus,
  type Department,
  type Course,
  type AcademicYear,
  type Semester,
  type Section,
  type Subject,
  type TimetableSlot,
  type StudentEnrollment,
} from "../../../database/schema/academic.schema";

// ─── Institutions ─────────────────────────────────────────────────────────────

export async function getAllInstitutions(): Promise<Institution[]> {
  return db.select().from(institutions).orderBy(asc(institutions.name));
}

export async function getInstitutionById(id: number): Promise<Institution | undefined> {
  const [row] = await db.select().from(institutions).where(eq(institutions.id, id));
  return row;
}

export async function createInstitution(
  data: Omit<Institution, "id" | "createdAt" | "updatedAt">
): Promise<Institution> {
  const now = new Date();
  const [row] = await db
    .insert(institutions)
    .values({ ...data, createdAt: now, updatedAt: now })
    .returning();
  return row;
}

export async function updateInstitution(
  id: number,
  data: Partial<Omit<Institution, "id" | "createdAt">>
): Promise<Institution> {
  const [row] = await db
    .update(institutions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(institutions.id, id))
    .returning();
  return row;
}

// ─── Campuses ─────────────────────────────────────────────────────────────────

export async function getCampusesByInstitution(institutionId: number): Promise<Campus[]> {
  return db
    .select()
    .from(campuses)
    .where(eq(campuses.institutionId, institutionId))
    .orderBy(asc(campuses.name));
}

export async function createCampus(
  data: Omit<Campus, "id" | "createdAt">
): Promise<Campus> {
  const [row] = await db
    .insert(campuses)
    .values({ ...data, createdAt: new Date() })
    .returning();
  return row;
}

// ─── Departments ──────────────────────────────────────────────────────────────

export async function getAllDepartments(): Promise<Department[]> {
  return db.select().from(departments).orderBy(asc(departments.name));
}

export async function getDepartmentsByInstitution(institutionId: number): Promise<Department[]> {
  // Join campuses to filter by institution
  return db
    .select({ department: departments })
    .from(departments)
    .innerJoin(campuses, eq(departments.campusId, campuses.id))
    .where(and(eq(campuses.institutionId, institutionId), eq(departments.isActive, true)))
    .orderBy(asc(departments.name))
    .then((rows: { department: Department }[]) => rows.map((r: { department: Department }) => r.department));
}

export async function getDepartmentById(id: number): Promise<Department | undefined> {
  const [row] = await db.select().from(departments).where(eq(departments.id, id));
  return row;
}

export async function createDepartment(
  data: Omit<Department, "id" | "createdAt" | "updatedAt">
): Promise<Department> {
  const now = new Date();
  const [row] = await db
    .insert(departments)
    .values({ ...data, createdAt: now, updatedAt: now })
    .returning();
  return row;
}

export async function updateDepartment(
  id: number,
  data: Partial<Omit<Department, "id" | "createdAt">>
): Promise<Department> {
  const [row] = await db
    .update(departments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(departments.id, id))
    .returning();
  return row;
}

// ─── Courses ──────────────────────────────────────────────────────────────────

export async function getCoursesByDepartment(departmentId: number): Promise<Course[]> {
  return db
    .select()
    .from(courses)
    .where(and(eq(courses.departmentId, departmentId), eq(courses.isActive, true)))
    .orderBy(asc(courses.name));
}

export async function getCourseById(id: number): Promise<Course | undefined> {
  const [row] = await db.select().from(courses).where(eq(courses.id, id));
  return row;
}

export async function createCourse(
  data: Omit<Course, "id" | "createdAt">
): Promise<Course> {
  const [row] = await db
    .insert(courses)
    .values({ ...data, createdAt: new Date() })
    .returning();
  return row;
}

export async function updateCourse(
  id: number,
  data: Partial<Omit<Course, "id" | "createdAt">>
): Promise<Course> {
  const [row] = await db
    .update(courses)
    .set(data)
    .where(eq(courses.id, id))
    .returning();
  return row;
}

// ─── Academic Years ───────────────────────────────────────────────────────────

export async function getAcademicYears(institutionId: number): Promise<AcademicYear[]> {
  return db
    .select()
    .from(academicYears)
    .where(eq(academicYears.institutionId, institutionId))
    .orderBy(desc(academicYears.startDate));
}

export async function getCurrentAcademicYear(
  institutionId: number
): Promise<AcademicYear | undefined> {
  const [row] = await db
    .select()
    .from(academicYears)
    .where(and(eq(academicYears.institutionId, institutionId), eq(academicYears.isCurrent, true)));
  return row;
}

export async function createAcademicYear(
  data: Omit<AcademicYear, "id" | "createdAt">
): Promise<AcademicYear> {
  const [row] = await db
    .insert(academicYears)
    .values({ ...data, createdAt: new Date() })
    .returning();
  return row;
}

export async function setCurrentAcademicYear(
  institutionId: number,
  yearId: number
): Promise<void> {
  // Clear all current flags for this institution
  await db
    .update(academicYears)
    .set({ isCurrent: false })
    .where(eq(academicYears.institutionId, institutionId));
  // Set the selected one
  await db
    .update(academicYears)
    .set({ isCurrent: true })
    .where(and(eq(academicYears.id, yearId), eq(academicYears.institutionId, institutionId)));
}

// ─── Semesters ────────────────────────────────────────────────────────────────

export async function getSemestersByCourse(courseId: number): Promise<Semester[]> {
  return db
    .select()
    .from(semesters)
    .where(eq(semesters.courseId, courseId))
    .orderBy(asc(semesters.number));
}

export async function getSemesterById(id: number): Promise<Semester | undefined> {
  const [row] = await db.select().from(semesters).where(eq(semesters.id, id));
  return row;
}

export async function createSemester(
  data: Omit<Semester, "id" | "createdAt">
): Promise<Semester> {
  const [row] = await db
    .insert(semesters)
    .values({ ...data, createdAt: new Date() })
    .returning();
  return row;
}

// ─── Sections ─────────────────────────────────────────────────────────────────

export async function getSectionsBySemester(semesterId: number): Promise<Section[]> {
  return db
    .select()
    .from(sections)
    .where(and(eq(sections.semesterId, semesterId), eq(sections.isActive, true)))
    .orderBy(asc(sections.name));
}

export async function getSectionById(id: number): Promise<Section | undefined> {
  const [row] = await db.select().from(sections).where(eq(sections.id, id));
  return row;
}

export async function createSection(
  data: Omit<Section, "id" | "createdAt">
): Promise<Section> {
  const [row] = await db
    .insert(sections)
    .values({ ...data, createdAt: new Date() })
    .returning();
  return row;
}

// ─── Subjects ─────────────────────────────────────────────────────────────────

export async function getSubjectsBySemester(semesterId: number): Promise<Subject[]> {
  return db
    .select()
    .from(subjects)
    .where(and(eq(subjects.semesterId, semesterId), eq(subjects.isActive, true)))
    .orderBy(asc(subjects.name));
}

export async function getSubjectById(id: number): Promise<Subject | undefined> {
  const [row] = await db.select().from(subjects).where(eq(subjects.id, id));
  return row;
}

export async function createSubject(
  data: Omit<Subject, "id" | "createdAt">
): Promise<Subject> {
  const [row] = await db
    .insert(subjects)
    .values({ ...data, createdAt: new Date() })
    .returning();
  return row;
}

export async function updateSubject(
  id: number,
  data: Partial<Omit<Subject, "id" | "createdAt">>
): Promise<Subject> {
  const [row] = await db.update(subjects).set(data).where(eq(subjects.id, id)).returning();
  return row;
}

// ─── Timetable ────────────────────────────────────────────────────────────────

export async function getAllTimetableSlots() {
  return db
    .select({
      id: timetable.id,
      sectionId: timetable.sectionId,
      subjectId: timetable.subjectId,
      facultyId: timetable.facultyId,
      day: timetable.day,
      startTime: timetable.startTime,
      endTime: timetable.endTime,
      room: timetable.room,
      periodNumber: timetable.periodNumber,
      isActive: timetable.isActive,
      createdAt: timetable.createdAt,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      subjectType: subjects.type,
      subjectCredits: subjects.credits,
    })
    .from(timetable)
    .leftJoin(subjects, eq(timetable.subjectId, subjects.id))
    .where(eq(timetable.isActive, true))
    .orderBy(asc(timetable.day), asc(timetable.startTime));
}

export async function getTimetableBySection(sectionId: number): Promise<TimetableSlot[]> {
  return db
    .select()
    .from(timetable)
    .where(and(eq(timetable.sectionId, sectionId), eq(timetable.isActive, true)))
    .orderBy(asc(timetable.day), asc(timetable.startTime));
}

export async function createTimetableSlot(
  data: Omit<TimetableSlot, "id" | "createdAt">
): Promise<TimetableSlot> {
  const [row] = await db
    .insert(timetable)
    .values({ ...data, createdAt: new Date() })
    .returning();
  return row;
}

export async function updateTimetableSlot(
  id: number,
  data: Partial<Omit<TimetableSlot, "id" | "createdAt">>
): Promise<TimetableSlot | undefined> {
  const [row] = await db
    .update(timetable)
    .set(data)
    .where(eq(timetable.id, id))
    .returning();
  return row;
}

export async function deleteTimetableSlot(id: number): Promise<boolean> {
  const result = await db.delete(timetable).where(eq(timetable.id, id)).returning();
  return result.length > 0;
}

// ─── Enrollments ──────────────────────────────────────────────────────────────

export async function getEnrollmentsBySection(sectionId: number): Promise<StudentEnrollment[]> {
  return db
    .select()
    .from(studentEnrollments)
    .where(and(eq(studentEnrollments.sectionId, sectionId), eq(studentEnrollments.isActive, true)));
}

export async function getEnrollmentsByStudent(studentId: string): Promise<StudentEnrollment[]> {
  return db
    .select()
    .from(studentEnrollments)
    .where(and(eq(studentEnrollments.studentId, studentId), eq(studentEnrollments.isActive, true)));
}

export async function enrollStudent(
  data: Omit<StudentEnrollment, "id">
): Promise<StudentEnrollment> {
  const [row] = await db.insert(studentEnrollments).values(data).returning();
  return row;
}

export async function unenrollStudent(studentId: string, sectionId: number): Promise<boolean> {
  const result = await db
    .update(studentEnrollments)
    .set({ isActive: false })
    .where(
      and(
        eq(studentEnrollments.studentId, studentId),
        eq(studentEnrollments.sectionId, sectionId)
      )
    )
    .returning();
  return result.length > 0;
}

// ─── Academic Calendar ────────────────────────────────────────────────────────

export async function getCalendarEvents(institutionId: number) {
  return db
    .select()
    .from(academicCalendar)
    .where(eq(academicCalendar.institutionId, institutionId))
    .orderBy(asc(academicCalendar.date));
}
