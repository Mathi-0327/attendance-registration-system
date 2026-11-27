/**
 * @file backend/modules/academic/academic.seed.ts
 * @description Seeds default academic structures: Institution, Campus, Department, Course, Semester, Section, Subjects, Faculty, and Timetable.
 */

import { db } from "../../../database/db";
import { eq } from "drizzle-orm";
import {
  institutions,
  campuses,
  departments,
  courses,
  semesters,
  sections,
  subjects,
  faculty,
  timetable,
} from "../../../database/schema/academic.schema";

export async function seedAcademicData() {
  try {
    const existingSlots = await db.select().from(timetable);
    if (existingSlots.length >= 48) return;

    console.log("[academic-seed] Seeding initial academic departments and timetable...");

    const now = new Date();

    // 1. Institution
    let [inst] = await db.select().from(institutions).limit(1);
    if (!inst) {
      [inst] = await db
        .insert(institutions)
        .values({
          name: "Engineering & Technology Institute",
          code: "ENG-TECH",
          type: "college",
          city: "Chennai",
          state: "Tamil Nadu",
          country: "India",
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
    }

    // 2. Campus
    let [campus] = await db.select().from(campuses).limit(1);
    if (!campus) {
      [campus] = await db
        .insert(campuses)
        .values({
          institutionId: inst.id,
          name: "Main Campus",
          code: "MAIN",
          location: "Chennai",
          isActive: true,
          createdAt: now,
        })
        .returning();
    }

    // 3. Department
    let [dept] = await db.select().from(departments).limit(1);
    if (!dept) {
      [dept] = await db
        .insert(departments)
        .values({
          campusId: campus.id,
          name: "Computer Science and Engineering",
          code: "CSE",
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
    }

    // 4. Faculty / Teacher (Dr. K. Ramanathan & Prof. Priya Sharma)
    let [teacher1] = await db.select().from(faculty).limit(1);
    if (!teacher1) {
      [teacher1] = await db
        .insert(faculty)
        .values({
          userId: 1,
          employeeId: "FAC-CSE-001",
          departmentId: dept.id,
          designation: "Associate Professor",
          qualification: "Ph.D in Computer Science",
          specialization: "Software Architecture & Cloud",
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
    }

    // 5. Course
    let [course] = await db.select().from(courses).limit(1);
    if (!course) {
      [course] = await db
        .insert(courses)
        .values({
          departmentId: dept.id,
          name: "B.Tech Computer Science and Engineering",
          code: "BTECH-CSE",
          type: "ug",
          durationYears: 4,
          totalCredits: 160,
          isActive: true,
          createdAt: now,
        })
        .returning();
    }

    // 6. Semester
    let [sem] = await db.select().from(semesters).limit(1);
    if (!sem) {
      [sem] = await db
        .insert(semesters)
        .values({
          courseId: course.id,
          number: 6,
          name: "Semester 6",
          isActive: true,
          createdAt: now,
        })
        .returning();
    }

    // 7. Section
    let [sec] = await db.select().from(sections).limit(1);
    if (!sec) {
      [sec] = await db
        .insert(sections)
        .values({
          semesterId: sem.id,
          name: "CSE-A",
          room: "Room 304 (Block-A)",
          maxStudents: 60,
          isActive: true,
          createdAt: now,
        })
        .returning();
    }

    // 8. Subjects
    const initialSubjects = [
      { name: "Object Oriented Analysis & Design", code: "CS3601", credits: 4, type: "theory" as const },
      { name: "Compiler Design", code: "CS3602", credits: 4, type: "theory" as const },
      { name: "Mobile Application Development", code: "CS3603", credits: 3, type: "theory" as const },
      { name: "Cloud Computing & DevOps", code: "CS3604", credits: 3, type: "theory" as const },
      { name: "AI & Machine Learning", code: "CS3605", credits: 4, type: "theory" as const },
      { name: "Mobile App Development Lab", code: "CS3606", credits: 2, type: "lab" as const },
    ];

    const createdSubjects: any[] = [];
    for (const sub of initialSubjects) {
      const [existing] = await db.select().from(subjects).where(eq(subjects.code, sub.code));
      if (existing) {
        createdSubjects.push(existing);
      } else {
        const [newSub] = await db
          .insert(subjects)
          .values({
            semesterId: sem.id,
            name: sub.name,
            code: sub.code,
            credits: sub.credits,
            type: sub.type,
            lecturesPerWeek: 4,
            isActive: true,
            createdAt: now,
          })
          .returning();
        createdSubjects.push(newSub);
      }
    }

    // 9. Timetable Slots (Monday to Saturday, 8 periods per day = 48 slots)
    await db.delete(timetable);

    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
    const periods = [
      { number: 1, start: "08:30", end: "09:20" },
      { number: 2, start: "09:20", end: "10:10" },
      { number: 3, start: "10:30", end: "11:20" },
      { number: 4, start: "11:20", end: "12:10" },
      { number: 5, start: "01:00", end: "01:50" },
      { number: 6, start: "01:50", end: "02:40" },
      { number: 7, start: "02:40", end: "03:30" },
      { number: 8, start: "03:30", end: "04:15" },
    ];

    let subIndex = 0;
    for (const day of days) {
      for (const p of periods) {
        const sub = createdSubjects[subIndex % createdSubjects.length];
        subIndex++;
        await db.insert(timetable).values({
          sectionId: sec.id,
          subjectId: sub.id,
          facultyId: teacher1 ? teacher1.id : null,
          day,
          startTime: p.start,
          endTime: p.end,
          room: (p.number === 5 || p.number === 6) && sub.type === "lab" ? "Lab 3 (Advanced Computing)" : "Room 304",
          periodNumber: p.number,
          isActive: true,
          createdAt: now,
        });
      }
    }

    console.log("[academic-seed] ✓ Academic structure and Timetable data seeded successfully!");
  } catch (err: any) {
    console.error("[academic-seed] Error seeding academic data:", err.message);
  }
}
