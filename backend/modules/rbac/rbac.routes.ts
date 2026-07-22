/**
 * @file backend/modules/rbac/rbac.routes.ts
 * @description RBAC API routes.
 * Exposes role and permission information.
 */

import { Router, type Request, type Response } from "express";
import { roleRepository } from "../../auth/auth.repository";
import { requireAdminLevel } from "../../auth/auth.middleware";

export const rbacRouter = Router();

// Protect all RBAC routes with admin-level check
rbacRouter.use(requireAdminLevel);

/**
 * @swagger
 * /api/rbac/roles:
 *   get:
 *     summary: Retrieve all roles
 *     tags: [RBAC]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of roles
 *       401:
 *         description: Unauthorized
 */
rbacRouter.get("/roles", async (_req: Request, res: Response) => {
  try {
    const rolesList = await roleRepository.findAll();
    const rolesWithPermissions: Array<typeof rolesList[number] & { permissions: string[] }> = [];

    for (const r of rolesList) {
      const perms = await roleRepository.getRolePermissions(r.id);
      rolesWithPermissions.push({
        ...r,
        permissions: perms.map((p) => p.name),
      });
    }

    res.json({ success: true, roles: rolesWithPermissions });
  } catch (error) {
    console.error("[rbac] Error fetching roles:", error);
    res.status(500).json({ error: "Failed to fetch roles" });
  }
});

/**
 * @swagger
 * /api/rbac/permissions:
 *   get:
 *     summary: Retrieve all permissions
 *     tags: [RBAC]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of permissions
 */
rbacRouter.get("/permissions", async (_req: Request, res: Response) => {
  try {
    // Import dynamically to read the DB schema table directly
    const { db } = await import("../../../database/db");
    const { permissions } = await import("../../../database/schema/auth.schema");
    const allPerms = await db.select().from(permissions);
    res.json({ success: true, permissions: allPerms });
  } catch (error) {
    console.error("[rbac] Error fetching permissions:", error);
    res.status(500).json({ error: "Failed to fetch permissions" });
  }
});
