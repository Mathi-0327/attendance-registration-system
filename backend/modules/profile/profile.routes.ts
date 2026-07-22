/**
 * @file backend/modules/profile/profile.routes.ts
 * @description Profile management API endpoints.
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { profileService } from "./profile.service";

// ─────────────────────────────────────────────
// VALIDATION SCHEMAS
// ─────────────────────────────────────────────

const updateProfileSchema = z.object({
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(), // ISO string from frontend
  bloodGroup: z.string().optional(),
  religion: z.string().optional(),
  category: z.string().optional(),
  nationality: z.string().default("Indian"),
  aadharNumber: z.string().optional(),
  permanentAddress: z.string().optional(),
  currentAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
  batch: z.string().optional(),
  rollNumber: z.string().optional(),
  sectionId: z.number().optional(),
  semesterId: z.number().optional(),
  admissionNumber: z.string().optional(),
  idCardNumber: z.string().optional(),
});

const updateParentSchema = z.object({
  fatherName: z.string().optional(),
  fatherOccupation: z.string().optional(),
  fatherPhone: z.string().optional(),
  fatherEmail: z.string().email().optional().or(z.literal("")),
  fatherAadhar: z.string().optional(),
  motherName: z.string().optional(),
  motherOccupation: z.string().optional(),
  motherPhone: z.string().optional(),
  motherEmail: z.string().email().optional().or(z.literal("")),
  guardianName: z.string().optional(),
  guardianRelation: z.string().optional(),
  guardianPhone: z.string().optional(),
  guardianEmail: z.string().email().optional().or(z.literal("")),
  guardianOccupation: z.string().optional(),
  guardianAddress: z.string().optional(),
  primaryContact: z.enum(["father", "mother", "guardian"]).default("father"),
  annualIncome: z.number().optional(),
});

const uploadMediaSchema = z.object({
  photo: z.string().optional(), // base64 string
  signature: z.string().optional(), // base64 string
});

// ─────────────────────────────────────────────
// ROUTER SETUP
// ─────────────────────────────────────────────

const profileRouter = Router();

// GET /api/v2/profile/student/:studentId - Get full aggregated profile
profileRouter.get("/student/:studentId", async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const profile = await profileService.getStudentProfileData(studentId);
    return res.json(profile);
  } catch (err: any) {
    const status = err.message === "Student not found" ? 404 : 500;
    return res.status(status).json({ error: err.message });
  }
});

// PUT /api/v2/profile/student/:studentId - Update extended profile details
profileRouter.put("/student/:studentId", async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }

    const { dateOfBirth, ...rest } = parsed.data;
    const updateData: any = { ...rest };
    if (dateOfBirth) {
      updateData.dateOfBirth = new Date(dateOfBirth);
    }

    const profile = await profileService.updateStudentProfile(studentId, updateData);
    return res.json({ message: "Profile updated successfully", profile });
  } catch (err: any) {
    const status = err.message === "Student not found" ? 404 : 500;
    return res.status(status).json({ error: err.message });
  }
});

// PUT /api/v2/profile/student/:studentId/parent - Update parent details
profileRouter.put("/student/:studentId/parent", async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const parsed = updateParentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }

    const parents = await profileService.updateParentDetails(studentId, parsed.data);
    return res.json({ message: "Parent details updated successfully", parents });
  } catch (err: any) {
    const status = err.message === "Student not found" ? 404 : 500;
    return res.status(status).json({ error: err.message });
  }
});

// PUT /api/v2/profile/student/:studentId/media - Upload photo / signature
profileRouter.put("/student/:studentId/media", async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const parsed = uploadMediaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }

    const profile = await profileService.uploadProfileMedia(studentId, parsed.data);
    return res.json({ message: "Profile media uploaded successfully", profile });
  } catch (err: any) {
    const status = err.message === "Student not found" ? 404 : 500;
    return res.status(status).json({ error: err.message });
  }
});

// GET /api/v2/profile/student/:studentId/idcard - Get ID card layout config & QR details
profileRouter.get("/student/:studentId/idcard", async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const profileData = await profileService.getStudentProfileData(studentId);

    // Format QR / Barcode data for identity validation
    const hostUrl = `${req.protocol}://${req.get("host")}`;
    const qrCodeValue = `${hostUrl}/attendance?studentId=${studentId}&source=id_card`;
    const barcodeValue = `STUDENT-${studentId}`;

    return res.json({
      studentId: profileData.studentId,
      name: profileData.name,
      department: profileData.department,
      photo: profileData.profile?.photo || null,
      signature: profileData.profile?.signature || null,
      bloodGroup: profileData.profile?.bloodGroup || "N/A",
      rollNumber: profileData.profile?.rollNumber || studentId,
      batch: profileData.profile?.batch || "N/A",
      emergencyContact: profileData.profile?.emergencyContactPhone || "N/A",
      qrCodeValue,
      barcodeValue,
      institution: {
        name: "AttendReg Enterprise Institute",
        code: "AREI-01",
        address: "Campus Circle, Smart City Road",
      },
    });
  } catch (err: any) {
    const status = err.message === "Student not found" ? 404 : 500;
    return res.status(status).json({ error: err.message });
  }
});

export const v2ProfileRoutes = profileRouter;
