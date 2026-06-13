import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AdminContentSkeleton } from "../components/admin/AdminLoading";
import { useAuth } from "../state/auth";
import {
  adminPermissionsReady,
  canAccessAdminPath,
  getFirstAccessibleAdminPath,
  isAdminRoleUser,
} from "../lib/adminPermissions.js";

export default function AdminPermissionOutlet() {
  const { user, booted } = useAuth();
  const location = useLocation();

  if (!booted || !user) {
    return <AdminContentSkeleton lines={2} imageHeight={120} className="min-h-[40vh]" />;
  }

  if (isAdminRoleUser(user) && !adminPermissionsReady(user)) {
    return <AdminContentSkeleton lines={2} imageHeight={120} className="min-h-[40vh]" />;
  }

  if (!canAccessAdminPath(user, location.pathname)) {
    const fallback = getFirstAccessibleAdminPath(user);
    return <Navigate to={fallback} replace state={{ permissionDenied: location.pathname }} />;
  }

  return <Outlet />;
}
