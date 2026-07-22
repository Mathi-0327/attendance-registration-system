/**
 * @file backend/modules/rbac/rbac.service.ts
 * @description RBAC authorization helper service.
 * Manages checking user permissions and roles with support for hierarchy.
 */

import { roleRepository } from "../../auth/auth.repository";
import { UserRole, Permission } from "@shared/types";

export class RBACService {
  /**
   * Check if a user has a specific permission.
   * If the user is a Super Admin, always returns true.
   */
  async hasPermission(userId: number, permission: Permission): Promise<boolean> {
    // 1. Get user roles to check for Super Admin override
    const userRoles = await roleRepository.getUserRoles(userId);
    const roleNames = userRoles.map((r) => r.name as UserRole);

    if (roleNames.includes(UserRole.SUPER_ADMIN)) {
      return true;
    }

    // 2. Query user's resolved permissions list
    const userPermissions = await roleRepository.getUserPermissions(userId);
    const permissionNames = userPermissions.map((p) => p.name as Permission);

    return permissionNames.includes(permission);
  }

  /**
   * Check if a user has at least one of the specified roles.
   */
  async hasRole(userId: number, allowedRoles: UserRole[]): Promise<boolean> {
    const userRoles = await roleRepository.getUserRoles(userId);
    const roleNames = userRoles.map((r) => r.name as UserRole);

    // Super Admin overrides role checks as well
    if (roleNames.includes(UserRole.SUPER_ADMIN)) {
      return true;
    }

    return allowedRoles.some((role) => roleNames.includes(role));
  }

  /**
   * Get all permissions assigned to a role.
   */
  async getRolePermissions(roleName: UserRole): Promise<Permission[]> {
    const role = await roleRepository.findByName(roleName);
    if (!role) return [];

    const perms = await roleRepository.getRolePermissions(role.id);
    return perms.map((p) => p.name as Permission);
  }
}

export const rbacService = new RBACService();
