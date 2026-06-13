import { useMemo } from "react";
import { useAuth } from "../state/auth";
import {
  adminPermissionsReady,
  canAccessAdminPath,
  getEffectiveAdminPermissions,
  hasAdminPermission,
  isSuperAdminUser,
} from "../lib/adminPermissions.js";

export function useAdminPermissions() {
  const { user, booted } = useAuth();

  return useMemo(
    () => ({
      user,
      booted,
      isSuperAdmin: isSuperAdminUser(user),
      permissionsReady: booted && adminPermissionsReady(user),
      permissions: getEffectiveAdminPermissions(user),
      can: (resource, action = "view") => hasAdminPermission(user, resource, action),
      canPath: (path) => canAccessAdminPath(user, path),
    }),
    [user, booted],
  );
}
