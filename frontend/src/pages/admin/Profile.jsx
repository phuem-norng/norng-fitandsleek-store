import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../state/auth";
import api from "../../lib/api";
import { resolveImageUrl } from "../../lib/images";
import { useTheme } from "../../state/theme.jsx";
import { AdminConfirmDialog } from "../../components/admin/AdminModal.jsx";
import { AdminContentSkeleton, AdminDashboardLoader } from "@/components/admin/AdminLoading";
import AdminSaveToast, { AdminFormErrorBanner, flashAdminMessage } from "../../components/admin/AdminFormToast.jsx";
import TrustedDeviceSessionsList from "../../components/security/TrustedDeviceSessionsList.jsx";
import TwoFactorSettings from "../../components/security/TwoFactorSettings.jsx";
import { useAdminPermissions } from "../../hooks/useAdminPermissions.js";
import { getFirstAccessibleAdminPath } from "../../lib/adminPermissions.js";

export default function Profile() {
 const { user, refresh } = useAuth();
 const { user: sessionUser, can, permissionsReady } = useAdminPermissions();
 const canViewProfile = can("profile", "view");
 const canEditProfile = can("profile", "edit");
 const { primaryColor, mode } = useTheme();
 const accentColor = primaryColor;
 const [form, setForm] = useState({
 name: "",
 email: "",
 phone: "",
 address: "",
 });
 const [passwordForm, setPasswordForm] = useState({
 current_password: "",
 password: "",
 password_confirmation: "",
 });
 const [loading, setLoading] = useState(true);
 const [imageLoading, setImageLoading] = useState(false);
 const [err, setErr] = useState("");
 const [success, setSuccess] = useState("");
 const [activeTab, setActiveTab] = useState("profile");
 const [profileImage, setProfileImage] = useState(user?.profile_image_url || null);
 const [sessions, setSessions] = useState([]);
 const [sessionsLoading, setSessionsLoading] = useState(false);
 const [profileSaving, setProfileSaving] = useState(false);
 const [passwordSaving, setPasswordSaving] = useState(false);
 const [pendingSessionId, setPendingSessionId] = useState(null);
 const [sessionBusy, setSessionBusy] = useState(false);

 useEffect(() => {
 if (!user) return;
 setForm({
 name: user.name || "",
 email: user.email || "",
 phone: user.phone || "",
 address: user.address || "",
 });
 setProfileImage(user?.profile_image_url || null);
 setLoading(false);
 }, [user]);

 const loadSessions = async () => {
 setSessionsLoading(true);
 try {
 const { data } = await api.get("/auth/sessions");
 setSessions(data?.data || []);
 } catch (e) {
 setErr(e.response?.data?.message || "Failed to load active sessions");
 } finally {
 setSessionsLoading(false);
 }
 };

 useEffect(() => {
 if (activeTab === "sessions") {
 loadSessions();
 }
 }, [activeTab]);

 const revokeSession = async (sessionId) => {
 if (!canEditProfile) return;
 setPendingSessionId(sessionId);
 };

 const confirmRevokeSession = async () => {
 if (!pendingSessionId || !canEditProfile) return;
 setSessionBusy(true);
 try {
 const { data } = await api.delete(`/auth/sessions/${pendingSessionId}`);
 if (data?.current_session_revoked) {
 window.location.href = "/login";
 return;
 }
 await loadSessions();
 flashAdminMessage(setSuccess, "Session revoked successfully.");
 } catch (e) {
 setErr(e.response?.data?.message || "Failed to revoke session");
 } finally {
 setSessionBusy(false);
 setPendingSessionId(null);
 }
 };

 const handleImageUpload = async (e) => {
 if (!canEditProfile) return;
 const file = e.target.files?.[0];
 if (!file) return;

 if (!file.type.startsWith("image/")) {
 setErr("Please select an image file");
 return;
 }

 if (file.size > 5 * 1024 * 1024) {
 setErr("Image size must be less than 5MB");
 return;
 }

 setImageLoading(true);
 setErr("");
 const formData = new FormData();
 formData.append("profile_image", file);

 try {
 const { data } = await api.post("/admin/profile/upload-image", formData, {
 headers: { "Content-Type": "multipart/form-data" },
 });
 setProfileImage(data?.profile_image_url || URL.createObjectURL(file));
 await refresh();
 flashAdminMessage(setSuccess, "Profile image updated successfully.");
 } catch (e) {
 setErr(e.response?.data?.message || "Failed to upload image");
 } finally {
 setImageLoading(false);
 }
 };

 const handleProfileUpdate = async (e) => {
 e.preventDefault();
 if (!canEditProfile) return;
 setProfileSaving(true);
 setErr("");
 setSuccess("");

 try {
 await api.put("/admin/profile", form);
 await refresh();
 flashAdminMessage(setSuccess, "Profile updated successfully.");
 } catch (e) {
 setErr(e.response?.data?.message || "Failed to update profile");
 } finally {
 setProfileSaving(false);
 }
 };

 const handlePasswordUpdate = async (e) => {
 e.preventDefault();
 if (!canEditProfile) return;
 setPasswordSaving(true);
 setErr("");
 setSuccess("");

 if (passwordForm.password !== passwordForm.password_confirmation) {
 setErr("Passwords do not match");
 setPasswordSaving(false);
 return;
 }

 if (passwordForm.password.length < 8) {
 setErr("Password must be at least 8 characters");
 setPasswordSaving(false);
 return;
 }

 try {
 await api.put("/admin/profile/password", {
 current_password: passwordForm.current_password,
 password: passwordForm.password,
 });
 setPasswordForm({ current_password: "", password: "", password_confirmation: "" });
 flashAdminMessage(setSuccess, "Password updated successfully.");
 } catch (e) {
 setErr(e.response?.data?.message || "Failed to update password");
 } finally {
 setPasswordSaving(false);
 }
 };

 if (!permissionsReady || loading) return <AdminContentSkeleton lines={3} imageHeight={200} />;

 if (!canViewProfile) {
 return <Navigate to={getFirstAccessibleAdminPath(sessionUser)} replace />;
 }

 const tabButtonClass = (tabKey) =>
 `relative px-4 md:px-5 py-3 text-sm font-semibold rounded-xl transition-colors ${
 activeTab === tabKey
 ? "text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700/70"
 : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-700/40"
 }`;

 const inputClass =
 "w-full h-11 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[rgba(var(--admin-primary-rgb),0.18)] focus:border-[var(--admin-primary)] transition";

 const textAreaClass =
 "w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[rgba(var(--admin-primary-rgb),0.18)] focus:border-[var(--admin-primary)] transition";
 const displayProfileImage = profileImage
 ? (/^(blob:|data:)/i.test(profileImage) ? profileImage : resolveImageUrl(profileImage))
 : null;

 return (
 <div className="min-h-full admin-soft text-slate-800 dark:text-slate-100">
 <div className="w-full min-w-0 space-y-6">
 <AdminConfirmDialog
 open={!!pendingSessionId}
 onClose={() => {
 if (sessionBusy) return;
 setPendingSessionId(null);
 }}
 onConfirm={confirmRevokeSession}
 title="Logout this device?"
 message="This session will be revoked immediately."
 confirmLabel="Logout"
 cancelLabel="Cancel"
 destructive
 busy={sessionBusy}
 />
 <div>
 <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">My Profile</h1>
 <p className="text-slate-500 dark:text-slate-400 mt-1">
 Manage your account details, security, and active sessions.
 </p>
 </div>

 <AdminSaveToast message={success} />
 <AdminFormErrorBanner error={err} onDismiss={() => setErr("")} />

 <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
 <aside className="xl:col-span-1 space-y-6">
 <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white/95 dark:bg-slate-800/90 overflow-hidden">
 <div
 className="h-28"
 style={{
 background:
 mode === "dark"
 ? "linear-gradient(120deg, rgba(255,255,255,0.2), rgba(255,255,255,0.06))"
 : `linear-gradient(120deg, ${accentColor}, ${accentColor}cc)`,
 }}
 />
 <div className="px-6 pb-6 -mt-12">
 <div className="relative w-fit">
 <div className="w-24 h-24 rounded-2xl bg-white dark:bg-slate-900 ring-4 ring-white dark:ring-slate-800 flex items-center justify-center text-3xl font-bold text-slate-700 dark:text-slate-200 overflow-hidden ">
 {displayProfileImage ? (
 <img src={displayProfileImage} alt="Profile" className="w-full h-full object-cover" />
 ) : (
 user?.name?.charAt(0).toUpperCase() || "A"
 )}
 </div>
 {canEditProfile ? (
 <label className="absolute -bottom-2 -right-2 w-9 h-9 bg-white dark:bg-slate-700 rounded-full border border-slate-200 dark:border-slate-600 flex items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition ">
 <input
 type="file"
 accept="image/*"
 onChange={handleImageUpload}
 disabled={imageLoading}
 className="hidden"
 />
 {imageLoading ? (
 <AdminDashboardLoader size={16} />
 ) : (
 <svg className="w-4 h-4 text-slate-700 dark:text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={2}
 d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
 />
 </svg>
 )}
 </label>
 ) : null}
 </div>

 <div className="mt-4">
 <h2 className="text-xl font-bold text-slate-900 dark:text-white">{user?.name}</h2>
 <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{user?.email}</p>
 <div className="flex items-center gap-2 mt-3 flex-wrap">
 <span
 className="px-3 py-1 rounded-full text-xs font-semibold capitalize"
 style={{
 backgroundColor: mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(var(--admin-primary-rgb),0.14)",
 color: mode === "dark" ? "#ffffff" : "#0f172a",
 }}
 >
 {user?.role || "Administrator"}
 </span>
 <span className="text-xs text-slate-500 dark:text-slate-400">
 Joined {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}
 </span>
 </div>
 </div>
 </div>
 </div>

 <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 ">
 <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Account Overview</h3>
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <span className="text-sm text-slate-500 dark:text-slate-400">Profile photo</span>
 <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
 {profileImage ? "Updated" : "Not set"}
 </span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm text-slate-500 dark:text-slate-400">Active sessions</span>
 <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{sessions.length || 0}</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm text-slate-500 dark:text-slate-400">Account status</span>
 <span className="inline-flex items-center rounded-full bg-[rgba(var(--admin-primary-rgb),0.12)] text-[color:var(--admin-primary)] dark:bg-[rgba(var(--admin-primary-rgb),0.2)] px-2.5 py-1 text-xs font-semibold">
 Active
 </span>
 </div>
 </div>
 </div>
 </aside>

 <section className="xl:col-span-2 rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
 <div className="p-4 md:p-5 border-b border-slate-200 dark:border-slate-700">
 <div className="flex flex-wrap gap-2">
 <button
 onClick={() => setActiveTab("profile")}
 className={tabButtonClass("profile")}
 style={activeTab === "profile" ? { boxShadow: `inset 0 0 0 1px ${accentColor}` } : undefined}
 >
 Profile Info
 </button>
 <button
 onClick={() => setActiveTab("security")}
 className={tabButtonClass("security")}
 style={activeTab === "security" ? { boxShadow: `inset 0 0 0 1px ${accentColor}` } : undefined}
 >
 Security
 </button>
 <button
 onClick={() => setActiveTab("sessions")}
 className={tabButtonClass("sessions")}
 style={activeTab === "sessions" ? { boxShadow: `inset 0 0 0 1px ${accentColor}` } : undefined}
 >
 Active Sessions
 </button>
 </div>
 </div>

 <div className="p-5 md:p-7">
 {activeTab === "profile" && (
 <form onSubmit={handleProfileUpdate} className="max-w-2xl space-y-5">
 <div>
 <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Full Name</label>
 <input
 type="text"
 value={form.name}
 onChange={(e) => setForm({ ...form, name: e.target.value })}
 required
 readOnly={!canEditProfile}
 disabled={!canEditProfile}
 className={inputClass}
 />
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Email Address</label>
 <input
 type="email"
 value={form.email}
 onChange={(e) => setForm({ ...form, email: e.target.value })}
 required
 readOnly={!canEditProfile}
 disabled={!canEditProfile}
 className={inputClass}
 />
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Phone Number</label>
 <input
 type="text"
 value={form.phone}
 onChange={(e) => setForm({ ...form, phone: e.target.value })}
 readOnly={!canEditProfile}
 disabled={!canEditProfile}
 className={inputClass}
 placeholder="+855 12 345 678"
 />
 </div>
 <div>
 <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Display Role</label>
 <input type="text" value={user?.role || "Administrator"} disabled className={`${inputClass} opacity-75 cursor-not-allowed`} />
 </div>
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Address</label>
 <textarea
 value={form.address}
 onChange={(e) => setForm({ ...form, address: e.target.value })}
 rows={4}
 readOnly={!canEditProfile}
 disabled={!canEditProfile}
 className={textAreaClass}
 placeholder="Street, city, province, country"
 />
 </div>

 {canEditProfile ? (
 <div className="pt-2">
 <button
 type="submit"
 disabled={profileSaving}
 className="inline-flex items-center justify-center h-11 px-6 rounded-xl font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition"
 style={{
 backgroundColor: accentColor,
 color: accentColor === "#ffffff" ? "#0b0b0f" : "#ffffff",
 border: accentColor === "#ffffff" ? "1px solid rgba(15,23,42,0.25)" : "none",
 }}
 >
 {profileSaving ? "Saving..." : "Save Changes"}
 </button>
 </div>
 ) : null}
 </form>
 )}

{activeTab === "security" && (
 <div className="max-w-2xl space-y-6">
 {canEditProfile ? (
 <form onSubmit={handlePasswordUpdate} className="space-y-5">
 <div>
 <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Current Password</label>
 <input
 type="password"
 value={passwordForm.current_password}
 onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
 required
 className={inputClass}
 />
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">New Password</label>
 <input
 type="password"
 value={passwordForm.password}
 onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
 required
 minLength={8}
 className={inputClass}
 />
 <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Use at least 8 characters for better security.</p>
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Confirm New Password</label>
 <input
 type="password"
 value={passwordForm.password_confirmation}
 onChange={(e) => setPasswordForm({ ...passwordForm, password_confirmation: e.target.value })}
 required
 className={inputClass}
 />
 </div>

 <div className="pt-2">
 <button
 type="submit"
 disabled={passwordSaving}
 className="inline-flex items-center justify-center h-11 px-6 rounded-xl font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition"
 style={{
 backgroundColor: accentColor,
 color: accentColor === "#ffffff" ? "#0b0b0f" : "#ffffff",
 border: accentColor === "#ffffff" ? "1px solid rgba(15,23,42,0.25)" : "none",
 }}
 >
 {passwordSaving ? "Updating..." : "Update Password"}
 </button>
 </div>
 </form>
 ) : null}
 {canEditProfile ? <TwoFactorSettings variant="admin" accentColor={accentColor} /> : null}
 </div>
 )}

 {activeTab === "sessions" && (
 <div className="max-w-3xl">
 <h3 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white mb-2">Trusted Devices</h3>
 <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Tap the arrow on a device to see older sessions from the same machine.</p>
 {sessionsLoading ? (
 <div className="flex justify-center py-10">
 <AdminDashboardLoader />
 </div>
 ) : sessions.length === 0 ? (
 <p className="text-slate-500 dark:text-slate-400">No active sessions found.</p>
 ) : (
 <TrustedDeviceSessionsList
 sessions={sessions}
 onRevoke={revokeSession}
 canRevoke={canEditProfile}
 titleClassName="font-semibold text-slate-800 dark:text-white"
 metaClassName="text-slate-500 dark:text-slate-400"
 mutedMetaClassName="text-slate-500 dark:text-slate-400"
 cardClassName="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-700/30"
 nestedCardClassName="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-white/80 dark:bg-slate-900/50 ml-8"
 currentBadgeClassName="rounded-full px-2.5 py-1 text-xs font-semibold"
 currentBadgeStyle={{
 backgroundColor: mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(var(--admin-primary-rgb),0.14)",
 color: accentColor,
 }}
 revokeButtonClassName="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
 revokeButtonStyle={{ borderColor: accentColor, color: accentColor }}
 expandButtonClassName="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
 compactMeta
 />
 )}
 </div>
 )}
 </div>
 </section>
 </div>
 </div>
 </div>
 );
}
