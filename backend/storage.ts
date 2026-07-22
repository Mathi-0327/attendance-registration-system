/**
 * @file backend/storage.ts
 * @description Storage mediator (facade) implementing the legacy IStorage interface.
 * Delegates database calls to StudentRepository, AttendanceRepository, and UserRepository
 * to preserve backward compatibility while moving to clean repository pattern.
 */

import type {
  User,
  InsertUser,
  AttendanceRecord,
  InsertAttendance,
  Session,
  InsertSession,
  Student,
  InsertStudent
} from "@shared/schema";
import session from "express-session";
import { createRequire } from "module";
import { studentRepository } from "./modules/students/student.repository";
import { attendanceRepository } from "./modules/attendance/attendance.repository";
import { userRepository } from "./auth/auth.repository";

const require = createRequire(import.meta.url);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Student methods
  getStudent(id: number): Promise<Student | undefined>;
  getStudentById(studentId: string): Promise<Student | undefined>;
  createStudent(student: InsertStudent): Promise<Student>;
  getAllStudents(): Promise<Student[]>;
  updateStudentFace(id: number, descriptor: number[]): Promise<Student>;
  deleteStudent(id: number): Promise<boolean>;

  // Attendance methods
  createAttendanceRecord(record: InsertAttendance): Promise<AttendanceRecord>;
  getAllAttendanceRecords(): Promise<AttendanceRecord[]>;
  getAttendanceRecordById(id: number): Promise<AttendanceRecord | undefined>;
  deleteAttendanceRecord(id: number): Promise<boolean>;
  clearAllRecords(): Promise<void>;
  logFaceRecognitionAttempt(data: any): Promise<void>;

  // Session management
  getSession(id: number): Promise<Session | undefined>;
  getActiveSession(): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;
  updateSession(id: number, active: boolean, endTime?: Date): Promise<Session>;
  getAllSessions(): Promise<Session[]>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    // MemoryStore for local development session tracking
    const MemoryStore = require('memorystore')(session);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000
    });
  }

  // ─────────────────────────────────────────────
  // USER METHODS (Legacy mapping to legacy user table)
  // ─────────────────────────────────────────────

  async getUser(id: number): Promise<User | undefined> {
    return userRepository.findById(id) as any;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return userRepository.findByUsername(username) as any;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return userRepository.create({
      username: insertUser.username,
      email: `${insertUser.username.toLowerCase()}@system.local`,
      passwordHash: insertUser.password, // legacy compatibility
      name: insertUser.username,
      isActive: true,
      isEmailVerified: true,
    } as any) as any;
  }

  // ─────────────────────────────────────────────
  // STUDENT METHODS (Delegated to studentRepository)
  // ─────────────────────────────────────────────

  async getStudent(id: number): Promise<Student | undefined> {
    return studentRepository.findById(id);
  }

  async getStudentById(studentId: string): Promise<Student | undefined> {
    return studentRepository.findByStudentId(studentId);
  }

  async createStudent(student: InsertStudent): Promise<Student> {
    return studentRepository.create(student);
  }

  async getAllStudents(): Promise<Student[]> {
    return studentRepository.findAll();
  }

  async updateStudentFace(id: number, descriptor: number[]): Promise<Student> {
    return studentRepository.updateFaceDescriptor(id, descriptor);
  }

  async deleteStudent(id: number): Promise<boolean> {
    return studentRepository.delete(id);
  }

  // ─────────────────────────────────────────────
  // ATTENDANCE METHODS (Delegated to attendanceRepository)
  // ─────────────────────────────────────────────

  async createAttendanceRecord(record: InsertAttendance): Promise<AttendanceRecord> {
    return attendanceRepository.createRecord(record);
  }

  async getAllAttendanceRecords(): Promise<AttendanceRecord[]> {
    return attendanceRepository.findAllRecords();
  }

  async getAttendanceRecordById(id: number): Promise<AttendanceRecord | undefined> {
    return attendanceRepository.findRecordById(id);
  }

  async deleteAttendanceRecord(id: number): Promise<boolean> {
    return attendanceRepository.deleteRecord(id);
  }

  async clearAllRecords(): Promise<void> {
    return attendanceRepository.clearAllRecords();
  }

  async logFaceRecognitionAttempt(data: any): Promise<void> {
    return attendanceRepository.logFaceRecognitionAttempt(data);
  }

  // ─────────────────────────────────────────────
  // SESSION METHODS (Delegated to attendanceRepository)
  // ─────────────────────────────────────────────

  async getSession(id: number): Promise<Session | undefined> {
    return attendanceRepository.findSessionById(id);
  }

  async getActiveSession(): Promise<Session | undefined> {
    return attendanceRepository.getActiveSession();
  }

  async createSession(session: InsertSession): Promise<Session> {
    return attendanceRepository.createSession(session);
  }

  async updateSession(id: number, active: boolean, endTime?: Date): Promise<Session> {
    return attendanceRepository.updateSession(id, active, endTime);
  }

  async getAllSessions(): Promise<Session[]> {
    return attendanceRepository.findAllSessions();
  }
}

export const storage = new DatabaseStorage();
