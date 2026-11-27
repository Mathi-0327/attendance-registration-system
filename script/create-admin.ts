/**
 * @file script/create-admin.ts
 * @description Command-line script to register or update the Super Admin user.
 */

import { db } from "../database/db";
import { authUsers, roles, userRoles } from "../database/schema/auth.schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

async function run() {
  const username = "admin";
  const email = "admin@attendreg.edu";
  const password = "Admin@2026!";
  const name = "System Administrator";

  console.log("Checking for role 'super_admin'...");
  const [adminRole] = await db.select().from(roles).where(eq(roles.name, "super_admin"));

  if (!adminRole) {
    console.error("Error: 'super_admin' role not found. Please run the server once to seed the RBAC tables first.");
    process.exit(1);
  }

  console.log("Checking if user already exists...");
  const [existingUser] = await db.select().from(authUsers).where(eq(authUsers.username, username));

  let userId: number;

  if (existingUser) {
    console.log(`User '${username}' already exists. Updating password...`);
    const passwordHash = await bcrypt.hash(password, 12);
    await db
      .update(authUsers)
      .set({
        passwordHash,
        email,
        name,
        isActive: true,
        isEmailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(authUsers.id, existingUser.id));
    userId = existingUser.id;
  } else {
    console.log(`Creating user '${username}'...`);
    const passwordHash = await bcrypt.hash(password, 12);
    const [newUser] = await db
      .insert(authUsers)
      .values({
        username,
        email,
        passwordHash,
        name,
        isActive: true,
        isEmailVerified: true,
        isTwoFactorEnabled: false,
        isLocked: false,
        failedLoginAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();
    userId = newUser.id;
  }

  // Assign super_admin role if not already assigned
  const [existingUserRole] = await db
    .select()
    .from(userRoles)
    .where(eq(userRoles.userId, userId));

  if (!existingUserRole) {
    console.log(`Assigning 'super_admin' role to user '${username}'...`);
    await db.insert(userRoles).values({
      userId,
      roleId: adminRole.id,
      scopeType: "global",
      scopeId: null,
      grantedBy: null,
      grantedAt: new Date(),
    });
  }

  console.log("\n==========================================");
  console.log("  SUPER ADMIN ACCOUNT READY");
  console.log("==========================================");
  console.log(`  Username : ${username}`);
  console.log(`  Email    : ${email}`);
  console.log(`  Name     : ${name}`);
  console.log(`  Password : ${password}`);
  console.log("==========================================\n");
}

run().catch((err) => {
  console.error("Failed to create admin:", err);
  process.exit(1);
});
