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
   * Create a new student with optional or mandatory parent details.
   */
  async create(
    data: InsertLegacyStudent,
    parentData?: {
      parentName?: string;
      relationship?: string;
      phone?: string;
      email?: string;
      alternatePhone?: string;
      alternateEmail?: string;
      emergencyContact?: string;
      fatherName?: string;
      fatherPhone?: string;
      fatherEmail?: string;
      motherName?: string;
      motherPhone?: string;
      motherEmail?: string;
      guardianName?: string;
      guardianPhone?: string;
      guardianEmail?: string;
    }
  ): Promise<LegacyStudent> {
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
      profileCompletion: parentData?.parentName ? 30 : 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 3. Create parent details record with provided parent info
    const relationship = parentData?.relationship || "father";
    const parentName = parentData?.parentName || parentData?.fatherName || parentData?.motherName || parentData?.guardianName || "";
    const parentPhone = parentData?.phone || parentData?.fatherPhone || parentData?.motherPhone || parentData?.guardianPhone || "";
    const parentEmail = parentData?.email || parentData?.fatherEmail || parentData?.motherEmail || parentData?.guardianEmail || "";

    await db.insert(parentDetails).values({
      studentId: legacyStudent.studentId,
      parentName,
      relationship,
      phone: parentPhone,
      email: parentEmail,
      alternatePhone: parentData?.alternatePhone || null,
      alternateEmail: parentData?.alternateEmail || null,
      emergencyContact: parentData?.emergencyContact || null,
      fatherName: relationship === "father" ? parentName : (parentData?.fatherName || null),
      fatherPhone: relationship === "father" ? parentPhone : (parentData?.fatherPhone || null),
      fatherEmail: relationship === "father" ? parentEmail : (parentData?.fatherEmail || null),
      motherName: relationship === "mother" ? parentName : (parentData?.motherName || null),
      motherPhone: relationship === "mother" ? parentPhone : (parentData?.motherPhone || null),
      motherEmail: relationship === "mother" ? parentEmail : (parentData?.motherEmail || null),
      guardianName: (relationship === "guardian" || relationship === "other") ? parentName : (parentData?.guardianName || null),
      guardianPhone: (relationship === "guardian" || relationship === "other") ? parentPhone : (parentData?.guardianPhone || null),
      guardianEmail: (relationship === "guardian" || relationship === "other") ? parentEmail : (parentData?.guardianEmail || null),
      primaryContact: (relationship === "mother" ? "mother" : (relationship === "guardian" || relationship === "other" ? "guardian" : "father")),
      notifyOnPresent: true,
      notifyOnLate: true,
      notifyOnAbsent: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return legacyStudent;
  }

  /**
   * Get all students with their parent details and linkage status
   */
  async findAllWithParentStatus(): Promise<Array<LegacyStudent & { parentLinked: boolean; parent?: ParentDetail }>> {
    const allStudents = await this.findAll();
    const allParents = await db.select().from(parentDetails);
    const parentMap = new Map<string, ParentDetail>();
    for (const p of allParents) {
      parentMap.set(p.studentId, p);
    }

    return allStudents.map(student => {
      const parent = parentMap.get(student.studentId);
      const isLinked = !!(
        parent &&
        ((parent.parentName && (parent.phone || parent.email)) ||
         (parent.fatherName && (parent.fatherPhone || parent.fatherEmail)) ||
         (parent.motherName && (parent.motherPhone || parent.motherEmail)) ||
         (parent.guardianName && (parent.guardianPhone || parent.guardianEmail)))
      );

      return {
        ...student,
        parentLinked: isLinked,
        parent: parent || undefined,
      };
    });
  }

  /**
   * Update student basic information
   */
  async update(id: number, data: Partial<InsertLegacyStudent>): Promise<LegacyStudent> {
    const [updated] = await db
      .update(legacyStudents)
      .set({
        ...data,
      })
      .where(eq(legacyStudents.id, id))
      .returning();
    return updated;
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
   * Upsert / update parent details
   */
  async updateParentDetails(
    studentId: string,
    data: Partial<Omit<ParentDetail, "id" | "studentId" | "createdAt">>
  ): Promise<ParentDetail> {
    const existing = await this.getParentDetails(studentId);
    if (existing) {
      const [updated] = await db
        .update(parentDetails)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(parentDetails.studentId, studentId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(parentDetails)
        .values({
          studentId,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .returning();
      return created;
    }
  }
}

export const studentRepository = new StudentRepository();
