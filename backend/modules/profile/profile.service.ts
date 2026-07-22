/**
 * @file backend/modules/profile/profile.service.ts
 * @description Profile management business logic.
 * Handles fetching aggregated profile data, updates, uploading base64 media,
 * and calculating profile completion percentage.
 */

import { studentRepository } from "../students/student.repository";
import type { StudentProfile, ParentDetail } from "../../../database/schema/attendance.schema";

export interface AggregatedProfile {
  studentId: string;
  name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  year: string | null;
  createdAt: Date;
  profile: StudentProfile | null;
  parents: ParentDetail | null;
}

export class ProfileService {
  /**
   * Fetch full student details with profile and parent info.
   */
  async getStudentProfileData(studentId: string): Promise<AggregatedProfile> {
    const student = await studentRepository.findByStudentId(studentId);
    if (!student) {
      throw new Error("Student not found");
    }

    const profile = await studentRepository.getExtendedProfile(studentId);
    const parents = await studentRepository.getParentDetails(studentId);

    return {
      studentId: student.studentId,
      name: student.name,
      email: student.email,
      phone: student.phone,
      department: student.department,
      year: student.year,
      createdAt: student.createdAt,
      profile: profile || null,
      parents: parents || null,
    };
  }

  /**
   * Update student personal & address details.
   */
  async updateStudentProfile(
    studentId: string,
    profileData: Partial<Omit<StudentProfile, "id" | "studentId" | "createdAt">>
  ) {
    const student = await studentRepository.findByStudentId(studentId);
    if (!student) {
      throw new Error("Student not found");
    }

    const updatedProfile = await studentRepository.updateExtendedProfile(studentId, profileData);
    await this.refreshProfileCompletion(studentId);

    return updatedProfile;
  }

  /**
   * Update student parent/guardian details.
   */
  async updateParentDetails(
    studentId: string,
    parentData: Partial<Omit<ParentDetail, "id" | "studentId" | "createdAt">>
  ) {
    const student = await studentRepository.findByStudentId(studentId);
    if (!student) {
      throw new Error("Student not found");
    }

    const updatedParents = await studentRepository.updateParentDetails(studentId, parentData);
    await this.refreshProfileCompletion(studentId);

    return updatedParents;
  }

  /**
   * Upload profile photo or signature (Base64).
   */
  async uploadProfileMedia(
    studentId: string,
    media: { photo?: string; signature?: string }
  ) {
    const student = await studentRepository.findByStudentId(studentId);
    if (!student) {
      throw new Error("Student not found");
    }

    const updatedProfile = await studentRepository.updateExtendedProfile(studentId, media);
    await this.refreshProfileCompletion(studentId);

    return updatedProfile;
  }

  /**
   * Re-calculate and save profile completion percentage.
   */
  async refreshProfileCompletion(studentId: string): Promise<number> {
    const student = await studentRepository.findByStudentId(studentId);
    if (!student) return 0;

    const profile = await studentRepository.getExtendedProfile(studentId);
    const parents = await studentRepository.getParentDetails(studentId);

    const completion = this.calculateCompletion(student, profile, parents);

    await studentRepository.updateExtendedProfile(studentId, {
      profileCompletion: completion,
    });

    return completion;
  }

  /**
   * Dynamically calculate completion score:
   * - Student base details: 20%
   * - Photo & signature: 10%
   * - Extended profile details: 20%
   * - Address: 15%
   * - Emergency contact: 15%
   * - Parent/Guardian details: 20%
   */
  private calculateCompletion(
    student: any,
    profile: StudentProfile | undefined,
    parents: ParentDetail | undefined
  ): number {
    let score = 0;

    // 1. Student base details (Name, Email, Phone, Dept, Year)
    if (student.name) score += 4;
    if (student.email) score += 4;
    if (student.phone) score += 4;
    if (student.department) score += 4;
    if (student.year) score += 4; // Max 20

    if (!profile) return score;

    // 2. Photo & Signature
    if (profile.photo) score += 5;
    if (profile.signature) score += 5; // Max 10

    // 3. Extended Profile (Gender, DOB, Blood Group, Aadhar)
    if (profile.gender) score += 5;
    if (profile.dateOfBirth) score += 5;
    if (profile.bloodGroup) score += 5;
    if (profile.aadharNumber) score += 5; // Max 20

    // 4. Address (Street, City, Pincode)
    if (profile.permanentAddress) score += 5;
    if (profile.city) score += 5;
    if (profile.pincode) score += 5; // Max 15

    // 5. Emergency Contact (Name, Phone, Relation)
    if (profile.emergencyContactName) score += 5;
    if (profile.emergencyContactPhone) score += 5;
    if (profile.emergencyContactRelation) score += 5; // Max 15

    // 6. Parent/Guardian (Father name, Mother name, Guardian/Primary Contact details)
    if (parents) {
      if (parents.fatherName) score += 5;
      if (parents.motherName) score += 5;
      if (parents.fatherPhone || parents.motherPhone) score += 5;
      if (parents.primaryContact) score += 5; // Max 20
    }

    return Math.min(100, score);
  }
}

export const profileService = new ProfileService();
