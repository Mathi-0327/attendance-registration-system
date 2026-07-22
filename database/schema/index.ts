/**
 * @file database/schema/index.ts
 * @description Central schema export — combines all domain schemas.
 * Backward compatible: re-exports original schema.ts tables as well.
 */

// ── Original schema (PRESERVED — backward compatible) ──
export * from "../schema"; // legacy tables: users, sessions, attendanceRecords, students

// ── New Auth Schema ──
export * from "./auth.schema";

// ── New Academic Schema ──
export * from "./academic.schema";

// ── New Attendance Schema ──
export * from "./attendance.schema";
