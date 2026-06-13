import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Activity,
  Award,
  ChevronRight,
  KeyRound,
  LayoutDashboard,
  MapPin,
  Monitor,
  Pencil,
  Shield,
  ShoppingBag,
  Trash2,
  UserX,
} from "lucide-react";
import api from "../../lib/api";
import { useAuth } from "../../state/auth";
import { useAdminPermissions } from "../../hooks/useAdminPermissions.js";
import { getFirstAccessibleAdminPath, isSuperAdminUser } from "../../lib/adminPermissions.js";
import { resolveImageUrl } from "../../lib/images";
import { AdminContentSkeleton } from "@/components/admin/AdminLoading";
import AdminModal, { AdminConfirmDialog } from "../../components/admin/AdminModal.jsx";
import AdminPermissionsPanel from "../../components/admin/AdminPermissionsPanel.jsx";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatRelativeTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  if (months < 12) return `${months} months ago`;
  return formatDate(value);
}

function formatRoleLabel(role) {
  const normalized = String(role || "").toLowerCase().replace(/[\s-]+/g, "");
  if (normalized === "superadmin") return "Super Admin";
  if (normalized === "admin") return "Admin";
  if (normalized === "driver") return "Driver";
  if (normalized === "customer") return "Customer";
  if (!role) return "—";
  return String(role).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getInitials(name) {
  if (!name) return "?";
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function roleBadgeClass(role) {
  const normalized = String(role || "").toLowerCase().replace(/[\s-]+/g, "");
  if (normalized === "superadmin") return "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/50 dark:text-violet-200 dark:border-violet-800";
  if (normalized === "admin") return "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:border-sky-800";
  if (normalized === "driver") return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800";
  return "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:border-sky-800";
}

function statusBadgeClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "active") return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800";
  if (normalized === "suspended") return "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-200 dark:border-red-800";
  if (normalized === "inactive") return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700";
  return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700";
}

function tierBadgeClass(tier) {
  const normalized = String(tier || "").toLowerCase();
  if (normalized === "gold" || normalized === "vip") return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800";
  if (normalized === "silver") return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700";
  return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/50 dark:text-orange-200 dark:border-orange-800";
}

function formatAddressLine(address) {
  if (!address) return "—";
  const parts = [
    address.house_no ? `House ${address.house_no}` : null,
    address.street_no ? `St. ${address.street_no}` : null,
    address.sangkat,
    address.khan,
    address.province,
    address.landmark,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return [address.street, address.city, address.state, address.zip, address.country].filter(Boolean).join(", ") || "—";
}

function countPermissionStats(permissions) {
  const map = permissions?.permissions;
  if (!map || typeof map !== "object") return { enabled: 0, total: 0 };
  const values = Object.values(map);
  return { enabled: values.filter(Boolean).length, total: values.length };
}

function ActionButton({ icon: Icon, label, onClick, danger = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed " +
        (danger
          ? "border-red-300 dark:border-red-500/40 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10"
          : "border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800")
      }
    >
      <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
      {label}
    </button>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/60 p-5">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</p>
      {hint ? <p className="mt-1.5 text-sm text-slate-500">{hint}</p> : null}
    </div>
  );
}

function InfoRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-100 dark:border-slate-700/60 last:border-0">
      <span className="text-sm text-slate-500 dark:text-slate-400 shrink-0">{label}</span>
      <div className="text-sm font-medium text-slate-800 dark:text-slate-100 text-right">{children}</div>
    </div>
  );
}

function TabButton({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px " +
        (active
          ? "border-[color:var(--admin-primary)] text-slate-900 dark:text-white"
          : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200")
      }
    >
      <Icon className="w-4 h-4" strokeWidth={1.75} />
      {label}
    </button>
  );
}

const TAB_META = {
  overview: { label: "Overview", icon: LayoutDashboard },
  orders: { label: "Orders", icon: ShoppingBag },
  addresses: { label: "Addresses", icon: MapPin },
  loyalty: { label: "Loyalty", icon: Award },
  sessions: { label: "Sessions", icon: Monitor },
  activity: { label: "Activity", icon: Activity },
  permissions: { label: "Permissions", icon: Shield },
};

