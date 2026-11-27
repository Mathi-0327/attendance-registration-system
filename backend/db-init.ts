/**
 * @file backend/db-init.ts
 * @description Ensures all new schema tables exist in the SQLite database.
 * Uses CREATE TABLE IF NOT EXISTS so it's safe to run on every startup.
 * This avoids requiring drizzle-kit push or migration files.
 */

import Database from "better-sqlite3";
import path from "path";

const sqlite = new Database(path.resolve(process.cwd(), "database", "sqlite.db"));

export function initializeTables() {
  sqlite.exec(`
    -- ──────────────────────────────────────────────
    -- Phase 4: Extended Attendance Schema
    -- ──────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS student_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL UNIQUE,
      user_id INTEGER,
      photo TEXT,
      signature TEXT,
      blood_group TEXT,
      date_of_birth INTEGER,
      gender TEXT,
      religion TEXT,
      category TEXT,
      nationality TEXT DEFAULT 'Indian',
      aadhar_number TEXT,
      permanent_address TEXT,
      current_address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      emergency_contact_relation TEXT,
      batch TEXT,
      roll_number TEXT,
      section_id INTEGER,
      semester_id INTEGER,
      admission_date INTEGER,
      admission_number TEXT,
      id_card_number TEXT UNIQUE,
      qr_code TEXT,
      profile_completion INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS parent_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL UNIQUE,
      parent_name TEXT,
      relationship TEXT DEFAULT 'father',
      phone TEXT,
      email TEXT,
      alternate_phone TEXT,
      alternate_email TEXT,
      emergency_contact TEXT,
      notify_on_present INTEGER NOT NULL DEFAULT 1,
      notify_on_late INTEGER NOT NULL DEFAULT 1,
      notify_on_absent INTEGER NOT NULL DEFAULT 1,
      father_name TEXT,
      father_occupation TEXT,
      father_phone TEXT,
      father_email TEXT,
      father_aadhar TEXT,
      mother_name TEXT,
      mother_occupation TEXT,
      mother_phone TEXT,
      mother_email TEXT,
      guardian_name TEXT,
      guardian_relation TEXT,
      guardian_phone TEXT,
      guardian_email TEXT,
      guardian_occupation TEXT,
      guardian_address TEXT,
      primary_contact TEXT DEFAULT 'father',
      annual_income REAL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS face_embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      descriptor TEXT NOT NULL,
      quality_score REAL NOT NULL DEFAULT 0,
      blur_score REAL,
      brightness_score REAL,
      pose_score REAL,
      sample_index INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      captured_at INTEGER NOT NULL,
      captured_by TEXT
    );

    -- ──────────────────────────────────────────────
    -- Phase 6: Face Recognition Logs
    -- ──────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS face_recognition_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT,
      session_id INTEGER,
      confidence REAL NOT NULL,
      liveness_score REAL,
      quality_score REAL,
      is_live INTEGER,
      is_known INTEGER NOT NULL,
      multiple_faces INTEGER NOT NULL DEFAULT 0,
      anti_spoof_passed INTEGER,
      result TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      ip_address TEXT
    );

    CREATE TABLE IF NOT EXISTS attendance_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      subject_id INTEGER,
      section_id INTEGER,
      faculty_id INTEGER,
      period_number INTEGER,
      authorized_ip TEXT,
      attendance_mode TEXT NOT NULL DEFAULT 'wifi',
      geo_fence_latitude REAL,
      geo_fence_longitude REAL,
      geo_fence_radius REAL,
      allow_late_entry INTEGER NOT NULL DEFAULT 1,
      late_entry_after_minutes INTEGER NOT NULL DEFAULT 15,
      auto_close INTEGER NOT NULL DEFAULT 0,
      auto_close_after_minutes INTEGER,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      total_students INTEGER NOT NULL DEFAULT 0,
      present_count INTEGER NOT NULL DEFAULT 0,
      absent_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attendance_records_extended (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      student_id TEXT NOT NULL,
      name TEXT NOT NULL,
      subject_id INTEGER,
      department TEXT,
      status TEXT NOT NULL DEFAULT 'present',
      marked_by TEXT NOT NULL DEFAULT 'self',
      ip_address TEXT,
      device TEXT,
      latitude REAL,
      longitude REAL,
      location_accuracy REAL,
      geo_fence_status TEXT,
      confidence REAL,
      liveness_score REAL,
      is_late INTEGER NOT NULL DEFAULT 0,
      minutes_late INTEGER,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      type TEXT NOT NULL,
      from_date INTEGER NOT NULL,
      to_date INTEGER NOT NULL,
      reason TEXT NOT NULL,
      subject_ids TEXT,
      document TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by INTEGER,
      reviewed_at INTEGER,
      remarks TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attendance_corrections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      session_id INTEGER NOT NULL,
      attendance_record_id INTEGER,
      requested_by INTEGER NOT NULL,
      requested_status TEXT NOT NULL,
      current_status TEXT NOT NULL,
      reason TEXT NOT NULL,
      supporting_document TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by INTEGER,
      reviewed_at INTEGER,
      remarks TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attendance_summary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      subject_id INTEGER,
      semester_id INTEGER,
      month INTEGER,
      year INTEGER,
      total_classes INTEGER NOT NULL DEFAULT 0,
      present_count INTEGER NOT NULL DEFAULT 0,
      absent_count INTEGER NOT NULL DEFAULT 0,
      late_count INTEGER NOT NULL DEFAULT 0,
      leave_count INTEGER NOT NULL DEFAULT 0,
      attendance_percentage REAL NOT NULL DEFAULT 0,
      last_updated INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      recipient_type TEXT NOT NULL,
      recipient_name TEXT,
      recipient_contact TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'email',
      notification_type TEXT NOT NULL,
      session_id INTEGER,
      subject TEXT,
      status TEXT NOT NULL DEFAULT 'sent',
      error_message TEXT,
      sent_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS grace_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      subject_id INTEGER,
      semester_id INTEGER,
      granted_classes INTEGER NOT NULL DEFAULT 0,
      granted_by INTEGER NOT NULL,
      reason TEXT NOT NULL,
      granted_at INTEGER NOT NULL
    );
  `);

  // Safe dynamic migration for existing parent_details table
  try {
    const columns = sqlite.pragma("table_info(parent_details)") as Array<{ name: string }>;
    const existingColNames = new Set(columns.map(c => c.name));

    const newColumns: Array<{ name: string; type: string }> = [
      { name: "parent_name", type: "TEXT" },
      { name: "relationship", type: "TEXT DEFAULT 'father'" },
      { name: "phone", type: "TEXT" },
      { name: "email", type: "TEXT" },
      { name: "alternate_phone", type: "TEXT" },
      { name: "alternate_email", type: "TEXT" },
      { name: "emergency_contact", type: "TEXT" },
      { name: "notify_on_present", type: "INTEGER NOT NULL DEFAULT 1" },
      { name: "notify_on_late", type: "INTEGER NOT NULL DEFAULT 1" },
      { name: "notify_on_absent", type: "INTEGER NOT NULL DEFAULT 1" },
    ];

    for (const col of newColumns) {
      if (!existingColNames.has(col.name)) {
        sqlite.exec(`ALTER TABLE parent_details ADD COLUMN ${col.name} ${col.type}`);
      }
    }
  } catch (err: any) {
    console.warn("[db-init] parent_details migration check note:", err.message);
  }

  console.log("[db-init] All tables initialized successfully.");
}
