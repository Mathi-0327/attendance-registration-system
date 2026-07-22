/**
 * @file database/schema/academic.schema.ts
 * @description Academic module schema — institutions, campuses, departments, courses,
 * semesters, sections, subjects, timetable, faculty, and academic calendar.
 */

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─────────────────────────────────────────────
// INSTITUTIONS
// ─────────────────────────────────────────────

export const institutions = sqliteTable("institutions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  logo: text("logo"),
  domain: text("domain"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  country: text("country").default("India"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  type: text("type").default("college"), // 'university' | 'college' | 'school' | 'institute' | 'corporate'
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  settings: text("settings", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// CAMPUSES
// ─────────────────────────────────────────────

export const campuses = sqliteTable("campuses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  institutionId: integer("institution_id").notNull().references(() => institutions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  code: text("code").notNull(),
  location: text("location"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// DEPARTMENTS
// ─────────────────────────────────────────────

export const departments = sqliteTable("departments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campusId: integer("campus_id").notNull().references(() => campuses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  code: text("code").notNull(),
  hodId: integer("hod_id"), // References auth_users
  phone: text("phone"),
  email: text("email"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// FACULTY (extended profile on top of auth_users)
// ─────────────────────────────────────────────

export const faculty = sqliteTable("faculty", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(), // References auth_users
  employeeId: text("employee_id").notNull().unique(),
  departmentId: integer("department_id").references(() => departments.id),
  designation: text("designation"), // 'Professor' | 'Asst Professor' | 'Lecturer'
  qualification: text("qualification"),
  specialization: text("specialization"),
  experience: integer("experience"), // years
  photo: text("photo"),
  signature: text("signature"),
  bloodGroup: text("blood_group"),
  address: text("address"),
  emergencyContact: text("emergency_contact"),
  joinDate: integer("join_date", { mode: "timestamp" }),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// COURSES / PROGRAMS
// ─────────────────────────────────────────────

export const courses = sqliteTable("courses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  departmentId: integer("department_id").notNull().references(() => departments.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  code: text("code").notNull(),
  type: text("type").default("ug"), // 'ug' | 'pg' | 'diploma' | 'phd' | 'certificate'
  durationYears: integer("duration_years").notNull().default(4),
  totalCredits: integer("total_credits"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// ACADEMIC YEARS
// ─────────────────────────────────────────────

export const academicYears = sqliteTable("academic_years", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  institutionId: integer("institution_id").notNull().references(() => institutions.id),
  name: text("name").notNull(), // e.g. "2024-2025"
  startDate: integer("start_date", { mode: "timestamp" }).notNull(),
  endDate: integer("end_date", { mode: "timestamp" }).notNull(),
  isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// SEMESTERS
// ─────────────────────────────────────────────

export const semesters = sqliteTable("semesters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  courseId: integer("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  academicYearId: integer("academic_year_id").references(() => academicYears.id),
  number: integer("number").notNull(), // 1 through 8
  name: text("name").notNull(), // e.g. "Semester 1"
  startDate: integer("start_date", { mode: "timestamp" }),
  endDate: integer("end_date", { mode: "timestamp" }),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// SECTIONS (Divisions / Batches)
// ─────────────────────────────────────────────

export const sections = sqliteTable("sections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  semesterId: integer("semester_id").notNull().references(() => semesters.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // 'A', 'B', 'C' or '2024-batch'
  maxStudents: integer("max_students").notNull().default(60),
  classTeacherId: integer("class_teacher_id"), // References faculty
  room: text("room"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// SUBJECTS
// ─────────────────────────────────────────────

export const subjects = sqliteTable("subjects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  semesterId: integer("semester_id").notNull().references(() => semesters.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  code: text("code").notNull(),
  credits: integer("credits").notNull().default(3),
  type: text("type").default("theory"), // 'theory' | 'lab' | 'project' | 'elective'
  lecturesPerWeek: integer("lectures_per_week").notNull().default(3),
  facultyId: integer("faculty_id").references(() => faculty.id),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  attendanceThreshold: integer("attendance_threshold").default(75), // Override global
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// TIMETABLE
// ─────────────────────────────────────────────

export const timetable = sqliteTable("timetable", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sectionId: integer("section_id").notNull().references(() => sections.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  facultyId: integer("faculty_id").references(() => faculty.id),
  day: text("day").notNull(), // 'monday' | 'tuesday' | ...
  startTime: text("start_time").notNull(), // "09:00"
  endTime: text("end_time").notNull(),     // "10:00"
  room: text("room"),
  periodNumber: integer("period_number"), // 1st period, 2nd period, etc.
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// STUDENT ACADEMIC ENROLLMENT
// Links students to their section/semester
// ─────────────────────────────────────────────

export const studentEnrollments = sqliteTable("student_enrollments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: text("student_id").notNull(), // References students.studentId
  sectionId: integer("section_id").notNull().references(() => sections.id),
  semesterId: integer("semester_id").notNull().references(() => semesters.id),
  rollNumber: text("roll_number"),
  enrolledAt: integer("enrolled_at", { mode: "timestamp" }).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

// ─────────────────────────────────────────────
// ACADEMIC CALENDAR
// ─────────────────────────────────────────────

export const academicCalendar = sqliteTable("academic_calendar", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  institutionId: integer("institution_id").notNull().references(() => institutions.id),
  date: integer("date", { mode: "timestamp" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(), // 'holiday' | 'exam' | 'event' | 'working_day' | 'class_off'
  isWorkingDay: integer("is_working_day", { mode: "boolean" }).notNull().default(false),
  affectsAttendance: integer("affects_attendance", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// MARKS / INTERNAL ASSESSMENT
// ─────────────────────────────────────────────

export const marks = sqliteTable("marks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: text("student_id").notNull(),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  type: text("type").notNull(), // 'internal_1' | 'internal_2' | 'assignment' | 'lab' | 'final'
  maxMarks: real("max_marks").notNull(),
  obtainedMarks: real("obtained_marks").notNull(),
  remarks: text("remarks"),
  enteredBy: integer("entered_by"), // faculty_id
  enteredAt: integer("entered_at", { mode: "timestamp" }).notNull(),
});

// ─────────────────────────────────────────────
// RELATIONS
// ─────────────────────────────────────────────

export const institutionsRelations = relations(institutions, ({ many }) => ({
  campuses: many(campuses),
  academicCalendar: many(academicCalendar),
}));

export const campusesRelations = relations(campuses, ({ one, many }) => ({
  institution: one(institutions, { fields: [campuses.institutionId], references: [institutions.id] }),
  departments: many(departments),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  campus: one(campuses, { fields: [departments.campusId], references: [campuses.id] }),
  courses: many(courses),
  faculty: many(faculty),
}));

export const semestersRelations = relations(semesters, ({ one, many }) => ({
  course: one(courses, { fields: [semesters.courseId], references: [courses.id] }),
  sections: many(sections),
  subjects: many(subjects),
}));

export const sectionsRelations = relations(sections, ({ one, many }) => ({
  semester: one(semesters, { fields: [sections.semesterId], references: [semesters.id] }),
  timetable: many(timetable),
  enrollments: many(studentEnrollments),
}));

// ─────────────────────────────────────────────
// ZOD SCHEMAS
// ─────────────────────────────────────────────

export const insertDepartmentSchema = createInsertSchema(departments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSubjectSchema = createInsertSchema(subjects).omit({ id: true, createdAt: true });
export const insertTimetableSchema = createInsertSchema(timetable).omit({ id: true, createdAt: true });

// ─────────────────────────────────────────────
// TYPE EXPORTS
// ─────────────────────────────────────────────

export type Institution = typeof institutions.$inferSelect;
export type Campus = typeof campuses.$inferSelect;
export type Department = typeof departments.$inferSelect;
export type Faculty = typeof faculty.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type AcademicYear = typeof academicYears.$inferSelect;
export type Semester = typeof semesters.$inferSelect;
export type Section = typeof sections.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type TimetableSlot = typeof timetable.$inferSelect;
export type StudentEnrollment = typeof studentEnrollments.$inferSelect;
export type AcademicCalendarEntry = typeof academicCalendar.$inferSelect;
export type Mark = typeof marks.$inferSelect;