export default function UserProfileDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: sessionUser } = useAuth();
  const { can, permissionsReady } = useAdminPermissions();
  const isSuperAdmin = isSuperAdminUser(sessionUser);

  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState({ password: "", password_confirmation: "" });
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const targetUser = profileData?.user;
  const role = targetUser?.role;
  const isAdminTarget = role === "admin" || role === "superadmin";
  const isCustomerTarget = role === "customer" || role === "driver";

  const availableTabs = useMemo(() => {
    const tabs = ["overview"];
    if (isCustomerTarget) {
      tabs.push("orders", "addresses", "loyalty", "activity");
      if (isSuperAdmin || profileData?.sessions?.length) tabs.push("sessions");
    }
    if (isAdminTarget) {
      if (profileData?.permissions) tabs.push("permissions");
      if (isSuperAdmin && profileData?.sessions) tabs.push("sessions");
      tabs.push("activity");
    }
    return tabs;
  }, [isCustomerTarget, isAdminTarget, isSuperAdmin, profileData]);

  const activeTab = availableTabs.includes(searchParams.get("tab"))
    ? searchParams.get("tab")
    : "overview";

  const setTab = (tab) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  const listPath = isAdminTarget ? "/admin/administrators" : "/admin/customers";
  const listLabel = isAdminTarget ? "Administrators" : "Customers";

  const canView = isAdminTarget ? isSuperAdmin : can("customers", "view");
  const canEdit = isAdminTarget ? isSuperAdmin : can("customers", "edit");
  const canDelete = isAdminTarget ? isSuperAdmin : can("customers", "delete");
  const showReset = isSuperAdmin;
  const showDeactivate = isSuperAdmin;

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/admin/users/${userId}/profile`);
      setProfileData(data?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load user profile");
      setProfileData(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!permissionsReady || !canView) return;
    loadProfile();
  }, [permissionsReady, canView, loadProfile]);

  const openEdit = () => {
    if (!targetUser || !canEdit) return;
    setEditForm({
      name: targetUser.name || "",
      email: targetUser.email || "",
      phone: targetUser.phone || "",
      address: targetUser.address || "",
    });
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    if (!targetUser || !canEdit) return;
    setSaving(true);
    try {
      const url = isAdminTarget
        ? `/admin/superadmin/admin-users/${targetUser.id}`
        : `/admin/customers/${targetUser.id}`;
      if (isAdminTarget) await api.put(url, editForm);
      else await api.patch(url, editForm);
      setShowEditModal(false);
      await loadProfile();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const saveResetPassword = async () => {
    if (!targetUser || !showReset) return;
    setSaving(true);
    try {
      await api.put(`/admin/users/${targetUser.id}/password`, resetPassword);
      setShowResetModal(false);
      setResetPassword({ password: "", password_confirmation: "" });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reset password");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!targetUser || !showDeactivate) return;
    setActionBusy(true);
    try {
      await api.patch(`/admin/superadmin/users/${targetUser.id}/status`, {
        status: targetUser.status === "active" ? "inactive" : "active",
      });
      setConfirmDeactivate(false);
      await loadProfile();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update status");
    } finally {
      setActionBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!targetUser || !canDelete) return;
    setActionBusy(true);
    try {
      const url = isAdminTarget
        ? `/admin/superadmin/admin-users/${targetUser.id}`
        : `/admin/customers/${targetUser.id}`;
      await api.delete(url);
      navigate(listPath);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete user");
      setActionBusy(false);
    }
  };

  if (!permissionsReady) return <AdminContentSkeleton title="User Profile" />;
  if (!canView) return <Navigate to={getFirstAccessibleAdminPath(sessionUser)} replace />;
  if (loading && !profileData) return <AdminContentSkeleton title="User Profile" />;

  if (error && !profileData) {
    return (
      <div className="min-h-full admin-soft p-6">
        <div className="rounded-2xl border border-red-500/30 bg-slate-900 p-8 text-center max-w-lg mx-auto">
          <p className="text-red-300">{error}</p>
          <button type="button" onClick={() => navigate(listPath)} className="mt-4 px-4 py-2 rounded-lg text-white bg-[color:var(--admin-primary)]">
            Back to list
          </button>
        </div>
      </div>
    );
  }

  const stats = profileData?.stats || {};
  const loyalty = profileData?.loyalty;
  const addresses = profileData?.addresses || [];
  const recentOrders = profileData?.recent_orders || [];
  const sessions = profileData?.sessions || [];
  const activity = profileData?.activity || [];
  const permissions = profileData?.permissions;
  const permissionStats = countPermissionStats(permissions);
  const defaultAddress = addresses.find((a) => a.is_default) || addresses[0];
  const defaultCount = stats.default_addresses_count ?? (defaultAddress ? 1 : 0);
  const tierLabel = loyalty?.tier ? `${loyalty.tier.charAt(0).toUpperCase()}${loyalty.tier.slice(1)} tier` : null;

  return (
    <div className="min-h-full admin-soft text-slate-800 dark:text-slate-100">
      <div className="w-full min-w-0 max-w-6xl mx-auto">
        <nav className="flex items-center gap-2 text-sm text-slate-400 flex-wrap mb-6">
          <Link to="/admin" className="hover:text-slate-200 transition-colors">Dashboard</Link>
          <ChevronRight className="w-4 h-4 shrink-0" />
          <Link to={listPath} className="hover:text-slate-200 transition-colors">{listLabel}</Link>
          <ChevronRight className="w-4 h-4 shrink-0" />
          <span className="text-slate-800 dark:text-slate-200 font-medium">{targetUser?.name}</span>
        </nav>

        {/* Profile header card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/70 p-6 mb-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row gap-5">
              <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-2xl font-bold text-slate-700 dark:text-slate-200 overflow-hidden shrink-0">
                {targetUser?.profile_image_url ? (
                  <img src={resolveImageUrl(targetUser.profile_image_url)} alt={targetUser.name} className="w-full h-full object-cover" />
                ) : (
                  getInitials(targetUser?.name)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{targetUser?.name}</h1>
                <p className="mt-1 text-slate-600 dark:text-slate-300">{targetUser?.email}</p>
                {targetUser?.phone ? <p className="text-slate-500 dark:text-slate-400">{targetUser.phone}</p> : null}
                <p className="mt-1 text-sm text-slate-500">Joined {formatDate(targetUser?.created_at)}</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <span className={"inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold " + roleBadgeClass(targetUser?.role)}>
                    {formatRoleLabel(targetUser?.role)}
                  </span>
                  <span className={"inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold " + statusBadgeClass(targetUser?.status)}>
                    {targetUser?.status ? String(targetUser.status).replace(/\b\w/g, (c) => c.toUpperCase()) : "—"}
                  </span>
                  {tierLabel ? (
                    <span className={"inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold capitalize " + tierBadgeClass(loyalty?.tier)}>
                      {tierLabel}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/60">
              {canEdit ? <ActionButton icon={Pencil} label="Edit" onClick={openEdit} /> : null}
              {showReset ? (
                <ActionButton icon={KeyRound} label="Reset password" onClick={() => setShowResetModal(true)} />
              ) : null}
              {showDeactivate && targetUser?.role !== "superadmin" ? (
                <ActionButton
                  icon={UserX}
                  label={targetUser?.status === "active" ? "Deactivate" : "Activate"}
                  onClick={() => setConfirmDeactivate(true)}
                />
              ) : null}
              {canDelete && targetUser?.id !== sessionUser?.id ? (
                <ActionButton icon={Trash2} label="Delete" onClick={() => setConfirmDelete(true)} danger />
              ) : null}
              {isSuperAdmin && targetUser?.role === "admin" ? (
                <ActionButton icon={Shield} label="Permissions" onClick={() => setPermissionsOpen(true)} />
              ) : null}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700/80 mb-6 overflow-x-auto">
          {availableTabs.map((tabId) => {
            const meta = TAB_META[tabId];
            if (!meta) return null;
            return (
              <TabButton
                key={tabId}
                active={activeTab === tabId}
                icon={meta.icon}
                label={meta.label}
                onClick={() => setTab(tabId)}
              />
            );
          })}
        </div>

        {/* Overview */}
        {activeTab === "overview" ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard
                label="Total orders"
                value={stats.orders_count ?? 0}
                hint={stats.last_order_at ? `Last: ${formatRelativeTime(stats.last_order_at)}` : "No orders yet"}
              />
              <StatCard
                label="Total spent"
                value={`$${Number(stats.total_spent || 0).toFixed(0)}`}
                hint={
                  stats.orders_count > 0
                    ? `Avg $${Number(stats.avg_order_value || 0).toFixed(0)} / order`
                    : "—"
                }
              />
              <StatCard
                label="Loyalty points"
                value={loyalty ? loyalty.points.toLocaleString() : "—"}
                hint={loyalty?.tier ? `${loyalty.tier.charAt(0).toUpperCase()}${loyalty.tier.slice(1)} tier` : "No loyalty profile"}
              />
              <StatCard
                label="Addresses"
                value={stats.addresses_count ?? 0}
                hint={defaultCount > 0 ? `${defaultCount} default` : "None saved"}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/60 p-5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Account info</h2>
                <div className="mt-2">
                  <InfoRow label="Full name">{targetUser?.name || "—"}</InfoRow>
                  <InfoRow label="Email">{targetUser?.email || "—"}</InfoRow>
                  <InfoRow label="Phone">{targetUser?.phone || "—"}</InfoRow>
                  <InfoRow label="Status">
                    <span className={"inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold " + statusBadgeClass(targetUser?.status)}>
                      {targetUser?.status ? String(targetUser.status).replace(/\b\w/g, (c) => c.toUpperCase()) : "—"}
                    </span>
                  </InfoRow>
                  <InfoRow label="2FA">
                    <span
                      className={
                        "inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold " +
                        (targetUser?.has_two_factor
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          : "bg-slate-500/15 text-slate-400 border-slate-500/30")
                      }
                    >
                      {targetUser?.has_two_factor ? "Enabled" : "Disabled"}
                    </span>
                  </InfoRow>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/60 p-5 flex flex-col">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">Default address</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed flex-1">
                  {defaultAddress ? formatAddressLine(defaultAddress) : targetUser?.address || "No address on file"}
                </p>
                {addresses.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setTab("addresses")}
                    className="mt-4 self-start px-4 py-2 rounded-lg border border-slate-600 text-sm font-medium text-slate-200 hover:bg-slate-800 transition-colors"
                  >
                    View all addresses
                  </button>
                ) : null}
              </div>

              {isAdminTarget && permissions ? (
                <div className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-5 lg:col-span-2">
                  <h2 className="text-base font-semibold text-white mb-2">Admin access</h2>
                  <p className="text-sm text-slate-400">
                    {permissionStats.enabled} of {permissionStats.total} permissions enabled
                  </p>
                  {isSuperAdmin && targetUser?.role === "admin" ? (
                    <button type="button" onClick={() => setPermissionsOpen(true)} className="mt-3 text-sm font-medium text-[color:var(--admin-primary)] hover:underline">
                      Manage permissions
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Orders */}
        {activeTab === "orders" ? (
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/60 overflow-hidden">
            {recentOrders.length === 0 ? (
              <p className="p-10 text-center text-slate-400">No orders yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700/80">
                      <th className="px-6 py-4">Order</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Payment</th>
                      <th className="px-6 py-4">Items</th>
                      <th className="px-6 py-4">Total</th>
                      <th className="px-6 py-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {recentOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-800/40">
                        <td className="px-6 py-4">
                          <Link to={`/admin/orders?highlight=${order.id}`} className="text-sm font-medium text-[color:var(--admin-primary)] hover:underline">
                            #{order.order_number || order.id}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-sm capitalize text-slate-300">{order.status}</td>
                        <td className="px-6 py-4 text-sm capitalize text-slate-400">{order.payment_status || "—"}</td>
                        <td className="px-6 py-4 text-sm text-slate-300">{order.items_count ?? 0}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-white">${Number(order.total || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{formatDateTime(order.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {/* Addresses */}
        {activeTab === "addresses" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {addresses.length === 0 ? (
              <p className="col-span-full p-10 text-center text-slate-400 rounded-2xl border border-slate-700/80 bg-slate-900/60">No saved addresses</p>
            ) : (
              addresses.map((address) => (
                <div key={address.id} className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-5">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h3 className="font-semibold text-white">{address.label || "Address"}</h3>
                    {address.is_default ? (
                      <span className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Default</span>
                    ) : null}
                  </div>
                  <p className="text-sm text-slate-300">{formatAddressLine(address)}</p>
                </div>
              ))
            )}
          </div>
        ) : null}

        {/* Loyalty */}
        {activeTab === "loyalty" && loyalty ? (
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-6 max-w-2xl">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
              <div><dt className="text-slate-400">Current tier</dt><dd className="text-xl font-bold capitalize text-white mt-1">{loyalty.tier}</dd></div>
              <div><dt className="text-slate-400">Points balance</dt><dd className="text-xl font-bold text-white mt-1">{loyalty.points.toLocaleString()}</dd></div>
              <div><dt className="text-slate-400">Tier discount</dt><dd className="font-medium text-slate-200 mt-1">{loyalty.discount_percent}%</dd></div>
              <div><dt className="text-slate-400">Lifetime spend</dt><dd className="font-medium text-slate-200 mt-1">${Number(loyalty.lifetime_spend || 0).toFixed(2)}</dd></div>
            </dl>
          </div>
        ) : null}

        {/* Activity */}
        {activeTab === "activity" ? (
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/60 divide-y divide-slate-700/60">
            {activity.length === 0 ? (
              <p className="p-10 text-center text-slate-400">No recent activity</p>
            ) : (
              activity.map((item, idx) => (
                <div key={`${item.type}-${idx}`} className="flex items-center justify-between gap-4 px-6 py-4">
                  <div>
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {item.amount != null ? <p className="text-sm font-semibold text-white">${Number(item.amount).toFixed(2)}</p> : null}
                    <p className="text-xs text-slate-500">{formatDateTime(item.date)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}

        {/* Permissions */}
        {activeTab === "permissions" && permissions ? (
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-6">
            <p className="text-sm text-slate-400 mb-4">{permissionStats.enabled} permissions enabled out of {permissionStats.total}.</p>
            {isSuperAdmin && targetUser?.role === "admin" ? (
              <button type="button" onClick={() => setPermissionsOpen(true)} className="px-4 py-2 rounded-lg text-white bg-[color:var(--admin-primary)] font-medium">
                Open permission editor
              </button>
            ) : (
              <p className="text-sm text-slate-500">Only superadmins can edit admin permissions.</p>
            )}
          </div>
        ) : null}

        {/* Sessions */}
        {activeTab === "sessions" ? (
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/60 overflow-hidden">
            {sessions.length === 0 ? (
              <p className="p-10 text-center text-slate-400">No active sessions recorded</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700/80">
                      <th className="px-6 py-4">Device</th>
                      <th className="px-6 py-4">Browser / OS</th>
                      <th className="px-6 py-4">Location</th>
                      <th className="px-6 py-4">Last used</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {sessions.map((session) => (
                      <tr key={session.id}>
                        <td className="px-6 py-4 text-sm text-slate-200">{session.device_name || "Unknown device"}</td>
                        <td className="px-6 py-4 text-sm text-slate-400">{[session.browser, session.os].filter(Boolean).join(" · ") || "—"}</td>
                        <td className="px-6 py-4 text-sm text-slate-400">{[session.ip_city, session.ip_country].filter(Boolean).join(", ") || session.ip_address || "—"}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{formatDateTime(session.last_used_at || session.last_login_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Modals */}
      <AdminModal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit profile" titleId="user-profile-edit-title" maxWidthClass="max-w-xl">
        <div className="space-y-4">
          {["name", "email", "phone", "address"].map((field) => (
            <label key={field} className="block space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200 capitalize">
              <span>{field}</span>
              <input
                type={field === "email" ? "email" : "text"}
                value={editForm[field]}
                onChange={(e) => setEditForm((prev) => ({ ...prev, [field]: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </label>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
          <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
          <button type="button" onClick={saveEdit} disabled={saving} className="px-4 py-2 rounded-lg text-white bg-[color:var(--admin-primary)] disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
        </div>
      </AdminModal>

      <AdminModal open={showResetModal} onClose={() => setShowResetModal(false)} title="Reset password" titleId="user-reset-password-title" maxWidthClass="max-w-md">
        <div className="space-y-4">
          <label className="block space-y-2 text-sm font-medium">
            <span>New password</span>
            <input type="password" value={resetPassword.password} onChange={(e) => setResetPassword((p) => ({ ...p, password: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950" />
          </label>
          <label className="block space-y-2 text-sm font-medium">
            <span>Confirm password</span>
            <input type="password" value={resetPassword.password_confirmation} onChange={(e) => setResetPassword((p) => ({ ...p, password_confirmation: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950" />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
          <button type="button" onClick={() => setShowResetModal(false)} className="px-4 py-2 rounded-lg text-slate-700 dark:text-slate-300">Cancel</button>
          <button type="button" onClick={saveResetPassword} disabled={saving} className="px-4 py-2 rounded-lg text-white bg-[color:var(--admin-primary)] disabled:opacity-60">{saving ? "Saving…" : "Reset"}</button>
        </div>
      </AdminModal>

      <AdminConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete user"
        message={`Are you sure you want to delete ${targetUser?.name}? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        busy={actionBusy}
      />

      <AdminConfirmDialog
        open={confirmDeactivate}
        onClose={() => setConfirmDeactivate(false)}
        onConfirm={handleDeactivate}
        title={targetUser?.status === "active" ? "Deactivate user" : "Activate user"}
        message={`Change status for ${targetUser?.name}?`}
        confirmLabel={targetUser?.status === "active" ? "Deactivate" : "Activate"}
        busy={actionBusy}
      />

      <AdminPermissionsPanel
        open={permissionsOpen}
        adminUser={targetUser?.role === "admin" ? targetUser : null}
        onClose={() => setPermissionsOpen(false)}
        onSaved={() => loadProfile()}
      />
    </div>
  );
}
