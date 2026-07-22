/**
 * @file backend/modules/students/student.repository.ts
 * @description Repository for Student entity.
 * Handles database operations for students, integrating legacy students table
 * and new extended student profiles.
 */

import { db } from "../../../database/db";
import { eq, desc } from "drizzle-orm";
import { students as legacyStudents, type Student as LegacyStudent, type InsertStudent as InsertLegacyStudent } from "../../../database/schema";
import { studentProfiles, parentDetails, type StudentProfile, type ParentDetail } from "../../../database/schema/attendance.schema";
import { authUsers } from "../../../database/schema/auth.schema";

export class StudentRepository {
  /**
   * Find student by ID (auto-incremented primary key)
   */
  async findById(id: number): Promise<LegacyStudent | undefined> {
    const [student] = await db.select().from(legacyStudents).where(eq(legacyStudents.id, id));
    return student;
  }

  /**
   * Find student by their unique student_id string (e.g. roll number/admission number)
   */
  async findByStudentId(studentId: string): Promise<LegacyStudent | undefined> {
    const [student] = await db
      .select()
      .from(legacyStudents)
      .where(eq(legacyStudents.studentId, studentId));
    return student;
  }

  /**
   * Get all students, ordered by creation date
   */
  async findAll(): Promise<LegacyStudent[]> {
    return db.select().from(legacyStudents).orderBy(desc(legacyStudents.createdAt));
  }

  /**
   * Create a new student. Inserts into legacy students, authUsers (as a Student user),
   * and creates a studentProfile and parentDetails record.
   */
  async create(data: InsertLegacyStudent): Promise<LegacyStudent> {
    // 1. Insert into legacy students table
    const [legacyStudent] = await db
      .insert(legacyStudents)
      .values({
        ...data,
        createdAt: new Date(),
      })
      .returning();

    // 2. Also create an entry in student_profiles
    await db.insert(studentProfiles).values({
      studentId: legacyStudent.studentId,
      permanentAddress: "",
      profileCompletion: 10, // Initial completion
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 3. Create parent details placeholder
    await db.insert(parentDetails).values({
      studentId: legacyStudent.studentId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return legacyStudent;
  }

  /**
   * Update student face descriptor for legacy and advanced face matching
   */
  async updateFaceDescriptor(id: number, descriptor: number[]): Promise<LegacyStudent> {
    const [updated] = await db
      .update(legacyStudents)
      .set({
        faceDescriptor: descriptor,
        faceRegistered: true,
      })
      .where(eq(legacyStudents.id, id))
      .returning();
    return updated;
  }

  /**
   * Delete student (cascades or deletes profiles and parents manually)
   */
  async delete(id: number): Promise<boolean> {
    const student = await this.findById(id);
    if (!student) return false;

    // Delete profiles and parents associated with studentId
    await db.delete(studentProfiles).where(eq(studentProfiles.studentId, student.studentId));
    await db.delete(parentDetails).where(eq(parentDetails.studentId, student.studentId));

    // Delete legacy student
    const result = await db.delete(legacyStudents).where(eq(legacyStudents.id, id)).returning();
    return result.length > 0;
  }

  /**
   * Get extended profile by studentId
   */
  async getExtendedProfile(studentId: string): Promise<StudentProfile | undefined> {
    const [profile] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.studentId, studentId));
    return profile;
  }

  /**
   * Update extended profile
   */
  async updateExtendedProfile(
    studentId: string,
    data: Partial<Omit<StudentProfile, "id" | "studentId" | "createdAt">>
  ): Promise<StudentProfile> {
    const [updated] = await db
      .update(studentProfiles)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(studentProfiles.studentId, studentId))
      .returning();
    return updated;
  }

  /**
   * Get parent details
   */
  async getParentDetails(studentId: string): Promise<ParentDetail | undefined> {
    const [details] = await db
      .select()
      .from(parentDetails)
      .where(eq(parentDetails.studentId, studentId));
    return details;
  }

  /**
   * Update parent details
   */
  async updateParentDetails(
    studentId: string,
    data: Partial<Omit<ParentDetail, "id" | "studentId" | "createdAt">>
  ): Promise<ParentDetail> {
    const [updated] = await db
      .update(parentDetails)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(parentDetails.studentId, studentId))
      .returning();
    return updated;
  }
}

export const studentRepository = new StudentRepository();
