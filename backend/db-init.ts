/**
 * @file backend/db-init.ts
 * @description Ensures ALL schema tables exist in the SQLite database on startup.
 * Uses CREATE TABLE IF NOT EXISTS so it's safe to run on fresh deployments or existing DBs.
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

export function initializeTables() {
  const dbDir = path.resolve(process.cwd(), "database");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const sqlite = new Database(path.join(dbDir, "sqlite.db"));

  sqlite.exec(`
    -- ──────────────────────────────────────────────
    -- Core & Legacy Schema
    -- ──────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      authorized_ip TEXT,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      name TEXT NOT NULL,
      student_id TEXT NOT NULL,
      department TEXT,
      ip_address TEXT NOT NULL,
      device TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'present'
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      department TEXT,
      year TEXT,
      password TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      face_descriptor TEXT,
      face_registered INTEGER DEFAULT 0
    );

    -- ──────────────────────────────────────────────
    -- Auth, Users & RBAC Schema
    -- ──────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS auth_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      profile_photo TEXT,
      institution_id INTEGER,
      campus_id INTEGER,
      department_id INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_email_verified INTEGER NOT NULL DEFAULT 0,
      is_two_factor_enabled INTEGER NOT NULL DEFAULT 0,
      two_factor_secret TEXT,
      is_locked INTEGER NOT NULL DEFAULT 0,
      lock_reason TEXT,
      locked_until INTEGER,
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      last_failed_login_at INTEGER,
      profile_completion INTEGER NOT NULL DEFAULT 0,
      last_login_at INTEGER,
      last_login_ip TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      description TEXT,
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      resource TEXT NOT NULL,
      action TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      scope_type TEXT,
      scope_id INTEGER,
      granted_by INTEGER,
      granted_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      device_info TEXT,
      ip_address TEXT,
      expires_at INTEGER NOT NULL,
      is_revoked INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS otp_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES auth_users(id) ON DELETE CASCADE,
      email TEXT,
      code_hash TEXT NOT NULL,
      type TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      is_used INTEGER NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      is_used INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_email TEXT,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      resource_id TEXT,
      old_value TEXT,
      new_value TEXT,
      ip_address TEXT NOT NULL,
      user_agent TEXT,
      severity TEXT NOT NULL DEFAULT 'info',
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      to_email TEXT NOT NULL,
      to_name TEXT,
      cc_email TEXT,
      subject TEXT NOT NULL,
      html_body TEXT NOT NULL,
      text_body TEXT,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      scheduled_at INTEGER,
      sent_at INTEGER,
      error_message TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      email_enabled INTEGER NOT NULL DEFAULT 1,
      sms_enabled INTEGER NOT NULL DEFAULT 0,
      push_enabled INTEGER NOT NULL DEFAULT 1,
      absent_alert_enabled INTEGER NOT NULL DEFAULT 1,
      attendance_confirm_enabled INTEGER NOT NULL DEFAULT 1,
      low_attendance_enabled INTEGER NOT NULL DEFAULT 1,
      weekly_report_enabled INTEGER NOT NULL DEFAULT 1,
      monthly_report_enabled INTEGER NOT NULL DEFAULT 1,
      daily_digest_enabled INTEGER NOT NULL DEFAULT 0,
      dnd_enabled INTEGER NOT NULL DEFAULT 0,
      dnd_start_time TEXT,
      dnd_end_time TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- ──────────────────────────────────────────────
    -- Academic Schema
    -- ──────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS institutions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      logo TEXT,
      domain TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      country TEXT DEFAULT 'India',
      phone TEXT,
      email TEXT,
      website TEXT,
      type TEXT DEFAULT 'college',
      is_active INTEGER NOT NULL DEFAULT 1,
      settings TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      location TEXT,
      address TEXT,
      phone TEXT,
      email TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campus_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      hod_id INTEGER,
      phone TEXT,
      email TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS faculty (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      employee_id TEXT NOT NULL UNIQUE,
      department_id INTEGER REFERENCES departments(id),
      designation TEXT,
      qualification TEXT,
      specialization TEXT,
      experience INTEGER,
      photo TEXT,
      signature TEXT,
      blood_group TEXT,
      address TEXT,
      emergency_contact TEXT,
      join_date INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      type TEXT DEFAULT 'ug',
      duration_years INTEGER NOT NULL DEFAULT 4,
      total_credits INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS academic_years (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institution_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      start_date INTEGER NOT NULL,
      end_date INTEGER NOT NULL,
      is_current INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS semesters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      academic_year_id INTEGER REFERENCES academic_years(id),
      number INTEGER NOT NULL,
      name TEXT NOT NULL,
      start_date INTEGER,
      end_date INTEGER,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      max_students INTEGER NOT NULL DEFAULT 60,
      class_teacher_id INTEGER,
      room TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      credits INTEGER NOT NULL DEFAULT 3,
      type TEXT DEFAULT 'theory',
      lectures_per_week INTEGER NOT NULL DEFAULT 3,
      faculty_id INTEGER REFERENCES faculty(id),
      is_active INTEGER NOT NULL DEFAULT 1,
      attendance_threshold INTEGER DEFAULT 75,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS timetable (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      faculty_id INTEGER REFERENCES faculty(id),
      day TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      room TEXT,
      period_number INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS student_enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      section_id INTEGER NOT NULL REFERENCES sections(id),
      semester_id INTEGER NOT NULL REFERENCES semesters(id),
      academic_year_id INTEGER,
      roll_number TEXT,
      enrollment_date INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS faculty_subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      faculty_id INTEGER NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      section_id INTEGER REFERENCES sections(id) ON DELETE CASCADE,
      academic_year_id INTEGER,
      is_primary INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS academic_calendar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institution_id INTEGER NOT NULL,
      academic_year_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      start_date INTEGER NOT NULL,
      end_date INTEGER NOT NULL,
      is_holiday INTEGER NOT NULL DEFAULT 0,
      target_audience TEXT DEFAULT 'all',
      department_ids TEXT,
      created_at INTEGER NOT NULL
    );

    -- ──────────────────────────────────────────────
    -- Extended Attendance & Biometric Profiles
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
      total_days INTEGER NOT NULL DEFAULT 1,
      reason TEXT NOT NULL,
      subject_ids TEXT,
      document TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      approved_by INTEGER,
      approved_at INTEGER,
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
      reviewer_remarks TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attendance_predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      subject_id INTEGER,
      current_rate REAL NOT NULL,
      predicted_rate REAL NOT NULL,
      trend_direction TEXT NOT NULL,
      risk_score REAL NOT NULL DEFAULT 0,
      risk_level TEXT NOT NULL,
      recommendation TEXT,
      generated_at INTEGER NOT NULL,
      valid_until INTEGER
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

  // Safe dynamic column migrations
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

  // Safe dynamic column migrations for leave_requests
  try {
    const columns = sqlite.pragma("table_info(leave_requests)") as Array<{ name: string }>;
    const existingColNames = new Set(columns.map(c => c.name));

    const newColumns: Array<{ name: string; type: string }> = [
      { name: "total_days", type: "INTEGER NOT NULL DEFAULT 1" },
      { name: "approved_by", type: "INTEGER" },
      { name: "approved_at", type: "INTEGER" },
      { name: "reviewed_by", type: "INTEGER" },
      { name: "reviewed_at", type: "INTEGER" },
      { name: "subject_ids", type: "TEXT" },
      { name: "document", type: "TEXT" },
      { name: "remarks", type: "TEXT" },
    ];

    for (const col of newColumns) {
      if (!existingColNames.has(col.name)) {
        sqlite.exec(`ALTER TABLE leave_requests ADD COLUMN ${col.name} ${col.type}`);
      }
    }
  } catch (err: any) {
    console.warn("[db-init] leave_requests migration check note:", err.message);
  }

  // Safe dynamic column migrations for attendance_corrections
  try {
    const columns = sqlite.pragma("table_info(attendance_corrections)") as Array<{ name: string }>;
    const existingColNames = new Set(columns.map(c => c.name));

    const newColumns: Array<{ name: string; type: string }> = [
      { name: "reviewer_remarks", type: "TEXT" },
      { name: "supporting_document", type: "TEXT" },
    ];

    for (const col of newColumns) {
      if (!existingColNames.has(col.name)) {
        sqlite.exec(`ALTER TABLE attendance_corrections ADD COLUMN ${col.name} ${col.type}`);
      }
    }
  } catch (err: any) {
    console.warn("[db-init] attendance_corrections migration check note:", err.message);
  }

  console.log("[db-init] All tables initialized successfully.");
}
