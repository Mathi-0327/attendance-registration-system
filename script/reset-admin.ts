/**
 * @file script/reset-admin.ts
 * @description Removes all existing admin/user accounts from the database and creates a fresh new Super Admin.
 */

import Database from "better-sqlite3";
import path from "path";
import bcrypt from "bcrypt";

const dbPath = path.resolve(process.cwd(), "database", "sqlite.db");
const sqlite = new Database(dbPath);

async function resetAdmin() {
  console.log("Cleaning up old admin and user records...");

  // Purge user tokens, roles, and records
  sqlite.prepare("DELETE FROM refresh_tokens").run();
  sqlite.prepare("DELETE FROM otp_codes").run();
  sqlite.prepare("DELETE FROM password_reset_tokens").run();
  sqlite.prepare("DELETE FROM notification_settings").run();
  sqlite.prepare("DELETE FROM user_roles").run();
  sqlite.prepare("DELETE FROM auth_users").run();

  try {
    sqlite.prepare("DELETE FROM users").run();
  } catch (e) {
    // legacy table if present
  }

  // Clear sqlite sequence for auth_users so ID restarts at 1
  try {
    sqlite.prepare("DELETE FROM sqlite_sequence WHERE name IN ('auth_users', 'user_roles', 'refresh_tokens')").run();
  } catch (e) {}

  console.log("✓ Cleared all old user and admin data.");

  // Find or verify super_admin role
  let superAdminRole = sqlite.prepare("SELECT id FROM roles WHERE name = 'super_admin'").get() as { id: number } | undefined;

  if (!superAdminRole) {
    console.log("Creating 'super_admin' role...");
    const now = Math.floor(Date.now() / 1000);
    const info = sqlite.prepare(`
      INSERT INTO roles (name, display_name, description, is_system, created_at)
      VALUES ('super_admin', 'Super Administrator', 'Full system access', 1, ?)
    `).run(now);
    superAdminRole = { id: Number(info.lastInsertRowid) };
  }

  // New admin credentials
  const username = "admin";
  const email = "admin@attendreg.edu";
  const name = "System Administrator";
  const password = "Admin@2026!";

  console.log("Hashing password...");
  const passwordHash = await bcrypt.hash(password, 12);
  const now = Math.floor(Date.now() / 1000);

  console.log("Inserting new super admin user...");
  const userInsert = sqlite.prepare(`
    INSERT INTO auth_users (
      username,
      email,
      password_hash,
      name,
      is_active,
      is_email_verified,
      is_two_factor_enabled,
      is_locked,
      failed_login_attempts,
      profile_completion,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, 1, 1, 0, 0, 0, 100, ?, ?)
  `).run(username, email, passwordHash, name, now, now);

  const newUserId = Number(userInsert.lastInsertRowid);

  console.log(`Assigning super_admin role to user ID ${newUserId}...`);
  sqlite.prepare(`
    INSERT INTO user_roles (user_id, role_id, scope_type, scope_id, granted_by, granted_at)
    VALUES (?, ?, 'global', NULL, NULL, ?)
  `).run(newUserId, superAdminRole.id, now);

  console.log("\n==========================================");
  console.log("  NEW SUPER ADMIN ACCOUNT CREATED");
  console.log("==========================================");
  console.log(`  User ID  : ${newUserId}`);
  console.log(`  Username : ${username}`);
  console.log(`  Email    : ${email}`);
  console.log(`  Name     : ${name}`);
  console.log(`  Password : ${password}`);
  console.log("==========================================\n");
}

resetAdmin().catch((err) => {
  console.error("Failed to reset admin:", err);
  process.exit(1);
});
